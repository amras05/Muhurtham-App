"""
Admin portal (plan C3): dashboard summary and user management.

  GET  /dashboard/summary              counts, needs-attention, recent activity (admin+)
  GET  /admin/people                   users list with masked mobiles, filters (admin+)
  GET  /admin/people/{id}/mobile       full mobile; the reveal is logged (admin+)
  POST /admin/people/{id}/disable      with a reason; signs the person out everywhere
  POST /admin/people/{id}/enable

Guard rails: nobody acts on themselves; an admin acts only on users; the super admin also on
admins; nobody disables a super admin here (the last one can never be disabled).
Admins see user activity only; the super admin sees everything.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.auth.database import get_user_by_id, write_activity_log
from app.auth.mobile import mask_mobile
from app.auth.permissions import has_permission, require
from app.auth.sessions import revoke_all_sessions
from app.db.engine import app_engine

router = APIRouter(tags=["Admin"])


def _ip(req: Request) -> Optional[str]:
    return req.client.host if req.client else None


def _iso(v):
    return v.isoformat() if hasattr(v, "isoformat") else v


@router.get("/dashboard/summary")
def summary(admin: dict = Depends(require("admin.dashboard"))) -> Dict[str, Any]:
    see_all = has_permission(admin, "audit.view_all")
    with app_engine().connect() as c:
        counts = c.execute(text("""
            SELECT count(*) FILTER (WHERE status <> 'deleted' AND disabled_reason IS DISTINCT FROM 'pending_verification') AS users,
                   count(*) FILTER (WHERE status = 'active')                                              AS active,
                   count(*) FILTER (WHERE status = 'disabled' AND disabled_reason IS DISTINCT FROM 'pending_verification') AS disabled,
                   count(*) FILTER (WHERE role = 'admin' AND status <> 'deleted')                          AS admins,
                   count(*) FILTER (WHERE mobile_verified_at >= date_trunc('day', now()))                  AS new_today,
                   count(*) FILTER (WHERE mobile_verified_at >= now() - interval '7 days')                 AS new_week,
                   count(*) FILTER (WHERE last_login_at >= date_trunc('day', now()))                       AS signed_in_today,
                   count(*) FILTER (WHERE disabled_reason = 'pending_verification'
                                    AND created_at < now() - interval '1 hour')                            AS stuck_pending,
                   count(*) FILTER (WHERE locked_until > now())                                            AS locked
            FROM app.users""")).one()._mapping
        activity = c.execute(text("""
            SELECT count(*) FILTER (WHERE action = 'search.muhurta')                                       AS searches_today,
                   count(*) FILTER (WHERE action IN ('signup', 'otp_resend') AND details_json->>'text' LIKE '%: False%') AS otp_failed_today,
                   count(*) FILTER (WHERE action = 'login_failed')                                         AS failed_logins_today
            FROM app.audit_logs WHERE created_at >= date_trunc('day', now())""")).one()._mapping
        recent = c.execute(text(f"""
            SELECT l.action, l.created_at, l.actor_role, u.name AS actor_name, l.details_json->>'text' AS details
            FROM app.audit_logs l LEFT JOIN app.users u ON u.id = l.actor_id
            WHERE l.action <> 'search.muhurta' {"" if see_all else "AND (l.actor_role = 'user' OR l.actor_role IS NULL)"}
            ORDER BY l.created_at DESC LIMIT 15""")).all()
    return {
        "counts": {**{k: int(v) for k, v in counts.items()}, **{k: int(v) for k, v in activity.items()}},
        "recent": [{"action": r.action, "at": _iso(r.created_at), "who": r.actor_name or "—",
                    "role": r.actor_role, "details": r.details} for r in recent],
        "scope": "all" if see_all else "users",
    }


@router.get("/admin/people")
def people(q: Optional[str] = Query(None, max_length=80), role: Optional[str] = Query(None, pattern="^(user|admin|super_admin)$"),
           status: Optional[str] = Query(None, pattern="^(active|disabled|pending|locked)$"),
           limit: int = Query(100, ge=1, le=500), admin: dict = Depends(require("users.view"))) -> Dict[str, Any]:
    where, params = ["u.status <> 'deleted'"], {"lim": limit}
    if q:
        term = q.strip()
        digits = "".join(ch for ch in term if ch.isdigit())
        if digits and len(digits) >= 3:
            where.append("u.mobile LIKE :d"); params["d"] = f"%{digits}%"
        else:
            where.append("u.name ILIKE :n"); params["n"] = f"%{term}%"
    if role:
        where.append("u.role = :r"); params["r"] = role
    if status == "pending":
        where.append("u.disabled_reason = 'pending_verification'")
    elif status == "locked":
        where.append("u.locked_until > now()")
    elif status == "disabled":
        where.append("u.status = 'disabled' AND u.disabled_reason IS DISTINCT FROM 'pending_verification'")
    elif status == "active":
        where.append("u.status = 'active'")
    with app_engine().connect() as c:
        rows = c.execute(text(f"""
            SELECT u.id::text AS id, u.name, u.mobile, u.role, u.status, u.disabled_reason, u.created_at,
                   u.last_login_at, u.login_count, (u.locked_until > now()) AS locked,
                   (SELECT count(*) FROM app.sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now()) AS devices
            FROM app.users u WHERE {' AND '.join(where)}
            ORDER BY u.created_at DESC LIMIT :lim"""), params).all()
    out = []
    for r in rows:
        pending = r.disabled_reason == "pending_verification"
        out.append({
            "id": r.id, "name": r.name, "mobile_masked": mask_mobile(r.mobile), "role": r.role,
            "status": "pending" if pending else r.status, "disabled_reason": None if pending else r.disabled_reason,
            "locked": bool(r.locked), "devices": int(r.devices), "login_count": int(r.login_count or 0),
            "created_at": _iso(r.created_at), "last_login_at": _iso(r.last_login_at),
            "can_manage": _may_manage(admin, {"id": r.id, "role": r.role}) is None,
            "can_change_role": has_permission(admin, "users.role") and r.id != admin["id"] and r.role != "super_admin"
                               and not pending,
        })
    return {"people": out, "count": len(out)}


def _may_manage(admin: dict, target: dict) -> Optional[str]:
    """None if `admin` may disable/enable `target`, else the reason they may not."""
    if target["id"] == admin["id"]:
        return "You cannot change your own account here."
    if target["role"] == "super_admin":
        return "The super admin account cannot be disabled here."
    if target["role"] == "admin" and not has_permission(admin, "users.disable_admins"):
        return "Only the super admin can disable an admin."
    return None


def _target(user_id: str) -> dict:
    target = get_user_by_id(user_id)
    if not target or target.get("status") == "deleted":
        raise HTTPException(status_code=404, detail="No such person.")
    return target


@router.get("/admin/people/{user_id}/mobile")
def reveal_mobile(user_id: str, req: Request, admin: dict = Depends(require("users.view_mobile"))) -> Dict[str, str]:
    target = _target(user_id)
    write_activity_log(user_id=admin["id"], action="mobile.reveal", details=f"Viewed the mobile of {target['name']}",
                       ip_address=_ip(req), target_type="user", target_id=user_id)
    return {"mobile": target["mobile"]}


class DisableRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=200)


@router.post("/admin/people/{user_id}/disable")
def disable(user_id: str, body: DisableRequest, req: Request, admin: dict = Depends(require("users.disable"))) -> Dict[str, Any]:
    target = _target(user_id)
    why_not = _may_manage(admin, target)
    if why_not:
        raise HTTPException(status_code=403, detail=why_not)
    with app_engine().begin() as c:
        c.execute(text("UPDATE app.users SET status = 'disabled', disabled_reason = :r WHERE id = CAST(:i AS uuid)"),
                  {"r": body.reason.strip(), "i": user_id})
    n = revoke_all_sessions(user_id)
    write_activity_log(user_id=admin["id"], action="user.disable",
                       details=f"Disabled {target['name']}: {body.reason.strip()} ({n} device(s) signed out)",
                       ip_address=_ip(req), target_type="user", target_id=user_id)
    return {"id": user_id, "status": "disabled", "signed_out_devices": n}


@router.post("/admin/people/{user_id}/enable")
def enable(user_id: str, req: Request, admin: dict = Depends(require("users.disable"))) -> Dict[str, Any]:
    target = _target(user_id)
    why_not = _may_manage(admin, target)
    if why_not:
        raise HTTPException(status_code=403, detail=why_not)
    if not target.get("is_verified"):
        raise HTTPException(status_code=400, detail="This person has not confirmed their mobile yet; they need to finish sign-up.")
    with app_engine().begin() as c:
        c.execute(text("""UPDATE app.users SET status = 'active', disabled_reason = NULL, failed_logins = 0, locked_until = NULL
                          WHERE id = CAST(:i AS uuid)"""), {"i": user_id})
    write_activity_log(user_id=admin["id"], action="user.enable", details=f"Enabled {target['name']}",
                       ip_address=_ip(req), target_type="user", target_id=user_id)
    return {"id": user_id, "status": "active"}


# ── Super admin (plan C4) ─────────────────────────────────────────────────────

class RoleRequest(BaseModel):
    role: str = Field(..., pattern="^(user|admin)$")


@router.post("/admin/people/{user_id}/role")
def change_role(user_id: str, body: RoleRequest, req: Request, boss: dict = Depends(require("users.role"))) -> Dict[str, Any]:
    """user ⇄ admin. The super admin role itself is only ever set by the bootstrap command."""
    target = _target(user_id)
    if target["id"] == boss["id"]:
        raise HTTPException(status_code=403, detail="You cannot change your own role.")
    if target["role"] == "super_admin":
        raise HTTPException(status_code=403, detail="The super admin's role cannot be changed here.")
    if not target.get("is_verified"):
        raise HTTPException(status_code=400, detail="This person has not finished sign-up yet.")
    if target["role"] == body.role:
        return {"id": user_id, "role": body.role, "changed": False}
    with app_engine().begin() as c:
        c.execute(text("UPDATE app.users SET role = :r WHERE id = CAST(:i AS uuid)"), {"r": body.role, "i": user_id})
    write_activity_log(user_id=boss["id"], action="user.role_change",
                       details=f"{target['name']}: {target['role']} → {body.role}", ip_address=_ip(req),
                       target_type="user", target_id=user_id)
    return {"id": user_id, "role": body.role, "changed": True}


class SettingsUpdate(BaseModel):
    signup_open: Optional[bool] = None
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = Field(None, min_length=3, max_length=300)


@router.get("/admin/settings")
def get_settings_api(boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    from app.auth.app_settings import all_settings
    return all_settings(fresh=True)


@router.put("/admin/settings")
def put_settings(body: SettingsUpdate, req: Request, boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    from app.auth.app_settings import all_settings, save_settings
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    before = all_settings(fresh=True)
    after = save_settings(changes, boss["id"])
    diff = ", ".join(f"{k}: {before.get(k)} → {after.get(k)}" for k in changes if k != "maintenance_message")
    write_activity_log(user_id=boss["id"], action="settings.update", details=diff or "Updated the maintenance message",
                       ip_address=_ip(req), target_type="setting", target_id=",".join(sorted(changes)))
    return after


@router.get("/admin/system")
def system(boss: dict = Depends(require("system.view"))) -> Dict[str, Any]:
    import time
    from app.core.config import APP_ENV, APP_VERSION
    out: Dict[str, Any] = {"app_env": APP_ENV, "app_version": APP_VERSION}
    t0 = time.perf_counter()
    try:
        with app_engine().connect() as c:
            row = c.execute(text("""
                SELECT split_part(version(), ' ', 2) AS pg,
                       (SELECT version_num FROM app.alembic_version LIMIT 1) AS migration,
                       (SELECT count(*) FROM app.sessions WHERE revoked_at IS NULL AND expires_at > now()) AS sessions,
                       (SELECT count(DISTINCT user_id) FROM app.sessions WHERE revoked_at IS NULL AND expires_at > now()) AS people_signed_in,
                       (SELECT count(*) FROM app.otp_requests WHERE created_at >= date_trunc('day', now())) AS otp_today,
                       (SELECT count(*) FROM app.audit_logs) AS log_rows,
                       (SELECT count(*) FROM app.users WHERE role = 'user' AND status <> 'deleted') AS role_user,
                       (SELECT count(*) FROM app.users WHERE role = 'admin' AND status <> 'deleted') AS role_admin,
                       (SELECT count(*) FROM app.users WHERE role = 'super_admin' AND status <> 'deleted') AS role_super""")).one()
        out["database"] = {"ok": True, "latency_ms": round((time.perf_counter() - t0) * 1000), "postgres": row.pg,
                           "migration": row.migration}
        out["counts"] = {k: int(getattr(row, k)) for k in ("sessions", "people_signed_in", "otp_today", "log_rows",
                                                           "role_user", "role_admin", "role_super")}
    except Exception as ex:
        out["database"] = {"ok": False, "error": type(ex).__name__}
    import os
    out["whatsapp_configured"] = bool(os.environ.get("MUHURTHAM_WHATSAPP_TOKEN") and os.environ.get("MUHURTHAM_WHATSAPP_PHONE_NUMBER_ID"))
    out["otp_dev_echo"] = os.environ.get("MUHURTHAM_OTP_DEV_ECHO", "0") == "1"
    return out


@router.get("/admin/audit")
def audit(action: Optional[str] = Query(None, max_length=60), before: Optional[int] = Query(None, ge=1),
          limit: int = Query(50, ge=1, le=200), viewer: dict = Depends(require("audit.view_users"))) -> Dict[str, Any]:
    """Activity log, newest first; page with `before=<id>`. Admins see user events only."""
    where, params = ["true"], {"lim": limit}
    if not has_permission(viewer, "audit.view_all"):
        where.append("(l.actor_role = 'user' OR l.actor_role IS NULL)")
    if action:
        where.append("l.action = :a"); params["a"] = action
    if before:
        where.append("l.id < :b"); params["b"] = before
    with app_engine().connect() as c:
        rows = c.execute(text(f"""
            SELECT l.id, l.action, l.created_at, l.actor_role, u.name AS actor_name, l.target_type, l.target_id,
                   l.details_json->>'text' AS details, host(l.ip_address) AS ip
            FROM app.audit_logs l LEFT JOIN app.users u ON u.id = l.actor_id
            WHERE {' AND '.join(where)} ORDER BY l.id DESC LIMIT :lim"""), params).all()
        actions = [r[0] for r in c.execute(text("SELECT DISTINCT action FROM app.audit_logs ORDER BY 1"))]
    items = [{"id": r.id, "action": r.action, "at": _iso(r.created_at), "who": r.actor_name or "—", "role": r.actor_role,
              "target": r.target_type, "details": r.details, "ip": r.ip} for r in rows]
    return {"items": items, "next_before": items[-1]["id"] if len(items) == limit else None, "actions": actions}
