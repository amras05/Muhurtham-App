"""
Muhurtham App — Activity evaluation service layer.
Wraps rules engine evaluation and search for next favorable dates.
"""
from datetime import date
from typing import Dict, Any, List, Optional
from app.engines.rules import evaluate, list_activities, find_next_favorable, get_activity
from app.services.panchang_service import get_panchang_calculator
from app.utils.date_helpers import parse_date_str, parse_date


def get_all_activities() -> List[Dict[str, Any]]:
    """List all activities digitized in the rules engine."""
    return list_activities()


def check_activity_on_date(
    activity_id: str,
    date_str: str,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str = "Location",
    hour: int = 6,
    method: str = "drik",
) -> Dict[str, Any]:
    """Check if a specific date is favorable for the given activity."""
    activity = get_activity(activity_id)
    if not activity:
        raise ValueError(f"Unknown activity_id '{activity_id}'")

    y, m, d = parse_date_str(date_str)
    try:
        hour_val = int(hour)
    except (TypeError, ValueError):
        hour_val = 6
    calculator = get_panchang_calculator(method)
    panchang = calculator(y, m, d, lat, lon, tz_offset, place_name, hour=hour_val)
    return evaluate(activity_id, panchang)


def find_next_favorable_date(
    activity_id: str,
    from_date: Optional[str],
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str = "Location",
    max_days: int = 60,
    method: str = "drik",
) -> Dict[str, Any]:
    """Find the next favorable date for an activity starting from a given date."""
    activity = get_activity(activity_id)
    if not activity:
        raise ValueError(f"Unknown activity_id '{activity_id}'")

    if from_date:
        start = parse_date(from_date)
    else:
        start = date.today()

    return find_next_favorable(
        activity_id,
        start.year,
        start.month,
        start.day,
        lat,
        lon,
        tz_offset,
        place_name,
        max_days=max_days,
        method=method,
    )
