"""
Muhurtham App — Samskara and Pitrukarya service layer.
Orchestrates finding Samskara Muhurtas and Pitrukarya dates.
"""
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from app.engines.samskaras import SAMSKARA_REGISTRY, find_samskara_muhurtas
from app.engines.pitrukarya import find_pitrukarya
from app.services.panchang_service import get_panchang_calculator
from app.utils.date_helpers import parse_date


def get_samskara_list() -> List[Dict[str, Any]]:
    """List all 16 Classical Vedic Samskaras digitized from the treatise with metadata."""
    return [
        {
            "id": s["id"],
            "page_number": s["page_number"],
            "name_en": s["name_en"],
            "name_te": s["name_te"],
            "tagline_en": s["tagline_en"],
            "tagline_te": s["tagline_te"],
            "icon": s["icon"],
            "rules_summary_en": s["rules_summary_en"],
            "rules_summary_te": s["rules_summary_te"],
            "special_checks": s.get("special_checks", []),
        }
        for s in SAMSKARA_REGISTRY.values()
    ]


def find_samskara_candidate_muhurtas(
    samskara_type: str,
    dob: str,
    tob: str,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str,
    child_gender: Optional[str] = None,
    ceremony_type: Optional[str] = None,
    timing_mode: Optional[str] = None,
    age_mode: Optional[str] = None,
    varna: Optional[str] = None,
    study_years: Optional[int] = None,
    husband_moon_rasi_idx: Optional[int] = None,
    husband_nak_idx: Optional[int] = None,
    bride_ritu_lagna_idx: Optional[int] = None,
    bride_nak_idx: Optional[int] = None,
    method: str = "drik",
) -> Any:
    """Find the best classical Muhurtas for any of the 16 digitized Samskaras."""
    base_date = parse_date(dob)
    calculator = get_panchang_calculator(method)

    return find_samskara_muhurtas(
        samskara_id=samskara_type,
        base_date=base_date,
        lat=lat,
        lon=lon,
        tz_offset=tz_offset,
        place_name=place_name,
        birth_time_str=tob,
        calculator_fn=calculator,
        child_gender=child_gender or "male",
        ceremony_type=ceremony_type or "seemantha",
        timing_mode=timing_mode or "early",
        age_mode=age_mode or "months",
        varna=varna or "brahmin",
        study_years=study_years,
        husband_moon_rasi_idx=husband_moon_rasi_idx,
        husband_nak_idx=husband_nak_idx,
        bride_ritu_lagna_idx=bride_ritu_lagna_idx,
        bride_nak_idx=bride_nak_idx,
    )


def find_pitrukarya_muhurtas(
    death_date: str,
    tob: str,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str,
    mode: str = "pending",
    calendar_year: Optional[int] = None,
) -> Any:
    """Antyeshti / Pitrukarya — tithi-locked karya windows."""
    d0 = parse_date(death_date)
    return find_pitrukarya(
        death_date=d0,
        lat=lat,
        lon=lon,
        tz_offset=tz_offset,
        place_name=place_name,
        mode=mode,
        calendar_year=calendar_year,
    )
