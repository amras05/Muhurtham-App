"""
My family (plan R1, Phase 15): each person entered once, picked on any finder card.

  GET    /me/family          the signed-in person's family, birth details opened for them only
  POST   /me/family          add one (star worked out on save from birth details, or picked)
  PUT    /me/family/{id}     change one (same body as POST)
  DELETE /me/family/{id}     remove one

Birth date, time and place are sealed with AES-GCM (app/core/sealed.py, decision E1) and bound to
the owner. Stars are stored as plain numbers so searches don't reopen the birth details.
Nobody else can read a family: there is no admin route to these rows. Logs never carry birth data.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.auth.database import write_activity_log
from app.auth.permissions import require
from app.core.logging import logger
from app.core.sealed import seal, unseal
from app.db.engine import app_engine
from app.engines.participants import birth_chart_points

router = APIRouter(tags=["Family"])

MAX_PROFILES = 30
RELATIONS = ("self", "spouse", "son", "daughter", "father", "mother", "brother", "sister", "grandchild", "other")
_COLS = """id::text AS id, display_name, relation, gender, birth_enc, birth_time_unknown, janma_nak, janma_pada,
           janma_rasi, birth_lagna, nama_nak, nama_pada, star_source, gotra, is_eldest, created_at, updated_at"""


class BirthIn(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    time_unknown: bool = False
    place: Optional[str] = Field(None, max_length=120)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lon: Optional[float] = Field(None, ge=-180, le=180)
    tz: Optional[float] = Field(None, ge=-12, le=14)


class FamilyIn(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=80)
    relation: str = Field(..., pattern="^(" + "|".join(RELATIONS) + ")$")
    gender: Optional[str] = Field(None, pattern="^(male|female)$")
    gotra: Optional[str] = Field(None, max_length=60)
    is_eldest: bool = False
    star_source: str = Field("picked", pattern="^(picked|name|birth)$")
    janma_nak: Optional[int] = Field(None, ge=1, le=27)
    janma_pada: Optional[int] = Field(None, ge=1, le=4)
    janma_rasi: Optional[int] = Field(None, ge=1, le=12)
    birth_lagna: Optional[int] = Field(None, ge=1, le=12)
    nama_nak: Optional[int] = Field(None, ge=1, le=27)
    nama_pada: Optional[int] = Field(None, ge=1, le=4)
    birth: Optional[BirthIn] = None

    @model_validator(mode="after")
    def _check(self):
        if self.star_source == "birth" and not self.birth:
            raise ValueError("Give the birth date (and time and place if known) to work out the star.")
        if self.birth:
            try:
                d = datetime.strptime(self.birth.date, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError("The birth date is not a real date.")
            if d > datetime.now().date() or d.year < 1900:
                raise ValueError("The birth date must be between 1900 and today.")
            if self.star_source == "birth" and None in (self.birth.lat, self.birth.lon, self.birth.tz):
                raise ValueError("Choose the birth place so the star can be worked out.")
        if not (self.janma_nak or self.nama_nak or self.star_source == "birth"):
            raise ValueError("Give a janma or nama nakshatra, or the birth details.")
        return self


def _out(r, owner_id: str, warnings: Optional[List[str]] = None) -> Dict[str, Any]:
    birth = None
    try:
        birth = unseal(r.birth_enc, owner_id)
    except Exception as ex:   # wrong key or damaged value: show the person without birth details
        logger.error(f"Family birth details could not be opened (profile {r.id}): {type(ex).__name__}")
    out = {k: getattr(r, k) for k in ("id", "display_name", "relation", "gender", "birth_time_unknown", "janma_nak",
                                      "janma_pada", "janma_rasi", "birth_lagna", "nama_nak", "nama_pada",
                                      "star_source", "gotra", "is_eldest")}
    out.update(birth=birth, birth_unreadable=bool(r.birth_enc) and birth is None,
               updated_at=r.updated_at.isoformat() if r.updated_at else None)
    if warnings is not None:
        out["warnings"] = warnings
    return out


def _values(body: FamilyIn, owner_id: str) -> (Dict[str, Any], List[str]):
    v = {"n": body.display_name.strip(), "rel": body.relation, "g": body.gender, "gt": (body.gotra or "").strip() or None,
         "el": body.is_eldest, "src": body.star_source, "jn": body.janma_nak, "jp": body.janma_pada,
         "jr": body.janma_rasi, "bl": body.birth_lagna, "nn": body.nama_nak, "np": body.nama_pada,
         "be": None, "btu": False}
    warnings: List[str] = []
    if body.birth:
        b = body.birth
        v["btu"] = b.time_unknown or not b.time
        v["be"] = seal({"date": b.date, "time": None if b.time_unknown else b.time, "time_unknown": v["btu"],
                        "place": b.place, "lat": b.lat, "lon": b.lon, "tz": b.tz}, owner_id)
        if body.star_source == "birth":
            pts = birth_chart_points(datetime.strptime(b.date, "%Y-%m-%d").date(), None if v["btu"] else b.time,
                                     b.lat, b.lon, b.tz, b.place or "Birth place")
            warnings += pts.pop("warnings", [])
            # Worked out from birth; a value the Moon left ambiguous may be picked by hand instead.
            v["jn"] = pts.get("janma_nak_idx") or body.janma_nak
            v["jp"] = pts.get("janma_pada") or (body.janma_pada if not pts.get("janma_nak_idx") else None)
            v["jr"] = pts.get("janma_rasi_idx") or body.janma_rasi
            v["bl"] = pts.get("birth_lagna_idx")
            if not v["jn"] and not v["nn"]:
                raise HTTPException(status_code=400, detail="; ".join(warnings) or "The star could not be worked out.")
    return v, warnings


def _ip(req: Request) -> Optional[str]:
    return req.client.host if req.client else None


@router.get("/me/family")
def list_family(me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().connect() as c:
        rows = c.execute(text(f"""SELECT {_COLS} FROM app.family_profiles
                                  WHERE owner_id = CAST(:o AS uuid) AND deleted_at IS NULL
                                  ORDER BY (relation = 'self') DESC, created_at"""), {"o": me["id"]}).all()
    return {"family": [_out(r, me["id"]) for r in rows], "max": MAX_PROFILES}


@router.post("/me/family", status_code=201)
def add_family(body: FamilyIn, req: Request, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    v, warnings = _values(body, me["id"])
    try:
        with app_engine().begin() as c:
            n = c.execute(text("SELECT count(*) FROM app.family_profiles WHERE owner_id = CAST(:o AS uuid) AND deleted_at IS NULL"),
                          {"o": me["id"]}).scalar()
            if n >= MAX_PROFILES:
                raise HTTPException(status_code=400, detail=f"You can save up to {MAX_PROFILES} family members.")
            r = c.execute(text(f"""
                INSERT INTO app.family_profiles (owner_id, display_name, relation, gender, gotra, is_eldest, star_source,
                       janma_nak, janma_pada, janma_rasi, birth_lagna, nama_nak, nama_pada, birth_enc, birth_time_unknown)
                VALUES (CAST(:o AS uuid), :n, :rel, :g, :gt, :el, :src, :jn, :jp, :jr, :bl, :nn, :np, :be, :btu)
                RETURNING {_COLS}"""), {"o": me["id"], **v}).first()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="You already have a profile for yourself (\"Self\").")
    write_activity_log(user_id=me["id"], action="family.add", details=f"Added a family member ({body.relation})",
                       ip_address=_ip(req), target_type="family", target_id=r.id)
    return _out(r, me["id"], warnings)


@router.put("/me/family/{profile_id}")
def edit_family(profile_id: str, body: FamilyIn, req: Request, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    v, warnings = _values(body, me["id"])
    keep_birth = body.birth is None
    try:
        with app_engine().begin() as c:
            r = c.execute(text(f"""
                UPDATE app.family_profiles SET display_name = :n, relation = :rel, gender = :g, gotra = :gt, is_eldest = :el,
                       star_source = :src, janma_nak = :jn, janma_pada = :jp, janma_rasi = :jr, birth_lagna = :bl,
                       nama_nak = :nn, nama_pada = :np
                       {"" if keep_birth else ", birth_enc = :be, birth_time_unknown = :btu"}
                WHERE id = CAST(:i AS uuid) AND owner_id = CAST(:o AS uuid) AND deleted_at IS NULL
                RETURNING {_COLS}"""), {"i": _uuid(profile_id), "o": me["id"], **v}).first()
    except IntegrityError:
        raise HTTPException(status_code=409, detail="You already have a profile for yourself (\"Self\").")
    if not r:
        raise HTTPException(status_code=404, detail="That family member was not found.")
    write_activity_log(user_id=me["id"], action="family.update", details=f"Changed a family member ({body.relation})",
                       ip_address=_ip(req), target_type="family", target_id=r.id)
    return _out(r, me["id"], warnings)


@router.delete("/me/family/{profile_id}")
def remove_family(profile_id: str, req: Request, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().begin() as c:
        r = c.execute(text("""UPDATE app.family_profiles SET deleted_at = now(), birth_enc = NULL
                              WHERE id = CAST(:i AS uuid) AND owner_id = CAST(:o AS uuid) AND deleted_at IS NULL
                              RETURNING relation"""), {"i": _uuid(profile_id), "o": me["id"]}).first()
    if not r:
        raise HTTPException(status_code=404, detail="That family member was not found.")
    write_activity_log(user_id=me["id"], action="family.remove", details=f"Removed a family member ({r.relation})",
                       ip_address=_ip(req), target_type="family", target_id=profile_id)
    return {"id": profile_id, "removed": True}


def _uuid(value: str) -> str:
    import uuid
    try:
        return str(uuid.UUID(value))
    except ValueError:
        raise HTTPException(status_code=404, detail="That family member was not found.")


def profile_for_search(profile_id: str, owner_id: str) -> Dict[str, Any]:
    """A saved person as finder card fields (used by /muhurta/find). 404 unless it belongs to `owner_id`."""
    with app_engine().connect() as c:
        r = c.execute(text(f"""SELECT {_COLS} FROM app.family_profiles WHERE id = CAST(:i AS uuid)
                               AND owner_id = CAST(:o AS uuid) AND deleted_at IS NULL"""),
                      {"i": _uuid(profile_id), "o": owner_id}).first()
    if not r:
        raise HTTPException(status_code=404, detail="That family member was not found.")
    p = _out(r, owner_id)
    b = p.get("birth") or {}
    return {"name": p["display_name"], "gotra": p["gotra"], "eldest": p["is_eldest"],
            "gender": {"male": "boy", "female": "girl"}.get(p["gender"] or ""),
            "janma_nak_idx": p["janma_nak"], "janma_pada": p["janma_pada"], "nama_nak_idx": p["nama_nak"],
            "nama_pada": p["nama_pada"], "rasi_idx": p["janma_rasi"], "lagna_idx": p["birth_lagna"],
            "birth_date": b.get("date"), "birth_time_unknown": bool(p["birth_time_unknown"])}


# ── Family events (plan R2) ───────────────────────────────────────────────────────
# Past and planned events per person. Used for the sibling-marriage warning (decision E2).

MARRIAGE_EVENTS = {"vivaha"}
SIBLING_GAP_DAYS = 183            # "6 months" (E2): warn only; the window is still to be confirmed by the author
# Who counts as a sibling of whom, from the relations the owner gave (grandchildren may be cousins: not used).
_SIBLINGS = {"self": {"brother", "sister"}, "brother": {"self", "brother", "sister"}, "sister": {"self", "brother", "sister"},
             "son": {"son", "daughter"}, "daughter": {"son", "daughter"}}


class EventIn(BaseModel):
    profile_id: str = Field(..., max_length=40)
    activity_id: str = Field(..., min_length=2, max_length=60)
    event_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    event_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    status: str = Field("planned", pattern="^(planned|done|cancelled)$")
    notes: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def _check(self):
        from app.engines.rule_interpreter import list_all_rules
        try:
            datetime.strptime(self.event_date, "%Y-%m-%d")
        except ValueError:
            raise ValueError("The event date is not a real date.")
        if self.event_time:
            h, m = (int(x) for x in self.event_time.split(":"))
            if not (0 <= h < 24 and 0 <= m < 60):
                raise ValueError("The event time is not a real time.")
        if self.activity_id not in {r["id"] for r in list_all_rules()}:
            raise ValueError("Unknown muhurta.")
        return self


_EV_COLS = """e.id::text AS id, e.profile_id::text AS profile_id, p.display_name, p.relation, e.activity_id, e.event_date,
              to_char(e.event_time, 'HH24:MI') AS event_time, e.status, e.notes, e.created_at"""


def _event_out(r) -> Dict[str, Any]:
    from app.engines.rule_interpreter import list_all_rules
    rule = next((x for x in list_all_rules() if x["id"] == r.activity_id), {})
    return {"id": r.id, "profile_id": r.profile_id, "person": r.display_name, "relation": r.relation,
            "activity_id": r.activity_id, "title_en": rule.get("title_en", r.activity_id), "title_te": rule.get("title_te") or "",
            "event_date": r.event_date.isoformat(), "event_time": r.event_time, "status": r.status, "notes": r.notes}


def _own_profile(c, profile_id: str, owner_id: str) -> None:
    ok = c.execute(text("""SELECT 1 FROM app.family_profiles WHERE id = CAST(:i AS uuid) AND owner_id = CAST(:o AS uuid)
                           AND deleted_at IS NULL"""), {"i": _uuid(profile_id), "o": owner_id}).first()
    if not ok:
        raise HTTPException(status_code=404, detail="That family member was not found.")


@router.get("/me/family/events")
def list_events(me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().connect() as c:
        rows = c.execute(text(f"""SELECT {_EV_COLS} FROM app.family_events e
                                  JOIN app.family_profiles p ON p.id = e.profile_id AND p.deleted_at IS NULL
                                  WHERE e.owner_id = CAST(:o AS uuid) ORDER BY e.event_date DESC, e.created_at DESC"""),
                         {"o": me["id"]}).all()
    return {"events": [_event_out(r) for r in rows]}


@router.post("/me/family/events", status_code=201)
def add_event(body: EventIn, req: Request, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().begin() as c:
        _own_profile(c, body.profile_id, me["id"])
        n = c.execute(text("SELECT count(*) FROM app.family_events WHERE owner_id = CAST(:o AS uuid)"), {"o": me["id"]}).scalar()
        if n >= 500:
            raise HTTPException(status_code=400, detail="You can keep up to 500 family events.")
        new_id = c.execute(text("""
            INSERT INTO app.family_events (owner_id, profile_id, activity_id, event_date, event_time, status, notes)
            VALUES (CAST(:o AS uuid), CAST(:p AS uuid), :a, CAST(:d AS date), CAST(:t AS time), :s, :n) RETURNING id::text"""),
            {"o": me["id"], "p": body.profile_id, "a": body.activity_id, "d": body.event_date, "t": body.event_time,
             "s": body.status, "n": (body.notes or "").strip() or None}).scalar()
        r = c.execute(text(f"SELECT {_EV_COLS} FROM app.family_events e JOIN app.family_profiles p ON p.id = e.profile_id "
                           "WHERE e.id = CAST(:i AS uuid)"), {"i": new_id}).first()
    write_activity_log(user_id=me["id"], action="family.event_add", details=f"{body.activity_id} ({body.status})",
                       ip_address=_ip(req), target_type="family_event", target_id=new_id)
    return _event_out(r)


@router.put("/me/family/events/{event_id}")
def edit_event(event_id: str, body: EventIn, req: Request, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().begin() as c:
        _own_profile(c, body.profile_id, me["id"])
        done = c.execute(text("""
            UPDATE app.family_events SET profile_id = CAST(:p AS uuid), activity_id = :a, event_date = CAST(:d AS date),
                   event_time = CAST(:t AS time), status = :s, notes = :n
            WHERE id = CAST(:i AS uuid) AND owner_id = CAST(:o AS uuid) RETURNING id"""),
            {"i": _uuid(event_id), "o": me["id"], "p": body.profile_id, "a": body.activity_id, "d": body.event_date,
             "t": body.event_time, "s": body.status, "n": (body.notes or "").strip() or None}).first()
        if not done:
            raise HTTPException(status_code=404, detail="That event was not found.")
        r = c.execute(text(f"SELECT {_EV_COLS} FROM app.family_events e JOIN app.family_profiles p ON p.id = e.profile_id "
                           "WHERE e.id = CAST(:i AS uuid)"), {"i": _uuid(event_id)}).first()
    write_activity_log(user_id=me["id"], action="family.event_update", details=f"{body.activity_id} ({body.status})",
                       ip_address=_ip(req), target_type="family_event", target_id=event_id)
    return _event_out(r)


@router.delete("/me/family/events/{event_id}")
def remove_event(event_id: str, req: Request, me: dict = Depends(require("self.edit"))) -> Dict[str, Any]:
    with app_engine().begin() as c:
        r = c.execute(text("DELETE FROM app.family_events WHERE id = CAST(:i AS uuid) AND owner_id = CAST(:o AS uuid) RETURNING activity_id"),
                      {"i": _uuid(event_id), "o": me["id"]}).first()
    if not r:
        raise HTTPException(status_code=404, detail="That event was not found.")
    write_activity_log(user_id=me["id"], action="family.event_remove", details=r.activity_id,
                       ip_address=_ip(req), target_type="family_event", target_id=event_id)
    return {"id": event_id, "removed": True}


def sibling_marriage_warnings(owner_id: str, profile_ids: List[str], start, end) -> List[str]:
    """E2: warn when a sibling of a person in this marriage search marries within 6 months of the dates searched.
    Warning only; the window is marked as still to be confirmed by the author."""
    from datetime import timedelta
    out: List[str] = []
    with app_engine().connect() as c:
        for pid in dict.fromkeys(profile_ids):
            me_row = c.execute(text("""SELECT display_name, relation FROM app.family_profiles WHERE id = CAST(:i AS uuid)
                                       AND owner_id = CAST(:o AS uuid) AND deleted_at IS NULL"""), {"i": _uuid(pid), "o": owner_id}).first()
            sibs = _SIBLINGS.get(me_row.relation if me_row else "", set())
            if not sibs:
                continue
            rows = c.execute(text("""
                SELECT p.display_name, e.event_date, e.status FROM app.family_events e
                JOIN app.family_profiles p ON p.id = e.profile_id AND p.deleted_at IS NULL
                WHERE e.owner_id = CAST(:o AS uuid) AND e.activity_id = ANY(:acts) AND e.status IN ('planned', 'done')
                  AND e.profile_id <> CAST(:i AS uuid) AND p.relation = ANY(:rels)
                  AND e.event_date BETWEEN :lo AND :hi ORDER BY e.event_date"""),
                {"o": owner_id, "i": pid, "acts": list(MARRIAGE_EVENTS), "rels": list(sibs),
                 "lo": start - timedelta(days=SIBLING_GAP_DAYS), "hi": end + timedelta(days=SIBLING_GAP_DAYS)}).all()
            for r in rows:
                state = "is planned for" if r.status == "planned" else "was on"
                out.append(f"Sibling marriage: {me_row.display_name}'s sibling {r.display_name}'s marriage {state} "
                           f"{r.event_date.isoformat()}, within 6 months of these dates. The book advises a gap between "
                           f"siblings' marriages (6 months; rule to be confirmed by the author).")
    return out
