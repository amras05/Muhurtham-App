"""
Generic Declarative Rule Interpreter Engine (Layer 3).
Loads YAML/JSON rules from backend/app/rules/{category}/{event_id}.yaml
and executes hard filters, universal dosha filters, and soft scoring against
continuous TimeWindows and LagnaWindows.
"""
from datetime import date, datetime, timedelta
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import yaml

from app.engines.lagna_scanner import LagnaWindow, evaluate_house_rules, scan_day_lagnas
from app.engines.panchang import compute_day_panchang
from app.engines.time_windows import TimeWindow, subtract_blocked_intervals
from app.engines.universal_filters import (
    evaluate_chandrabala,
    evaluate_panchaka,
    evaluate_tarabala,
    extract_inauspicious_windows,
)
from app.schemas.rules import RuleDefinition
from jhora.panchanga import drik
from app.services.muhurta_service import compute_d1_positions, compute_pushkara_window
from app.engines.doshas import (
    evaluate_21_maha_doshas,
    evaluate_10_dashavidha_doshas,
    evaluate_muhurta_pariharas
)
from app.engines.nama_nakshatra import (
    check_travel_directional_sula,
    check_facing_compatibility,
    lookup_nama_nakshatra
)

RULES_ROOT = Path(__file__).resolve().parent.parent / "rules"

# In-memory cache for parsed RuleDefinitions
_RULES_CACHE: Dict[str, RuleDefinition] = {}
_CATALOG_CACHE: Optional[List[Dict[str, Any]]] = None

# Day name normalization
VAARA_MAP = {
    0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
    4: "thursday", 5: "friday", 6: "saturday",
    "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3,
    "thursday": 4, "friday": 5, "saturday": 6,
}

TITHI_RIKTA = [4, 9, 14, 19, 24, 29]  # Chaturthi, Navami, Chaturdashi in both pakshas


def _hms_to_hours(hms_str: Optional[str], default: float = 6.0) -> float:
    if not hms_str:
        return default
    try:
        parts = [float(p) for p in str(hms_str).split(":")]
        return parts[0] + (parts[1] / 60.0) + (parts[2] / 3600.0 if len(parts) > 2 else 0.0)
    except Exception:
        return default


def load_rule(event_id: str) -> Optional[RuleDefinition]:
    """Finds and loads a rule definition by its event_id across all category folders."""
    if event_id in _RULES_CACHE:
        return _RULES_CACHE[event_id]

    for category_dir in RULES_ROOT.iterdir():
        if category_dir.is_dir() and category_dir.name != "shared":
            candidate = category_dir / f"{event_id}.yaml"
            if candidate.exists():
                with open(candidate, encoding="utf-8") as f:
                    raw_data = yaml.safe_load(f)
                    rule_def = RuleDefinition(**raw_data)
                    _RULES_CACHE[event_id] = rule_def
                    return rule_def

    return None


def list_all_rules(force_reload: bool = False) -> List[Dict[str, Any]]:
    """Scans the rules directory and returns a catalog of all available muhurtams."""
    global _CATALOG_CACHE
    if _CATALOG_CACHE is not None and not force_reload:
        return _CATALOG_CACHE

    catalog = []
    if not RULES_ROOT.exists():
        return []

    for cat_dir in sorted(RULES_ROOT.iterdir()):
        if cat_dir.is_dir() and cat_dir.name != "shared":
            for y_file in sorted(cat_dir.glob("*.yaml")):
                try:
                    with open(y_file, encoding="utf-8") as f:
                        raw = yaml.safe_load(f)
                        catalog.append({
                            "id": raw.get("id", y_file.stem),
                            "category": cat_dir.name,
                            "title_en": raw.get("title_en", y_file.stem),
                            "title_te": raw.get("title_te", ""),
                            "source_part": raw.get("source", {}).get("part"),
                            "source_section": raw.get("source", {}).get("section"),
                        })
                except Exception:
                    continue

    _CATALOG_CACHE = catalog
    return catalog


