"""
One lagna segment against the event's own rules: the five angas, lagna, houses, planets, balas.
Part of the rule engine package (split from rule_interpreter.py, 21 Nov 2026).
"""
from collections import Counter
import dataclasses
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import re

import yaml

from app.core.logging import logger
from app.engines.dosha_registry import link_rows
from app.engines.lagna_scanner import (RASI_NAMES_EN, LagnaWindow, evaluate_house_rules, get_navamsa_sign,
                                       is_pushkara_navamsa as _in_pushkara, scan_day_lagnas)
from app.engines.participants import participants_for
from app.engines.special_yogas import apply_dosha_profile, evaluate_yogas, extra_checks
from app.engines.limb_timeline import (
    Limbs, ascendant_at, jd_to_local, limb_spans, local_to_jd, moon_phase, moudhya_status,
    split_by_limbs, tithi_bounds, varjyam_windows,
)
from app.engines.panchang import compute_day_panchang
from app.engines.time_windows import TimeWindow, subtract_blocked_intervals
from app.engines.universal_filters import (
    evaluate_chandrabala,
    evaluate_panchaka,
    evaluate_tarabala,
    extract_inauspicious_windows,
)
from app.engines.vocab import (
    NAKSHATRA_CANONICAL, RASI_INDEX, karana_set, nakshatra_set,
    norm_key, tithi_token_set, yoga_set,
)
from app.schemas.rules import RuleDefinition
from jhora.panchanga import drik
from app.services.muhurta_service import compute_d1_positions, compute_pushkara_window
from app.engines.doshas import (
    evaluate_21_maha_doshas,
    evaluate_10_dashavidha_doshas,
    evaluate_muhurta_pariharas,
    SEVERE_FOR_SCORING,
)
from app.engines.nama_nakshatra import (
    check_travel_directional_sula,
    check_facing_compatibility,
)
from app.engines.rule_interpreter.rules_loader import COMBUST_ORB, CompiledRule, VAARA_MAP  # noqa: F401
from app.engines.rule_interpreter.planets import TRAVEL_PURPOSE_LAGNAS, VENUS_EAST_FORBIDS, VENUS_WEST_FORBIDS, _planet_rule_check, _planets_by_name, _travel_check, _upanayana_strength  # noqa: F401
from app.engines.rule_interpreter.pushkara import pushkara_text  # noqa: F401


ANGA_NAMES = {"vara": ("Weekday", "వారం"), "tithi": ("Tithi", "తిథి"), "nakshatra": ("Nakshatra", "నక్షత్రం"),
              "yoga": ("Yoga", "యోగం"), "karana": ("Karana", "కరణం")}


def anga_checks(cr: "CompiledRule", limbs: "Limbs", vaara_idx: int) -> List[Dict[str, Any]]:
    """The five panchanga angas against this event's allow / exclude lists, in order. Panchanga shuddhi
    (user, 21 Nov 2026, option B) = how many of these five pass; each angas row is {id, ok, msg, name_en, name_te}."""
    vaara_str = VAARA_MAP[vaara_idx].title()
    t_label = f"{limbs.tithi_name} ({limbs.paksha.title()})"
    rows = []

    def add(aid, excluded, not_allowed, ok_msg, ex_msg, na_msg):
        bad = excluded or not_allowed
        en, te = ANGA_NAMES[aid]
        rows.append({"id": aid, "ok": not bad, "name_en": en, "name_te": te,
                     "msg": ex_msg if excluded else na_msg if not_allowed else ok_msg})

    add("vara", vaara_idx in cr.vaara_exclude, bool(cr.vaara_allow and vaara_idx not in cr.vaara_allow),
        f"Weekday ({vaara_str}) is acceptable", f"{vaara_str} is excluded for this event", f"{vaara_str} is not an allowed weekday")
    add("tithi", limbs.tithi in cr.tithi_exclude, bool(cr.tithi_allow and limbs.tithi not in cr.tithi_allow),
        f"Tithi {t_label} is acceptable", f"Tithi {t_label} is excluded", f"Tithi {t_label} is not an allowed tithi")
    add("nakshatra", limbs.nakshatra in cr.nak_exclude, bool(cr.nak_allow and limbs.nakshatra not in cr.nak_allow),
        f"Nakshatra {limbs.nakshatra_name} (pada {limbs.pada}) is acceptable",
        f"Nakshatra {limbs.nakshatra_name} is excluded", f"Nakshatra {limbs.nakshatra_name} is not an allowed nakshatra")
    add("yoga", limbs.yoga in cr.yoga_exclude, bool(cr.yoga_allow and limbs.yoga not in cr.yoga_allow),
        f"Yoga {limbs.yoga_name} is acceptable", f"Yoga {limbs.yoga_name} is excluded", f"Yoga {limbs.yoga_name} is not an allowed yoga")
    add("karana", limbs.karana in cr.karana_exclude, bool(cr.karana_allow and limbs.karana not in cr.karana_allow),
        f"Karana {limbs.karana_name} is acceptable", f"Karana {limbs.karana_name} is excluded",
        f"Karana {limbs.karana_name} is not an allowed karana")
    return rows


