"""
Muhurtham App — Muhurta calculation and evaluation service.

Contains Pushkara Navamsha / Bhaga window calculation, D1 divisional chart
planet position calculation, and Ashtama Shuddhi checks.
Extracted from main.py lines 246-364 and 451-742.
"""
from datetime import date, timedelta
from typing import Optional, List, Dict, Any, Tuple
import swisseph as swe
from jhora.panchanga.drik import Place as JHoraPlace
from jhora.panchanga import drik
from jhora.horoscope.chart import charts
from jhora import utils

from app.models.names import CANONICAL_NAKSHATRA, RASI_NAMES
from app.core.constants import PUSHKARA_RANGES, PUSHKARA_BHAGA_DEGS, TELUGU_RASI_NAMES
from app.core.logging import logger
from app.utils.time_helpers import (
    parse_time_to_hours,
    is_colliding_time,
    format_hms,
)


def compute_d1_positions(
    target_date: date,
    eval_hour: float,
    birth_place_obj: JHoraPlace,
) -> Tuple[List[Dict[str, Any]], List[Any]]:
    """
    Computes D1 (Rasi chart) planetary positions, retrogrades, combustion,
    and calculates Mandi & Gulika ascendants.
    """
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
                "pada": int(pada),
            })

        # Mandi & Gulika calculation
        jd_midnight = swe.julday(target_date.year, target_date.month, target_date.day, 0.0)
        sr_date = drik.sunrise(jd_midnight + 6.0 / 24.0, birth_place_obj)[0]

        if eval_hour < sr_date:
            base_date = target_date - timedelta(days=1)
            is_day = False
        else:
            base_date = target_date
            jd_base_midnight = swe.julday(base_date.year, base_date.month, base_date.day, 0.0)
            ss_base_date = drik.sunset(jd_base_midnight + 6.0 / 24.0, birth_place_obj)[0]
            is_day = eval_hour < ss_base_date

        jd_base_midnight = swe.julday(base_date.year, base_date.month, base_date.day, 0.0)
        weekday = drik.vaara(jd_base_midnight + 12.0 / 24.0, birth_place_obj)

        if is_day:
            sr = drik.sunrise(jd_base_midnight + 6.0 / 24.0, birth_place_obj)[0]
            ss = drik.sunset(jd_base_midnight + 6.0 / 24.0, birth_place_obj)[0]
            duration = ss - sr
            part_dur = duration / 8.0
            day_parts = [6, 5, 4, 3, 2, 1, 0]
            part_idx = day_parts[weekday]
            gk_time_rel = sr + part_idx * part_dur
            mnd_time_rel = sr + (part_idx + 0.5) * part_dur
        else:
            ss = drik.sunset(jd_base_midnight + 6.0 / 24.0, birth_place_obj)[0]
            sr_next = drik.sunrise(jd_base_midnight + 1.0 + 6.0 / 24.0, birth_place_obj)[0]
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
            "pada": int(mnd_pada),
        })
        positions.append({
            "planet": "Gk",
            "rasi_index": int(gk_lagna[0]),
            "is_retro": False,
            "is_combust": False,
            "nakshatra": CANONICAL_NAKSHATRA.get(raw_gk_nak, raw_gk_nak),
            "pada": int(gk_pada),
        })
        return positions, raw_d1
    except Exception as ex:
        logger.error(f"compute_d1_positions error: {ex}", exc_info=True)
        return [], []


def _get_time_period_str(h: float) -> Tuple[str, str]:
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