def evaluate_window_for_rule(
    rule: RuleDefinition,
    lagna: LagnaWindow,
    panchang_data: Dict[str, Any],
    birth_details: Optional[Dict[str, Any]] = None,
    panchaka_method: str = "standard"
) -> Tuple[bool, int, List[str], List[str]]:
    """
    Evaluates a specific LagnaWindow against a RuleDefinition.
    Returns (is_passed, score, rules_passed, cautions).
    """
    hf = rule.hard_filters
    sc = rule.soft_scoring
    rules_passed: List[str] = []
    cautions: List[str] = []
    score: int = 0

    vaara_str = panchang_data.get("vaara", "").lower().strip()
    vaara_idx = VAARA_MAP.get(vaara_str, 0)
    tithi_num = panchang_data.get("tithi_number", 1)
    paksha = panchang_data.get("paksha", "shukla").lower()
    nak_name = panchang_data.get("nakshatra_name", "").lower()
    nak_idx = panchang_data.get("nakshatra_index", 1)
    karana_name = panchang_data.get("karana_name", "").lower()
    yoga_name = panchang_data.get("yoga_name", "").lower()
    lagna_name = lagna.lagna_name_en.lower()

    # 1. Weekday (Vaara) checks
    if hf.vaara_exclude and vaara_str in [v.lower() for v in hf.vaara_exclude]:
        return False, 0, [], [f"{vaara_str.title()} is strictly excluded for this event"]
    if hf.vaara_allow and vaara_str not in [v.lower() for v in hf.vaara_allow]:
        return False, 0, [], [f"{vaara_str.title()} is not in the allowed weekdays list"]
    rules_passed.append(f"Weekday ({vaara_str.title()}) is acceptable")

    # 2. Tithi checks
    if hf.tithi_exclude:
        t_exc = [t.lower() for t in hf.tithi_exclude]
        if "rikta" in t_exc and tithi_num in TITHI_RIKTA:
            return False, 0, [], [f"Tithi #{tithi_num} is a Rikta tithi (strictly excluded)"]
        if "amavasya" in t_exc and tithi_num == 30:
            return False, 0, [], ["Amavasya is strictly excluded"]

    if hf.tithi_numbers_both_paksha and tithi_num not in hf.tithi_numbers_both_paksha:
        return False, 0, [], [f"Tithi #{tithi_num} is not allowed"]

    if hf.tithi_shukla_numbers and paksha == "shukla" and tithi_num not in hf.tithi_shukla_numbers:
        return False, 0, [], [f"Shukla #{tithi_num} is not allowed"]

    if hf.tithi_krishna_numbers and paksha == "krishna" and tithi_num not in hf.tithi_krishna_numbers:
        return False, 0, [], [f"Krishna #{tithi_num} is not allowed"]

    rules_passed.append(f"Tithi ({panchang_data.get('tithi_name')}) is acceptable")

    # 3. Nakshatra checks
    if hf.nakshatra_exclude and any(n.lower() in nak_name for n in hf.nakshatra_exclude):
        return False, 0, [], [f"{panchang_data.get('nakshatra_name')} is excluded"]
    if hf.nakshatra_allow and not any(n.lower() in nak_name for n in hf.nakshatra_allow):
        return False, 0, [], [f"{panchang_data.get('nakshatra_name')} is not in allowed stars"]
    rules_passed.append(f"Nakshatra ({panchang_data.get('nakshatra_name')}) is favorable")

    # 4. Karana check (Bhadra / Vishti)
    if hf.karana_exclude and any(k.lower() in karana_name for k in hf.karana_exclude):
        return False, 0, [], [f"Karana ({karana_name.title()}) is inauspicious (Bhadra/Vishti)"]

    # 5. Lagna checks
    if hf.lagna_types and lagna.mobility.lower() not in [lt.lower() for lt in hf.lagna_types]:
        return False, 0, [], [f"{lagna.lagna_name_en} Lagna ({lagna.mobility}) is not of allowed type {hf.lagna_types}"]

    if hf.lagna_allow and lagna_name not in [l.lower() for l in hf.lagna_allow]:
        return False, 0, [], [f"{lagna.lagna_name_en} is not an allowed Lagna"]

    if hf.lagna_exclude and lagna_name in [l.lower() for l in hf.lagna_exclude]:
        return False, 0, [], [f"{lagna.lagna_name_en} Lagna is excluded"]

    # 6. House Occupancy Rules (e.g. Ashtama Shuddhi)
    if hf.house_rules:
        h_pass, h_reasons = evaluate_house_rules(lagna, hf.house_rules)
        if not h_pass:
            return False, 0, [], h_reasons
        rules_passed.extend(h_reasons)

    # 7. Common Panchaka Rahitam
    if hf.common.panchaka_rahita:
        p_res = evaluate_panchaka(tithi_num, vaara_idx, nak_idx, lagna.lagna_idx, method=panchaka_method)
        if not p_res["is_pass"]:
            return False, 0, [], [f"Panchaka Dosha: {p_res['name_en']} ({p_res['effect_en']})"]
        rules_passed.append(f"Panchaka Rahitam: {p_res['name_en']}")

    # 8. Participant Birth Balas (if provided)
    if birth_details:
        # Tarabalam
        if "janma_nak_idx" in birth_details:
            tb = evaluate_tarabala(nak_idx, birth_details["janma_nak_idx"])
            if not tb["is_pass"]:
                return False, 0, [], [f"Tarabalam failed: {tb['name_en']} ({tb['verdict_en']})"]
            rules_passed.append(f"Tarabalam satisfied ({tb['name_en']})")
            score += 3

        # Chandrabalam
        if "janma_moon_rasi_idx" in birth_details:
            transit_moon_rasi = panchang_data.get("moon_rasi_index", 1)
            cb = evaluate_chandrabala(transit_moon_rasi, birth_details["janma_moon_rasi_idx"])
            if not cb["is_pass"]:
                return False, 0, [], [f"Chandrabalam failed: {cb['verdict_en']}"]
            rules_passed.append("Chandrabalam satisfied")
            score += 2

    # --- Apply Soft Scoring ---
    if sc.vaara_weights and vaara_str in sc.vaara_weights:
        score += sc.vaara_weights[vaara_str]
    if sc.lagna_weights and lagna_name in sc.lagna_weights:
        score += sc.lagna_weights[lagna_name]

    # Pushkara Navamsa bonus
    if lagna.is_pushkara_navamsa:
        score += 5
        rules_passed.append(f"Pushkara Navamsa: {lagna.navamsa_name_en} (+5 points)")

    return True, score, rules_passed, cautions


