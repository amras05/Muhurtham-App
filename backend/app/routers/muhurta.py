"""
Muhurta API router.
Serves /muhurta/check, /muhurta/next, and /muhurta/finder.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.services.activity_service import check_activity_on_date, find_next_favorable_date
from app.services.muhurta_finder_service import find_muhurtas

router = APIRouter(prefix="/muhurta", tags=["Muhurta"])


@router.get("/check")
def check_muhurta(
    activity_id: str = Query(...),
    date_str: str = Query(..., alias="date"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    hour: int = Query(6),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """Is `date` good for `activity_id`? Powers the 'Activity Search' single-date check."""
    try:
        return check_activity_on_date(
            activity_id=activity_id,
            date_str=date_str,
            lat=lat,
            lon=lon,
            tz_offset=tz_offset,
            place_name=place_name,
            hour=hour,
            method=method,
        )
    except ValueError as e:
        msg = str(e)
        if "Unknown activity_id" in msg:
            raise HTTPException(404, msg) from e
        raise HTTPException(400, "date must be in YYYY-MM-DD format") from e


@router.get("/next")
def next_muhurta(
    activity_id: str = Query(...),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD, defaults to today"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    max_days: int = Query(60, le=180),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """Find the next favorable date for `activity_id`."""
    try:
        return find_next_favorable_date(
            activity_id=activity_id,
            from_date=from_date,
            lat=lat,
            lon=lon,
            tz_offset=tz_offset,
            place_name=place_name,
            max_days=max_days,
            method=method,
        )
    except ValueError as e:
        msg = str(e)
        if "Unknown activity_id" in msg:
            raise HTTPException(404, msg) from e
        raise HTTPException(400, "from_date must be in YYYY-MM-DD format") from e


@router.get("/finder")
def muhurta_finder(
    date_str: str = Query(..., alias="date", description="Start date YYYY-MM-DD"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(..., description="e.g. 5.5 for IST"),
    place_name: str = Query("Location"),
    days: int = Query(30, le=60, description="Number of days to scan (max 60)"),
    birth_dob: Optional[str] = Query(None, description="Birth DOB (YYYY-MM-DD) for Tarabalam/Ashtama checks"),
    birth_tob: Optional[str] = Query(None, description="Birth TOB (HH:MM) for Tarabalam/Ashtama checks"),
):
    """Find auspicious Muhurtas across consecutive days from the given date."""
    try:
        return find_muhurtas(
            date_str=date_str,
            lat=lat,
            lon=lon,
            tz_offset=tz_offset,
            place_name=place_name,
            days=days,
            birth_dob=birth_dob,
            birth_tob=birth_tob,
        )
    except ValueError as e:
        raise HTTPException(400, "date must be YYYY-MM-DD") from e