def evaluate_window_for_rule(
    cr: CompiledRule,
    lagna: LagnaWindow,
    limbs: Limbs,
    vaara_idx: int,
    birth_details: Optional[Dict[str, Any]] = None,
    panchaka_method: str = "standard",
    activity_params: Optional[Dict[str, Any]] = None,
    soft_misses: Optional[List[str]] = None,
) -> Tuple[bool, int, List[str], List[str]]:
    """
    Evaluates one lagna segment against the compiled rule.
    Returns (is_passed, score, rules_passed, reasons_failed).

    soft_misses: when a list is given ("Show all" mode, 11 Nov 2026), the chart and placement checks
    (steps 6-9: lagna, houses, planets, combustion, panchaka, tara and chandra bala) do not refuse the
    window; each one missed is added to the list and the window goes on, marked and scored lower.
    Since 21 Nov 2026 the panchanga checks (steps 1-5c: weekday, tithi, nakshatra, yoga, karana, Sun's sign)
    work the same way; only Strict mode (soft_misses None) refuses.
    """
    hf = cr.hf
    sc = cr.rule.soft_scoring
    passed: List[str] = []
    score = 0
    vaara_str = VAARA_MAP[vaara_idx]

    def fail(msg: str):
        return False, 0, [], [msg]

    def miss(msg: str):
        """A chart / placement check that failed: refuse, or note it and go on in Show-all mode."""
        if soft_misses is None:
            return fail(msg)
        soft_misses.append(msg)
        return None

    # Steps 1-5c (panchanga). Since 21 Nov 2026 (user: "standardize all workflows, nothing dropped") these
    # behave like the chart checks: in Show-all mode a miss is noted and the window goes on, marked and
    # scored lower; only Strict mode refuses. Before, a missed weekday or nakshatra silently dropped the
    # window (e.g. a daivajna's Sunday / Ashwini business muhurta never appeared).
    def check(bad: bool, msg: str):
        """A panchanga rule (angas, dagdha tithi, waning-Moon Monday, the Sun's sign): refuse in both modes.
        User, 21 Nov 2026 ("good days, best 1-2"): a day whose panchanga the event does not allow gets no
        muhurtas, as in a printed panchangam. This reverses the 21 Nov morning "note it and go on" for these
        checks; the chart and person checks below still only note a miss in Show-all mode."""
        return fail(msg) if bad else None

    # 1-5. The five angas (vara, tithi, nakshatra, yoga, karana), one helper shared with the score.
    angas = anga_checks(cr, limbs, vaara_idx)
    for a in angas:
        if (r := check(not a["ok"], a["msg"])):
            return r
        if a["ok"] and a["id"] in ("vara", "tithi", "nakshatra"):
            passed.append(a["msg"])

    # 5a. Dagdha tithi and waning-Moon Monday
    if hf.exclude_dagdha_tithi:
        from app.engines.doshas import _DAGDHA_BY_SUN_SIGN
        if (r := check(limbs.tithi_number == _DAGDHA_BY_SUN_SIGN[limbs.sun_rasi],
                       f"{limbs.tithi_name} is the dagdha tithi for this solar month")):
            return r
    if (r := check(bool(hf.monday_needs_waxing_moon and vaara_idx == 1 and not limbs.moon_waxing),
                   "Monday with a waning Moon")):
        return r

    # 5b. Person's own janma nakshatra
    if hf.exclude_janma_nakshatra and birth_details and birth_details.get("janma_nak_idx") == limbs.nakshatra:
        if (r := miss(f"{limbs.nakshatra_name} is the person's own janma nakshatra")):
            return r

    if hf.exclude_janma_counts and birth_details and birth_details.get("janma_nak_idx"):
        cnt = (limbs.nakshatra - int(birth_details["janma_nak_idx"])) % 27 + 1
        if cnt in hf.exclude_janma_counts:
            if (r := miss(f"{limbs.nakshatra_name} is count {cnt} from the janma nakshatra (avoided)")):
                return r

    # 5c. Sun sign (ayana / solar month)
    s_bad = limbs.sun_rasi in cr.sun_sign_exclude
    s_msg = "The Sun's sign is excluded for this event" if s_bad else "The Sun's sign is outside the allowed months (e.g. not Uttarayana)"
    if (r := check(s_bad or bool(cr.sun_sign_allow and limbs.sun_rasi not in cr.sun_sign_allow), s_msg)):
        return r

    # 6. Lagna
    if cr.lagna_types and lagna.mobility.lower() not in cr.lagna_types:
        if (r := miss(f"{lagna.lagna_name_en} lagna ({lagna.mobility}) is not an allowed lagna type")):
            return r
    if cr.lagna_allow and lagna.lagna_idx not in cr.lagna_allow:
        if (r := miss(f"{lagna.lagna_name_en} is not an allowed lagna")):
            return r
    if lagna.lagna_idx in cr.lagna_exclude:
        if (r := miss(f"{lagna.lagna_name_en} lagna is excluded")):
            return r

    # 6b. A combust planet in the lagna: the muhurta is not allowed, in Strict and Show all alike
    # (11 Nov 2026, user's rule). Retrograde Jupiter, Mercury and Venus are allowed: Mercury and Venus
    # turn retrograde as they pass the Sun, so they read as "combust" then.
    sun_p = next((p for plist in (lagna.house_planets or {}).values() for p in plist if p.name_en == "Sun"), None)
    if sun_p:
        for p in (lagna.house_planets or {}).get(1, []):
            pname = p.name_en.lower()
            if pname not in COMBUST_ORB:
                continue
            dist = abs((p.longitude - sun_p.longitude + 180.0) % 360.0 - 180.0)
            if dist > COMBUST_ORB[pname]:
                continue
            if pname in ("jupiter", "mercury", "venus") and p.speed < 0:
                passed.append(f"Retrograde {p.name_en} in the lagna is {dist:.1f}° from the Sun: allowed (retrograde)")
                continue
            return fail(f"Combust {p.name_en} in the lagna ({dist:.1f}° from the Sun): muhurta not allowed")

    # 7. House occupancy (e.g. ashtama shuddhi)
    if hf.house_rules:
        h_pass, h_reasons = evaluate_house_rules(lagna, hf.house_rules)
        if not h_pass:
            failing = [r for r in h_reasons if "must be empty" in r or "contains malefics" in r] or h_reasons
            if soft_misses is None:
                return False, 0, [], failing
            soft_misses.extend(failing)
        else:
            passed.extend(h_reasons)

    # 7b. Planet placements and combustion
    planets = _planets_by_name(lagna)
    for key, in_h, not_in_h, not_signs, soft, note, in_naks, not_naks in cr.planet_rules:
        ok_p, msg = _planet_rule_check(key, in_h, not_in_h, not_signs, planets, limbs.moon_waxing, in_naks, not_naks)
        if soft:
            if ok_p:
                score += soft
                passed.append(f"{msg} (+{soft})" + (f" — {note}" if note else ""))
            continue
        if not ok_p:
            if (r := miss(msg + (f" ({note})" if note else ""))):
                return r
        elif msg:
            passed.append(msg)
    moon = planets.get("moon")
    if hf.moon_free_of_malefics and moon:
        with_moon = [p.name_en for p in planets.values() if p.is_malefic and p.rasi_idx == moon.rasi_idx]
        if with_moon:
            if (r := miss(f"Moon is with malefic(s): {', '.join(with_moon)}")):
                return r
        else:
            passed.append("Moon is free of malefics")
    if hf.mars_saturn_not_opposed and planets.get("mars") and planets.get("saturn"):
        if (planets["mars"].rasi_idx - planets["saturn"].rasi_idx) % 12 == 6:
            if (r := miss("Mars and Saturn are in mutual 7th")):
                return r
    if hf.travel_checks:
        ok_t, msg_t = _travel_check(limbs, vaara_idx, planets, activity_params or {})
        if not ok_t:
            if (r := miss(msg_t)):
                return r
        elif msg_t:
            passed.append(msg_t)
        if hf.return_journey:
            # Book p.144: Venus, Mars and Mercury must not face the returning traveller; if Mercury sets
            # (combust) during the journey, wait until it rises again. Venus is in _travel_check; Mercury,
            # like Venus, is east as a morning star and west as an evening star. Mars faces the direction of
            # its rashi (Dr. Nemani, 13 Nov 2026): 1/5/9 east, 2/6/10 south, 3/7/11 west, 4/8/12 north.
            direction = ((activity_params or {}).get("travel_direction") or "").lower().strip()
            mars_p = planets.get("mars")
            if mars_p and direction:
                mars_dir = ("east", "south", "west", "north")[int(mars_p.longitude // 30) % 4]
                if mars_dir in direction:
                    if (r := miss(f"Kuja sammukha: Mars in {RASI_NAMES_EN[int(mars_p.longitude // 30) + 1]} "
                                  f"faces the {mars_dir}, the returning traveller's way (book p.144)")):
                        return r
            sun_p, mer = planets.get("sun"), planets.get("mercury")
            if sun_p and mer:
                gap = abs((mer.longitude - sun_p.longitude + 180.0) % 360.0 - 180.0)
                if gap <= COMBUST_ORB["mercury"]:
                    if (r := miss(f"Mercury is combust ({gap:.1f}° from the Sun): wait until it rises again (book p.144)")):
                        return r
                elif direction:
                    evening = (mer.longitude - sun_p.longitude) % 360.0 < 180.0
                    if (not evening and direction in VENUS_EAST_FORBIDS) or (evening and direction in VENUS_WEST_FORBIDS):
                        if (r := miss("Budha sammukha: Mercury faces the returning traveller (book p.144)")):
                            return r
        purpose = (activity_params or {}).get("travel_purpose")
        if purpose in TRAVEL_PURPOSE_LAGNAS and lagna.lagna_idx in TRAVEL_PURPOSE_LAGNAS[purpose]:
            score += 3
            passed.append(f"Lagna suits the purpose ({purpose}) (+3)")
    if hf.upanayana_strength:
        fails_u, notes_u, bonus_u = _upanayana_strength(planets, activity_params or {}, limbs, lagna)
        for f in fails_u:
            if (r := miss(f)):
                return r
        passed.extend(notes_u)
        score += bonus_u
    sun = planets.get("sun")
    for pname in cr.not_combust:
        p = planets.get(pname)
        if sun and p:
            dist = abs((p.longitude - sun.longitude + 180.0) % 360.0 - 180.0)
            if dist <= COMBUST_ORB[pname]:
                if (r := miss(f"{p.name_en} is combust ({dist:.1f}° from the Sun)")):
                    return r
            else:
                passed.append(f"{p.name_en} is not combust")

    # 8. Panchaka rahita
    if hf.common.panchaka_rahita:
        p_res = evaluate_panchaka(limbs.tithi_number, vaara_idx, limbs.nakshatra, lagna.lagna_idx,
                                  method=panchaka_method, tithi_30=limbs.tithi)
        if not p_res["is_pass"]:
            if (r := miss(f"Panchaka: {p_res['name_en']} ({p_res['effect_en']})")):
                return r
        else:
            passed.append(f"Panchaka rahita: {p_res['name_en']}")

    # 9. Participant balas
    if birth_details:
        if birth_details.get("janma_nak_idx"):
            tb = evaluate_tarabala(limbs.nakshatra, birth_details["janma_nak_idx"])
            if not tb["is_pass"]:
                if (r := miss(f"Tarabala failed: {tb['name_en']} tara (navaka {tb['navaka']})")):
                    return r
            else:
                passed.append(f"Tarabala: {tb['name_en']} tara")
                score += 3
        if birth_details.get("janma_moon_rasi_idx"):
            cb = evaluate_chandrabala(limbs.moon_rasi, birth_details["janma_moon_rasi_idx"])
            if not cb["is_pass"]:
                if (r := miss(f"Chandrabala failed: {cb['verdict_en']}")):
                    return r
            else:
                passed.append("Chandrabala satisfied")
                score += 2

    # Soft scoring
    score += sc.vaara_weights.get(vaara_str, 0)
    score += sc.lagna_weights.get(lagna.lagna_name_en.lower(), 0)
    score += sc.nakshatra_weights.get(norm_key(limbs.nakshatra_name), 0)
    if lagna.is_pushkara_navamsa:
        score += 5
        passed.append(f"Pushkara navamsa: {pushkara_text(lagna)} (+5)")

    return True, score, passed, []
