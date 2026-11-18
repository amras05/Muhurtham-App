"""
Super admin settings API (Super Admin Control Plan, step S1, 13 Nov 2026).

  GET  /app/config                    what pages need (brand, theme, menu, panchang, places, finder, sharing,
                                      texts, admin dashboard). Public and read-only: no secrets, no security
                                      settings, so the sign-in page can use it too.
  GET  /admin/config                  every adjustable setting with its default and labels (super admin)
  PUT  /admin/config                  {changes: {key: value}}: all checked first, then saved; each change logged
  POST /admin/config/{key}/reset      back to the default; logged
  GET  /admin/config/history          who changed what, newest first (optionally one key)
"""
import json
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import text

from app.auth.app_settings import all_settings, reset_setting, save_settings
from app.auth.config_registry import REGISTRY, meta, public_view, validate
from app.auth.database import write_activity_log
from app.auth.permissions import require
from app.db.engine import app_engine

router = APIRouter(tags=["Settings"])


def _ip(req: Request) -> Optional[str]:
    return req.client.host if req.client else None


def _short(v: Any, n: int = 400) -> str:
    s = json.dumps(v, ensure_ascii=False, sort_keys=True)
    return s if len(s) <= n else s[: n - 1] + "…"


@router.get("/app/config")
def public_config() -> Dict[str, Any]:
    return public_view(all_settings())


@router.get("/admin/config")
def get_config(boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    values = all_settings(fresh=True)
    return {"values": {k: values[k] for k in REGISTRY}, "meta": meta()}


class ConfigChanges(BaseModel):
    changes: Dict[str, Any]


@router.put("/admin/config")
def put_config(body: ConfigChanges, req: Request, boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    if not body.changes:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    checked, errors = {}, {}
    for key, value in body.changes.items():
        try:
            checked[key] = validate(key, value)
        except ValueError as e:
            errors[key] = str(e)
    if errors:   # nothing is saved unless every change is valid
        raise HTTPException(status_code=422, detail={"errors": errors})
    before = all_settings(fresh=True)
    after = save_settings(checked, boss["id"])
    for key in checked:
        if before.get(key) != after.get(key):
            write_activity_log(user_id=boss["id"], action="config.update", target_type="setting", target_id=key,
                               details=f"{key}: {_short(before.get(key))} → {_short(after.get(key))}", ip_address=_ip(req))
    return {"values": {k: after[k] for k in REGISTRY}}


@router.post("/admin/config/{key}/reset")
def reset_config(key: str, req: Request, boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    if key not in REGISTRY:
        raise HTTPException(status_code=404, detail=f"'{key}' is not an adjustable setting.")
    before = all_settings(fresh=True).get(key)
    after = reset_setting(key)
    write_activity_log(user_id=boss["id"], action="config.reset", target_type="setting", target_id=key,
                       details=f"{key}: {_short(before)} → default", ip_address=_ip(req))
    return {"values": {k: after[k] for k in REGISTRY}}


@router.get("/admin/config/history")
def config_history(key: Optional[str] = Query(None, max_length=40), limit: int = Query(50, ge=1, le=200),
                   boss: dict = Depends(require("settings.edit"))) -> Dict[str, Any]:
    where, params = ["l.action IN ('config.update', 'config.reset', 'settings.update')"], {"lim": limit}
    if key:
        where.append("l.target_id = :k"); params["k"] = key
    with app_engine().connect() as c:
        rows = c.execute(text(f"""
            SELECT l.action, l.created_at, l.target_id, u.name AS who, l.details_json->>'text' AS details
            FROM app.audit_logs l LEFT JOIN app.users u ON u.id = l.actor_id
            WHERE {' AND '.join(where)} ORDER BY l.created_at DESC LIMIT :lim"""), params).all()
    return {"items": [{"action": r.action, "at": r.created_at.isoformat() if r.created_at else None, "key": r.target_id,
                       "who": r.who or "—", "details": r.details} for r in rows]}
