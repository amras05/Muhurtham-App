"""
Panchang API router.
Serves /panchang, /panchang/day-summary, and /panchang/simple.
"""
from fastapi import APIRouter, HTTPException, Query
from app.services.panchang_service import (
    get_panchang_data,
    get_day_summary_data,
    get_simple_panchang_data,
    get_month_panchang_data,
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
        )
    except ValueError as e:
        raise HTTPException(400, "date must be in YYYY-MM-DD format") from e


@router.get("/month")
def month_panchang(
    year: int = Query(..., ge=1900, le=2100),
    month: int = Query(..., ge=1, le=12),
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    tz_offset: float = Query(..., ge=-14, le=14),
    place_name: str = Query("Location"),
):
    """Every day of one month — powers the 'Month' calendar tab on the Panchang page."""
    return get_month_panchang_data(year, month, lat, lon, tz_offset, place_name)


@router.get("/simple")
def simple_panchang(
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    region: str = Query(..., description="region id from /regions, e.g. 'vijayawada'"),
):
    """
    Basic panchang for a region + date, Chandramana-based.
    """
    try:
        return get_simple_panchang_data(
            date_str=date_str,
            region=region,
        )
    except ValueError as e:
        raise HTTPException(400, "date must be in YYYY-MM-DD format") from e
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
