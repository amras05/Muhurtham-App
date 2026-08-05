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
# pyrefly: ignore [missing-import]
from jhora import utils

from .panchang import compute_day_panchang as compute_drik_panchang
from .names import CANONICAL_NAKSHATRA, RASI_NAMES
from .doshas_engine import evaluate_21_maha_doshas, evaluate_10_dashavidha_doshas
# from .panchang_chandramana import compute_day_panchang as compute_chandramana_panchang

def get_panchang_calculator(method: str):
    # if method == "chandramana":
    #     return compute_chandramana_panchang
    return compute_drik_panchang

from .rules_engine import evaluate, list_activities, find_next_favorable, get_activity
from .regions import get_region, list_regions, geocode_place_name, get_geocode_suggestions
from .auth import auth_router

app = FastAPI(title="Muhurta Finder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

from .muhurta_finder import router as muhurta_finder_router
app.include_router(muhurta_finder_router)



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


def compute_d1_positions(target_date, eval_hour, birth_place_obj):
    try:
        jd = swe.julday(target_date.year, target_date.month, target_date.day, eval_hour)
        raw_d1 = charts.divisional_chart(jd, birth_place_obj, divisional_chart_factor=1)
        retro_ids = charts.planets_in_retrograde(raw_d1)
        combust_ids = charts.planets_in_combustion(raw_d1)
        
        positions = []
        swe.set_sid_mode(swe.SIDM_LAHIRI)
        flags_speed = swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED

        for item in raw_d1:
            p_id = item[0]
            rasi_idx = item[1][0]
            deg = item[1][1]
            tot_long = rasi_idx * 30.0 + deg
            
            nak_no, pada, _ = drik.nakshatra_pada(tot_long)
            raw_nak = utils.NAKSHATRA_LIST[nak_no - 1]
            canon_nak = CANONICAL_NAKSHATRA.get(raw_nak, raw_nak)
            
            is_retro = False
            is_combust = False
            
            p_str = str(p_id)
            if p_str in ["7", "8"]:
                is_retro = True
            elif p_str not in ["0", "1", "L", "Mnd", "Gk"]:
                try:
                    p_int = int(p_str)
                    swe_map = {2: swe.MARS, 3: swe.MERCURY, 4: swe.JUPITER, 5: swe.VENUS, 6: swe.SATURN}
                    if p_int in swe_map:
                        res = swe.calc_ut(jd, swe_map[p_int], flags_speed)[0]
                        speed = res[3]
                        is_retro = speed < 0
                        
                    is_combust = p_int in combust_ids
                except (ValueError, TypeError):
                    pass
                
            positions.append({
                "planet": str(p_id),
                "rasi_index": int(rasi_idx),
                "is_retro": is_retro,
                "is_combust": is_combust,
                "nakshatra": canon_nak,
                "pada": int(pada)
            })

        # Mandi & Gulika calculation
        jd_midnight = swe.julday(target_date.year, target_date.month, target_date.day, 0.0)
        sr_date = drik.sunrise(jd_midnight + 6.0/24.0, birth_place_obj)[0]
        
        if eval_hour < sr_date:
            base_date = target_date - timedelta(days=1)
            is_day = False
        else:
            base_date = target_date
            jd_base_midnight = swe.julday(base_date.year, base_date.month, base_date.day, 0.0)
            ss_base_date = drik.sunset(jd_base_midnight + 6.0/24.0, birth_place_obj)[0]
            is_day = eval_hour < ss_base_date
            
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

        mnd_long = mnd_lagna[0] * 30.0 + mnd_lagna[1]
        mnd_nak_no, mnd_pada, _ = drik.nakshatra_pada(mnd_long)
        raw_mnd_nak = utils.NAKSHATRA_LIST[mnd_nak_no - 1]

        gk_long = gk_lagna[0] * 30.0 + gk_lagna[1]
        gk_nak_no, gk_pada, _ = drik.nakshatra_pada(gk_long)
        raw_gk_nak = utils.NAKSHATRA_LIST[gk_nak_no - 1]

        positions.append({
            "planet": "Mnd",
            "rasi_index": int(mnd_lagna[0]),
            "is_retro": False,
            "is_combust": False,
            "nakshatra": CANONICAL_NAKSHATRA.get(raw_mnd_nak, raw_mnd_nak),
            "pada": int(mnd_pada)
        })
        positions.append({
            "planet": "Gk",
            "rasi_index": int(gk_lagna[0]),
            "is_retro": False,
            "is_combust": False,
            "nakshatra": CANONICAL_NAKSHATRA.get(raw_gk_nak, raw_gk_nak),
            "pada": int(gk_pada)
        })
        return positions, raw_d1
    except Exception as ex:
        print("compute_d1_positions error:", ex)
        return [], []


# Pushkara Navamsha ranges per Rasi (0-indexed: 0=Mesha, 1=Vrishabha, ... 11=Meena)
PUSHKARA_RANGES = {
    # Fiery (Mesha 0, Simha 4, Dhanus 8): 20°00'-23°20' (7th Navamsha) & 26°40'-30°00' (9th Navamsha)
    0: [(20.0, 23.3333), (26.6667, 30.0)],
    4: [(20.0, 23.3333), (26.6667, 30.0)],
    8: [(20.0, 23.3333), (26.6667, 30.0)],
    
    # Earthy (Vrishabha 1, Kanya 5, Makara 9): 6°40'-10°00' (3rd Navamsha) & 13°20'-16°40' (5th Navamsha)
    1: [(6.6667, 10.0), (13.3333, 16.6667)],
    5: [(6.6667, 10.0), (13.3333, 16.6667)],
    9: [(6.6667, 10.0), (13.3333, 16.6667)],
    
    # Airy (Mithuna 2, Tula 6, Kumbha 10): 16°40'-20°00' (6th Navamsha) & 23°20'-26°40' (8th Navamsha)
    2: [(16.6667, 20.0), (23.3333, 26.6667)],
    6: [(16.6667, 20.0), (23.3333, 26.6667)],
    10: [(16.6667, 20.0), (23.3333, 26.6667)],
    
    # Watery (Karkataka 3, Vrishchika 7, Meena 11): 0°00'-3°20' (1st Navamsha) & 6°40'-10°00' (3rd Navamsha)
    3: [(0.0, 3.3333), (6.6667, 10.0)],
    7: [(0.0, 3.3333), (6.6667, 10.0)],
    11: [(0.0, 3.3333), (6.6667, 10.0)],
}

PUSHKARA_BHAGA_DEGS = {
    0: 21.0, 4: 21.0, 8: 21.0,   # Fiery (Mesha, Simha, Dhanus)
    1: 14.0, 5: 14.0, 9: 14.0,   # Earthy (Vrishabha, Kanya, Makara)
    2: 24.0, 6: 24.0, 10: 24.0,  # Airy (Mithuna, Tula, Kumbha)
    3: 7.0,  7: 7.0,  11: 7.0,   # Watery (Karkataka, Vrishchika, Meena)
}

def parse_time_to_hours(t_str):
    if not t_str: return None
    offset = 0
    if "(-1)" in t_str:
        offset = -24
    elif "(+1)" in t_str:
        offset = 24
    clean = t_str.split()[0]
    parts = clean.split(":")
    return offset + float(parts[0]) + float(parts[1])/60.0 + float(parts[2])/3600.0

def is_colliding_time(h, time_dict_or_list, buffer_mins=10.0):
    if not time_dict_or_list: return False
    buffer_h = buffer_mins / 60.0
    if isinstance(time_dict_or_list, dict):
        s = parse_time_to_hours(time_dict_or_list.get("start"))
        e = parse_time_to_hours(time_dict_or_list.get("end"))
        if s is None or e is None: return False
        
        # If period is entirely on previous day (<= 0) or next day (>= 24), no collision with today h (0..24)
        if s <= 0 and e <= 0: return False
        if s >= 24 and e >= 24: return False
        
        # Apply safety buffer around inauspicious time window
        s_buf = s - buffer_h
        e_buf = e + buffer_h
        
        if s_buf <= e_buf:
            return s_buf <= h <= e_buf
        else:
            return h >= s_buf or h <= e_buf
    elif isinstance(time_dict_or_list, list):
        for item in time_dict_or_list:
            if is_colliding_time(h, item, buffer_mins): return True
    return False

def compute_pushkara_window(cand_date, lat, lon, tz_offset, place_name, p, birth_lagna_idx=None, birth_place_obj=None, return_all=False):
    sr_h = parse_time_to_hours(p["sunrise"]) or 6.0
    noon_h = 12.0
    
    rahu = p.get("rahu_kalam")
    yama = p.get("yamagandam")
    gulika = p.get("gulika_kalam")
    dur_list = p.get("durmuhurtam")
    varjyam = p.get("varjyam")
    
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    jd_ut_mid = swe.julday(cand_date.year, cand_date.month, cand_date.day, 0.0)
    
    RASI_NAMES_TE = ["మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య", "తులా", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"]

    # 1. Map all 12 Lagnas across the 24-hour period (from Sunrise to next Sunrise)
    lagnas = []
    curr_h = sr_h
    last_rasi = None
    lagna_start = sr_h
    
    while curr_h <= sr_h + 24.0 + (1.0 / 60.0):
        ut_hour = curr_h - tz_offset
        jd_t = jd_ut_mid + ut_hour / 24.0
        cusps, ascmc = swe.houses_ex(jd_t, lat, lon, b'P', swe.FLG_SIDEREAL)
        l_lon = ascmc[0] % 360.0
        r_idx = int(l_lon // 30)
        
        if last_rasi is not None and r_idx != last_rasi:
            lagnas.append({
                "rasi_index": last_rasi,
                "rasi_en": RASI_NAMES[last_rasi + 1],
                "rasi_te": RASI_NAMES_TE[last_rasi],
                "start_h": lagna_start,
                "end_h": curr_h
            })
            lagna_start = curr_h
        last_rasi = r_idx
        curr_h += (1.0 / 60.0)

    # 2. Evaluate each Lagna in the 24-hour day
    candidate_lagnas = []
    
    for lg in lagnas:
        step_h = lg["start_h"]
        step_end = lg["end_h"]

        # Strictly reject any Lagna that overlaps with Durmuhurtam, Rahu Kalam, Yamagandam, or Gulika Kalam
        has_major_inauspicious_overlap = False
        check_step = lg["start_h"]
        while check_step <= lg["end_h"]:
            if (
                is_colliding_time(check_step, dur_list, buffer_mins=0.0) or
                is_colliding_time(check_step, rahu, buffer_mins=0.0) or
                is_colliding_time(check_step, yama, buffer_mins=0.0) or
                is_colliding_time(check_step, gulika, buffer_mins=0.0)
            ):
                has_major_inauspicious_overlap = True
                break
            check_step += (2.0 / 60.0)

        if has_major_inauspicious_overlap:
            continue  # Disqualify corrupted Lagna!
        
        clean_minutes = []
        pushkara_bhaga_mins = []
        pushkara_nav_mins = []
        
        while step_h <= step_end:
            coll = is_colliding_time(step_h, varjyam, buffer_mins=5.0)
            if not coll:
                clean_minutes.append(step_h)
                ut_hour = step_h - tz_offset
                jd_t = jd_ut_mid + ut_hour / 24.0
                cusps, ascmc = swe.houses_ex(jd_t, lat, lon, b'P', swe.FLG_SIDEREAL)
                l_lon = ascmc[0] % 360.0
                deg_in_rasi = l_lon % 30.0
                
                target_deg = PUSHKARA_BHAGA_DEGS.get(lg["rasi_index"], 15.0)
                if abs(deg_in_rasi - target_deg) <= 1.5:
                    pushkara_bhaga_mins.append(step_h)
                
                ranges = PUSHKARA_RANGES.get(lg["rasi_index"], [])
                for r_s, r_e in ranges:
                    if r_s <= deg_in_rasi <= r_e:
                        pushkara_nav_mins.append(step_h)
                        break
            step_h += (1.0 / 60.0)
            
        # Require at least 20 minutes of clean uncollided duration
        if len(clean_minutes) >= 20:
            candidate_lagnas.append({
                "lagna": lg,
                "clean_mins": clean_minutes,
                "bhaga_mins": pushkara_bhaga_mins,
                "nav_mins": pushkara_nav_mins
            })

    def format_hms(h):
        norm_h = h % 24.0
        hh = int(norm_h)
        mm = int(round((norm_h - hh) * 60))
        if mm >= 60:
            hh += 1
            mm = 0
            if hh >= 24: hh = 0
        ampm = "AM" if hh < 12 else "PM"
        display_h = hh if hh <= 12 else hh - 12
        if display_h == 0: display_h = 12
        return f"{display_h:02d}:{mm:02d} {ampm}"

    def get_time_period_str(h):
        norm_h = h % 24.0
        hh = int(norm_h)
        if 4 <= hh < 12:
            return "ఉదయం", "Morning"
        elif 12 <= hh < 16:
            return "మధ్యాహ్నం", "Afternoon"
        elif 16 <= hh < 20:
            return "సాయంత్రం", "Evening"
        else:
            return "రాత్రి", "Night"
            
    if not candidate_lagnas:
        return None

    def get_colliding_names(check_h, buffer_m=5.0):
        names_te = []
        names_en = []
        if is_colliding_time(check_h, rahu, buffer_mins=buffer_m):
            names_te.append("రాహు కాలం")
            names_en.append("Rahu Kalam")
        if is_colliding_time(check_h, yama, buffer_mins=buffer_m):
            names_te.append("యమగండం")
            names_en.append("Yamagandam")
        if is_colliding_time(check_h, gulika, buffer_mins=buffer_m):
            names_te.append("గుళిక కాలం")
            names_en.append("Gulika Kalam")
        if is_colliding_time(check_h, dur_list, buffer_mins=buffer_m):
            names_te.append("దుర్ముహూర్తం")
            names_en.append("Durmuhurtam")
        if is_colliding_time(check_h, varjyam, buffer_mins=buffer_m):
            names_te.append("వర్జ్యం")
            names_en.append("Varjyam")
        return names_te, names_en

    # Process all clean candidate Lagnas for this date
    processed_windows = []
    
    for cand_item in candidate_lagnas:
        lg = cand_item["lagna"]
        cand_lagna_idx = lg["rasi_index"] + 1

        # 1. Reject Ashtama Lagna (Muhurta Lagna is the 8th house from Birth Lagna)
        if birth_lagna_idx and ((cand_lagna_idx - birth_lagna_idx) % 12 == 7):
            continue

        clean_mins = cand_item["clean_mins"]
        bhaga_mins = cand_item["bhaga_mins"]
        nav_mins = cand_item["nav_mins"]
        
        match_kind = "clean"
        best_h = clean_mins[len(clean_mins)//2]
        if bhaga_mins:
            match_kind = "bhaga"
            best_h = bhaga_mins[len(bhaga_mins)//2]
        elif nav_mins:
            match_kind = "navamsha"
            best_h = nav_mins[len(nav_mins)//2]
            
        end_truncated = clean_mins[-1] < lg['end_h'] - (2.0/60.0)
        start_truncated = clean_mins[0] > lg['start_h'] + (2.0/60.0)

        # Enforce safety buffer (minimum 10 minutes) before inauspicious cutoff
        if end_truncated and (clean_mins[-1] - best_h) < (10.0 / 60.0):
            safe_target = clean_mins[-1] - (10.0 / 60.0)
            if safe_target >= clean_mins[0]:
                best_h = safe_target
            else:
                best_h = clean_mins[len(clean_mins)//2]

        if start_truncated and (best_h - clean_mins[0]) < (10.0 / 60.0):
            safe_target = clean_mins[0] + (10.0 / 60.0)
            if safe_target <= clean_mins[-1]:
                best_h = safe_target
            else:
                best_h = clean_mins[len(clean_mins)//2]

        # 2. Reject Ashtama Shuddhi violation (8th house must be vacant) & Lagna Shuddhi violation (Lagna block must be vacant)
        if birth_place_obj:
            ashtama_rasi_idx = (cand_lagna_idx - 1 + 7) % 12 + 1
            _, cand_raw_d1_h = compute_d1_positions(cand_date, best_h, birth_place_obj)
            has_shuddhi_at_h = True
            for item in cand_raw_d1_h:
                p_id = item[0]
                if p_id == 'L': continue
                p_rasi = item[1][0] + 1
                if p_rasi == ashtama_rasi_idx:
                    has_shuddhi_at_h = False
                    break
                if p_rasi == cand_lagna_idx:
                    has_shuddhi_at_h = False
                    break
            if not has_shuddhi_at_h:
                continue  # Disqualify this Lagna window completely!

        precise_t = format_hms(best_h)
        p_te, p_en = get_time_period_str(best_h)
        lg_duration = f"{format_hms(lg['start_h'])} – {format_hms(lg['end_h'])}"
        clean_win = f"{format_hms(clean_mins[0])} – {format_hms(clean_mins[-1])}"
        
        type_en = "Pushkara Bhaga Lagna" if match_kind == "bhaga" else ("Pushkara Navamsha Lagna" if match_kind == "navamsha" else "Auspicious Lagna Window")
        type_te = "పుష్కర భాగ లగ్నం" if match_kind == "bhaga" else ("పుష్కర నవాంశ లగ్నం" if match_kind == "navamsha" else "శుభ లగ్న సమయం")
        
        avoid_notes_te = []
        avoid_notes_en = []

        if end_truncated:
            end_names_te, end_names_en = get_colliding_names(clean_mins[-1] + (5.0/60.0), buffer_m=5.0)
            if not end_names_te:
                name_str_te = "అశుభ సమయం"
                name_str_en = "Inauspicious Time"
            else:
                name_str_te = " / ".join(end_names_te)
                name_str_en = " / ".join(end_names_en)
            avoid_notes_te.append(f"{format_hms(clean_mins[-1])} తర్వాత అశుభ సమయం ({name_str_te})")
            avoid_notes_en.append(f"inauspicious time ({name_str_en}) after {format_hms(clean_mins[-1])}")

        if start_truncated:
            start_names_te, start_names_en = get_colliding_names(clean_mins[0] - (5.0/60.0), buffer_m=5.0)
            if not start_names_te:
                name_str_te = "అశుభ సమయం"
                name_str_en = "Inauspicious Time"
            else:
                name_str_te = " / ".join(start_names_te)
                name_str_en = " / ".join(start_names_en)
            avoid_notes_te.append(f"{format_hms(clean_mins[0])} వరకు అశుభ సమయం ({name_str_te})")
            avoid_notes_en.append(f"inauspicious time ({name_str_en}) until {format_hms(clean_mins[0])}")

        avoid_note_te = f"{', '.join(avoid_notes_te)}" if avoid_notes_te else ""
        avoid_note_en = f"{', '.join(avoid_notes_en)}" if avoid_notes_en else ""
        
        is_squeezed = (start_truncated and end_truncated) or ((clean_mins[-1] - clean_mins[0]) < (35.0 / 60.0))

        pushkara_bhaga_info = {
            "is_available": len(bhaga_mins) > 0,
            "precise_time": format_hms(bhaga_mins[len(bhaga_mins)//2]) if bhaga_mins else None,
            "time_window": f"{format_hms(bhaga_mins[0])} – {format_hms(bhaga_mins[-1])}" if bhaga_mins else None
        }

        pushkara_navamsha_info = {
            "is_available": len(nav_mins) > 0,
            "precise_time": format_hms(nav_mins[len(nav_mins)//2]) if nav_mins else None,
            "time_window": f"{format_hms(nav_mins[0])} – {format_hms(nav_mins[-1])}" if nav_mins else None
        }

        processed_windows.append({
            "precise_time": precise_t,
            "start_h": lg["start_h"],
            "time_window": clean_win,
            "lagna_duration": lg_duration,
            "lagna_name_en": lg["rasi_en"],
            "lagna_name_te": lg["rasi_te"],
            "lagna_name": lg["rasi_en"],
            "match_kind": match_kind,
            "pushkara_bhaga": pushkara_bhaga_info,
            "pushkara_navamsha": pushkara_navamsha_info,
            "is_squeezed": is_squeezed,
            "avoid_note_te": avoid_note_te,
            "avoid_note_en": avoid_note_en,
            "statement_en": f"{p_en} {precise_t} is an auspicious time ({lg['rasi_en']} Lagna: {lg_duration})",
            "statement_te": f"{p_te} {precise_t} శ్రేష్ఠమైన శుభ ముహూర్త సమయం ({lg['rasi_te']} లగ్నాంతాలు: {lg_duration})",
            "type_en": type_en,
            "type_te": type_te
        })

    if not processed_windows:
        return [] if return_all else None

    # Sort so morning Lagnas (< 12 PM) are MOST PREFERRED for Namakarana, then afternoon (< 5 PM), then evening/night!
    processed_windows.sort(key=lambda x: (
        0 if x["start_h"] < 12.0 else (1 if x["start_h"] < 17.0 else 2),
        0 if not x["is_squeezed"] else 1,
        0 if x["match_kind"] == "bhaga" else (1 if x["match_kind"] == "navamsha" else 2)
    ))

    if return_all:
        return processed_windows

    primary = processed_windows[0]
    additional = processed_windows[1:] if len(processed_windows) > 1 else []
    primary["additional_windows"] = additional
    
    return primary


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
    local_hour = h + m / 60.0
    birth_panchang = calculator(birth_date.year, birth_date.month, birth_date.day,
                                         lat, lon, tz_offset, place_name, hour=local_hour)
    birth_nak_idx = birth_panchang["nakshatra"]["index"]
    birth_nak_name = birth_panchang["nakshatra"]["name"]
    birth_nak_pada = birth_panchang["nakshatra"]["pada"]

    # Calculate D1 (Rasi) chart for birth
    d1_positions = []
    try:
        birth_place_obj = JHoraPlace(place_name, lat, lon, tz_offset)
        d1_positions, raw_d1 = compute_d1_positions(birth_date, local_hour, birth_place_obj)
    except Exception as ex:
        print("Birth D1 chart error:", ex)
        birth_place_obj = JHoraPlace(place_name, lat, lon, tz_offset)
        raw_d1 = []

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
    
    # 0-indexed birth lagna
    birth_lagna_idx_0 = raw_d1[0][1][0] if raw_d1 else 0
    birth_lagna_idx = birth_lagna_idx_0 + 1
    birth_lagna_name = RASI_NAMES[birth_lagna_idx]

    planet_names_map = {
        "0": "Sun", "1": "Moon", "2": "Mars", "3": "Mercury", "4": "Jupiter", 
        "5": "Venus", "6": "Saturn", "7": "Rahu", "8": "Ketu"
    }

    for day_num, offset_days in offsets.items():
        cand_date = birth_date + timedelta(days=offset_days)
        p_base = calculator(cand_date.year, cand_date.month, cand_date.day,
                                     lat, lon, tz_offset, place_name, hour=10)
        
        # 1. Compute Pushkara / Auspicious Muhurta Windows
        all_pushkara_windows = compute_pushkara_window(
            cand_date, lat, lon, tz_offset, place_name, p_base,
            birth_lagna_idx=birth_lagna_idx,
            birth_place_obj=birth_place_obj,
            return_all=True
        )
        
        day_results = []

        if all_pushkara_windows:
            for pushkara_info in all_pushkara_windows:
                muhurta_hour = parse_time_str_to_h(pushkara_info.get("precise_time", "10:00 AM"))

                # Recompute panchang at precise window time
                try:
                    hh = int(muhurta_hour)
                    mm = int(round((muhurta_hour - hh) * 60))
                    if mm >= 60:
                        hh += 1
                        mm = 0
                    p_win = calculator(
                        cand_date.year, cand_date.month, cand_date.day,
                        lat, lon, tz_offset, place_name, hour=hh, minute=mm, second=0
                    )
                except Exception as ex:
                    print(f"Panchang recomputation error for {cand_date} at {muhurta_hour}: {ex}")
                    p_win = p_base

                # Compute D1 (Rasi) chart at the EXACT recommended Muhurta time
                cand_d1_positions, cand_raw_d1 = compute_d1_positions(cand_date, muhurta_hour, birth_place_obj)

                # Get exact Muhurta Lagna from cand_raw_d1 at recommended Muhurta time
                cand_lagna_idx = None
                for item in cand_raw_d1:
                    if item[0] == 'L':
                        cand_lagna_idx = item[1][0] + 1  # 1-based (1=Mesha, 2=Vrishabha, ... 12=Meena)
                        break
                if not cand_lagna_idx:
                    if pushkara_info and "lagna_name_en" in pushkara_info:
                        try:
                            cand_lagna_idx = RASI_NAMES.index(pushkara_info["lagna_name_en"]) + 1
                        except ValueError:
                            cand_lagna_idx = p_win["lagna_rasi_index"]
                    else:
                        cand_lagna_idx = p_win["lagna_rasi_index"]
                    
                cand_lagna_name = RASI_NAMES[cand_lagna_idx - 1]

                # Calculate Tarabalam
                count_inc = utils.count_stars(birth_nak_idx, p_win["nakshatra"]["index"])
                tb_rem = count_inc % 9
                tara_idx = 9 if tb_rem == 0 else tb_rem
                tara_name = tara_names[tara_idx]
                is_tara_avoid = tara_idx in [1, 3, 5, 7]
                is_tara_good = not is_tara_avoid

                # General checks
                is_vaara_good = p_win["vaara"] in ["Monday", "Wednesday", "Thursday", "Friday"]
                is_nak_good = p_win["nakshatra"]["name"] in [
                    "Ashwini", "Rohini", "Mrigashira", "Punarvasu", "Pushya", "Uttara Phalguni", 
                    "Hasta", "Chitra", "Swati", "Anuradha", "Uttara Ashadha", "Shravana", 
                    "Dhanishtha", "Shatabhisha", "Uttara Bhadrapada", "Revati"
                ]
                is_tithi_avoid = p_win["tithi"]["name"] in ["Chaturthi", "Navami", "Purnima", "Amavasya"]
                
                # Yoga & Karana avoid lists
                is_yoga_avoid = p_win["yoga"]["name"] in ["Vaidhriti", "Ganda", "Vyatipata", "Parigha"]
                is_karana_avoid = p_win["karana"]["name"] in ["Vishti (Bhadra)", "Shakuni", "Chatushpada", "Naga", "Kimstughna"]

                # Ashtama Lagna check (8th house from birth lagna)
                is_ashtama_lagna = (cand_lagna_idx - birth_lagna_idx) % 12 == 7

                # Ashtama Shuddhi check
                ashtama_rasi_idx = (cand_lagna_idx - 1 + 7) % 12 + 1
                ashtama_rasi_name = RASI_NAMES[ashtama_rasi_idx - 1]
                
                planets_in_8th = []
                for item in cand_raw_d1:
                    p_id = item[0]
                    if p_id == 'L':
                        continue
                    p_rasi = item[1][0] + 1
                    if p_rasi == ashtama_rasi_idx:
                        planets_in_8th.append(planet_names_map.get(str(p_id), str(p_id)))
                
                has_ashtama_shuddhi = len(planets_in_8th) == 0

                # Lagna Shuddhi check
                planets_in_lagna = []
                for item in cand_raw_d1:
                    p_id = item[0]
                    if p_id == 'L': continue
                    p_rasi = item[1][0] + 1
                    if p_rasi == cand_lagna_idx:
                        planets_in_lagna.append(planet_names_map.get(str(p_id), str(p_id)))

                has_lagna_shuddhi = len(planets_in_lagna) == 0

                # STRICT FILTERING
                if is_tithi_avoid or is_tara_avoid or is_ashtama_lagna or not has_ashtama_shuddhi or not has_lagna_shuddhi:
                    continue  # Skip this window!

                # Scoring Logic
                base_score = 0
                if is_vaara_good: base_score += 25
                if is_nak_good: base_score += 25
                if not is_tithi_avoid: base_score += 25
                if not is_tara_avoid: base_score += 25

                # Deductions
                deductions = 0
                if is_yoga_avoid: deductions += 30
                if is_karana_avoid: deductions += 30

                total_pct = max(0, base_score - deductions)
                verdict = "highly_favorable" if total_pct >= 75 else ("favorable" if total_pct >= 50 else "unfavorable")

                # Build list of reasons
                reasons = []
                if is_vaara_good:
                    reasons.append(f"{p_win['vaara']} is favorable.")
                else:
                    reasons.append(f"{p_win['vaara']} is not recommended.")

                if is_nak_good:
                    reasons.append(f"Nakshatra {p_win['nakshatra']['name']} is favorable.")
                else:
                    reasons.append(f"Nakshatra {p_win['nakshatra']['name']} is not recommended.")

                reasons.append(f"Tithi {p_win['tithi']['name']} is favorable.")
                reasons.append(f"Tarabalam is {tara_name} (favorable).")
                reasons.append("Ashtama Lagna: Clean.")
                reasons.append("Ashtama Shuddhi: Clean (8th house is vacant).")
                reasons.append("Lagna Shuddhi: Clean (Lagna block vacant).")

                if is_yoga_avoid:
                    reasons.append(f"Avoid: Unfavorable {p_win['yoga']['name']} yoga!")
                if is_karana_avoid:
                    reasons.append(f"Avoid: Unfavorable {p_win['karana']['name']} karana!")
                
                curr_pushkara = pushkara_info
                birth_details_dict = {"birth_lagna_idx": birth_lagna_idx} if birth_lagna_idx else None
                maha_doshas_list = evaluate_21_maha_doshas(p_win, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)
                dashavidha_doshas_list = evaluate_10_dashavidha_doshas(p_win, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)

                day_results.append({
                    "day_number": day_num,
                    "date": cand_date.strftime("%Y-%m-%d"),
                    "percentage": total_pct,
                    "tara": tara_name,
                    "is_tara_good": is_tara_good,
                    "verdict": verdict,
                    "reasons": reasons,
                    "pushkara_info": curr_pushkara,
                    "special_yogas": p_win.get("special_yogas", []),
                    "panchang": {
                        "vaara": p_win["vaara"],
                        "tithi": f"{p_win['tithi']['name']} ({p_win['tithi']['paksha']})",
                        "nakshatra": p_win["nakshatra"]["name"],
                        "yoga": p_win["yoga"]["name"],
                        "karana": p_win["karana"]["name"],
                        "rahu_kalam": p_win.get("rahu_kalam"),
                        "yamagandam": p_win.get("yamagandam"),
                        "gulika_kalam": p_win.get("gulika_kalam"),
                        "durmuhurtam": p_win.get("durmuhurtam"),
                        "varjyam": p_win.get("varjyam"),
                        "inauspicious_periods": {
                            "rahu_kalam": p_win.get("rahu_kalam"),
                            "yamagandam": p_win.get("yamagandam"),
                            "gulika_kalam": p_win.get("gulika_kalam"),
                            "durmuhurtam": p_win.get("durmuhurtam"),
                            "varjyam": p_win.get("varjyam")
                        }
                    },
                    "d1_chart": cand_d1_positions,
                    "detailed_eval": {
                        "vaara": {"name": p_win["vaara"], "is_pass": is_vaara_good},
                        "tithi": {"name": p_win["tithi"]["name"], "paksha": p_win["tithi"]["paksha"], "is_pass": not is_tithi_avoid},
                        "nakshatra": {"name": p_win["nakshatra"]["name"], "pada": p_win["nakshatra"]["pada"], "is_pass": is_nak_good},
                        "tara": {"name": tara_name, "is_pass": is_tara_good},
                        "ashtama_lagna": {"is_dosha": is_ashtama_lagna, "birth_lagna": birth_lagna_name, "muhurta_lagna": cand_lagna_name},
                        "ashtama_shuddhi": {"has_shuddhi": has_ashtama_shuddhi, "planets_in_8th": planets_in_8th, "muhurta_lagna": cand_lagna_name, "ashtama_rasi": ashtama_rasi_name},
                        "lagna_shuddhi": {"has_shuddhi": has_lagna_shuddhi, "planets_in_lagna": planets_in_lagna, "muhurta_lagna": cand_lagna_name},
                        "yoga": {"name": p_win["yoga"]["name"], "is_pass": not is_yoga_avoid},
                        "karana": {"name": p_win["karana"]["name"], "is_pass": not is_karana_avoid},
                        "maha_doshas": maha_doshas_list,
                        "dashavidha_doshas": dashavidha_doshas_list
                    }
                })

        if not day_results:
            # Fallback for day with no qualifying windows
            cand_d1_positions, cand_raw_d1 = compute_d1_positions(cand_date, 10.0, birth_place_obj)

            cand_lagna_idx = p_base["lagna_rasi_index"]
            cand_lagna_name = RASI_NAMES[cand_lagna_idx - 1]

            count_inc = utils.count_stars(birth_nak_idx, p_base["nakshatra"]["index"])
            tb_rem = count_inc % 9
            tara_idx = 9 if tb_rem == 0 else tb_rem
            tara_name = tara_names[tara_idx]
            is_tara_avoid = tara_idx in [1, 3, 5, 7]
            is_tara_good = not is_tara_avoid

            is_vaara_good = p_base["vaara"] in ["Monday", "Wednesday", "Thursday", "Friday"]
            is_nak_good = p_base["nakshatra"]["name"] in [
                "Ashwini", "Rohini", "Mrigashira", "Punarvasu", "Pushya", "Uttara Phalguni", 
                "Hasta", "Chitra", "Swati", "Anuradha", "Uttara Ashadha", "Shravana", 
                "Dhanishtha", "Shatabhisha", "Uttara Bhadrapada", "Revati"
            ]
            is_tithi_avoid = p_base["tithi"]["name"] in ["Chaturthi", "Navami", "Purnima", "Amavasya"]
            is_yoga_avoid = p_base["yoga"]["name"] in ["Vaidhriti", "Ganda", "Vyatipata", "Parigha"]
            is_karana_avoid = p_base["karana"]["name"] in ["Vishti (Bhadra)", "Shakuni", "Chatushpada", "Naga", "Kimstughna"]

            is_ashtama_lagna = (cand_lagna_idx - birth_lagna_idx) % 12 == 7

            ashtama_rasi_idx = (cand_lagna_idx - 1 + 7) % 12 + 1
            ashtama_rasi_name = RASI_NAMES[ashtama_rasi_idx - 1]
            
            planets_in_8th = []
            for item in cand_raw_d1:
                p_id = item[0]
                if p_id == 'L': continue
                p_rasi = item[1][0] + 1
                if p_rasi == ashtama_rasi_idx:
                    planets_in_8th.append(planet_names_map.get(str(p_id), str(p_id)))
            has_ashtama_shuddhi = len(planets_in_8th) == 0

            planets_in_lagna = []
            for item in cand_raw_d1:
                p_id = item[0]
                if p_id == 'L': continue
                p_rasi = item[1][0] + 1
                if p_rasi == cand_lagna_idx:
                    planets_in_lagna.append(planet_names_map.get(str(p_id), str(p_id)))
            has_lagna_shuddhi = len(planets_in_lagna) == 0

            reasons = []
            if is_vaara_good:
                reasons.append(f"{p_base['vaara']} is favorable.")
            else:
                reasons.append(f"{p_base['vaara']} is not recommended.")

            if is_nak_good:
                reasons.append(f"Nakshatra {p_base['nakshatra']['name']} is favorable.")
            else:
                reasons.append(f"Nakshatra {p_base['nakshatra']['name']} is not recommended.")

            if is_tithi_avoid:
                reasons.append(f"Tithi {p_base['tithi']['name']} must be avoided!")
            else:
                reasons.append(f"Tithi {p_base['tithi']['name']} is favorable.")

            reasons.append(f"Tarabalam is {tara_name} ({'not recommended' if is_tara_avoid else 'favorable'}).")

            if is_ashtama_lagna:
                reasons.append("Ashtama Lagna Dosha (Muhurta Lagna is 8th from birth Lagna)!")
            if not has_ashtama_shuddhi:
                reasons.append(f"No Ashtama Shuddhi ({', '.join(planets_in_8th)} in 8th house from Lagna)!")
            if not has_lagna_shuddhi:
                reasons.append(f"No Lagna Shuddhi ({', '.join(planets_in_lagna)} in Lagna)!")

            reasons.append("No auspicious pushkara/lagna window found or all windows were filtered out due to doshas.")

            birth_details_dict = {"birth_lagna_idx": birth_lagna_idx} if birth_lagna_idx else None
            maha_doshas_list = evaluate_21_maha_doshas(p_base, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)
            dashavidha_doshas_list = evaluate_10_dashavidha_doshas(p_base, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)

            candidates_list.append({
                "day_number": day_num,
                "date": cand_date.strftime("%Y-%m-%d"),
                "percentage": 0,
                "tara": tara_name,
                "is_tara_good": is_tara_good,
                "verdict": "unfavorable",
                "reasons": reasons,
                "pushkara_info": None,
                "special_yogas": p_base.get("special_yogas", []),
                "panchang": {
                    "vaara": p_base["vaara"],
                    "tithi": f"{p_base['tithi']['name']} ({p_base['tithi']['paksha']})",
                    "nakshatra": p_base["nakshatra"]["name"],
                    "yoga": p_base["yoga"]["name"],
                    "karana": p_base["karana"]["name"],
                    "rahu_kalam": p_base.get("rahu_kalam"),
                    "yamagandam": p_base.get("yamagandam"),
                    "gulika_kalam": p_base.get("gulika_kalam"),
                    "durmuhurtam": p_base.get("durmuhurtam"),
                    "varjyam": p_base.get("varjyam"),
                    "inauspicious_periods": {
                        "rahu_kalam": p_base.get("rahu_kalam"),
                        "yamagandam": p_base.get("yamagandam"),
                        "gulika_kalam": p_base.get("gulika_kalam"),
                        "durmuhurtam": p_base.get("durmuhurtam"),
                        "varjyam": p_base.get("varjyam")
                    }
                },
                "d1_chart": cand_d1_positions,
                "detailed_eval": {
                    "vaara": {"name": p_base["vaara"], "is_pass": is_vaara_good},
                    "tithi": {"name": p_base["tithi"]["name"], "paksha": p_base["tithi"]["paksha"], "is_pass": not is_tithi_avoid},
                    "nakshatra": {"name": p_base["nakshatra"]["name"], "pada": p_base["nakshatra"]["pada"], "is_pass": is_nak_good},
                    "tara": {"name": tara_name, "is_pass": is_tara_good},
                    "ashtama_lagna": {"is_dosha": is_ashtama_lagna, "birth_lagna": birth_lagna_name, "muhurta_lagna": cand_lagna_name},
                    "ashtama_shuddhi": {"has_shuddhi": has_ashtama_shuddhi, "planets_in_8th": planets_in_8th, "muhurta_lagna": cand_lagna_name, "ashtama_rasi": ashtama_rasi_name},
                    "lagna_shuddhi": {"has_shuddhi": has_lagna_shuddhi, "planets_in_lagna": planets_in_lagna, "muhurta_lagna": cand_lagna_name},
                    "yoga": {"name": p_base["yoga"]["name"], "is_pass": not is_yoga_avoid},
                    "karana": {"name": p_base["karana"]["name"], "is_pass": not is_karana_avoid},
                    "maha_doshas": maha_doshas_list,
                    "dashavidha_doshas": dashavidha_doshas_list
                }
            })
        else:
            candidates_list.extend(day_results)

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


