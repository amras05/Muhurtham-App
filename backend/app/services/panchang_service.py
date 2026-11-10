"""
Muhurtham App — Panchang service layer.
Wraps engine calculations and day-summary assembly.
"""
import calendar
from typing import Dict, Any, List
from app.engines.panchang import compute_day_panchang as compute_drik_panchang
from app.engines.rules import evaluate, list_activities
from app.geo.regions import get_region
from app.utils.date_helpers import parse_date_str


def get_panchang_data(
    date_str: str,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str = "Location",
    hour: int = 6,
) -> Dict[str, Any]:
    """Calculate complete panchang for a given date, location, and hour."""
    y, m, d = parse_date_str(date_str)
    try:
        hour_val = int(hour)
    except (TypeError, ValueError):
        hour_val = 6
    return compute_drik_panchang(y, m, d, lat, lon, tz_offset, place_name, hour=hour_val)


def get_day_summary_data(
    date_str: str,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str = "Location",
) -> Dict[str, Any]:
    """Calculate panchang and evaluate favorable/avoid/mixed verdict for all activities."""
    y, m, d = parse_date_str(date_str)
    panchang = compute_drik_panchang(y, m, d, lat, lon, tz_offset, place_name)
    activities = list_activities()
    results = [evaluate(a["id"], panchang) for a in activities]
    favorable = [r for r in results if r.get("verdict") == "favorable"]
    avoid = [r for r in results if r.get("verdict") == "avoid"]
    mixed = [r for r in results if r.get("verdict") == "mixed"]
    return {
        "panchang": panchang,
        "favorable_activities": favorable,
        "avoid_activities": avoid,
        "mixed_activities": mixed,
    }


def _month_day_entry(p: Dict[str, Any]) -> Dict[str, Any]:
    """The parts of one day's panchang that the month calendar and its day panel show."""
    cm = p.get("chandramana") or {}
    return {
        "date": p["date"],
        "vaara": p["vaara"],
        "sunrise": p["sunrise"],
        "sunset": p["sunset"],
        "tithi": {k: p["tithi"][k] for k in ("name", "number", "paksha", "end_time")},
        "nakshatra": {k: p["nakshatra"][k] for k in ("name", "pada", "end_time")},
        "yoga": {k: p["yoga"][k] for k in ("name", "end_time")},
        "karana": {k: p["karana"][k] for k in ("name", "end_time")},
        "rahu_kalam": p.get("rahu_kalam"),
        "yamagandam": p.get("yamagandam"),
        "gulika_kalam": p.get("gulika_kalam"),
        "durmuhurtam": p.get("durmuhurtam") or [],
        "varjyam": p.get("varjyam"),
        "abhijit_muhurta": p.get("abhijit_muhurta"),
        "amrit_kalam": p.get("amrit_kalam") or [],
        "special_yogas": [
            {"name_en": y.get("name_en"), "name_te": y.get("name_te"), "type": y.get("type")}
            for y in (p.get("special_yogas") or [])
        ],
        "chandramana": {
            "month_name": cm.get("month_name"),
            "is_adhika_masa": cm.get("is_adhika_masa", False),
            "samvatsara_name": cm.get("samvatsara_name"),
            "samvatsara_telugu": cm.get("samvatsara_telugu"),
        },
    }


def get_month_panchang_data(
    year: int,
    month: int,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str = "Location",
) -> Dict[str, Any]:
    """Panchang for every day of a calendar month (Drik), trimmed for the month calendar."""
    days_in_month = calendar.monthrange(year, month)[1]
    days = [
        _month_day_entry(compute_drik_panchang(year, month, d, lat, lon, tz_offset, place_name))
        for d in range(1, days_in_month + 1)
    ]
    return {"year": year, "month": month, "place": place_name, "days": days}


def get_simple_panchang_data(
    date_str: str,
    region: str,
) -> Dict[str, Any]:
    """Basic panchang lookup using a predefined region."""
    y, m, d = parse_date_str(date_str)
    r = get_region(region)
    return compute_drik_panchang(y, m, d, r["lat"], r["lon"], r["tz_offset"], r["label"])
