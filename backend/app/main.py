# pyrefly: ignore [missing-import]
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException, Query
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from datetime import date, datetime, timedelta
# pyrefly: ignore [missing-import]
import swisseph as swe
# pyrefly: ignore [missing-import]
from jhora.panchanga.drik import Place as JHoraPlace
# pyrefly: ignore [missing-import]
from jhora.panchanga import drik
# pyrefly: ignore [missing-import]
from jhora.horoscope.chart import charts

from .panchang import compute_day_panchang as compute_drik_panchang
# from .panchang_chandramana import compute_day_panchang as compute_chandramana_panchang

def get_panchang_calculator(method: str):
    # if method == "chandramana":
    #     return compute_chandramana_panchang
    return compute_drik_panchang

from .rules_engine import evaluate, list_activities, find_next_favorable, get_activity
from .regions import get_region, list_regions, geocode_place_name, get_geocode_suggestions

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
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """Full panchang for a given date/place — powers the 'Date Lookup' screen."""
    try:
        y, m, d = (int(x) for x in date_str.split("-"))
    except ValueError:
        raise HTTPException(400, "date must be in YYYY-MM-DD format")
    calculator = get_panchang_calculator(method)
    return calculator(y, m, d, lat, lon, tz_offset, place_name, hour=hour)