def find_muhurta_windows(
    activity_id: str,
    start_date: date,
    days_to_scan: int,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str = "Location",
    birth_details: Optional[Dict[str, Any]] = None,
    panchaka_method: str = "standard",
    min_window_minutes: float = 15.0,
    activity_params: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Main entry point for finding auspicious muhurtha windows for any activity.
    Scans days in date range, evaluates LagnaWindows against YAML rules,
    subtracts inauspicious kalas, and returns ranked time windows alongside
    comprehensive candidates with full D1 charts, 21 Maha Doshas, and Pariharams.
    """
    rule = load_rule(activity_id)
    if not rule:
        return {"error": f"Unknown activity rule '{activity_id}'"}

    results: List[Dict[str, Any]] = []
    candidates: List[Dict[str, Any]] = []
    place_obj = drik.Place(place_name, lat, lon, tz_offset)

    # Participant astrological points
    b_nak_idx = birth_details.get("janma_nak_idx") if birth_details else None
    b_rasi_idx = birth_details.get("janma_moon_rasi_idx") if birth_details else None
    travel_dir = activity_params.get("travel_direction") if activity_params else None
    facing_dir = (activity_params.get("door_facing") or activity_params.get("plot_facing")) if activity_params else None

    for d_offset in range(days_to_scan):
        cur_date = start_date + timedelta(days=d_offset)
        base_dt = datetime(cur_date.year, cur_date.month, cur_date.day)

        # 1. Compute day panchang
        panchang = compute_day_panchang(
            cur_date.year, cur_date.month, cur_date.day,
            lat, lon, tz_offset, place_name, hour=6.0
        )
        sr_h = _hms_to_hours(panchang.get("sunrise"), default=6.0)

        # 2. Extract inauspicious spans (Rahu, Yama, Gulika, Varjyam, Durmuhurtha)
        inauspicious_spans = extract_inauspicious_windows(panchang, base_dt)

        # 3. Scan Lagnas across the day
        lagnas = scan_day_lagnas(
            cur_date.year, cur_date.month, cur_date.day,
            lat, lon, tz_offset, sr_h
        )

        # 4. Pushkara window prediction for the date
        pushkara_info = compute_pushkara_window(
            cur_date, lat, lon, tz_offset, place_name, panchang,
            birth_lagna_idx=b_rasi_idx, birth_place_obj=place_obj
        )

        # Directional Sula check for travel activities
        sula_check = check_travel_directional_sula(panchang.get("vaara", ""), travel_dir) if travel_dir else None

        # 5. Evaluate each Lagna window against the rule
        for lagna in lagnas:
            is_pass, score, rules_passed, cautions = evaluate_window_for_rule(
                rule, lagna, panchang, birth_details, panchaka_method
            )
            if not is_pass:
                continue

            # Candidate time window is the Lagna window
            cand_window = TimeWindow(
                start=lagna.start,
                end=lagna.end,
                label=f"{lagna.lagna_name_en} Lagna",
                metadata={"lagna": lagna.lagna_name_en, "navamsa": lagna.navamsa_name_en}
            )

            # Subtract Rahu, Yama, Varjyam, Durmuhurtham
            clean_windows = subtract_blocked_intervals(
                [cand_window], inauspicious_spans, min_duration_minutes=min_window_minutes
            )

            for cw in clean_windows:
                # Compute midpoint of clean window for Swiss Ephemeris D1 chart
                mid_dt = cw.start + (cw.end - cw.start) / 2
                eval_h = mid_dt.hour + mid_dt.minute / 60.0 + mid_dt.second / 3600.0

                d1_positions, raw_d1 = compute_d1_positions(cur_date, eval_h, place_obj)

                # Evaluate 21 Maha Doshas, 10 Dashavidha Doshas, & Pariharams
                maha_doshas = evaluate_21_maha_doshas(
                    panchang, d1_positions, raw_d1, lagna.lagna_idx, birth_details
                )
                dashavidha_doshas = evaluate_10_dashavidha_doshas(
                    panchang, d1_positions, raw_d1, lagna.lagna_idx, birth_details
                )
                pariharas = evaluate_muhurta_pariharas(
                    panchang, raw_d1, lagna.lagna_idx,
                    birth_details=birth_details, pushkara_info=pushkara_info
                )

                # Panchaka evaluation
                panchaka_info = evaluate_panchaka(
                    panchang.get("tithi_number", 1),
                    panchang.get("vaara_number", 0),
                    panchang.get("nakshatra_number", 1),
                    lagna.lagna_idx,
                    method=panchaka_method
                )

                # Participant Balas
                tara_info = None
                if b_nak_idx:
                    tara_res = evaluate_tarabala(panchang.get("nakshatra_number", 1), b_nak_idx)
                    tara_info = {
                        "name": tara_res.get("name_en"),
                        "name_te": tara_res.get("name_te"),
                        "remainder": tara_res.get("tara_num"),
                        "is_pass": tara_res.get("is_pass", True)
                    }

                chandra_info = None
                if b_rasi_idx:
                    cb_res = evaluate_chandrabala(panchang.get("moon_rasi_index", 0), b_rasi_idx)
                    chandra_info = {
                        "is_pass": cb_res.get("is_pass", True),
                        "house": cb_res.get("house_diff"),
                        "msg": cb_res.get("verdict_en"),
                        "desc_en": cb_res.get("verdict_en"),
                        "desc_te": cb_res.get("verdict_te")
                    }

                # Facing compatibility
                facing_check = check_facing_compatibility(facing_dir, b_rasi_idx) if facing_dir else None

                # Build reasons
                all_reasons: List[str] = list(rules_passed)
                if lagna.is_pushkara_navamsa:
                    all_reasons.append("✨ Pushkara Navamsa active in Lagna (highest classical auspiciousness).")
                planets_in_8 = [p.name_en for p in lagna.house_planets.get(8, [])]
                if not planets_in_8:
                    all_reasons.append("Ashtama Shuddhi clean: 8th house is vacant.")
                else:
                    cautions.append(f"8th house occupied by {', '.join(planets_in_8)}")
                if panchaka_info.get("is_pass"):
                    all_reasons.append(f"Panchaka Rahitam clean: {panchaka_info.get('name_en')} (remainder {panchaka_info.get('remainder')}).")
                if sula_check and sula_check.get("has_sula"):
                    cautions.append(sula_check.get("desc_en"))

                # Final percentage calculation
                active_severe_doshas = [d for d in maha_doshas if not d.get("is_pass") and d.get("severity") == "high"]
                pct = int(min(98, max(15, score * 10 - len(active_severe_doshas) * 15 + (10 if lagna.is_pushkara_navamsa else 0))))
                if sula_check and sula_check.get("has_sula"):
                    pct = min(pct, 40)

                verdict = "ఉత్తమ ముహూర్తం" if pct >= 75 else ("మధ్యమ ముహూర్తం" if pct >= 50 else "నిషిద్ధం")

                planets_in_1 = [p.name_en for p in lagna.house_planets.get(1, [])]

                # Detailed evaluation bundle
                detailed_eval = {
                    "vaara": {"name": panchang.get("vaara"), "is_pass": True},
                    "tithi": {"name": panchang.get("tithi_name"), "number": panchang.get("tithi_number"), "is_pass": panchang.get("tithi_number") not in TITHI_RIKTA},
                    "nakshatra": {"name": panchang.get("nakshatra_name"), "pada": panchang.get("nakshatra_pada", 1), "is_pass": True},
                    "lagna": {
                        "name": lagna.lagna_name_en, "name_te": lagna.lagna_name_te,
                        "navamsa": lagna.navamsa_name_en, "is_pushkara_navamsa": lagna.is_pushkara_navamsa
                    },
                    "ashtama_shuddhi": {
                        "has_shuddhi": len(planets_in_8) == 0,
                        "planets_in_8th": planets_in_8,
                        "muhurta_lagna": lagna.lagna_name_en
                    },
                    "lagna_shuddhi": {
                        "has_shuddhi": True,
                        "planets_in_lagna": planets_in_1,
                        "muhurta_lagna": lagna.lagna_name_en
                    },
                    "maha_doshas": maha_doshas,
                    "dashavidha_doshas": dashavidha_doshas,
                    "pariharas": pariharas,
                    "panchaka": panchaka_info,
                    "tara": tara_info,
                    "chandrabalam": chandra_info,
                    "sula_check": sula_check,
                    "facing_check": facing_check
                }

                cand_obj = {
                    "date": cur_date.isoformat(),
                    "day_number": d_offset + 1,
                    "day_label_en": f"{rule.title_en} · {lagna.lagna_name_en} Lagna ({cw.start_time} – {cw.end_time})",
                    "day_label_te": f"{rule.title_te} · {lagna.lagna_name_te} లగ్నం ({cw.start_time} – {cw.end_time})",
                    "window_start": cw.start_time,
                    "window_end": cw.end_time,
                    "duration_minutes": cw.duration_minutes,
                    "percentage": pct,
                    "verdict": verdict,
                    "reasons": all_reasons,
                    "cautions": cautions,
                    "tara": tara_info["name"] if tara_info else None,
                    "pushkara_info": pushkara_info,
                    "special_yogas": panchang.get("special_yogas", []),
                    "panchang": panchang,
                    "d1_chart": d1_positions,
                    "detailed_eval": detailed_eval,
                    "source": rule.source.model_dump()
                }
                candidates.append(cand_obj)

                results.append({
                    "date": cur_date.isoformat(),
                    "start_time": cw.start_time,
                    "end_time": cw.end_time,
                    "duration_minutes": cw.duration_minutes,
                    "duration_ghatis": cw.duration_ghatis,
                    "lagna_en": lagna.lagna_name_en,
                    "lagna_te": lagna.lagna_name_te,
                    "navamsa_en": lagna.navamsa_name_en,
                    "is_pushkara_navamsa": lagna.is_pushkara_navamsa,
                    "score": score,
                    "percentage": pct,
                    "verdict": verdict,
                    "rules_passed": rules_passed,
                    "cautions": cautions,
                    "source": rule.source.model_dump(),
                    "panchang_snapshot": {
                        "vaara": panchang.get("vaara"),
                        "tithi": f"{panchang.get('tithi_name')} (#{panchang.get('tithi_number')})",
                        "nakshatra": panchang.get("nakshatra_name"),
                        "yoga": panchang.get("yoga_name"),
                        "karana": panchang.get("karana_name")
                    }
                })

    # Sort results & candidates by percentage descending, then date ascending
    sorted_candidates = sorted(candidates, key=lambda x: (-x["percentage"], x["date"], x["window_start"]))
    sorted_results = sorted(results, key=lambda x: (-x.get("percentage", 0), x["date"], x["start_time"]))

    return {
        "activity_id": rule.id,
        "title_en": rule.title_en,
        "title_te": rule.title_te,
        "source": rule.source.model_dump(),
        "days_scanned": days_to_scan,
        "total_candidates": len(sorted_candidates),
        "candidates": sorted_candidates,
        "total_windows_found": len(sorted_results),
        "windows": sorted_results,
        "birth_details": birth_details,
        "activity_params": activity_params
    }
