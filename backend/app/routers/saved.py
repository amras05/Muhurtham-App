"""
Saved muhurtas, "download my data" and "delete my account" (plan R3, step E).

  GET    /me/saved            your saved searches, favourites first
  GET    /me/saved/{id}       one, with the request to run it again
  POST   /me/saved            save a search (and the window you chose); kind muhurta, yogas or pitru
  PUT    /me/saved/{id}       rename / favourite
  DELETE /me/saved/{id}
  GET    /me/export           everything stored about you, as one JSON file
  POST   /me/delete           delete your account (password needed); same wipe as the super admin's Delete

Saved requests keep family profile ids and stars, never raw birth details (date, time, place).
"""
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.auth.crypto import verify_password
from app.auth.database import write_activity_log
from app.auth.dependencies import get_current_user
from app.auth.mobile import mask_mobile
from app.auth.permissions import require
from app.auth.sessions import hit
from app.core.config import APP_VERSION
from app.db.engine import app_engine

router = APIRouter(tags=["Saved"])

MAX_SAVED = 100
_BIRTH_KEYS = {"birth_date", "birth_time", "birth_time_unknown", "from_birth", "birth_place", "birth_lat", "birth_lon",
               "birth_tz_offset", "birth_region", "lookup"}
_REQUEST_KEYS = {"activity_id", "start_date", "days_to_scan", "lat", "lon", "tz_offset", "place_name", "panchaka_method",
                 "strictness", "rule_variant", "time_preference", "participants", "conception_date", "main_event_date",
                 "veda_shakha", "sutra", "varna", "door_facing", "plot_facing", "house_type", "origin", "destination",
                 "travel_direction", "travel_mode", "travel_purpose", "travel_exemption", "business_name", "business_type",
                 "entrance_facing", "vehicle_type", "vehicle_muhurta_type", "lunar_months"}
_WINDOW_KEYS = {"date", "window_start", "window_end", "start_time", "end_time", "verdict", "percentage", "score", "lagna_en", "lagna_te"}
# Special Yogas and Shraddha calendar searches (plan F2). A death date is kept only when the person
# chose to save it; the finder asks first and leaves it out otherwise.
_YOGA_KEYS = {"start_date", "days_to_scan", "lat", "lon", "tz_offset", "place_name", "yogas", "conditions",
              "janma_nak_idx", "janma_rasi_idx"}
_PITRU_KEYS = {"mode", "lat", "lon", "tz_offset", "place_name", "death_date", "death_time", "years", "year"}
_PITRU_MODES = ("annual", "after_death", "shannavati")


def _ip(req: Request) -> Optional[str]:
    return req.client.host if req.client else None