@app.get("/panchang/day-summary")
def day_summary(
    date_str: str = Query(..., alias="date"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
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

    calculator = get_panchang_calculator(method)
    panchang = calculator(y, m, d, lat, lon, tz_offset, place_name)
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
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """Is `date` good for `activity_id`? Powers the 'Activity Search' screen (single-date check)."""
    if not get_activity(activity_id):
        raise HTTPException(404, f"Unknown activity_id '{activity_id}'")
    try:
        y, m, d = (int(x) for x in date_str.split("-"))
    except ValueError:
        raise HTTPException(400, "date must be in YYYY-MM-DD format")
    calculator = get_panchang_calculator(method)
    panchang = calculator(y, m, d, lat, lon, tz_offset, place_name, hour=hour)
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
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
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
                                lat, lon, tz_offset, place_name, max_days=max_days, method=method)


@app.get("/regions")
def get_regions():
    """List available region presets for the region dropdown."""
    return list_regions()


@app.get("/panchang/simple")
def simple_panchang(
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    region: str = Query(..., description="region id from /regions, e.g. 'vijayawada'"),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """
    Basic panchang for a region + date, Chandramana-based —
    powers the small standalone lookup UI (date + region in, panchang out).
    """
    try:
        y, m, d = (int(x) for x in date_str.split("-"))
    except ValueError:
        raise HTTPException(400, "date must be in YYYY-MM-DD format")
    try:
        r = get_region(region)
    except KeyError as e:
        raise HTTPException(404, str(e))

    calculator = get_panchang_calculator(method)
    p = calculator(y, m, d, r["lat"], r["lon"], r["tz_offset"], r["label"])
    return p


@app.get("/geocode")
def geocode(place: str = Query(..., description="Any place name, e.g. 'Kakinada, Andhra Pradesh'")):
    """
    Free-text place lookup via OpenStreetMap (for places not in /regions).
    NOTE: not live-tested in the development sandbox (no network access to
    nominatim.openstreetmap.org there) — verify this works in your deployment.
    """
    try:
        return geocode_place_name(place)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(502, f"Geocoding service error: {e}")


@app.get("/geocode/suggestions")
def geocode_suggestions(q: str = Query(..., description="Query string, min 3 chars")):
    """Get geocoding suggestions."""
    return get_geocode_suggestions(q)


@app.get("/muhurta/namakarana-finder")
def namakarana_finder(
    dob: str = Query(..., description="YYYY-MM-DD"),
    tob: str = Query("12:00", description="HH:MM"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(...),
    place_name: str = Query("Location"),
    method: str = Query("drik", description="Calculation method: 'drik' or 'chandramana'"),
):
    """Find the best Namakarana Muhurtas on the 11th, 12th, 16th, 20th, and 22nd days from birth."""
    try:
        birth_date = datetime.strptime(dob, "%Y-%m-%d").date()
        h, m = (int(x) for x in tob.split(":"))
    except ValueError:
        raise HTTPException(400, "dob must be YYYY-MM-DD, tob must be HH:MM")

    calculator = get_panchang_calculator(method)

    # 1. Determine Janma Nakshatra at birth hour
    birth_panchang = calculator(birth_date.year, birth_date.month, birth_date.day,
                                         lat, lon, tz_offset, place_name, hour=h)
    birth_nak_idx = birth_panchang["nakshatra"]["index"]
    birth_nak_name = birth_panchang["nakshatra"]["name"]
    birth_nak_pada = birth_panchang["nakshatra"]["pada"]

    # Calculate D1 (Rasi) chart for birth
    d1_positions = []
    try:
        birth_place_obj = JHoraPlace(place_name, lat, lon, tz_offset)
        # PyJHora expects JD in LOCAL time — it subtracts tz internally
        local_hour = h + m / 60.0
        birth_jd = swe.julday(birth_date.year, birth_date.month, birth_date.day, local_hour)
        
        raw_d1 = charts.divisional_chart(birth_jd, birth_place_obj, divisional_chart_factor=1)
        
        # Get retro/combust flags
        retro_ids = charts.planets_in_retrograde(raw_d1)
        combust_ids = charts.planets_in_combustion(raw_d1)
        
        for item in raw_d1:
            p_id = item[0]
            rasi_idx = item[1][0]
            
            is_retro = False
            is_combust = False
            try:
                p_int = int(p_id)
                is_retro = p_int in retro_ids
                is_combust = p_int in combust_ids
            except (ValueError, TypeError):
                pass
                
            d1_positions.append({
                "planet": str(p_id),
                "rasi_index": int(rasi_idx),
                "is_retro": is_retro,
                "is_combust": is_combust
            })
            
        # --- Mandi and Gulika calculation ---
        # 1. Determine the "base_date" of the day (since weekday starts at Sunrise)
        jd_birth_midnight = swe.julday(birth_date.year, birth_date.month, birth_date.day, 0.0)
        sr_birth_date = drik.sunrise(jd_birth_midnight + 6.0/24.0, birth_place_obj)[0]
        
        if local_hour < sr_birth_date:
            base_date = birth_date - timedelta(days=1)
            is_day = False
        else:
            base_date = birth_date
            jd_base_midnight = swe.julday(base_date.year, base_date.month, base_date.day, 0.0)
            ss_base_date = drik.sunset(jd_base_midnight + 6.0/24.0, birth_place_obj)[0]
            is_day = local_hour < ss_base_date
            
        # 2. Weekday and day/night duration
        jd_base_midnight = swe.julday(base_date.year, base_date.month, base_date.day, 0.0)
        weekday = drik.vaara(jd_base_midnight + 12.0/24.0, birth_place_obj)
        
        if is_day:
            sr = drik.sunrise(jd_base_midnight + 6.0/24.0, birth_place_obj)[0]
            ss = drik.sunset(jd_base_midnight + 6.0/24.0, birth_place_obj)[0]
            duration = ss - sr
            part_dur = duration / 8.0
            day_parts = [6, 5, 4, 3, 2, 1, 0]
            part_idx = day_parts[weekday]
            gk_time_rel = sr + part_idx * part_dur
            mnd_time_rel = sr + (part_idx + 0.5) * part_dur
        else:
            ss = drik.sunset(jd_base_midnight + 6.0/24.0, birth_place_obj)[0]
            sr_next = drik.sunrise(jd_base_midnight + 1.0 + 6.0/24.0, birth_place_obj)[0]
            duration = (24.0 + sr_next) - ss
            part_dur = duration / 8.0
            night_parts = [2, 1, 0, 6, 5, 4, 3]
            part_idx = night_parts[weekday]
            gk_time_rel = ss + part_idx * part_dur
            mnd_time_rel = ss + (part_idx + 0.5) * part_dur
            
        jd_gk = jd_base_midnight + gk_time_rel / 24.0
        jd_mnd = jd_base_midnight + mnd_time_rel / 24.0
        
        gk_lagna = drik.ascendant(jd_gk, birth_place_obj)
        mnd_lagna = drik.ascendant(jd_mnd, birth_place_obj)
        
        d1_positions.append({
            "planet": "Mnd",
            "rasi_index": int(mnd_lagna[0]),
            "is_retro": False,
            "is_combust": False
        })
        d1_positions.append({
            "planet": "Gk",
            "rasi_index": int(gk_lagna[0]),
            "is_retro": False,
            "is_combust": False
        })
    except Exception as ex:
        print("D1 chart calculation error:", ex)

    # Candidate day offsets from birth day (Day 1 is birth date, so Day 11 is +10 days)
    offsets = {
        11: 10,
        12: 11,
        16: 15,
        20: 19,
        22: 21
    }

    candidates_list = []
    tara_names = {
        1: "Janma", 2: "Sampat", 3: "Vipat", 4: "Kshema", 5: "Pratyak",
        6: "Sadhana", 7: "Naidhana", 8: "Mitra", 9: "Paramamitra"
    }
    
    # We evaluate the Muhurtas at 10 AM (standard auspicious morning hour)
    eval_hour = 10

    for day_num, offset_days in offsets.items():
        cand_date = birth_date + timedelta(days=offset_days)
        p = calculator(cand_date.year, cand_date.month, cand_date.day,
                                 lat, lon, tz_offset, place_name, hour=eval_hour)
        
        # Calculate Tarabala
        diff = (p["nakshatra"]["index"] - birth_nak_idx) % 27
        tara_idx = (diff % 9) + 1
        tara_name = tara_names[tara_idx]
        is_tara_good = tara_idx in [2, 4, 6, 8, 9]

        # General checks
        is_vaara_good = p["vaara"] in ["Monday", "Wednesday", "Thursday", "Friday"]
        is_nak_good = p["nakshatra"]["name"] in [
            "Ashwini", "Rohini", "Punarvasu", "Pushya", "Uttara Phalguni", 
            "Hasta", "Swati", "Anuradha", "Uttara Ashadha", "Shravana", 
            "Dhanishtha", "Shatabhisha", "Uttara Bhadrapada"
        ]
        is_tithi_avoid = p["tithi"]["name"] in ["Chaturthi", "Navami", "Purnima", "Amavasya"]

        # Scoring
        vaara_score = 25 if is_vaara_good else 0
        nak_score = 25 if is_nak_good else 0
        tithi_score = 25 if not is_tithi_avoid else 0
        tara_score = 25 if is_tara_good else 0
        
        total_pct = vaara_score + nak_score + tithi_score + tara_score
        
        # Avoid Tithi is a blocker, penalize/cap heavily
        if is_tithi_avoid:
            total_pct = min(total_pct, 10)

        # Build list of user-facing reasons
        reasons = []
        if is_vaara_good:
            reasons.append(f"{p['vaara']} is favorable.")
        else:
            reasons.append(f"{p['vaara']} is unfavorable.")

        if is_nak_good:
            reasons.append(f"Nakshatra {p['nakshatra']['name']} is favorable.")
        else:
            reasons.append(f"Nakshatra {p['nakshatra']['name']} is not recommended.")

        if is_tithi_avoid:
            reasons.append(f"Tithi {p['tithi']['name']} must be avoided!")
        else:
            reasons.append(f"Tithi {p['tithi']['name']} is favorable.")

        reasons.append(f"Tarabalam is {tara_name} ({'favorable' if is_tara_good else 'unfavorable'}).")

        verdict = "highly_favorable" if total_pct >= 75 else ("favorable" if total_pct >= 50 else "unfavorable")

        candidates_list.append({
            "day_number": day_num,
            "date": cand_date.strftime("%Y-%m-%d"),
            "percentage": total_pct,
            "tara": tara_name,
            "is_tara_good": is_tara_good,
            "verdict": verdict,
            "reasons": reasons,
            "panchang": {
                "vaara": p["vaara"],
                "tithi": f"{p['tithi']['name']} ({p['tithi']['paksha']})",
                "nakshatra": p["nakshatra"]["name"],
                "yoga": p["yoga"]["name"],
                "karana": p["karana"]["name"]
            }
        })

    return {
        "birth_details": {
            "dob": dob,
            "tob": tob,
            "place": place_name,
            "janma_nakshatra": birth_nak_name,
            "janma_nakshatra_pada": birth_nak_pada,
            "d1_chart": d1_positions
        },
        "candidates": candidates_list
    }


@app.get("/health")
def health():
    return {"status": "ok"}


