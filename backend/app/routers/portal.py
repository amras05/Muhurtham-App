"""
Web portal data (plan C2): the "Today" panchang card and the signed-in person's own account.

  GET /dashboard/today   today's panchang for the person's home place (default Hyderabad, D2),
                         with the limb running now, the bad periods, what period it is now,
                         and the next good window
  GET /me · PUT /me      own name, language and home place
"""
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.auth.database import get_user_by_id, update_user_profile, write_activity_log
from app.auth.dependencies import get_current_user
from app.engines.limb_timeline import jd_to_local, limb_spans, limbs_at, local_to_jd, varjyam_windows
from app.engines.panchang import compute_day_panchang

router = APIRouter(tags=["Portal"])

DEFAULT_PLACE = {"name": "Hyderabad, Telangana", "lat": 17.385, "lon": 78.4867, "tz": 5.5}   # D2


def _home_place(user: dict) -> Dict[str, Any]:
    if user.get("home_lat") is not None and user.get("home_lon") is not None and user.get("home_tz") is not None:
        return {"name": user.get("home_place") or "Home", "lat": float(user["home_lat"]),
                "lon": float(user["home_lon"]), "tz": float(user["home_tz"])}
    return dict(DEFAULT_PLACE)


def _at(day: date, hms: Optional[str]) -> Optional[datetime]:
    """'HH:MM:SS' (optionally '(+1)') on `day` as a local datetime."""
    if not hms:
        return None
    try:
        clock = hms.split()[0]
        h, m, s = (int(x) for x in (clock.split(":") + ["0", "0"])[:3])
        dt = datetime(day.year, day.month, day.day) + timedelta(hours=h, minutes=m, seconds=s)
        return dt + timedelta(days=1) if "(+1)" in hms else dt
    except (ValueError, IndexError):
        return None


def _span(day: date, pair: Optional[dict]) -> Optional[Tuple[datetime, datetime]]:
    if not isinstance(pair, dict):
        return None
    a, b = _at(day, pair.get("start")), _at(day, pair.get("end"))
    return (a, b) if a and b and a < b else None


def _limb(span: Tuple[float, float], tz: float) -> Dict[str, str]:
    return {"start": jd_to_local(span[0], tz).strftime("%d %b %H:%M"), "end": jd_to_local(span[1], tz).strftime("%d %b %H:%M")}


