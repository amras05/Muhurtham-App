"""
Complete Chandramana (Surya Siddhanta) Panchang — all panchangam elements
computed via PyJHora's surya_sidhantha module.

Region-based: pass lat/lon/tz_offset for any location and get accurate,
location-specific timings for sunrise, sunset, tithi, nakshatra, etc.
"""
# pyrefly: ignore [missing-import]
from jhora.panchanga import drik, surya_sidhantha
# pyrefly: ignore [missing-import]
from jhora import utils, const
# pyrefly: ignore [missing-import]
import swisseph as swe
import math

from .names import (
    VAARA_NAMES, tithi_to_number_and_paksha, LUNAR_MONTH_NAMES,
    CANONICAL_NAKSHATRA, CANONICAL_TITHI, CANONICAL_KARANA, CANONICAL_YOGA,
    NAKSHATRA_NAMES, TITHI_NAMES,
)

# Monkey patches to ensure surya_sidhantha functions run correctly
class CustomPlanetList(dict):
    def index(self, key):
        return self[key]

drik.planet_list = CustomPlanetList(drik.planet_list)

_orig_vaara = drik.vaara
def patched_vaara(jd, place=None):
    if place is None:
        place = drik.Place('Ujjain', 23.1765, 75.7885, 5.5)
    return _orig_vaara(jd, place)
drik.vaara = patched_vaara

# Float-based kali_ahargana to allow time-of-day variations
def float_kali_ahargana(jd):
    kad = jd - const.mahabharatha_tithi_julian_day
    wday = int(kad) % 7
    wdayjd = drik.vaara(jd)
    winc = (wdayjd - 5 - wday)
    return kad + winc
