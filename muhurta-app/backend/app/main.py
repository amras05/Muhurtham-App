from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import date

from .panchang import compute_day_panchang
from .rules_engine import evaluate, list_activities, find_next_favorable, get_activity

app = FastAPI(title="Muhurta Finder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before production
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/activities")
def get_activities():
    """List all activities the app currently has digitized rules for."""
    return list_activities()


@app.get("/panchang")
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
        y, m, d = (int(x) for x in date_str.split("-"))
    except ValueError:
        raise HTTPException(400, "date must be in YYYY-MM-DD format")
    return compute_day_panchang(y, m, d, lat, lon, tz_offset, place_name, hour=hour)


@app.get("/panchang/day-summary")
def day_summary(
    date_str: str = Query(..., alias="date"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
):
    """
    Panchang + a verdict for EVERY known activity on this date, in one call —
    this is what the 'Date Lookup' screen shows: 'here's today, here's what's
    good to do and what to avoid'.
    """
    try:
        y, m, d = (int(x) for x in date_str.split("-"))
    except ValueError:
        raise HTTPException(400, "date must be in YYYY-MM-DD format")

    panchang = compute_day_panchang(y, m, d, lat, lon, tz_offset, place_name)
    activities = list_activities()
    results = [evaluate(a["id"], panchang) for a in activities]
    favorable = [r for r in results if r["verdict"] == "favorable"]
    avoid = [r for r in results if r["verdict"] == "avoid"]
    mixed = [r for r in results if r["verdict"] == "mixed"]
    return {
        "panchang": panchang,
        "favorable_activities": favorable,
        "avoid_activities": avoid,
        "mixed_activities": mixed,
    }


@app.get("/muhurta/check")
def check_muhurta(
    activity_id: str = Query(...),
    date_str: str = Query(..., alias="date"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    hour: int = Query(6),
):
    """Is `date` good for `activity_id`? Powers the 'Activity Search' screen (single-date check)."""
    if not get_activity(activity_id):
        raise HTTPException(404, f"Unknown activity_id '{activity_id}'")
    try:
        y, m, d = (int(x) for x in date_str.split("-"))
    except ValueError:
        raise HTTPException(400, "date must be in YYYY-MM-DD format")
    panchang = compute_day_panchang(y, m, d, lat, lon, tz_offset, place_name, hour=hour)
    return evaluate(activity_id, panchang)


@app.get("/muhurta/next")
def next_muhurta(
    activity_id: str = Query(...),
    from_date: str = Query(None, description="YYYY-MM-DD, defaults to today"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    max_days: int = Query(60, le=180),
):
    """Find the next favorable date for `activity_id` — the core 'Activity Search' feature."""
    if not get_activity(activity_id):
        raise HTTPException(404, f"Unknown activity_id '{activity_id}'")
    if from_date:
        y, m, d = (int(x) for x in from_date.split("-"))
        start = date(y, m, d)
    else:
        start = date.today()
    return find_next_favorable(activity_id, start.year, start.month, start.day,
                                lat, lon, tz_offset, place_name, max_days=max_days)


@app.get("/health")
def health():
    return {"status": "ok"}
