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

from app.auth.database import INVITED, get_user_by_id, get_user_by_phone, write_activity_log
from app.auth.mobile import normalize_mobile
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
           status: Optional[str] = Query(None, pattern="^(active|disabled|pending|invited|locked)$"),
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
    elif status == "invited":
        where.append("u.disabled_reason = 'invited'")
    elif status == "disabled":
        where.append("u.status = 'disabled' AND u.disabled_reason IS DISTINCT FROM 'pending_verification'"
                     " AND u.disabled_reason IS DISTINCT FROM 'invited'")
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
        invited = r.disabled_reason == INVITED
        out.append({
            "id": r.id, "name": r.name, "mobile_masked": mask_mobile(r.mobile), "role": r.role,
            "status": "pending" if pending else "invited" if invited else r.status,
            "disabled_reason": None if (pending or invited) else r.disabled_reason,
            "locked": bool(r.locked), "devices": int(r.devices), "login_count": int(r.login_count or 0),
            "created_at": _iso(r.created_at), "last_login_at": _iso(r.last_login_at),
            "can_manage": _may_manage(admin, {"id": r.id, "role": r.role}) is None,
            "can_change_role": has_permission(admin, "users.role") and r.id != admin["id"] and r.role != "super_admin"
                               and not pending and not invited,
            "can_edit": has_permission(admin, "users.edit") and r.id != admin["id"] and r.role != "super_admin",
            "can_delete": has_permission(admin, "users.delete") and r.id != admin["id"] and r.role != "super_admin",
        })
    return {"people": out, "count": len(out), "can_create": has_permission(admin, "users.create")}


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


class AlertChoices(BaseModel):
    signup: bool = True
    locked: bool = True
    disabled: bool = True
    daily_summary: bool = True


class SettingsUpdate(BaseModel):
    signup_open: Optional[bool] = None
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = Field(None, min_length=3, max_length=300)
    otp_sending: Optional[bool] = None                                   # plan R11
    otp_language: Optional[str] = Field(None, pattern="^(te|en)$")
    admin_alerts: Optional[AlertChoices] = None


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


# ── Managing people: add, edit, delete, several at once (plan R9) ───────────────
# Add, edit and delete are for the super admin only (decision S1). Super admin accounts are
# never edited or deleted here (that role is set only by the bootstrap command).

def _editable(boss: dict, user_id: str) -> dict:
    target = _target(user_id)
    if target["id"] == boss["id"]:
        raise HTTPException(status_code=403, detail="Use My account to change your own details.")
    if target["role"] == "super_admin":
        raise HTTPException(status_code=403, detail="The super admin account can't be changed here.")
    return target


def _mobile_or_400(raw: str) -> str:
    m = normalize_mobile(raw)
    if not m:
        raise HTTPException(status_code=400, detail="Enter a valid mobile number: 10 digits starting with 6, 7, 8 or 9, "
                                                    "or include the country code.")
    return m


class PersonCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., min_length=8, max_length=20)
    role: str = Field("user", pattern="^(user|admin)$")
    preferred_language: str = Field("te", pattern="^(te|en)$")


@router.post("/admin/people", status_code=201)
def add_person(body: PersonCreate, req: Request, boss: dict = Depends(require("users.create"))) -> Dict[str, Any]:
    """The account waits as 'invited' until the person confirms a code and sets a password
    ("Forgot password" on the login page, or signing up with the same number)."""
    mobile = _mobile_or_400(body.phone)
    if get_user_by_phone(mobile):
        raise HTTPException(status_code=409, detail="This mobile number already has an account.")
    with app_engine().begin() as c:
        new_id = c.execute(text("""
            INSERT INTO app.users (mobile, name, role, status, disabled_reason, preferred_language, created_by)
            VALUES (:m, :n, :r, 'disabled', :inv, :l, CAST(:b AS uuid)) RETURNING id::text"""),
            {"m": mobile, "n": body.name.strip(), "r": body.role, "inv": INVITED, "l": body.preferred_language,
             "b": boss["id"]}).scalar()
    write_activity_log(user_id=boss["id"], action="user.create",
                       details=f"Added {body.name.strip()} ({mask_mobile(mobile)}) as {body.role}",
                       ip_address=_ip(req), target_type="user", target_id=new_id)
    return {"id": new_id, "status": "invited"}


class PersonUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    phone: Optional[str] = Field(None, min_length=8, max_length=20)
    preferred_language: Optional[str] = Field(None, pattern="^(te|en)$")


@router.put("/admin/people/{user_id}")
def edit_person(user_id: str, body: PersonUpdate, req: Request, boss: dict = Depends(require("users.edit"))) -> Dict[str, Any]:
    target = _editable(boss, user_id)
    sets, params, changed = [], {"i": user_id}, []
    if body.name and body.name.strip() != target.get("name"):
        sets.append("name = :n"); params["n"] = body.name.strip(); changed.append("name")
    if body.preferred_language and body.preferred_language != target.get("preferred_language"):
        sets.append("preferred_language = :l"); params["l"] = body.preferred_language; changed.append("language")
    new_mobile = _mobile_or_400(body.phone) if body.phone else None
    mobile_changed = bool(new_mobile and new_mobile != target.get("mobile"))
    if mobile_changed:
        if get_user_by_phone(new_mobile):
            raise HTTPException(status_code=409, detail="This mobile number already has an account.")
        if target.get("status") == "disabled" and target.get("disabled_reason") not in (INVITED, "pending_verification"):
            raise HTTPException(status_code=400, detail="Enable this account before changing its mobile number.")
        # The new number must be confirmed by a code: the account waits as invited until then.
        sets.append("mobile = :m, mobile_verified_at = NULL, status = 'disabled', disabled_reason = :inv")
        params.update(m=new_mobile, inv=INVITED); changed.append("mobile")
    if not sets:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    with app_engine().begin() as c:
        c.execute(text(f"UPDATE app.users SET {', '.join(sets)} WHERE id = CAST(:i AS uuid)"), params)
    n = revoke_all_sessions(user_id) if mobile_changed else 0
    detail = f"Changed {', '.join(changed)} of {target['name']}"
    if mobile_changed:
        detail += f": mobile {mask_mobile(target.get('mobile'))} → {mask_mobile(new_mobile)}, {n} device(s) signed out"
    write_activity_log(user_id=boss["id"], action="user.edit", details=detail, ip_address=_ip(req),
                       target_type="user", target_id=user_id)
    return {"id": user_id, "changed": changed, "needs_confirmation": mobile_changed}


def wipe_account(user_id: str, mobile: Optional[str]) -> int:
    """Decision S2: personal details and the person's data go; the account row and the log stay.
    Used by the super admin's Delete (R9) and by "Delete my account" (R3). Returns devices signed out."""
    with app_engine().begin() as c:
        for table in ("family_events", "saved_searches", "family_profiles"):
            c.execute(text(f"DELETE FROM app.{table} WHERE owner_id = CAST(:i AS uuid)"), {"i": user_id})
        if mobile:
            c.execute(text("DELETE FROM app.otp_requests WHERE mobile = :m"), {"m": mobile})
        c.execute(text("""
            UPDATE app.users SET status = 'deleted', deleted_at = now(), name = 'Deleted account', mobile = NULL,
                   mobile_verified_at = NULL, email = NULL, password_hash = NULL, disabled_reason = NULL,
                   home_place = NULL, home_lat = NULL, home_lon = NULL, home_tz = NULL
            WHERE id = CAST(:i AS uuid)"""), {"i": user_id})
    return revoke_all_sessions(user_id)


class DeleteRequest(BaseModel):
    confirm_name: str = Field(..., min_length=1, max_length=80)


@router.post("/admin/people/{user_id}/delete")
def delete_person(user_id: str, body: DeleteRequest, req: Request, boss: dict = Depends(require("users.delete"))) -> Dict[str, Any]:
    """Decision S2: wipe the personal details and the person's data, keep the account row and the log."""
    target = _editable(boss, user_id)
    if body.confirm_name.strip().casefold() != (target.get("name") or "").strip().casefold():
        raise HTTPException(status_code=400, detail="Type the person's name exactly as shown to confirm.")
    masked = mask_mobile(target.get("mobile"))
    n = wipe_account(user_id, target.get("mobile"))
    write_activity_log(user_id=boss["id"], action="user.delete",
                       details=f"Deleted the {target['role']} account {masked}; personal details and family data removed",
                       ip_address=_ip(req), target_type="user", target_id=user_id)
    return {"id": user_id, "deleted": True, "signed_out_devices": n}