def compute_pushkara_window(
    cand_date: date,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str,
    p: Dict[str, Any],
    birth_lagna_idx: Optional[int] = None,
    birth_place_obj: Optional[JHoraPlace] = None,
    return_all: bool = False,
) -> Any:
    """
    Computes Pushkara Navamsha / Bhaga auspicious windows across the 24-hour day.
    Filters out major inauspicious periods (Durmuhurtam, Rahu Kalam, Yamagandam, Gulika Kalam),
    Varjyam overlaps, Ashtama Lagna, and Ashtama Shuddhi violations.
    """
    sr_h = parse_time_to_hours(p.get("sunrise")) or 6.0

    rahu = p.get("rahu_kalam")
    yama = p.get("yamagandam")
    gulika = p.get("gulika_kalam")
    dur_list = p.get("durmuhurtam")
    varjyam = p.get("varjyam")

    swe.set_sid_mode(swe.SIDM_LAHIRI)
    jd_ut_mid = swe.julday(cand_date.year, cand_date.month, cand_date.day, 0.0)

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
                "rasi_te": TELUGU_RASI_NAMES[last_rasi],
                "start_h": lagna_start,
                "end_h": curr_h,
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
            continue

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
                "nav_mins": pushkara_nav_mins,
            })

    if not candidate_lagnas:
        return [] if return_all else None

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
        best_h = clean_mins[len(clean_mins) // 2]
        if bhaga_mins:
            match_kind = "bhaga"
            best_h = bhaga_mins[len(bhaga_mins) // 2]
        elif nav_mins:
            match_kind = "navamsha"
            best_h = nav_mins[len(nav_mins) // 2]

        end_truncated = clean_mins[-1] < lg["end_h"] - (2.0 / 60.0)
        start_truncated = clean_mins[0] > lg["start_h"] + (2.0 / 60.0)

        # Enforce safety buffer (minimum 10 minutes) before inauspicious cutoff
        if end_truncated and (clean_mins[-1] - best_h) < (10.0 / 60.0):
            safe_target = clean_mins[-1] - (10.0 / 60.0)
            if safe_target >= clean_mins[0]:
                best_h = safe_target
            else:
                best_h = clean_mins[len(clean_mins) // 2]

        if start_truncated and (best_h - clean_mins[0]) < (10.0 / 60.0):
            safe_target = clean_mins[0] + (10.0 / 60.0)
            if safe_target <= clean_mins[-1]:
                best_h = safe_target
            else:
                best_h = clean_mins[len(clean_mins) // 2]

        # 2. Reject Ashtama Shuddhi violation (8th house must be vacant)
        if birth_place_obj:
            ashtama_rasi_idx = (cand_lagna_idx - 1 + 7) % 12 + 1
            _, cand_raw_d1_h = compute_d1_positions(cand_date, best_h, birth_place_obj)
            has_shuddhi_at_h = True
            for item in cand_raw_d1_h:
                p_id = item[0]
                if p_id == 'L':
                    continue
                p_rasi = item[1][0] + 1
                if p_rasi == ashtama_rasi_idx:
                    has_shuddhi_at_h = False
                    break
            if not has_shuddhi_at_h:
                continue

        precise_t = format_hms(best_h)
        p_te, p_en = _get_time_period_str(best_h)
        lg_duration = f"{format_hms(lg['start_h'])} – {format_hms(lg['end_h'])}"
        clean_win = f"{format_hms(clean_mins[0])} – {format_hms(clean_mins[-1])}"

        type_en = "Pushkara Bhaga Lagna" if match_kind == "bhaga" else (
            "Pushkara Navamsha Lagna" if match_kind == "navamsha" else "Auspicious Lagna Window"
        )
        type_te = "పుష్కర భాగ లగ్నం" if match_kind == "bhaga" else (
            "పుష్కర నవాంశ లగ్నం" if match_kind == "navamsha" else "శుభ లగ్న సమయం"
        )

        avoid_notes_te = []
        avoid_notes_en = []

        if end_truncated:
            end_names_te, end_names_en = get_colliding_names(clean_mins[-1] + (5.0 / 60.0), buffer_m=5.0)
            if not end_names_te:
                name_str_te = "అశుభ సమయం"
                name_str_en = "Inauspicious Time"
            else:
                name_str_te = " / ".join(end_names_te)
                name_str_en = " / ".join(end_names_en)
            avoid_notes_te.append(f"{format_hms(clean_mins[-1])} తర్వాత అశుభ సమయం ({name_str_te})")
            avoid_notes_en.append(f"inauspicious time ({name_str_en}) after {format_hms(clean_mins[-1])}")

        if start_truncated:
            start_names_te, start_names_en = get_colliding_names(clean_mins[0] - (5.0 / 60.0), buffer_m=5.0)
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
            "precise_time": format_hms(bhaga_mins[len(bhaga_mins) // 2]) if bhaga_mins else None,
            "time_window": f"{format_hms(bhaga_mins[0])} – {format_hms(bhaga_mins[-1])}" if bhaga_mins else None,
        }

        pushkara_navamsha_info = {
            "is_available": len(nav_mins) > 0,
            "precise_time": format_hms(nav_mins[len(nav_mins) // 2]) if nav_mins else None,
            "time_window": f"{format_hms(nav_mins[0])} – {format_hms(nav_mins[-1])}" if nav_mins else None,
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
            "type_te": type_te,
        })

    if not processed_windows:
        return [] if return_all else None

    # Sort: morning Lagnas (< 12 PM) first, then afternoon (< 5 PM), then evening/night
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
