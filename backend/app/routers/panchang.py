"""
Panchang API router.
Serves /panchang, /panchang/day-summary, and /panchang/simple.
"""
from fastapi import APIRouter, HTTPException, Query
from app.services.panchang_service import (
    get_panchang_data,
    get_day_summary_data,
    get_simple_panchang_data,
)

router = APIRouter(prefix="/panchang", tags=["Panchang"])


@router.get("")
@router.get("/")
def get_panchang(
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(..., description="e.g. 5.5 for IST"),
    place_name: str = Query("Location"),
    hour: int = Query(6, description="Hour of day to evaluate panchang at (0-23)"),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """Full panchang for a given date/place — powers the 'Date Lookup' screen."""
    try:
        return get_panchang_data(
            date_str=date_str,
            lat=lat,
            lon=lon,
            tz_offset=tz_offset,
            place_name=place_name,
            hour=hour,
            method=method,
        )
    except ValueError as e:
        raise HTTPException(400, "date must be in YYYY-MM-DD format") from e


@router.get("/day-summary")
def day_summary(
    date_str: str = Query(..., alias="date"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """
    Panchang + a verdict for EVERY known activity on this date, in one call.
    """
    try:
        return get_day_summary_data(
            date_str=date_str,
            lat=lat,
            lon=lon,
            tz_offset=tz_offset,
            place_name=place_name,
            method=method,
        )
    except ValueError as e:
        raise HTTPException(400, "date must be in YYYY-MM-DD format") from e


@router.get("/simple")
def simple_panchang(
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    region: str = Query(..., description="region id from /regions, e.g. 'vijayawada'"),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """
    Basic panchang for a region + date, Chandramana-based.
    """
    try:
        return get_simple_panchang_data(
            date_str=date_str,
            region=region,
            method=method,
        )
    except ValueError as e:
        raise HTTPException(400, "date must be in YYYY-MM-DD format") from e
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
