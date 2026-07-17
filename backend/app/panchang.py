"""
Complete Drik Panchang — all panchangam elements computed via PyJHora's
drik module (modern astronomical Drik Siddhanta, Lahiri/Chitrapaksha ayanamsa).

Region-based: pass lat/lon/tz_offset for any location and get accurate,
location-specific timings for sunrise, sunset, tithi, nakshatra, etc.
"""
from jhora.panchanga import drik, drik1
from jhora import utils, const
import swisseph as swe

# Monkey patch pyjhora's reset functions to prevent it from resetting Swiss Ephemeris 
# to other modes. We force it to stay on Lahiri ayanamsa at all times.
drik.reset_ayanamsa_mode = lambda: swe.set_sid_mode(swe.SIDM_LAHIRI)
drik1.reset_ayanamsa_mode = lambda: swe.set_sid_mode(swe.SIDM_LAHIRI)

from .names import (
    VAARA_NAMES, tithi_to_number_and_paksha, LUNAR_MONTH_NAMES,
    CANONICAL_NAKSHATRA, CANONICAL_TITHI, CANONICAL_KARANA, CANONICAL_YOGA,
    NAKSHATRA_NAMES, TITHI_NAMES,
)

# Lahiri/Chitrapaksha ayanamsa — the standard for Telugu panchangams
# and the Nemani family tradition this application is built on.
drik.set_ayanamsa_mode("LAHIRI")


# ---------------------------------------------------------------------------
# Time formatting helpers
# ---------------------------------------------------------------------------

def _decimal_hours_to_hms(h: float) -> str:
    """Convert decimal hours to HH:MM:SS string with day-offset tag.

    PyJHora's convention:
      - Positive hours: 0 to 24 (current day), 24 to 48 (next day, +1), etc.
      - Negative hours: the absolute value is the hour on the previous day (-1).
    """
    if h is None:
        return None

    day_offset = 0
    if h < 0.0:
        day_offset = -1
        h = abs(h)
        while h >= 24.0:
            h -= 24.0
            day_offset -= 1
    else:
        while h >= 24.0:
            h -= 24.0
            day_offset += 1

    hh = int(h)
    remainder = (h - hh) * 60
    mm = int(remainder)
    ss = int((remainder - mm) * 60 + 0.5)  # round to nearest second

    # handle carry from rounding
    if ss >= 60:
        ss -= 60
        mm += 1
    if mm >= 60:
        mm -= 60
        hh += 1
    if hh >= 24:
        hh -= 24
        day_offset += 1

    suffix = f" ({day_offset:+d})" if day_offset != 0 else ""
    return f"{hh:02d}:{mm:02d}:{ss:02d}{suffix}"

def _format_pair(pair) -> dict:
    """Format a (start, end) pair into a dict — handles both string and
    float (decimal hours) values from PyJHora's various return types."""
    if not pair or len(pair) < 2:
        return None
    a, b = pair[0], pair[1]
    start = a if isinstance(a, str) else _decimal_hours_to_hms(a)
    end = b if isinstance(b, str) else _decimal_hours_to_hms(b)
    return {"start": start, "end": end}



# ---------------------------------------------------------------------------
# Main panchang computation
# ---------------------------------------------------------------------------