surya_sidhantha.kali_ahargana = float_kali_ahargana


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
    float (decimal hours) values."""
    if not pair or len(pair) < 2:
        return None
    a, b = pair[0], pair[1]
    start = a if isinstance(a, str) else _decimal_hours_to_hms(a)
    end = b if isinstance(b, str) else _decimal_hours_to_hms(b)
    return {"start": start, "end": end}


def _find_tithi_boundary(target_angle: float, jd_midnight: float, place, low_h: float, high_h: float) -> float:
    """Find the local hour where the moon-sun longitude difference matches target_angle."""
    for _ in range(25):
        mid_h = (low_h + high_h) / 2.0
        jd_t = jd_midnight + mid_h / 24.0
        pp = surya_sidhantha.planet_positions(jd_t, place)
        sun_long = pp[1][1][0] * 30.0 + pp[1][1][1]
        moon_long = pp[2][1][0] * 30.0 + pp[2][1][1]
        l_diff = (moon_long + 360.0 - sun_long) % 360.0
        diff = (l_diff - target_angle + 180.0) % 360.0 - 180.0
        if diff < 0.0:
            low_h = mid_h
        else:
            high_h = mid_h
    return (low_h + high_h) / 2.0


def _find_nakshatra_boundary(target_angle: float, jd_midnight: float, place, low_h: float, high_h: float) -> float:
    """Find the local hour where the moon longitude matches target_angle."""
    for _ in range(25):
        mid_h = (low_h + high_h) / 2.0
        jd_t = jd_midnight + mid_h / 24.0
        pp = surya_sidhantha.planet_positions(jd_t, place)
        moon_long = pp[2][1][0] * 30.0 + pp[2][1][1]
        diff = (moon_long - target_angle + 180.0) % 360.0 - 180.0
        if diff < 0.0:
            low_h = mid_h
        else:
            high_h = mid_h
    return (low_h + high_h) / 2.0


def _find_yoga_boundary(target_angle: float, jd_midnight: float, place, low_h: float, high_h: float) -> float:
    """Find the local hour where the sun + moon longitude matches target_angle."""
    for _ in range(25):
        mid_h = (low_h + high_h) / 2.0
        jd_t = jd_midnight + mid_h / 24.0
        pp = surya_sidhantha.planet_positions(jd_t, place)
        sun_long = pp[1][1][0] * 30.0 + pp[1][1][1]
        moon_long = pp[2][1][0] * 30.0 + pp[2][1][1]
        y_sum = (sun_long + moon_long) % 360.0
        diff = (y_sum - target_angle + 180.0) % 360.0 - 180.0
        if diff < 0.0:
            low_h = mid_h
        else:
            high_h = mid_h
    return (low_h + high_h) / 2.0


def compute_day_panchang(year: int, month: int, day: int,
                          lat: float, lon: float, tz_offset: float,
                          place_name: str = "Location",
                          hour: int = 6, minute: int = 0, second: int = 0) -> dict:
    """
    Compute complete Chandramana (Surya Siddhanta) panchang for a given date/place.

    Calculations use PyJHora's surya_sidhantha module.
    Times are formatted as HH:MM:SS with (+1)/(-1) day-offset tags
    when the time falls on the next/previous calendar day.
    """
    place = drik.Place(place_name, lat, lon, tz_offset)
    # Set global place in surya_sidhantha to prevent NameError
    surya_sidhantha.place = place

    date_in = drik.Date(year, month, day)
    jd_midnight = utils.julian_day_number(date_in, (0, 0, 0))
    jd = jd_midnight + (hour + minute / 60.0 + second / 3600.0) / 24.0
    jd_hours = hour + minute / 60.0 + second / 3600.0

    # 1. Vaara (weekday)
    vaara_idx = drik.vaara(jd, place)

    # 2. Sunrise / Sunset
    # surya_sidhantha.sunrise_set returns [sr_hrs, sr_str, ss_hrs, ss_str]
    sr_hrs, _, ss_hrs, _ = surya_sidhantha.sunrise_set(jd, place)
    sunrise_str = _decimal_hours_to_hms(sr_hrs)
    sunset_str = _decimal_hours_to_hms(ss_hrs)
    day_dur = ss_hrs - sr_hrs

    # Tomorrow's sunrise for night duration
    sr_hrs_tomorrow, _, _, _ = surya_sidhantha.sunrise_set(jd + 1, place)
    night_dur = (24.0 + sr_hrs_tomorrow) - ss_hrs

    # 3. Tithi (Calculated in minutes of arc per the traditional textbook method)
    pp = surya_sidhantha.planet_positions(jd, place)
    # pp[1] is Sun, pp[2] is Moon.
    # pp[1][1][0] is Sign (S), pp[1][1][1] is degrees and decimal minutes
    sun_sign = pp[1][1][0]
    sun_deg = pp[1][1][1]
    sun_long = sun_sign * 30.0 + sun_deg
    sun_minutes = (sun_sign * 30.0 * 60.0) + (sun_deg * 60.0)

    moon_sign = pp[2][1][0]
    moon_deg = pp[2][1][1]
    moon_long = moon_sign * 30.0 + moon_deg
    moon_minutes = (moon_sign * 30.0 * 60.0) + (moon_deg * 60.0)

    # 21600 minutes of arc in a full circle (360 degrees)
    minutes_diff = (moon_minutes + 21600.0 - sun_minutes) % 21600.0
    
    # Each Tithi spans 12 degrees = 720 minutes of arc
    _tithi = (minutes_diff / 720.0) % 30.0
    tithi_idx_30 = math.ceil(_tithi) if _tithi != 0.0 else 30
    tithi_num, paksha = tithi_to_number_and_paksha(tithi_idx_30)
    tithi_name_raw = utils.TITHI_LIST[tithi_idx_30 - 1]
    tithi_name = CANONICAL_TITHI.get(tithi_name_raw, tithi_name_raw)

    sun_dm = surya_sidhantha._true_daily_motion_planet(jd, const._SUN)
    moon_dm = surya_sidhantha._true_daily_motion_planet(jd, const._MOON)
    sun_dm_min = sun_dm * 60.0
    moon_dm_min = moon_dm * 60.0

    _td_left_min = (tithi_idx_30 * 720.0 - minutes_diff) % 21600.0
    _th_left = _td_left_min / (moon_dm_min - sun_dm_min) * 24.0

    _td_elapsed_min = (minutes_diff - (tithi_idx_30 - 1) * 720.0) % 21600.0
    _th_elapsed = _td_elapsed_min / (moon_dm_min - sun_dm_min) * 24.0

    approx_start = jd_hours - _th_elapsed
    approx_end = jd_hours + _th_left

    tithi_start_hrs = _find_tithi_boundary((tithi_idx_30 - 1) * 12.0, jd_midnight, place, approx_start - 3.0, approx_start + 3.0)
    tithi_end_hrs = _find_tithi_boundary(tithi_idx_30 * 12.0, jd_midnight, place, approx_end - 3.0, approx_end + 3.0)

    # 4. Nakshatra (Calculated in minutes of arc; each Nakshatra spans 13° 20' = 800 minutes of arc)
    moon_long = moon_sign * 30.0 + moon_deg
    nak_idx, nak_pada, _ = drik.nakshatra_pada(moon_long)
    nak_name_raw = utils.NAKSHATRA_LIST[nak_idx - 1]
    nak_name = CANONICAL_NAKSHATRA.get(nak_name_raw, nak_name_raw)

    nak_span_min = 800.0
    nak_left_min = (nak_idx * nak_span_min - moon_minutes) % 21600.0
    _nak_left = nak_left_min / moon_dm_min * 24.0

    nak_elapsed_min = (moon_minutes - (nak_idx - 1) * nak_span_min) % 21600.0
    _nak_elapsed = nak_elapsed_min / moon_dm_min * 24.0

    approx_nak_start = jd_hours - _nak_elapsed
    approx_nak_end = jd_hours + _nak_left

    nak_start_hrs = _find_nakshatra_boundary((nak_idx - 1) * (360.0 / 27.0), jd_midnight, place, approx_nak_start - 3.0, approx_nak_start + 3.0)
    nak_end_hrs = _find_nakshatra_boundary(nak_idx * (360.0 / 27.0), jd_midnight, place, approx_nak_end - 3.0, approx_nak_end + 3.0)

    # Calculate exact boundaries for all 4 padas of the current nakshatra
    padas_list = []
    pada_duration = (nak_end_hrs - nak_start_hrs) / 4.0
    for p in range(1, 5):
        p_start = nak_start_hrs + (p - 1) * pada_duration
        p_end = nak_start_hrs + p * pada_duration
        padas_list.append({
            "pada": p,
            "start_time": _decimal_hours_to_hms(p_start),
            "end_time": _decimal_hours_to_hms(p_end)
        })

    # Next nakshatra info
    next_nak_idx = (nak_idx % 27) + 1
    next_nak_name_raw = utils.NAKSHATRA_LIST[next_nak_idx - 1]
    approx_next_end = nak_end_hrs + (360.0 / 27.0) / moon_dm * 24.0
    next_nak_end_hrs = _find_nakshatra_boundary(next_nak_idx * (360.0 / 27.0), jd_midnight, place, approx_next_end - 3.0, approx_next_end + 3.0)
    
    next_nak = {
        "name": CANONICAL_NAKSHATRA.get(next_nak_name_raw, next_nak_name_raw),
        "pada": 1,
        "start_time": _decimal_hours_to_hms(nak_end_hrs),
        "end_time": _decimal_hours_to_hms(next_nak_end_hrs),
    }

    # 5. Yoga
    yoga_phase = (sun_long + moon_long) % 360.0
    one_yoga = 360.0 / 27.0
    yoga_idx = math.ceil(yoga_phase / one_yoga) if yoga_phase != 0.0 else 27
    yoga_name_raw = utils.YOGAM_LIST[yoga_idx - 1]
    yoga_name = CANONICAL_YOGA.get(yoga_name_raw, yoga_name_raw)

    yoga_left_deg = (yoga_idx * one_yoga - yoga_phase) % 360.0
    _yoga_left = yoga_left_deg / (moon_dm + sun_dm) * 24.0

    yoga_elapsed_deg = (yoga_phase - (yoga_idx - 1) * one_yoga) % 360.0
    _yoga_elapsed = yoga_elapsed_deg / (moon_dm + sun_dm) * 24.0

    approx_yoga_start = jd_hours - _yoga_elapsed
    approx_yoga_end = jd_hours + _yoga_left

    yoga_start_hrs = _find_yoga_boundary((yoga_idx - 1) * one_yoga, jd_midnight, place, approx_yoga_start - 3.0, approx_yoga_start + 3.0)
    yoga_end_hrs = _find_yoga_boundary(yoga_idx * one_yoga, jd_midnight, place, approx_yoga_end - 3.0, approx_yoga_end + 3.0)

    # 6. Karana
    karana_idx = tithi_idx_30 * 2 - 1
    _t_mid = 0.5 * (tithi_start_hrs + tithi_end_hrs)
    if jd_hours > _t_mid:
        karana_idx += 1
        karana_start_hrs = _t_mid
        karana_end_hrs = tithi_end_hrs
    else:
        karana_start_hrs = tithi_start_hrs
        karana_end_hrs = _t_mid

    karana_name_raw = utils.KARANA_LIST[karana_idx - 1]
    karana_name = CANONICAL_KARANA.get(karana_name_raw, karana_name_raw)

    # 7. Rahu Kalam, Yamagandam, Gulika Kalam (trikalam)
    trikalam_offsets = {
        'rahu_kalam': [0.875, 0.125, 0.75, 0.5, 0.625, 0.375, 0.25],
        'gulika_kalam': [0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0.0],
        'yamagandam': [0.5, 0.375, 0.25, 0.125, 0.0, 0.75, 0.625]
    }

    rahu_kalam_start = sr_hrs + day_dur * trikalam_offsets['rahu_kalam'][vaara_idx]
    rahu_kalam = {"start": _decimal_hours_to_hms(rahu_kalam_start), "end": _decimal_hours_to_hms(rahu_kalam_start + 0.125 * day_dur)}

    yamagandam_start = sr_hrs + day_dur * trikalam_offsets['yamagandam'][vaara_idx]
    yamagandam = {"start": _decimal_hours_to_hms(yamagandam_start), "end": _decimal_hours_to_hms(yamagandam_start + 0.125 * day_dur)}

    gulika_kalam_start = sr_hrs + day_dur * trikalam_offsets['gulika_kalam'][vaara_idx]
    gulika_kalam = {"start": _decimal_hours_to_hms(gulika_kalam_start), "end": _decimal_hours_to_hms(gulika_kalam_start + 0.125 * day_dur)}

    # 8. Durmuhurtam
    durmuhurtam_offsets = [
        [10.4, 0.0],  # Sunday
        [6.4, 8.8],   # Monday
        [2.4, 4.8],   # Tuesday
        [5.6, 0.0],   # Wednesday
        [4.0, 8.8],   # Thursday
        [2.4, 6.4],   # Friday
        [1.6, 0.0]    # Saturday
    ]
    dur = [day_dur, day_dur]
    base = [sr_hrs, sr_hrs]
    if vaara_idx == 2:
        dur[1] = night_dur
        base[1] = ss_hrs

    durmuhurtam_list = []
    for i in range(0, 2):
        offset = durmuhurtam_offsets[vaara_idx][i]
        if offset != 0.0:
            d_start = base[i] + dur[i] * offset / 12.0
            d_end = d_start + day_dur * 0.8 / 12.0
            durmuhurtam_list.append({
                "start": _decimal_hours_to_hms(d_start),
                "end": _decimal_hours_to_hms(d_end),
            })

    # 9. Abhijit Muhurta
    abhijit = {
        "start": _decimal_hours_to_hms(sr_hrs + 7.0 / 15.0 * day_dur),
        "end": _decimal_hours_to_hms(sr_hrs + 8.0 / 15.0 * day_dur)
    }

    # 10. Brahma Muhurta
    nm = night_dur / 15.0
    brahma = {
        "start": _decimal_hours_to_hms(sr_hrs - 2 * nm),
        "end": _decimal_hours_to_hms(sr_hrs - nm)
    }

    # 11. Godhuli Muhurta
    dm = day_dur / 15.0
    godhuli = {
        "start": _decimal_hours_to_hms(ss_hrs - 0.25 * dm),
        "end": _decimal_hours_to_hms(ss_hrs + 0.25 * nm)
    }

    # 12. Varjyam
    varjyam_times = []
    nak_durn = nak_end_hrs - nak_start_hrs
    if nak_idx == 19:  # Moolam has two Varjyam timings
        nak_fac1 = const.amrita_gadiya_varjyam_star_map[nak_idx-1][1][0]/24
        nak_fac2 = const.amrita_gadiya_varjyam_star_map[nak_idx-1][1][1]/24
        v_start1 = nak_start_hrs + nak_fac1*nak_durn
        v_start2 = nak_start_hrs + nak_fac2*nak_durn
        v_durn = nak_durn * 1.6/24
        varjyam = {"start": _decimal_hours_to_hms(v_start1), "end": _decimal_hours_to_hms(v_start1 + v_durn)}
    else:
        nak_fac = const.amrita_gadiya_varjyam_star_map[nak_idx-1][1]/24
        v_start = nak_start_hrs + nak_fac*nak_durn
        v_durn = nak_durn * 1.6/24
        varjyam = {"start": _decimal_hours_to_hms(v_start), "end": _decimal_hours_to_hms(v_start + v_durn)}

    # 13. Amrit Kalam
    amrit_fac = const.amrita_gadiya_varjyam_star_map[nak_idx-1][0]/24
    amrit_start = nak_start_hrs + amrit_fac * nak_durn
    amrit_durn = nak_durn * 1.6/24
    amrit_kalam = [{"start": _decimal_hours_to_hms(amrit_start), "end": _decimal_hours_to_hms(amrit_start + amrit_durn)}]

    # 14. Chandramana (Lunar calendar — Amanta system)
    # Reuse drik vedic_date for standard calendar date name resolver
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

    # 15. Lagna (Ascendant) at queried time
    # pp[0] contains the ascendant rasi index and coordinates
    # pp[0][1][0] is 0-indexed rasi, normalize to 1-12
    lagna_rasi = pp[0][1][0] + 1

    # Assemble response
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

        "rahu_kalam": rahu_kalam,
        "yamagandam": yamagandam,
        "gulika_kalam": gulika_kalam,
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
