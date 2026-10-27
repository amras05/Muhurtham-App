"""
Samskara and Pitrukarya API router.
Serves /muhurta/samskaras/list, /muhurta/samskara-finder, /muhurta/namakarana-finder, /muhurta/pitrukarya-finder.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.services.samskara_service import (
    get_samskara_list,
    find_samskara_candidate_muhurtas,
    find_pitrukarya_muhurtas,
)
from app.core.logging import logger

router = APIRouter(prefix="/muhurta", tags=["Samskaras"])


@router.get("/samskaras/list")
def list_all_samskaras():
    """List all 16 Classical Vedic Samskaras digitized from the treatise with metadata."""
    return get_samskara_list()


@router.get("/samskara-finder")
def samskara_finder(
    type: str = Query(..., description="Samskara ID"),
    dob: str = Query(..., description="Reference date (YYYY-MM-DD) e.g. birth date, LMP date, or target date"),
    tob: str = Query("12:00", description="HH:MM"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    child_gender: Optional[str] = Query(None, description="'male' or 'female'"),
    ceremony_type: Optional[str] = Query(None, description="'seemantha' or 'valaikappu_gajulu'"),
    timing_mode: Optional[str] = Query(None, description="'early' or 'later'"),
    age_mode: Optional[str] = Query(None, description="'months' or 'years'"),
    varna: Optional[str] = Query(None, description="'brahmin', 'kshatriya', 'vaishya'"),
    study_years: Optional[int] = Query(None, description="Target year offset from birth"),
    husband_moon_rasi_idx: Optional[int] = Query(None, description="1-12 Janma Rasi index of husband"),
    husband_nak_idx: Optional[int] = Query(None, description="1-27 Janma Nakshatra index of husband"),
    bride_ritu_lagna_idx: Optional[int] = Query(None, description="1-12 First Ritu Lagna of bride"),
    bride_nak_idx: Optional[int] = Query(None, description="1-27 Janma Nakshatra of bride"),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """Find the best classical Muhurtas for any of the 16 digitized Samskaras."""
    try:
        return find_samskara_candidate_muhurtas(
            samskara_type=type,
            dob=dob,
            tob=tob,
            lat=lat,
            lon=lon,
            tz_offset=tz_offset,
            place_name=place_name,
            child_gender=child_gender,
            ceremony_type=ceremony_type,
            timing_mode=timing_mode,
            age_mode=age_mode,
            varna=varna,
            study_years=study_years,
            husband_moon_rasi_idx=husband_moon_rasi_idx,
            husband_nak_idx=husband_nak_idx,
            bride_ritu_lagna_idx=bride_ritu_lagna_idx,
            bride_nak_idx=bride_nak_idx,
            method=method,
        )
    except ValueError as ex:
        raise HTTPException(400, str(ex)) from ex
    except Exception as ex:
        logger.error(f"Error in samskara_finder: {ex}", exc_info=True)
        raise HTTPException(500, f"Error calculating Samskara Muhurtas: {str(ex)}") from ex


@router.get("/namakarana-finder")
def namakarana_finder(
    dob: str = Query(..., description="YYYY-MM-DD"),
    tob: str = Query("12:00", description="HH:MM"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """Backwards-compatible endpoint for Namakarana Muhurtas."""
    return samskara_finder(
        type="namakarana",
        dob=dob,
        tob=tob,
        lat=lat,
        lon=lon,
        tz_offset=tz_offset,
        place_name=place_name,
        method=method,
    )


@router.get("/pitrukarya-finder")
def pitrukarya_finder(
    death_date: str = Query(..., description="Date of death (YYYY-MM-DD)"),
    tob: str = Query("12:00", description="HH:MM"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    mode: str = Query("pending", description="'pending' or 'calendar'"),
    calendar_year: Optional[int] = Query(None, description="Gregorian year for calendar mode"),
):
    """Antyeshti / Pitrukarya — tithi-locked karya windows (treatise Part 5.3)."""
    try:
        return find_pitrukarya_muhurtas(
            death_date=death_date,
            tob=tob,
            lat=lat,
            lon=lon,
            tz_offset=tz_offset,
            place_name=place_name,
            mode=mode,
            calendar_year=calendar_year,
        )
    except ValueError as ex:
        raise HTTPException(400, "death_date must be YYYY-MM-DD") from ex
    except Exception as ex:
        logger.error(f"Error in pitrukarya_finder: {ex}", exc_info=True)
        raise HTTPException(500, f"Pitrukarya calculation failed: {str(ex)}") from ex