def _clean_request(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Only known search fields; people keep profile ids and stars, never birth date, time or place."""
    out = {k: v for k, v in raw.items() if k in _REQUEST_KEYS}
    people = []
    for p in (raw.get("participants") or [])[:12]:
        if isinstance(p, dict):
            people.append({k: v for k, v in p.items() if k not in _BIRTH_KEYS})
    out["participants"] = people
    return out


def _clean_tool_request(kind: str, raw: Dict[str, Any]) -> Dict[str, Any]:
    """Special Yogas or Shraddha calendar: only that tool's fields, checked enough to run again."""
    if kind == "yogas":
        out = {k: v for k, v in raw.items() if k in _YOGA_KEYS}
        for k in ("yogas", "conditions"):
            vals = out.get(k) or []
            if not isinstance(vals, list) or len(vals) > 40 or not all(isinstance(v, str) and len(v) <= 60 for v in vals):
                raise HTTPException(status_code=400, detail="This search can't be saved: the yoga list is not valid.")
            out[k] = vals
        if not out.get("start_date") or not (out["yogas"] or out["conditions"]):
            raise HTTPException(status_code=400, detail="This search can't be saved: the start date or the yogas are missing.")
        return out
    out = {k: v for k, v in raw.items() if k in _PITRU_KEYS}
    if out.get("mode") not in _PITRU_MODES:
        raise HTTPException(status_code=400, detail="This search can't be saved: choose what to find first.")
    if out["mode"] == "shannavati" and not out.get("year"):
        raise HTTPException(status_code=400, detail="This search can't be saved: the year is missing.")
    return out


class SaveIn(BaseModel):
    kind: str = Field("muhurta", pattern="^(muhurta|yogas|pitru)$")
    label: str = Field(..., min_length=1, max_length=120)
    request: Dict[str, Any]
    chosen_window: Optional[Dict[str, Any]] = None
    is_favourite: bool = False


class SaveEdit(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=120)
    is_favourite: Optional[bool] = None


def _row_out(r, with_request: bool = False) -> Dict[str, Any]:
    out = {"id": r.id, "kind": r.kind, "activity_id": r.activity_id, "label": r.label, "is_favourite": r.is_favourite,
           "chosen_window": r.chosen_window_json, "engine_version": r.engine_version,
           "engine_changed": r.engine_version != APP_VERSION,
           "created_at": r.created_at.isoformat(), "updated_at": r.updated_at.isoformat() if r.updated_at else None,
           "summary": {k: (r.request_json or {}).get(k) for k in ("start_date", "days_to_scan", "place_name", "mode", "year")}}
    if with_request:
        out["request"] = r.request_json
    return out


_COLS = """id::text AS id, kind, activity_id, label, request_json, chosen_window_json, engine_version, is_favourite,
           created_at, updated_at"""


def _uuid(value: str) -> str:
    import uuid
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise HTTPException(status_code=404, detail="That saved muhurta was not found.")


@router.get("/me/saved")
def list_saved(me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().connect() as c:
        rows = c.execute(text(f"""SELECT {_COLS} FROM app.saved_searches WHERE owner_id = CAST(:o AS uuid)
                                  ORDER BY is_favourite DESC, created_at DESC"""), {"o": me["id"]}).all()
    return {"saved": [_row_out(r) for r in rows], "max": MAX_SAVED, "engine_version": APP_VERSION}


@router.get("/me/saved/{saved_id}")
def get_saved(saved_id: str, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().connect() as c:
        r = c.execute(text(f"SELECT {_COLS} FROM app.saved_searches WHERE id = CAST(:i AS uuid) AND owner_id = CAST(:o AS uuid)"),
                      {"i": _uuid(saved_id), "o": me["id"]}).first()
    if not r:
        raise HTTPException(status_code=404, detail="That saved muhurta was not found.")
    return _row_out(r, with_request=True)


@router.post("/me/saved", status_code=201)
def save(body: SaveIn, req: Request, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    if body.kind == "muhurta":
        request = _clean_request(body.request)
        if not request.get("activity_id") or not request.get("start_date"):
            raise HTTPException(status_code=400, detail="This search can't be saved: the muhurta or start date is missing.")
        window = {k: v for k, v in (body.chosen_window or {}).items() if k in _WINDOW_KEYS} or None
    else:
        request, window = _clean_tool_request(body.kind, body.request), None
    activity = request.get("activity_id") if body.kind == "muhurta" else None
    if len(json.dumps(request)) > 20_000:
        raise HTTPException(status_code=400, detail="This search is too large to save.")
    with app_engine().begin() as c:
        n = c.execute(text("SELECT count(*) FROM app.saved_searches WHERE owner_id = CAST(:o AS uuid)"), {"o": me["id"]}).scalar()
        if n >= MAX_SAVED:
            raise HTTPException(status_code=400, detail=f"You can keep up to {MAX_SAVED} saved muhurtas. Delete some first.")
        r = c.execute(text(f"""
            INSERT INTO app.saved_searches (owner_id, kind, activity_id, label, request_json, chosen_window_json, engine_version, is_favourite)
            VALUES (CAST(:o AS uuid), :k, :a, :l, CAST(:rq AS jsonb), CAST(:w AS jsonb), :v, :f) RETURNING {_COLS}"""),
            {"o": me["id"], "k": body.kind, "a": activity, "l": body.label.strip(), "rq": json.dumps(request),
             "w": json.dumps(window) if window else None, "v": APP_VERSION, "f": body.is_favourite}).first()
    write_activity_log(user_id=me["id"], action="saved.add", details=activity or body.kind, ip_address=_ip(req),
                       target_type="saved", target_id=r.id)
    return _row_out(r)


@router.put("/me/saved/{saved_id}")
def edit_saved(saved_id: str, body: SaveEdit, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    sets, params = [], {"i": _uuid(saved_id), "o": me["id"]}
    if body.label is not None:
        sets.append("label = :l"); params["l"] = body.label.strip()
    if body.is_favourite is not None:
        sets.append("is_favourite = :f"); params["f"] = body.is_favourite
    if not sets:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    with app_engine().begin() as c:
        r = c.execute(text(f"UPDATE app.saved_searches SET {', '.join(sets)} WHERE id = CAST(:i AS uuid) "
                           f"AND owner_id = CAST(:o AS uuid) RETURNING {_COLS}"), params).first()
    if not r:
        raise HTTPException(status_code=404, detail="That saved muhurta was not found.")
    return _row_out(r)


@router.delete("/me/saved/{saved_id}")
def delete_saved(saved_id: str, req: Request, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().begin() as c:
        r = c.execute(text("DELETE FROM app.saved_searches WHERE id = CAST(:i AS uuid) AND owner_id = CAST(:o AS uuid) RETURNING activity_id, kind"),
                      {"i": _uuid(saved_id), "o": me["id"]}).first()
    if not r:
        raise HTTPException(status_code=404, detail="That saved muhurta was not found.")
    write_activity_log(user_id=me["id"], action="saved.remove", details=r.activity_id or r.kind, ip_address=_ip(req),
                       target_type="saved", target_id=saved_id)
    return {"id": saved_id, "removed": True}


# ── Download my data ──────────────────────────────────────────────────────────────

@router.get("/me/export")
def export(req: Request, me: dict = Depends(get_current_user)) -> JSONResponse:
    if not hit(f"export:{me['id']}", 60, 5):
        raise HTTPException(status_code=429, detail="You can download your data 5 times an hour. Please try later.")
    from app.routers.family import list_events, list_family
    with app_engine().connect() as c:
        saved = [dict(r._mapping) for r in c.execute(text(f"""
            SELECT id::text AS id, kind, activity_id, label, request_json AS request, chosen_window_json AS chosen_window,
                   engine_version, is_favourite, created_at FROM app.saved_searches WHERE owner_id = CAST(:o AS uuid)
            ORDER BY created_at"""), {"o": me["id"]})]
        activity = [dict(r._mapping) for r in c.execute(text("""
            SELECT action, details_json->>'text' AS details, created_at FROM app.audit_logs
            WHERE actor_id = CAST(:o AS uuid) ORDER BY id DESC LIMIT 1000"""), {"o": me["id"]})]
    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(), "app": "Muhurtham", "app_version": APP_VERSION,
        "account": {k: me.get(k) for k in ("id", "name", "mobile", "role", "preferred_language", "home_place", "home_lat",
                                          "home_lon", "home_tz", "created_at", "last_login_at", "login_count")},
        "family": list_family(me)["family"], "family_events": list_events(me)["events"],
        "saved_muhurtas": saved, "my_activity": activity,
    }
    write_activity_log(user_id=me["id"], action="account.export", ip_address=_ip(req), target_type="user", target_id=me["id"])
    body = json.dumps(data, ensure_ascii=False, indent=2, default=lambda v: v.isoformat() if hasattr(v, "isoformat") else str(v))
    return JSONResponse(content=json.loads(body), headers={
        "Content-Disposition": f'attachment; filename="muhurtham_my_data_{datetime.now().strftime("%Y-%m-%d")}.json"',
        "Cache-Control": "no-store"})


# ── Delete my account ─────────────────────────────────────────────────────────────

class DeleteMe(BaseModel):
    password: str = Field(..., min_length=1, max_length=200)


@router.post("/me/delete")
def delete_me(body: DeleteMe, req: Request, me: dict = Depends(get_current_user)) -> JSONResponse:
    from app.auth.web import _clear_cookies
    from app.routers.admin import wipe_account
    if me.get("role") == "super_admin":
        raise HTTPException(status_code=403, detail="The super admin account can't be deleted here. Hand over to another "
                                                    "super admin first (server command).")
    if not hit(f"delete_me:{me['id']}", 15, 5):
        raise HTTPException(status_code=429, detail="Too many tries. Please wait 15 minutes.")
    if not verify_password(body.password, me.get("password_hash") or ""):
        raise HTTPException(status_code=400, detail="Your password is not correct.")
    masked = mask_mobile(me.get("mobile"))
    n = wipe_account(me["id"], me.get("mobile"))
    write_activity_log(user_id=me["id"], action="account.self_delete",
                       details=f"Deleted their own account {masked}; {n} device(s) signed out",
                       ip_address=_ip(req), target_type="user", target_id=me["id"])
    resp = JSONResponse({"deleted": True})
    _clear_cookies(resp)
    return resp