@router.get("/dashboard/today")
def today(
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lon: Optional[float] = Query(None, ge=-180, le=180),
    tz: Optional[float] = Query(None, ge=-12, le=14),
    place: Optional[str] = Query(None, max_length=120),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    where = _home_place(current_user)
    if lat is not None and lon is not None and tz is not None:
        where = {"name": place or "Selected place", "lat": lat, "lon": lon, "tz": tz}

    now = (datetime.now(timezone.utc) + timedelta(hours=where["tz"])).replace(tzinfo=None, microsecond=0)
    day = now.date()
    p = compute_day_panchang(day.year, day.month, day.day, where["lat"], where["lon"], where["tz"], where["name"], hour=12)

    jd_now = local_to_jd(now, where["tz"])
    limbs = limbs_at(jd_now)
    spans = limb_spans(jd_now)

    periods: List[Dict[str, Any]] = []
    for key, en, te in (("rahu_kalam", "Rahu kalam", "రాహు కాలం"), ("yamagandam", "Yamagandam", "యమగండం"),
                        ("gulika_kalam", "Gulika kalam", "గుళిక కాలం")):
        sp = _span(day, p.get(key))
        if sp:
            periods.append({"kind": key, "name_en": en, "name_te": te, "start": sp[0], "end": sp[1]})
    for d in p.get("durmuhurtam") or []:
        sp = _span(day, d)
        if sp:
            periods.append({"kind": "durmuhurtam", "name_en": "Durmuhurtam", "name_te": "దుర్ముహూర్తం", "start": sp[0], "end": sp[1]})
    sunrise, sunset = _at(day, p.get("sunrise")), _at(day, p.get("sunset"))
    if sunrise:
        for v in varjyam_windows(sunrise, sunrise + timedelta(days=1), where["tz"]):
            periods.append({"kind": "varjyam", "name_en": "Varjyam", "name_te": "వర్జ్యం", "start": v["start"], "end": v["end"]})
    periods.sort(key=lambda x: x["start"])

    current = next((x for x in periods if x["start"] <= now < x["end"]), None)
    abhijit = _span(day, p.get("abhijit_muhurta"))
    next_good = None
    if abhijit and now < abhijit[1] and p.get("vaara") != "Wednesday":   # Abhijit is not used on Wednesdays
        next_good = {"name_en": "Abhijit muhurta", "name_te": "అభిజిత్ ముహూర్తం",
                     "start": abhijit[0].strftime("%H:%M"), "end": abhijit[1].strftime("%H:%M"),
                     "now": abhijit[0] <= now}

    cm = p.get("chandramana") or {}
    fmt = lambda x: {**{k: v for k, v in x.items() if k not in ("start", "end")},  # noqa: E731
                     "start": x["start"].strftime("%H:%M"), "end": x["end"].strftime("%H:%M"),
                     "past": x["end"] <= now}
    return {
        "date": day.isoformat(),
        "now": now.strftime("%H:%M"),
        "place": where,
        "weekday": p.get("vaara"),
        "masa": {"name_en": cm.get("month_name"), "name_te": cm.get("month_telugu"),
                 "paksha_en": cm.get("paksha_en"), "paksha_te": cm.get("paksha_te"),
                 "adhika": bool(cm.get("is_adhika_masa")), "samvatsara_en": cm.get("samvatsara_name"),
                 "samvatsara_te": cm.get("samvatsara_telugu")},
        "tithi": {"name": f"{limbs.tithi_name} ({limbs.paksha.title()})", **_limb(spans["tithi"], where["tz"])},
        "nakshatra": {"name": limbs.nakshatra_name, "pada": limbs.pada, **_limb(spans["nakshatra"], where["tz"])},
        "yoga": {"name": limbs.yoga_name, **_limb(spans["yoga"], where["tz"])},
        "karana": {"name": limbs.karana_name, **_limb(spans["karana"], where["tz"])},
        "sunrise": sunrise.strftime("%H:%M") if sunrise else None,
        "sunset": sunset.strftime("%H:%M") if sunset else None,
        "periods": [fmt(x) for x in periods],
        "current_period": fmt(current) if current else None,
        "next_good": next_good,
        "special_yogas": [{"name_en": y.get("name_en"), "name_te": y.get("name_te"), "type": y.get("type")}
                          for y in (p.get("special_yogas") or [])],
    }


# ── Own account ───────────────────────────────────────────────────────────────

class MeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=80)
    preferred_language: Optional[str] = Field(None, pattern="^(te|en)$")
    home_place: Optional[str] = Field(None, min_length=1, max_length=120)
    home_lat: Optional[float] = Field(None, ge=-90, le=90)
    home_lon: Optional[float] = Field(None, ge=-180, le=180)
    home_tz: Optional[float] = Field(None, ge=-12, le=14)


def _me(u: dict) -> Dict[str, Any]:
    return {"id": u["id"], "name": u.get("name"), "phone": u.get("phone"), "role": u.get("role"),
            "preferred_language": u.get("preferred_language"),
            "home": _home_place(u), "home_is_default": u.get("home_lat") is None,
            "created_at": u.get("created_at"), "last_login_at": u.get("last_login_at")}


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    return _me(current_user)


@router.put("/me")
def put_me(body: MeUpdate, req: Request, current_user: dict = Depends(get_current_user)) -> Dict[str, Any]:
    fields: Dict[str, Any] = {}
    if body.name:
        fields["name"] = body.name.strip()
    if body.preferred_language:
        fields["preferred_language"] = body.preferred_language
    home = (body.home_place, body.home_lat, body.home_lon, body.home_tz)
    if any(v is not None for v in home):
        if any(v is None for v in home):
            raise HTTPException(status_code=400, detail="A home place needs its name, latitude, longitude and time zone.")
        fields["home"] = home
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    update_user_profile(current_user["id"], fields)
    write_activity_log(user_id=current_user["id"], action="account_update",
                       details="Changed " + ", ".join(sorted(fields)), ip_address=req.client.host if req.client else None)
    return _me(get_user_by_id(current_user["id"]))