def compute_day_panchang(year: int, month: int, day: int,
                          lat: float, lon: float, tz_offset: float,
                          place_name: str = "Location",
                          hour: int = 6, minute: int = 0, second: int = 0) -> dict:
    """
    Compute complete Drik panchang for a given date/place.

    All calculations use PyJHora's drik module with Lahiri ayanamsa.
    Times are formatted as HH:MM:SS with (+1)/(-1) day-offset tags
    when the time falls on the next/previous calendar day.

    Parameters:
        year, month, day: Calendar date
        lat, lon: Geographic coordinates (decimal degrees)
        tz_offset: Timezone offset from UTC in hours (e.g. 5.5 for IST)
        place_name: Display name for the location
        hour, minute, second: Time of day to evaluate at (default 06:00)
    """
    # Ensure Lahiri ayanamsa is active for this call
    drik.set_ayanamsa_mode("LAHIRI")

    place = drik.Place(place_name, lat, lon, tz_offset)
    date_in = drik.Date(year, month, day)
    jd = utils.julian_day_number(date_in, (hour, minute, second))

    # -------------------------------------------------------------------
    # 1. Vaara (weekday)
    # -------------------------------------------------------------------
    vaara_idx = drik.vaara(jd, place)

    # -------------------------------------------------------------------
    # 2. Sunrise / Sunset
    # -------------------------------------------------------------------
    sunrise_raw = drik.sunrise(jd, place)
    sunset_raw = drik.sunset(jd, place)
    sunrise_str = sunrise_raw[1] if len(sunrise_raw) > 1 else _decimal_hours_to_hms(sunrise_raw[0])
    sunset_str = sunset_raw[1] if len(sunset_raw) > 1 else _decimal_hours_to_hms(sunset_raw[0])

    # -------------------------------------------------------------------
    # 3. Tithi  — raw: [index_1_30, start_hrs, end_hrs]
    # -------------------------------------------------------------------
    tithi_raw = drik.tithi(jd, place)
    tithi_idx_30 = tithi_raw[0]           # 1-30
    tithi_num, paksha = tithi_to_number_and_paksha(tithi_idx_30)
    tithi_name_raw = utils.TITHI_LIST[tithi_idx_30 - 1]
    tithi_name = CANONICAL_TITHI.get(tithi_name_raw, tithi_name_raw)
    tithi_start_hrs = tithi_raw[1]
    tithi_end_hrs = tithi_raw[2] if len(tithi_raw) > 2 else None

    # -------------------------------------------------------------------
    # 4. Nakshatra  — raw: [idx, pada, start_hrs, end_hrs, next_idx, next_pada, next_end_hrs]
    # -------------------------------------------------------------------
    nak_raw = drik.nakshatra(jd, place)
    nak_idx = nak_raw[0]                  # 1-27
    nak_pada = nak_raw[1]                 # 1-4
    nak_name_raw = utils.NAKSHATRA_LIST[nak_idx - 1]
    nak_name = CANONICAL_NAKSHATRA.get(nak_name_raw, nak_name_raw)
    nak_start_hrs = nak_raw[2]
    nak_end_hrs = nak_raw[3]

    # Calculate exact boundaries for all 4 padas of the current nakshatra
    padas_list = []
    try:
        # Convert local hours to absolute values relative to today's midnight
        h_start = abs(nak_start_hrs) - 24.0 if nak_start_hrs < 0 else nak_start_hrs
        h_end = nak_end_hrs
        
        # UT midnight Julian Day for this calendar date
        jd_ut_mid = swe.julday(year, month, day, 0.0)
        
        def get_moon_lon(h):
            # h is local hour relative to midnight
            ut_hour = h - tz_offset
            jd_t = jd_ut_mid + ut_hour / 24.0
            swe.set_sid_mode(swe.SIDM_LAHIRI)
            flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL
            return swe.calc_ut(jd_t, swe.MOON, flags)[0][0]

        def find_crossing_hour(target_lon, a, b):
            for _ in range(25):
                mid = (a + b) / 2.0
                lon = get_moon_lon(mid)
                diff = (lon - target_lon + 180) % 360 - 180
                if diff < 0:
                    a = mid
                else:
                    b = mid
            return (a + b) / 2.0

        # L_start is the sidereal longitude where this nakshatra starts
        L_start = (nak_idx - 1) * (360.0 / 27.0)
        
        last_t = h_start
        for p in range(1, 5):
            p_end_lon = L_start + p * (360.0 / 108.0)
            # Find the crossing time for this pada end
            t_end = find_crossing_hour(p_end_lon, last_t, h_end)
            
            # Convert relative time offsets (relative to midnight of today) 
            # to PyJHora's absolute negated hour convention if they are on the previous day.
            t_start_val = -(24.0 + last_t) if last_t < 0.0 else last_t
            t_end_val = -(24.0 + t_end) if t_end < 0.0 else t_end
            
            padas_list.append({
                "pada": p,
                "start_time": _decimal_hours_to_hms(t_start_val),
                "end_time": _decimal_hours_to_hms(t_end_val)
            })
            last_t = t_end
    except Exception as e:
        # Fallback to empty list on error
        padas_list = []

    # Next nakshatra info (if available in raw output)
    next_nak = None
    if len(nak_raw) >= 7:
        next_nak_idx = nak_raw[4]
        next_nak_name_raw = utils.NAKSHATRA_LIST[next_nak_idx - 1]
        next_nak = {
            "name": CANONICAL_NAKSHATRA.get(next_nak_name_raw, next_nak_name_raw),
            "pada": nak_raw[5],
            "start_time": _decimal_hours_to_hms(nak_end_hrs),  # next starts where current ends
            "end_time": _decimal_hours_to_hms(nak_raw[6]),
        }

    # -------------------------------------------------------------------
    # 5. Yoga  — raw: [idx, start_hrs, end_hrs, ?, next_idx, next_start, next_end, ?]
    # -------------------------------------------------------------------
    yoga_raw = drik.yogam(jd, place)
    yoga_idx = yoga_raw[0]                # 1-27
    yoga_name_raw = utils.YOGAM_LIST[yoga_idx - 1]
    yoga_name = CANONICAL_YOGA.get(yoga_name_raw, yoga_name_raw)
    yoga_start_hrs = yoga_raw[1]
    yoga_end_hrs = yoga_raw[2]

    # -------------------------------------------------------------------
    # 6. Karana  — raw: [idx, start_hrs, end_hrs]
    # -------------------------------------------------------------------
    karana_raw = drik.karana(jd, place)
    karana_idx = karana_raw[0]
    karana_name_raw = utils.KARANA_LIST[karana_idx - 1]
    karana_name = CANONICAL_KARANA.get(karana_name_raw, karana_name_raw)
    karana_start_hrs = karana_raw[1]
    karana_end_hrs = karana_raw[2] if len(karana_raw) > 2 else None

    # -------------------------------------------------------------------
    # 7. Rahu Kalam
    # -------------------------------------------------------------------
    rahu_kalam = drik.raahu_kaalam(jd, place)

    # -------------------------------------------------------------------
    # 8. Yamagandam
    # -------------------------------------------------------------------
    yamagandam = drik.yamaganda_kaalam(jd, place)

    # -------------------------------------------------------------------
    # 9. Gulika Kalam
    # -------------------------------------------------------------------
    gulika_kalam = drik.gulikai_kaalam(jd, place)

    # -------------------------------------------------------------------
    # 10. Durmuhurtam
    # -------------------------------------------------------------------
    dur_raw = drik.durmuhurtam(jd, place)
    durmuhurtam_list = []
    if dur_raw:
        # dur_raw is a flat list: [start1, end1, start2, end2, ...]
        for i in range(0, len(dur_raw), 2):
            if i + 1 < len(dur_raw):
                durmuhurtam_list.append({
                    "start": dur_raw[i],
                    "end": dur_raw[i + 1],
                })

    # -------------------------------------------------------------------
    # 11. Abhijit Muhurta
    # -------------------------------------------------------------------
    abhijit = None
    try:
        am = drik.abhijit_muhurta(jd, place)
        if am and len(am) >= 2:
            abhijit = _format_pair(am)
    except Exception:
        pass

    # -------------------------------------------------------------------
    # 12. Brahma Muhurta
    # -------------------------------------------------------------------
    brahma = None
    try:
        bm = drik.brahma_muhurtha(jd, place)
        if bm and len(bm) >= 2:
            brahma = _format_pair(bm)
    except Exception:
        pass

    # -------------------------------------------------------------------
    # 13. Godhuli Muhurta
    # -------------------------------------------------------------------
    godhuli = None
    try:
        gm = drik.godhuli_muhurtha(jd, place)
        if gm and len(gm) >= 2:
            godhuli = _format_pair(gm)
    except Exception:
        pass

    # -------------------------------------------------------------------
    # 14. Varjyam
    # -------------------------------------------------------------------
    varjyam = None
    try:
        vj = drik.varjyam(jd, place)
        if vj and len(vj) >= 2:
            varjyam = _format_pair(vj)
    except Exception:
        pass

    # -------------------------------------------------------------------
    # 15. Amrit Kalam
    # -------------------------------------------------------------------
    amrit_kalam = None
    try:
        ak = drik.amrit_kaalam(jd, place)
        if ak:
            # ak can be a list of tuples or a single tuple
            if isinstance(ak, list):
                amrit_kalam = []
                for period in ak:
                    if isinstance(period, (list, tuple)) and len(period) >= 2:
                        amrit_kalam.append({"start": period[0], "end": period[1]})
            elif isinstance(ak, tuple) and len(ak) >= 2:
                amrit_kalam = [{"start": ak[0], "end": ak[1]}]
    except Exception:
        pass

    # -------------------------------------------------------------------
    # 16. Chandramana (Lunar calendar — Amanta system)
    # -------------------------------------------------------------------
    chandramana = {}
    try:
        vd = drik.vedic_date(jd, place, calendar_type=const.CALENDAR_TYPE.LUNAR_AMANTHA)
        chandra_month = vd[0]
        chandra_day = vd[1]
        samvatsara_idx = vd[2]
        is_adhika = bool(vd[3]) if len(vd) > 3 else False
        is_nija = bool(vd[4]) if len(vd) > 4 else False
        chandramana = {
            "month_name": LUNAR_MONTH_NAMES[chandra_month] if 1 <= chandra_month <= 12 else f"Month-{chandra_month}",
            "month_number": chandra_month,
            "day": chandra_day,
            "samvatsara_name": utils.YEAR_LIST[samvatsara_idx % 60],
            "is_adhika_masa": is_adhika,
            "is_nija_masa": is_nija,
        }
    except Exception:
        pass

    # -------------------------------------------------------------------
    # 17. Lagna (Ascendant) at queried time
    # -------------------------------------------------------------------
    lagna_rasi = None
    try:
        asc = drik.ascendant(jd, place)
        lagna_rasi = asc[0] + 1  # 0-indexed to 1-indexed
    except Exception:
        pass

    # -------------------------------------------------------------------
    # Assemble response
    # -------------------------------------------------------------------
    result = {
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "place": place_name,
        "vaara": VAARA_NAMES[vaara_idx],

        "sunrise": sunrise_str,
        "sunset": sunset_str,

        "tithi": {
            "name": tithi_name,
            "paksha": paksha.capitalize(),
            "number": tithi_num,
            "index_30": tithi_idx_30,
            "start_time": _decimal_hours_to_hms(tithi_start_hrs),
            "end_time": _decimal_hours_to_hms(tithi_end_hrs),
        },

        "nakshatra": {
            "name": nak_name,
            "index": nak_idx,
            "pada": nak_pada,
            "start_time": _decimal_hours_to_hms(nak_start_hrs),
            "end_time": _decimal_hours_to_hms(nak_end_hrs),
            "padas": padas_list,
            "next": next_nak,
        },

        "yoga": {
            "name": yoga_name,
            "index": yoga_idx,
            "start_time": _decimal_hours_to_hms(yoga_start_hrs),
            "end_time": _decimal_hours_to_hms(yoga_end_hrs),
        },

        "karana": {
            "name": karana_name,
            "index": karana_idx,
            "start_time": _decimal_hours_to_hms(karana_start_hrs),
            "end_time": _decimal_hours_to_hms(karana_end_hrs),
        },

        "rahu_kalam": _format_pair(rahu_kalam),
        "yamagandam": _format_pair(yamagandam),
        "gulika_kalam": _format_pair(gulika_kalam),
        "durmuhurtam": durmuhurtam_list,
        "abhijit_muhurta": abhijit,
        "brahma_muhurta": brahma,
        "godhuli_muhurta": godhuli,
        "varjyam": varjyam,
        "amrit_kalam": amrit_kalam,

        "chandramana": chandramana,
        "lagna_rasi": lagna_rasi,

        # Flat aliases for backward compatibility with rules_engine.py
        "tithi_name": tithi_name,
        "tithi_number": tithi_num,
        "tithi_index_raw": tithi_idx_30,
        "paksha": paksha,
        "nakshatra_name": nak_name,
        "nakshatra_index": nak_idx,
        "nakshatra_pada": nak_pada,
        "yoga_name": yoga_name,
        "yoga_index": yoga_idx,
        "karana_name": karana_name,
        "karana_index": karana_idx,
        "lagna_rasi_index": lagna_rasi if lagna_rasi else 1,
    }
    return result

