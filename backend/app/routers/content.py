"""
Content the admins keep (web portal plan, C5).

  Omen calendar (app.utpata_events) — feeds Mahadosha #15. Earthquakes, comets and the like
  can't be computed, so an admin records them; every muhurta window on a listed date fails #15.
  An entry may name a state (plan F2, G2): it then applies only to searches whose place is in that state.
    GET    /admin/omens              recent and upcoming entries
    POST   /admin/omens              add one
    DELETE /admin/omens/{id}         remove (kept in the table with deleted_at, for the record)

  Announcements (app.announcements) — a short notice on the home pages.
    GET    /announcements            the ones showing now, for the signed-in person's role
    GET    /admin/announcements      all of them, newest first
    POST   /admin/announcements      add one
    POST   /admin/announcements/{id}/end   stop showing it now
"""
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text

from app.auth.database import write_activity_log
from app.auth.dependencies import get_current_user
from app.auth.permissions import require
from app.db.engine import app_engine
from app.engines.limb_timeline import clear_utpata_cache
from app.geo.regions import INDIA_STATES

router = APIRouter(tags=["Content"])

OMEN_KINDS = ("earthquake", "comet", "meteor", "thunderbolt", "flood", "fire", "other")


def _ip(req: Request) -> Optional[str]:
    return req.client.host if req.client else None


def _iso(v):
    return v.isoformat() if v is not None else None


def _uuid_or_404(value: str) -> str:
    import uuid
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found.")


# ── Omen calendar ─────────────────────────────────────────────────────────────

class OmenCreate(BaseModel):
    event_date: date
    end_date: Optional[date] = None
    kind: str = Field(..., pattern="^(" + "|".join(OMEN_KINDS) + ")$")
    description_en: Optional[str] = Field(None, min_length=3, max_length=300)
    description_te: Optional[str] = Field(None, min_length=2, max_length=300)
    region: Optional[str] = Field(None, max_length=120)      # a state from INDIA_STATES, or None = everywhere (G2)
    source: str = Field(..., min_length=2, max_length=200)

    @model_validator(mode="after")
    def _check(self):
        self.region = (self.region or "").strip() or None
        if self.region and self.region not in INDIA_STATES:
            raise ValueError("Choose the state from the list, or Everywhere.")
        if self.end_date and self.end_date < self.event_date:
            raise ValueError("The end date can't be before the start date.")
        if (self.end_date or self.event_date) - self.event_date > timedelta(days=60):
            raise ValueError("An omen entry can cover at most 60 days.")
        if not (self.description_en or self.description_te):
            raise ValueError("Write what happened, in English or Telugu.")
        return self


def _omen(r) -> Dict[str, Any]:
    return {"id": str(r.id), "event_date": r.event_date.isoformat(),
            "end_date": r.end_date.isoformat() if r.end_date else None, "kind": r.kind,
            "description_en": r.description_en, "description_te": r.description_te, "region": r.region,
            "source": r.source, "added_by": r.added_by or "—", "created_at": _iso(r.created_at)}


@router.get("/admin/omens")
def list_omens(admin: dict = Depends(require("content.edit"))) -> Dict[str, Any]:
    """Entries ending within the last 90 days or later, oldest first."""
    with app_engine().connect() as c:
        rows = c.execute(text("""
            SELECT o.*, u.name AS added_by FROM app.utpata_events o
            LEFT JOIN app.users u ON u.id = o.created_by
            WHERE o.deleted_at IS NULL AND COALESCE(o.end_date, o.event_date) >= CURRENT_DATE - 90
            ORDER BY o.event_date, o.created_at""")).all()
    return {"omens": [_omen(r) for r in rows], "kinds": list(OMEN_KINDS), "states": list(INDIA_STATES)}


@router.post("/admin/omens", status_code=201)
def add_omen(body: OmenCreate, req: Request, admin: dict = Depends(require("content.edit"))) -> Dict[str, Any]:
    with app_engine().begin() as c:
        new_id = c.execute(text("""
            INSERT INTO app.utpata_events (event_date, end_date, kind, description_en, description_te, region, source, created_by)
            VALUES (:d, :e, :k, :en, :te, :r, :s, CAST(:u AS uuid)) RETURNING id"""),
            {"d": body.event_date, "e": body.end_date, "k": body.kind, "en": (body.description_en or "").strip() or None,
             "te": (body.description_te or "").strip() or None, "r": (body.region or "").strip() or None,
             "s": body.source.strip(), "u": admin["id"]}).scalar()
    clear_utpata_cache()
    span = body.event_date.isoformat() + (f" to {body.end_date.isoformat()}" if body.end_date else "")
    write_activity_log(user_id=admin["id"], action="omen.add", details=f"{body.kind} on {span}",
                       ip_address=_ip(req), target_type="omen", target_id=str(new_id))
    return {"id": str(new_id)}


