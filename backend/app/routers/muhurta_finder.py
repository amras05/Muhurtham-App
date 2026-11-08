"""
Unified Declarative Muhurtha Finder Router (Layer 3 API).
Exposes the catalog of all ~80 events and the continuous window calculation engine.
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request

from app.core.logging import logger
from pydantic import BaseModel, Field

from app.engines.muhurta_tabs import SUB_GROUPS, tabs_with_events
from app.engines.participants import participants_for, resolve_participants
from app.engines.yoga_finder import find_yoga_windows, yoga_catalog
from app.engines.pitru_calendar import after_death as pitru_after_death, annual_shraddha, shannavati as pitru_shannavati
from app.engines.rule_interpreter import find_muhurta_windows, list_all_rules, load_rule
from app.engines.nama_nakshatra import (
    lookup_nama_nakshatra,
    NAKSHATRA_PADA_AKSHARAS,
    check_travel_directional_sula,
    check_facing_compatibility
)

router = APIRouter(prefix="/muhurta", tags=["Muhurtha Finder Engine"])


class ParticipantIn(BaseModel):
    """One person taking part (Input Data Master). Janma and nama nakshatra are separate fields."""
    role: str = Field("person", description="groom, bride, vatu, father, mother, guru, owner, spouse, child, ...")
    name: Optional[str] = None
    gotra: Optional[str] = Field(None, description="Record only: printed on the result, not used in the calculation")
    janma_nak_idx: Optional[int] = Field(None, ge=1, le=27)
    janma_pada: Optional[int] = Field(None, ge=1, le=4)
    nama_nak_idx: Optional[int] = Field(None, ge=1, le=27)
    nama_pada: Optional[int] = Field(None, ge=1, le=4)
    rasi_idx: Optional[int] = Field(None, ge=1, le=12, description="Janma (Moon) rashi")
    lagna_idx: Optional[int] = Field(None, ge=1, le=12, description="Janma lagna")
    birth_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    birth_time: Optional[str] = Field(None, description="HH:MM (24h)")
    birth_time_unknown: bool = False
    from_birth: bool = Field(False, description="Work out janma nakshatra, pada, rashi and lagna from the birth details")
    birth_place: Optional[str] = None
    birth_lat: Optional[float] = None
    birth_lon: Optional[float] = None
    birth_tz_offset: Optional[float] = None
    gender: Optional[str] = Field(None, description="boy / girl (child samskaras)")
    eldest: bool = Field(False, description="Eldest child (Trijyeshtha)")


class MuhurtaFindRequest(BaseModel):
    activity_id: str = Field(..., description="Unique event identifier from catalog (e.g. 'griha_pravesha', 'business_start')")
    start_date: str = Field(..., description="Start date YYYY-MM-DD")
    days_to_scan: int = Field(15, ge=1, le=60, description="Number of days to search forward (1-60)")
    lat: float = Field(..., description="Geographic latitude")
    lon: float = Field(..., description="Geographic longitude")
    tz_offset: float = Field(..., description="Timezone offset in hours (e.g. 5.5 for IST)")
    place_name: str = Field("Location", description="Human readable location name")
    panchaka_method: str = Field("standard", description="Panchaka tradition: 'standard', 'dhruvaka', or 'matantara'")
    min_window_minutes: float = Field(15.0, ge=5.0, le=120.0, description="Minimum acceptable window duration in minutes")
    strictness: str = Field("strict", pattern="^(strict|lenient)$",
                            description="'strict' (default) excludes windows with a fatal Mahadosha; 'lenient' keeps them with a warning")

    # Level 1 — General
    person_name: Optional[str] = Field(None, description="Primary person name")
    date_to: Optional[str] = Field(None, description="End date YYYY-MM-DD")
    time_preference: Optional[str] = Field("any", description="Time preference: 'any', 'morning', 'afternoon', 'evening', 'night'")
    participants: List[ParticipantIn] = Field(default_factory=list, description="People taking part; see /muhurta/catalog for each event's list")

    # Level 2 — Astrological & Nama Nakshatra
    janma_nak_idx: Optional[int] = Field(None, ge=1, le=27, description="Janma Nakshatra index (1-27)")
    janma_pada: Optional[int] = Field(None, ge=1, le=4, description="Janma Nakshatra Pada (1-4)")
    janma_moon_rasi_idx: Optional[int] = Field(None, ge=1, le=12, description="Janma Rasi index (1-12)")
    rule_variant: Optional[str] = Field(None, description="Alternate list from the book, e.g. 'part7_second_list'")
    birth_lagna_idx: Optional[int] = Field(None, ge=1, le=12, description="Janma Lagna index (1-12), for Lagnashtama")
    birth_dob: Optional[str] = Field(None, description="Birth date YYYY-MM-DD")
    birth_tob: Optional[str] = Field(None, description="Birth time HH:MM")
    nama_nak_idx: Optional[int] = Field(None, ge=1, le=27, description="Nama Nakshatra index (1-27)")
    nama_pada: Optional[int] = Field(None, ge=1, le=4, description="Nama Nakshatra Pada (1-4)")
    gotra: Optional[str] = Field(None, description="Family Gotra")

    # Level 3 — Activity-Specific
    # Vivaha
    groom_name: Optional[str] = None
    groom_nak_idx: Optional[int] = None
    groom_gotra: Optional[str] = None
    bride_name: Optional[str] = None
    bride_nak_idx: Optional[int] = None
    bride_gotra: Optional[str] = None
    groom_rasi_idx: Optional[int] = Field(None, ge=1, le=12)
    bride_rasi_idx: Optional[int] = Field(None, ge=1, le=12)
    groom_eldest: bool = Field(False, description="Groom is the eldest child (Trijyeshtha)")
    bride_eldest: bool = Field(False, description="Bride is the eldest child (Trijyeshtha)")
    # Samskaras
    child_dob: Optional[str] = Field(None, description="Child's date of birth YYYY-MM-DD (age windows)")
    child_gender: Optional[str] = Field(None, pattern="^(boy|girl)$")
    conception_date: Optional[str] = Field(None, description="Conception date YYYY-MM-DD (pregnancy-month windows)")
    main_event_date: Optional[str] = Field(None, description="Main samskara date YYYY-MM-DD (dependent muhurtas)")
    guru_nak_idx: Optional[int] = Field(None, ge=1, le=27)
    # Upanayana
    vatu_name: Optional[str] = None
    father_name: Optional[str] = None
    father_nak_idx: Optional[int] = None
    mother_nak_idx: Optional[int] = None
    veda_shakha: Optional[str] = None
    sutra: Optional[str] = None
    varna: Optional[str] = None
    # Griha / Vastu
    owner_name: Optional[str] = None
    owner_nama_nak_idx: Optional[int] = None
    spouse_name: Optional[str] = None
    spouse_nama_nak_idx: Optional[int] = None
    plot_length: Optional[float] = None
    plot_width: Optional[float] = None
    plot_facing: Optional[str] = None
    door_facing: Optional[str] = None
    house_type: Optional[str] = None
    construction_purpose: Optional[str] = None
    # Business
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    partner_name: Optional[str] = None
    partner_nama_nak_idx: Optional[int] = None
    entrance_facing: Optional[str] = None
    # Travel
    origin: Optional[str] = None
    destination: Optional[str] = None
    travel_direction: Optional[str] = None
    travel_mode: Optional[str] = None
    travel_purpose: Optional[str] = Field(None, pattern="^(women|cattle_trade|trade|war)$")
    travel_exemption: Optional[str] = Field(None, description="Gotra, marriage, distress, pilgrimage, escape or renunciate: waives Shukra sammukha")
    # Vehicle
    vehicle_type: Optional[str] = None
    vehicle_muhurta_type: Optional[str] = None


@router.get("/catalog")
def get_muhurta_catalog():
    """
    Returns the comprehensive catalog of all digitized Muhurtam event types,
    grouped by domain category with English and Telugu titles.
    """
    rules = list_all_rules()
    categories: Dict[str, List[Dict[str, Any]]] = {}

    for r in rules:
        cat = r["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(r)

    return {
        "total_activities": len(rules),
        "tabs": tabs_with_events(rules),
        "sub_groups": SUB_GROUPS,
        "categories": categories,
        "all_activities": rules
    }


class YogaSearchRequest(BaseModel):
    start_date: str = Field(..., description="YYYY-MM-DD")
    days_to_scan: int = Field(30, ge=1, le=60)
    lat: float
    lon: float
    tz_offset: float
    place_name: str = "Location"
    yogas: List[str] = Field(default_factory=list, description="Yoga ids (any of them must form); see /muhurta/yogas/catalog")
    conditions: List[str] = Field(default_factory=list, description="Conditions that must all hold")
    janma_nak_idx: Optional[int] = Field(None, ge=1, le=27)
    janma_rasi_idx: Optional[int] = Field(None, ge=1, le=12)


@router.get("/yogas/catalog")
def get_yoga_catalog():
    """Yogas and conditions the Special Yogas tab can search for."""
    return yoga_catalog()


@router.post("/yogas")
def search_yoga_windows(req: YogaSearchRequest):
    """Windows where the chosen special yogas form and the chosen conditions hold (no event needed)."""
    try:
        s_date = datetime.strptime(req.start_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_date format. Expected YYYY-MM-DD.")
    if not req.yogas and not req.conditions:
        raise HTTPException(status_code=400, detail="Choose at least one yoga or condition.")
    return find_yoga_windows(s_date, req.days_to_scan, req.lat, req.lon, req.tz_offset, req.place_name,
                             req.yogas, req.conditions, req.janma_nak_idx, req.janma_rasi_idx)


class PitruCalendarRequest(BaseModel):
    mode: str = Field(..., description="annual (yearly shraddha), after_death (day counts and masikas), shannavati (96 days of a year)")
    lat: float
    lon: float
    tz_offset: float
    place_name: str = "Location"
    death_date: Optional[str] = Field(None, description="YYYY-MM-DD (annual, after_death)")
    death_time: Optional[str] = Field(None, description="HH:MM; the tithi at death depends on it")
    years: int = Field(3, ge=1, le=10, description="How many yearly shraddhas to list (annual)")
    year: Optional[int] = Field(None, ge=1900, le=2200, description="Calendar year (shannavati)")


@router.post("/pitru-calendar")
def pitru_calendar(req: PitruCalendarRequest):
    """Annual shraddha dates, after-death day counts, or the 96 shraddha days of a year."""
    warnings: List[str] = []
    if req.mode == "shannavati":
        if not req.year:
            raise HTTPException(status_code=400, detail="shannavati needs `year`.")
        out = pitru_shannavati(req.year, req.lat, req.lon, req.tz_offset)
        out["warnings"] = warnings
        return out
    if req.mode not in ("annual", "after_death"):
        raise HTTPException(status_code=400, detail="mode must be annual, after_death or shannavati.")
    if not req.death_date:
        raise HTTPException(status_code=400, detail=f"{req.mode} needs `death_date`.")
    try:
        d = datetime.strptime(req.death_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid death_date. Expected YYYY-MM-DD.")
    hh, mm = 12, 0
    if req.death_time:
        try:
            hh, mm = (int(x) for x in req.death_time.split(":")[:2])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid death_time. Expected HH:MM.")
    else:
        warnings.append("Time of death not given: noon used. If the tithi changed that day, give the time.")
    death_dt = d.replace(hour=hh, minute=mm)
    if req.mode == "annual":
        out = annual_shraddha(death_dt, req.years, req.lat, req.lon, req.tz_offset)
    else:
        out = pitru_after_death(death_dt, req.lat, req.lon, req.tz_offset)
    out["warnings"] = warnings
    return out


@router.get("/rule/{activity_id}")
def get_rule_details(activity_id: str):
    """
    Inspects the exact declarative rule specification and book citations for an event.
    """
    rule = load_rule(activity_id)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Activity rule '{activity_id}' not found.")
    return rule.model_dump()


@router.get("/nama-nakshatra/lookup")
def get_nama_nakshatra_by_name(name: str = Query(..., min_length=1, description="Person name in English or Telugu")):
    """
    Phonetically identifies the classical Nama Nakshatra, Pada, and Moon Rasi from a person's name
    using the 108 Pada Sanskrit/Telugu syllable table.
    """
    res = lookup_nama_nakshatra(name)
    if not res:
        return {"matched": False, "message": f"Could not determine Nama Nakshatra from '{name}'. Pick manually."}
    return {"matched": True, "result": res}


@router.get("/nama-nakshatra/table")
def get_nakshatra_padas_table():
    """
    Returns the full classical 108 Pada Akshara table for interactive selection.
    """
    table = []
    for row in NAKSHATRA_PADA_AKSHARAS:
        table.append({
            "nakshatra_index": row[0],
            "nakshatra_en": row[1],
            "nakshatra_te": row[2],
            "rasi_index": row[3],
            "rasi_en": row[4],
            "rasi_te": row[5],
            "pada": row[6],
            "syllables_en": row[7],
            "syllables_te": row[8]
        })
    return {"total_padas": len(table), "padas": table}


def _count_search(request: Request, activity_id: str) -> None:
    """D3 (A): one activity-log row per search, for the admin dashboard. Never blocks a search."""
    try:
        from app.auth.guard import session_user
        from app.auth.database import write_activity_log
        user = session_user(request)
        write_activity_log(user_id=user["id"] if user else None, action="search.muhurta",
                           details=activity_id, ip_address=request.client.host if request.client else None)
    except Exception as ex:  # logging must never break the finder
        logger.warning(f"Could not record a search: {type(ex).__name__}")


@router.post("/find")
def search_muhurta_windows(req: MuhurtaFindRequest, request: Request = None):
    """
    Searches for auspicious continuous time windows using the 3-Layer engine:
    1. Intersects valid Angas (Tithi ∩ Nakshatra ∩ Shubha Lagna)
    2. Enforces 21 Maha Doshas, 10 Dashavidha Doshas, & Pariharams
    3. Computes Pushkara Bhaga & Pushkara Navamsha precise timings
    4. Evaluates participant Balas (Tarabalam, Chandrabalam, Directional Sula)
    5. Returns both candidates (for detailed inspection modal) and ranked continuous windows.
    """
    try:
        s_date = datetime.strptime(req.start_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_date format. Expected YYYY-MM-DD.")

    # Level 2 Astrological bundle
    birth_details: Dict[str, Any] = {}
    # Use Janma Nakshatra or Nama Nakshatra if provided
    active_nak = req.janma_nak_idx or req.nama_nak_idx
    if active_nak:
        birth_details["janma_nak_idx"] = active_nak
    if req.janma_moon_rasi_idx:
        birth_details["janma_moon_rasi_idx"] = req.janma_moon_rasi_idx
    if req.birth_lagna_idx:
        birth_details["birth_lagna_idx"] = req.birth_lagna_idx
    if req.person_name:
        birth_details["person_name"] = req.person_name
    if req.gotra:
        birth_details["gotra"] = req.gotra
    if req.birth_dob:
        birth_details["dob"] = req.birth_dob
    if req.birth_tob:
        birth_details["tob"] = req.birth_tob
    if req.place_name:
        birth_details["place"] = req.place_name

    # Level 3 Activity-specific parameters bundle
    activity_params = {
        "groom_name": req.groom_name,
        "groom_nak_idx": req.groom_nak_idx,
        "groom_gotra": req.groom_gotra,
        "bride_name": req.bride_name,
        "bride_nak_idx": req.bride_nak_idx,
        "bride_gotra": req.bride_gotra,
        "groom_rasi_idx": req.groom_rasi_idx,
        "bride_rasi_idx": req.bride_rasi_idx,
        "groom_eldest": req.groom_eldest,
        "bride_eldest": req.bride_eldest,
        "child_dob": req.child_dob,
        "child_gender": req.child_gender,
        "conception_date": req.conception_date,
        "main_event_date": req.main_event_date,
        "guru_nak_idx": req.guru_nak_idx,
        "vatu_name": req.vatu_name,
        "father_name": req.father_name,
        "father_nak_idx": req.father_nak_idx,
        "mother_nak_idx": req.mother_nak_idx,
        "veda_shakha": req.veda_shakha,
        "sutra": req.sutra,
        "varna": req.varna,
        "owner_name": req.owner_name,
        "owner_nama_nak_idx": req.owner_nama_nak_idx,
        "spouse_name": req.spouse_name,
        "spouse_nama_nak_idx": req.spouse_nama_nak_idx,
        "plot_length": req.plot_length,
        "plot_width": req.plot_width,
        "plot_facing": req.plot_facing,
        "door_facing": req.door_facing,
        "house_type": req.house_type,
        "construction_purpose": req.construction_purpose,
        "business_name": req.business_name,
        "business_type": req.business_type,
        "partner_name": req.partner_name,
        "partner_nama_nak_idx": req.partner_nama_nak_idx,
        "entrance_facing": req.entrance_facing,
        "origin": req.origin,
        "destination": req.destination,
        "travel_direction": req.travel_direction,
        "travel_mode": req.travel_mode,
        "travel_purpose": req.travel_purpose,
        "travel_exemption": req.travel_exemption,
        "vehicle_type": req.vehicle_type,
        "vehicle_muhurta_type": req.vehicle_muhurta_type,
        "time_preference": req.time_preference,
    }

    # People taking part: resolve stars (from birth data where needed) into the engine's keys.
    rule = load_rule(req.activity_id)
    given = [p.model_dump() for p in req.participants]
    if not given and (req.birth_dob or req.janma_nak_idx or req.nama_nak_idx):
        # Older single-person form: treat it as the main participant.
        given = [{"role": "person", "name": req.person_name, "birth_date": req.birth_dob,
                  "from_birth": bool(req.birth_dob),
                  "birth_time": req.birth_tob, "janma_nak_idx": req.janma_nak_idx,
                  "nama_nak_idx": req.nama_nak_idx, "rasi_idx": req.janma_moon_rasi_idx}]
    resolved_people: List[Dict[str, Any]] = []
    people_warnings: List[str] = []
    if given and rule:
        specs = participants_for([p.model_dump() for p in rule.participants] if rule.participants else None,
                                 rule.tab or rule.category, rule.tab_inputs)
        if not req.participants:
            given[0]["role"] = next((s["role"] for s in specs if s.get("primary")), "person")
        resolved_people, people_warnings = resolve_participants(
            specs, given, {"lat": req.lat, "lon": req.lon, "tz_offset": req.tz_offset, "name": req.place_name},
            activity_params, birth_details)

    result = find_muhurta_windows(
        activity_id=req.activity_id,
        start_date=s_date,
        days_to_scan=req.days_to_scan,
        lat=req.lat,
        lon=req.lon,
        tz_offset=req.tz_offset,
        place_name=req.place_name,
        birth_details=birth_details if birth_details else None,
        panchaka_method=req.panchaka_method,
        min_window_minutes=req.min_window_minutes,
        activity_params=activity_params,
        strictness=req.strictness,
        rule_variant=req.rule_variant,
        people=resolved_people,
    )

    if "error" in result:
        err = result["error"]
        if "needs main_event_date" in err:
            raise HTTPException(status_code=400, detail=err)
        status = 500 if err.startswith("Rule file") and "variant" not in err else (400 if "variant" in err else 404)
        raise HTTPException(status_code=status, detail=result["error"])

    if request is not None:
        _count_search(request, req.activity_id)
    result["participants"] = resolved_people
    result["warnings"] = people_warnings + (result.get("warnings") or [])

    # Clean decimal places for API output
    for w in result.get("windows", []):
        w["duration_minutes"] = round(float(w["duration_minutes"]), 1)
        w["duration_ghatis"] = round(float(w["duration_ghatis"]), 2)

    return result