class BulkRequest(BaseModel):
    ids: List[str] = Field(..., min_length=1, max_length=100)
    action: str = Field(..., pattern="^(disable|enable)$")
    reason: Optional[str] = Field(None, min_length=3, max_length=200)


@router.post("/admin/people/bulk")
def bulk(body: BulkRequest, req: Request, admin: dict = Depends(require("users.disable"))) -> Dict[str, Any]:
    """Disable or enable several people with the same checks as one at a time."""
    if body.action == "disable" and not body.reason:
        raise HTTPException(status_code=400, detail="Give a reason for disabling.")
    done, skipped = [], []
    for uid in dict.fromkeys(body.ids):           # keep order, drop repeats
        try:
            if body.action == "disable":
                disable(uid, DisableRequest(reason=body.reason), req, admin)
            else:
                enable(uid, req, admin)
            done.append(uid)
        except HTTPException as ex:
            skipped.append({"id": uid, "why": ex.detail})
    return {"done": done, "skipped": skipped}


# ── Which muhurtas are shown (plan R12) ───────────────────────────────────────────

@router.get("/admin/catalog-visibility")
def get_catalog_visibility(boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    from app.auth import visibility
    from app.engines.muhurta_tabs import tabs_with_events
    from app.engines.rule_interpreter import list_all_rules
    rules = list_all_rules()
    by_id = {r["id"]: r for r in rules}
    vis = visibility.current()
    tabs = [{"id": t["id"], "en": t["en"], "te": t["te"], "hidden": t["id"] in vis["hidden_tabs"],
             "events": [{"id": e, "en": by_id[e]["title_en"], "te": by_id[e].get("title_te") or "",
                         "hidden": e in vis["hidden_events"], "also_in_other_tab": (by_id[e].get("tab") or by_id[e]["category"]) != t["id"],
                         "hidden_effective": visibility.event_hidden(by_id[e], vis)}
                        for e in t["events"]]}
            for t in tabs_with_events(rules)]
    tools = [{"id": k, **v, "hidden": k in vis["hidden_tools"]} for k, v in visibility.TOOLS.items()]
    return {"tabs": tabs, "tools": tools,
            "counts": {"events": len(rules), "hidden_events": sum(visibility.event_hidden(r, vis) for r in rules),
                       "hidden_tabs": len(vis["hidden_tabs"])}}


class VisibilityUpdate(BaseModel):
    hidden_tabs: List[str] = Field(default_factory=list, max_length=50)
    hidden_events: List[str] = Field(default_factory=list, max_length=500)
    hidden_tools: List[str] = Field(default_factory=list, max_length=10)


@router.put("/admin/catalog-visibility")
def put_catalog_visibility(body: VisibilityUpdate, req: Request, boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    from app.auth import visibility
    from app.auth.app_settings import save_settings
    from app.engines.muhurta_tabs import TAB_IDS
    from app.engines.rule_interpreter import list_all_rules
    event_ids = {r["id"] for r in list_all_rules()}
    unknown = ([t for t in body.hidden_tabs if t not in TAB_IDS] + [e for e in body.hidden_events if e not in event_ids]
               + [x for x in body.hidden_tools if x not in visibility.TOOLS])
    if unknown:
        raise HTTPException(status_code=400, detail="Unknown tab, muhurta or tool: " + ", ".join(sorted(set(unknown))[:10]))
    before = visibility.current()
    value = {"hidden_tabs": sorted(set(body.hidden_tabs)), "hidden_events": sorted(set(body.hidden_events)),
             "hidden_tools": sorted(set(body.hidden_tools))}
    save_settings({visibility.SETTING: value}, boss["id"])
    changes = []
    for key, label in (("hidden_tabs", "tabs"), ("hidden_events", "muhurtas"), ("hidden_tools", "tools")):
        now_hidden, was = set(value[key]), before[key]
        if now_hidden - was:
            changes.append(f"hid {label}: {', '.join(sorted(now_hidden - was))}")
        if was - now_hidden:
            changes.append(f"showed {label}: {', '.join(sorted(was - now_hidden))}")
    write_activity_log(user_id=boss["id"], action="catalog.visibility",
                       details=("; ".join(changes) or "No change")[:900], ip_address=_ip(req), target_type="catalog")
    return get_catalog_visibility(boss)


# ── Statistics (plan R10) ─────────────────────────────────────────────────────────
import time as _time
from app.core.config import APP_ENV
from app.core.logging import logger
_STARTED = _time.time()          # this worker's start; "time since the last restart"
_DAY = "(({col}) AT TIME ZONE 'Asia/Kolkata')::date"


def _ephemeris_files() -> int:
    try:
        import os
        import jhora
        d = os.path.join(os.path.dirname(jhora.__file__), "data", "ephe")
        return sum(1 for f in os.listdir(d) if f.endswith(".se1"))
    except Exception as ex:
        logger.warning(f"Ephemeris check failed: {type(ex).__name__}")
        return 0


@router.get("/admin/statistics")
def stats(days: int = Query(30, ge=7, le=90), boss: dict = Depends(require("system.view"))) -> Dict[str, Any]:
    """Day-by-day counts for the last `days` days (India time), from the users table and the activity log."""
    from datetime import timedelta
    from app.core.config import get_settings
    from app.engines.muhurta_tabs import MUHURTA_TABS
    from app.engines.rule_interpreter import list_all_rules
    p = {"d": days}
    with app_engine().connect() as c:
        today = c.execute(text("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date")).scalar()
        start = today - timedelta(days=days - 1)
        p["start"] = start

        def per_day(sql: str, params: dict = None) -> Dict[str, int]:
            return {r.day.isoformat(): int(r.n) for r in c.execute(text(sql), {**p, **(params or {})})}

        audit_sql = (f"SELECT {_DAY.format(col='created_at')} AS day, count(*) AS n FROM app.audit_logs "
                     f"WHERE action = :a AND {_DAY.format(col='created_at')} >= :start GROUP BY 1")
        series = {
            "new_accounts": per_day(f"SELECT {_DAY.format(col='created_at')} AS day, count(*) AS n FROM app.users "
                                    f"WHERE {_DAY.format(col='created_at')} >= :start GROUP BY 1"),
            "searches": per_day(audit_sql, {"a": "search.muhurta"}),
            "pdfs": per_day(audit_sql, {"a": "pdf.download"}),
            "logins": per_day(audit_sql, {"a": "login"}),
            "failed_logins": per_day(audit_sql, {"a": "login_failed"}),
            "codes_sent": per_day(f"SELECT {_DAY.format(col='created_at')} AS day, count(*) AS n FROM app.otp_requests "
                                  f"WHERE {_DAY.format(col='created_at')} >= :start GROUP BY 1"),
            "codes_confirmed": per_day(f"SELECT {_DAY.format(col='consumed_at')} AS day, count(*) AS n FROM app.otp_requests "
                                       f"WHERE consumed_at IS NOT NULL AND {_DAY.format(col='consumed_at')} >= :start GROUP BY 1"),
        }
        active = c.execute(text("""
            SELECT count(DISTINCT actor_id) FILTER (WHERE created_at > now() - interval '7 days')  AS d7,
                   count(DISTINCT actor_id) FILTER (WHERE created_at > now() - interval '30 days') AS d30
            FROM app.audit_logs WHERE actor_id IS NOT NULL AND created_at > now() - interval '30 days'""")).first()
        accounts = c.execute(text("""
            SELECT count(*) FILTER (WHERE status = 'active') AS active, count(*) FILTER (WHERE status <> 'deleted') AS total,
                   count(*) FILTER (WHERE locked_until > now()) AS locked FROM app.users""")).first()
        top = c.execute(text(f"""
            SELECT details_json->>'text' AS id, count(*) AS n FROM app.audit_logs
            WHERE action = 'search.muhurta' AND {_DAY.format(col='created_at')} >= :start
            GROUP BY 1 ORDER BY 2 DESC"""), p).all()
        pdf_kinds = {r.k: int(r.n) for r in c.execute(text(f"""
            SELECT details_json->>'text' AS k, count(*) AS n FROM app.audit_logs
            WHERE action = 'pdf.download' AND {_DAY.format(col='created_at')} >= :start GROUP BY 1"""), p)}

    dates = [(start + timedelta(days=i)).isoformat() for i in range(days)]
    rules = {r["id"]: r for r in list_all_rules()}
    tab_names = {t["id"]: t for t in MUHURTA_TABS}
    top_muhurtas, tab_counts = [], {}
    for r in top:
        rule = rules.get(r.id or "")
        if len(top_muhurtas) < 10:
            top_muhurtas.append({"id": r.id, "en": rule["title_en"] if rule else r.id, "te": (rule or {}).get("title_te") or "", "count": int(r.n)})
        tab = (rule.get("tab") or rule.get("category")) if rule else "other"
        tab_counts[tab] = tab_counts.get(tab, 0) + int(r.n)
    top_tabs = [{"id": k, "en": tab_names.get(k, {}).get("en", k), "te": tab_names.get(k, {}).get("te", k), "count": v}
                for k, v in sorted(tab_counts.items(), key=lambda kv: -kv[1])][:10]
    eph = _ephemeris_files()
    return {
        "days": days, "dates": dates,
        "series": {k: [v.get(d, 0) for d in dates] for k, v in series.items()},
        "totals": {k: sum(v.values()) for k, v in series.items()},
        "active_people": {"last_7_days": int(active.d7 or 0), "last_30_days": int(active.d30 or 0)},
        "accounts": {"active": int(accounts.active), "total": int(accounts.total), "locked_now": int(accounts.locked)},
        "top_muhurtas": top_muhurtas, "top_tabs": top_tabs, "pdf_by_kind": pdf_kinds,
        "server": {"version": get_settings().APP_VERSION, "env": APP_ENV, "uptime_seconds": int(_time.time() - _STARTED),
                   "ephemeris_files": eph, "ephemeris_ok": eph > 0},
    }


# ── Notifications (plan R11) ──────────────────────────────────────────────────────

@router.get("/admin/notifications")
def notifications(boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    """Login-code and alert settings, plus how WhatsApp is set up (never the token itself)."""
    import os
    from app.auth import sessions as S
    from app.auth.app_settings import all_settings
    from app.auth.whatsapp import OTP_DEV_ECHO, WHATSAPP_TEMPLATE_NAME
    st = all_settings(fresh=True)
    return {
        "otp_sending": st["otp_sending"], "otp_language": st["otp_language"], "admin_alerts": st["admin_alerts"],
        "whatsapp_configured": bool(os.environ.get("MUHURTHAM_WHATSAPP_TOKEN") and os.environ.get("MUHURTHAM_WHATSAPP_PHONE_NUMBER_ID")),
        "template": WHATSAPP_TEMPLATE_NAME, "dev_echo": OTP_DEV_ECHO, "sms_available": False,
        "limits": {"per_mobile_15min": S.OTP_PER_MOBILE_15MIN, "per_mobile_day": S.OTP_PER_MOBILE_DAY,
                   "per_ip_hour": S.OTP_PER_IP_HOUR, "resend_wait_seconds": S.OTP_RESEND_WAIT_SECONDS,
                   "code_minutes": 5, "wrong_passwords_before_lock": S.LOGIN_FAILS_BEFORE_LOCK,
                   "lock_minutes": S.LOGIN_LOCK_MINUTES},
    }


@router.post("/admin/notifications/test")
def notifications_test(req: Request, boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    """Send one code message to the super admin's own WhatsApp to check the set-up. The code is never stored."""
    import secrets as _secrets
    from app.auth.sessions import hit
    from app.auth.whatsapp import OTP_DEV_ECHO, send_whatsapp_otp
    if not hit(f"wa_test:{boss['id']}", 10, 3):
        raise HTTPException(status_code=429, detail="Three test messages already sent. Please wait 10 minutes.")
    mobile = (get_user_by_id(boss["id"]) or {}).get("mobile")
    if not mobile:
        raise HTTPException(status_code=400, detail="Your account has no mobile number.")
    sent = send_whatsapp_otp(mobile.lstrip("+"), f"{_secrets.randbelow(10**6):06d}")
    write_activity_log(user_id=boss["id"], action="notifications.test", details=f"Test message to {mask_mobile(mobile)}: "
                       + ("sent" if sent else "failed"), ip_address=_ip(req), target_type="setting")
    return {"sent": bool(sent), "to": mask_mobile(mobile), "dev_echo": OTP_DEV_ECHO}


@router.get("/admin/alerts")
def alerts(boss: dict = Depends(require("system.view"))) -> Dict[str, Any]:
    """The super admin's bell: last 7 days of the alerts switched on in settings, newest first."""
    from datetime import datetime, time as dtime, timedelta, timezone
    from app.auth.app_settings import get_setting
    on = {**{"signup": True, "locked": True, "disabled": True, "daily_summary": True}, **(get_setting("admin_alerts") or {})}
    actions = {"signup": ["otp_verify", "invite.accepted"], "locked": ["account.locked"], "disabled": ["user.disable"]}
    wanted = [a for k, acts in actions.items() if on.get(k) for a in acts]
    items: List[Dict[str, Any]] = []
    with app_engine().connect() as c:
        if wanted:
            rows = c.execute(text("""
                SELECT a.id, a.action, a.created_at, a.actor_role, a.details_json->>'text' AS details, u.name
                FROM app.audit_logs a LEFT JOIN app.users u ON u.id = a.actor_id
                WHERE a.action = ANY(:acts) AND a.created_at > now() - interval '7 days'
                  AND (a.action <> 'user.disable' OR a.actor_role = 'admin')
                ORDER BY a.id DESC LIMIT 30"""), {"acts": wanted}).all()
            for r in rows:
                who = r.name or "—"
                if r.action in ("otp_verify", "invite.accepted"):
                    en, te, kind = f"New account: {who}", f"కొత్త ఖాతా: {who}", "signup"
                elif r.action == "account.locked":
                    en, te, kind = f"{who} was locked out after wrong passwords", f"తప్పు పాస్‌వర్డ్‌ల వల్ల {who} ఖాతా లాక్ అయింది", "locked"
                else:
                    en, te, kind = f"Admin {who}: {r.details}", f"నిర్వాహకులు {who}: {r.details}", "disabled"
                items.append({"id": f"a{r.id}", "kind": kind, "at": _iso(r.created_at), "en": en, "te": te})
        if on.get("daily_summary"):
            ist_today = c.execute(text("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date")).scalar()
            y = ist_today - timedelta(days=1)
            day = "(created_at AT TIME ZONE 'Asia/Kolkata')::date = :y"
            n = c.execute(text(f"""
                SELECT (SELECT count(*) FROM app.users WHERE {day}) AS accounts,
                       (SELECT count(*) FROM app.audit_logs WHERE action = 'search.muhurta' AND {day}) AS searches,
                       (SELECT count(*) FROM app.audit_logs WHERE action = 'login' AND {day}) AS logins,
                       (SELECT count(*) FROM app.audit_logs WHERE action = 'pdf.download' AND {day}) AS pdfs"""), {"y": y}).first()
            at = datetime.combine(ist_today, dtime(0, 0), tzinfo=timezone(timedelta(hours=5, minutes=30)))
            items.append({"id": f"summary-{y.isoformat()}", "kind": "summary", "at": at.isoformat(),
                          "en": f"Yesterday: {n.accounts} new accounts, {n.searches} searches, {n.logins} logins, {n.pdfs} PDFs",
                          "te": f"నిన్న: {n.accounts} కొత్త ఖాతాలు, {n.searches} శోధనలు, {n.logins} లాగిన్లు, {n.pdfs} PDFలు"})
        seen = c.execute(text("SELECT alerts_seen_at FROM app.users WHERE id = CAST(:u AS uuid)"), {"u": boss["id"]}).scalar()
    items.sort(key=lambda x: x["at"], reverse=True)
    return {"items": items, "seen_at": _iso(seen)}


@router.post("/admin/alerts/seen")
def alerts_seen(boss: dict = Depends(require("system.view"))) -> Dict[str, Any]:
    """The bell was opened: remember it on the account, so every browser shows the same unread count (M4)."""
    with app_engine().begin() as c:
        seen = c.execute(text("UPDATE app.users SET alerts_seen_at = now() WHERE id = CAST(:u AS uuid) RETURNING alerts_seen_at"),
                         {"u": boss["id"]}).scalar()
    return {"seen_at": _iso(seen)}