@router.delete("/admin/omens/{omen_id}")
def remove_omen(omen_id: str, req: Request, admin: dict = Depends(require("content.edit"))) -> Dict[str, Any]:
    omen_id = _uuid_or_404(omen_id)
    with app_engine().begin() as c:
        row = c.execute(text("""UPDATE app.utpata_events SET deleted_at = now()
                                WHERE id = CAST(:i AS uuid) AND deleted_at IS NULL RETURNING kind, event_date"""),
                        {"i": omen_id}).first()
    if not row:
        raise HTTPException(status_code=404, detail="That omen entry was not found.")
    clear_utpata_cache()
    write_activity_log(user_id=admin["id"], action="omen.remove", details=f"{row.kind} on {row.event_date.isoformat()}",
                       ip_address=_ip(req), target_type="omen", target_id=omen_id)
    return {"id": omen_id, "removed": True}


# ── Announcements ─────────────────────────────────────────────────────────────

class AnnouncementCreate(BaseModel):
    title_en: Optional[str] = Field(None, min_length=2, max_length=120)
    title_te: Optional[str] = Field(None, min_length=2, max_length=120)
    body_en: Optional[str] = Field(None, max_length=1000)
    body_te: Optional[str] = Field(None, max_length=1000)
    audience: str = Field("all", pattern="^(all|users|admins)$")
    starts_at: Optional[datetime] = None          # default: now
    ends_at: Optional[datetime] = None            # default: shows until ended

    @model_validator(mode="after")
    def _check(self):
        if not (self.title_en or self.title_te):
            raise ValueError("Give the announcement a title, in English or Telugu.")
        for f in ("starts_at", "ends_at"):
            v = getattr(self, f)
            if v is not None and v.tzinfo is None:
                setattr(self, f, v.replace(tzinfo=timezone.utc))
        if self.ends_at and self.ends_at <= (self.starts_at or datetime.now(timezone.utc)):
            raise ValueError("The end time must be after the start time.")
        return self


def _announcement(r, now: datetime) -> Dict[str, Any]:
    showing = r.starts_at <= now and (r.ends_at is None or r.ends_at > now)
    return {"id": str(r.id), "title_en": r.title_en, "title_te": r.title_te, "body_en": r.body_en, "body_te": r.body_te,
            "audience": r.audience, "starts_at": _iso(r.starts_at), "ends_at": _iso(r.ends_at),
            "status": "showing" if showing else ("scheduled" if r.starts_at > now else "ended"),
            "added_by": getattr(r, "added_by", None) or "—"}


@router.get("/announcements")
def current_announcements(current_user: dict = Depends(get_current_user)) -> Dict[str, List[Dict[str, Any]]]:
    audiences = ["all", "admins"] if current_user.get("role") in ("admin", "super_admin") else ["all", "users"]
    with app_engine().connect() as c:
        now = c.execute(text("SELECT now()")).scalar()
        rows = c.execute(text("""
            SELECT * FROM app.announcements
            WHERE audience = ANY(:a) AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
            ORDER BY starts_at DESC LIMIT 5"""), {"a": audiences}).all()
    return {"announcements": [_announcement(r, now) for r in rows]}


@router.get("/admin/announcements")
def list_announcements(admin: dict = Depends(require("content.edit"))) -> Dict[str, Any]:
    with app_engine().connect() as c:
        now = c.execute(text("SELECT now()")).scalar()
        rows = c.execute(text("""
            SELECT a.*, u.name AS added_by FROM app.announcements a LEFT JOIN app.users u ON u.id = a.created_by
            ORDER BY a.starts_at DESC LIMIT 50""")).all()
    return {"announcements": [_announcement(r, now) for r in rows]}


@router.post("/admin/announcements", status_code=201)
def add_announcement(body: AnnouncementCreate, req: Request, admin: dict = Depends(require("content.edit"))) -> Dict[str, Any]:
    clean = lambda s: (s or "").strip() or None   # noqa: E731
    with app_engine().begin() as c:
        new_id = c.execute(text("""
            INSERT INTO app.announcements (title_en, title_te, body_en, body_te, audience, starts_at, ends_at, created_by)
            VALUES (:te1, :tt, :be, :bt, :a, COALESCE(:s, now()), :e, CAST(:u AS uuid)) RETURNING id"""),
            {"te1": clean(body.title_en), "tt": clean(body.title_te), "be": clean(body.body_en), "bt": clean(body.body_te),
             "a": body.audience, "s": body.starts_at, "e": body.ends_at, "u": admin["id"]}).scalar()
    write_activity_log(user_id=admin["id"], action="announcement.add",
                       details=f"{clean(body.title_en) or clean(body.title_te)} (for {body.audience})",
                       ip_address=_ip(req), target_type="announcement", target_id=str(new_id))
    return {"id": str(new_id)}


@router.post("/admin/announcements/{ann_id}/end")
def end_announcement(ann_id: str, req: Request, admin: dict = Depends(require("content.edit"))) -> Dict[str, Any]:
    ann_id = _uuid_or_404(ann_id)
    with app_engine().begin() as c:
        row = c.execute(text("""UPDATE app.announcements SET ends_at = now()
                                WHERE id = CAST(:i AS uuid) AND (ends_at IS NULL OR ends_at > now())
                                RETURNING COALESCE(title_en, title_te) AS title"""), {"i": ann_id}).first()
    if not row:
        raise HTTPException(status_code=404, detail="That announcement was not found or has already ended.")
    write_activity_log(user_id=admin["id"], action="announcement.end", details=row.title,
                       ip_address=_ip(req), target_type="announcement", target_id=ann_id)
    return {"id": ann_id, "ended": True}
