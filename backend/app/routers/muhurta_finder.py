"""
Unified Declarative Muhurtha Finder Router (Layer 3 API).
Exposes the catalog of all ~80 events and the continuous window calculation engine.
"""
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.engines.rule_interpreter import find_muhurta_windows, list_all_rules, load_rule
from app.engines.nama_nakshatra import (
    lookup_nama_nakshatra,
    NAKSHATRA_PADA_AKSHARAS,
    check_travel_directional_sula,
    check_facing_compatibility
)

router = APIRouter(prefix="/muhurta", tags=["Muhurtha Finder Engine"])


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

    # Level 1 — General
    person_name: Optional[str] = Field(None, description="Primary person name")
    date_to: Optional[str] = Field(None, description="End date YYYY-MM-DD")
    time_preference: Optional[str] = Field("any", description="Time preference: 'any', 'morning', 'afternoon', 'night'")

    # Level 2 — Astrological & Nama Nakshatra
    janma_nak_idx: Optional[int] = Field(None, ge=1, le=27, description="Janma Nakshatra index (1-27)")
    janma_pada: Optional[int] = Field(None, ge=1, le=4, description="Janma Nakshatra Pada (1-4)")
    janma_moon_rasi_idx: Optional[int] = Field(None, ge=1, le=12, description="Janma Rasi index (1-12)")
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
        "categories": categories,
        "all_activities": rules
    }


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


@router.post("/find")
def search_muhurta_windows(req: MuhurtaFindRequest):
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
        "vehicle_type": req.vehicle_type,
        "vehicle_muhurta_type": req.vehicle_muhurta_type
    }

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
        activity_params=activity_params
    )

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    # Clean decimal places for API output
    for w in result.get("windows", []):
        w["duration_minutes"] = round(float(w["duration_minutes"]), 1)
        w["duration_ghatis"] = round(float(w["duration_ghatis"]), 2)

    return result

