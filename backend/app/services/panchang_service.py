"""
Muhurtham App — Panchang service layer.
Wraps engine calculations and day-summary assembly.
"""
from typing import Dict, Any, List
from app.engines.panchang import compute_day_panchang as compute_drik_panchang
from app.engines.rules import evaluate, list_activities
from app.geo.regions import get_region
from app.utils.date_helpers import parse_date_str


def get_panchang_calculator(method: str = "drik"):
    """
    Returns the calculation function based on requested method.
    Preserves existing behavior (drik engine by default).
    """
    return compute_drik_panchang


def get_panchang_data(
    date_str: str,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str = "Location",
    hour: int = 6,
    method: str = "drik",
) -> Dict[str, Any]:
    """Calculate complete panchang for a given date, location, and hour."""
    y, m, d = parse_date_str(date_str)
    try:
        hour_val = int(hour)
    except (TypeError, ValueError):
        hour_val = 6
    calculator = get_panchang_calculator(method)
    return calculator(y, m, d, lat, lon, tz_offset, place_name, hour=hour_val)


def get_day_summary_data(
    date_str: str,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str = "Location",
    method: str = "drik",
) -> Dict[str, Any]:
    """Calculate panchang and evaluate favorable/avoid/mixed verdict for all activities."""
    y, m, d = parse_date_str(date_str)
    calculator = get_panchang_calculator(method)
    panchang = calculator(y, m, d, lat, lon, tz_offset, place_name)
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


def get_simple_panchang_data(
    date_str: str,
    region: str,
    method: str = "drik",
) -> Dict[str, Any]:
    """Basic panchang lookup using a predefined region."""
    y, m, d = parse_date_str(date_str)
    r = get_region(region)
    calculator = get_panchang_calculator(method)
    return calculator(y, m, d, r["lat"], r["lon"], r["tz_offset"], r["label"])
