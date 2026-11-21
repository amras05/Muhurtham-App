"""
Planet helpers: weakness, travel checks, upanayana strengths, year lord, hora lord, planet rules.
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
from app.engines.rule_interpreter.rules_loader import COMBUST_ORB, _hms_to_hours  # noqa: F401


# Prayana (plan M18)
VARA_SHULA = {1: "east", 6: "east", 4: "south", 0: "west", 5: "west", 2: "north", 3: "north"}
NAKSHATRA_SHULA = {18: "east", 25: "south", 4: "west", 11: "north"}  # Jyeshtha, P.Bhadra, Rohini, P.Phalguni
VENUS_EAST_FORBIDS = {"northeast", "north", "northwest"}
VENUS_WEST_FORBIDS = {"southwest", "south", "southeast"}
TRAVEL_PURPOSE_LAGNAS = {
    "women": {2, 6, 3}, "cattle_trade": {7, 2, 1, 5, 10},
    "trade": {11, 4, 12, 10}, "war": {2, 5, 9, 1},
}


def _travel_check(limbs: "Limbs", vaara_idx: int, planets: Dict[str, Any], ap: Dict[str, Any]) -> Tuple[bool, str]:
    direction = (ap.get("travel_direction") or "").lower().strip()
    if not direction:
        return True, ""
    if limbs.moon_rasi == 12:
        return True, "Moon in Meena: every direction is open"
    base = {"northeast": "north", "northwest": "north", "southeast": "south", "southwest": "south"}.get(direction, direction)
    if VARA_SHULA.get(vaara_idx) == base:
        return False, f"Vara shula: travel {direction} is forbidden on this weekday"
    if NAKSHATRA_SHULA.get(limbs.nakshatra) == base:
        return False, f"Nakshatra shula: travel {direction} is forbidden in {limbs.nakshatra_name}"
    if base == "south" and limbs.moon_rasi == 11:
        return False, "Dhanishta panchaka: travel south is forbidden"
    if not ap.get("travel_exemption"):
        sun, venus = planets.get("sun"), planets.get("venus")
        if sun and venus:
            ahead = (venus.longitude - sun.longitude) % 360.0 < 180.0  # evening star = west
            if not ahead and direction in VENUS_EAST_FORBIDS:
                return False, "Shukra sammukha: Venus in the east faces the traveller"
            if ahead and direction in VENUS_WEST_FORBIDS:
                return False, "Shukra sammukha: Venus in the west faces the traveller"
    return True, f"No shula for travel {direction}"


# Combustion orbs in degrees from the Sun (direct motion), standard values
# Upanayana (category index 2, items 8-11). Classical lords; author to confirm the book's table.
VARNESHA = {"brahmana": ("jupiter",), "kshatriya": ("sun",), "vaishya": ("moon",)}   # book paras 1923-25
VEDADHIPATI = {"rig": "jupiter", "yajur": "venus", "sama": "mars", "atharva": "mercury"}
DEBILITATION = {"sun": 7, "moon": 8, "mars": 4, "mercury": 12, "jupiter": 10, "venus": 6, "saturn": 1}


def _planet_weak(pname: str, planets: Dict[str, Any]) -> Optional[str]:
    """Why a planet is weak at this moment (combust or debilitated), or None if strong."""
    p, sun = planets.get(pname), planets.get("sun")
    if not p:
        return None
    if int(p.longitude // 30) + 1 == DEBILITATION.get(pname):
        return f"{p.name_en} is debilitated"
    if pname in COMBUST_ORB and sun:
        dist = abs((p.longitude - sun.longitude + 180.0) % 360.0 - 180.0)
        if dist <= COMBUST_ORB[pname]:
            return f"{p.name_en} is combust ({dist:.1f}° from the Sun)"
    return None


# ── Upanayana: the book's planet and Moon checks (Part 5, paras 1921-1957; 11 Nov 2026) ─────────
_EXALT = {"sun": 1, "moon": 2, "mars": 10, "mercury": 6, "jupiter": 4, "venus": 12, "saturn": 7}
_OWN = {"sun": {5}, "moon": {4}, "mars": {1, 8}, "mercury": {3, 6}, "jupiter": {9, 12}, "venus": {2, 7}, "saturn": {10, 11}}
_PID = {"sun": 0, "moon": 1, "mars": 2, "mercury": 3, "jupiter": 4, "venus": 5, "saturn": 6}
_GURU_GOOD_SIGNS = {4, 9, 12}            # Karkataka, Dhanus, Meena (para 1948)
_GURU_BAD_SIGNS = {2, 3, 6, 7, 10}       # Vrishabha, Mithuna, Kanya, Tula, Makara (para 1949)
_MOON_SIGN = {                           # paras 1951-57: (good / bad / neutral, the result for the vatu)
    5: ("bad", "the vatu becomes sinful"), 4: ("bad", "the vatu becomes poor"),
    10: ("bad", "the vatu becomes a servant of the lowly"), 11: ("bad", "the vatu becomes a servant of the lowly"),
    3: ("good", "the vatu becomes a scholar"), 6: ("good", "the vatu becomes a scholar"),
    9: ("good", "the vatu becomes a somayaji"), 12: ("good", "the vatu becomes a somayaji"),
    1: ("neutral", "the vatu bears weapons"), 8: ("neutral", "the vatu bears weapons"),
    2: ("neutral", "the vatu marries soon"), 7: ("neutral", "the vatu marries soon")}


_WEEKDAY_LORD = ("moon", "mars", "mercury", "jupiter", "venus", "saturn", "sun")   # date.weekday(): Mon=0


@lru_cache(maxsize=64)
def _ugadi(year: int, tz_offset: float) -> Optional[date]:
    """Chaitra shukla pratipada (Ugadi) of this year: the first day from 1 March whose 6 a.m. tithi is
    pratipada begun after a new moon with the Sun in Meena (amanta Chaitra). When that pratipada touches
    no sunrise (kshaya), Ugadi is the day it begins. 6 a.m. stands in for sunrise. Adhika Chaitra is not
    handled separately."""
    from app.engines.limb_timeline import limbs_at, tithi_bounds
    d = date(year, 3, 1)
    while d <= date(year, 4, 30):
        jd = local_to_jd(datetime(d.year, d.month, d.day, 6), tz_offset)
        t = limbs_at(jd).tithi
        if t == 1 and limbs_at(tithi_bounds(jd)[0]).sun_rasi == 12:
            return d
        if t == 2:                                   # pratipada may have fallen between two sunrises
            p_start = tithi_bounds(tithi_bounds(jd)[0] - 1e-4)[0]
            if p_start > jd - 1.0 and limbs_at(p_start).sun_rasi == 12:
                return d - timedelta(days=1)
        d += timedelta(days=1)
    return None


def samvatsara_lord(day: date, tz_offset: float) -> Optional[str]:
    """Lord of the year (samvatsara) in force on `day`: the lord of Ugadi's weekday."""
    u = _ugadi(day.year, round(tz_offset, 2))
    if u is None or day < u:
        u = _ugadi(day.year - 1, round(tz_offset, 2))
    return _WEEKDAY_LORD[u.weekday()] if u else None


def _upanayana_planet(pname: str, planets: Dict[str, Any], moudhya: Dict[str, str]) -> Tuple[Optional[str], Optional[str]]:
    """(why weak, why strong) for a varnesha or vedadhipati. Weak (paras 1927, 1939): combust, in its bala or
    vriddha days, debilitated, in an enemy's sign, or with an enemy. Strong (para 1928): exalted, own or
    friend's sign."""
    from app.engines.vocab import ENEMIES, FRIENDS, SIGN_LORD
    p = planets.get(pname)
    if not p:
        return None, None
    why = _planet_weak(pname, planets)
    if why:
        return why, None
    state = moudhya.get(pname)
    if state in ("bala", "vriddha"):
        return f"{p.name_en} is in its {'child (bala)' if state == 'bala' else 'old (vriddha)'} days", None
    sign, pid = int(p.longitude // 30) + 1, _PID[pname]
    lord = SIGN_LORD[sign]
    if lord != pid and lord in ENEMIES.get(pid, set()):
        return f"{p.name_en} is in an enemy's sign ({RASI_NAMES_EN[sign]})", None
    foes = [q.name_en for n, q in planets.items()
            if n in _PID and _PID[n] in ENEMIES.get(pid, set()) and int(q.longitude // 30) + 1 == sign]
    if foes:
        return f"{p.name_en} is with its enemy {', '.join(foes)}", None
    good = ("exalted" if _EXALT.get(pname) == sign else "in its own sign" if sign in _OWN.get(pname, set())
            else "in a friend's sign" if lord in FRIENDS.get(pid, set()) else None)
    return None, good


def _upanayana_strength(planets: Dict[str, Any], ap: Dict[str, Any], limbs: "Limbs",
                        lagna: LagnaWindow) -> Tuple[List[str], List[str], int]:
    """(not matched, matched notes, preference points) for the upanayana chart."""
    fails: List[str] = []
    notes: List[str] = []
    bonus = 0
    moudhya = ap.get("_moudhya") or {}
    checks = [("Varnesha", p) for p in VARNESHA.get((ap.get("varna") or "").lower(), ())]
    shakha = (ap.get("veda_shakha") or "").lower()
    if shakha in VEDADHIPATI:
        checks.append(("Vedadhipati", VEDADHIPATI[shakha]))
    # Book p.117 (para 1926), added 12 Nov 2026: beside the varnesha, the Sun, Venus and Jupiter must be
    # strong, and so must the lord of the samvatsara (year) in which the upanayana falls.
    named = {p for _, p in checks}
    for role, pname in (("Sun", "sun"), ("Venus", "venus"), ("Jupiter", "jupiter"),
                        ("Year lord", ap.get("_year_lord"))):
        if pname and pname not in named:
            checks.append((role, pname))
            named.add(pname)
    for role, pname in checks:
        if role in ("Sun", "Year lord"):
            # p.117 asks only that they are not bala, vriddha or combust (we add debilitated); the
            # enemy-sign rule of p.118 names the varnesha, Jupiter, Venus and the vedadhipati only.
            weak = _planet_weak(pname, planets) or (
                f"{pname.title()} is in its {moudhya[pname]} days" if moudhya.get(pname) in ("bala", "vriddha") else None)
            strong = None
        else:
            weak, strong = _upanayana_planet(pname, planets, moudhya)
        if weak:
            fails.append(f"{role} weak: {weak} (book p.117, paras 1926-27, 1939)")
        else:
            notes.append(f"{role} {pname.title()} is strong" + (f" ({strong})" if strong else ""))

    # Guru bala (paras 1948-49): Jupiter in Vrishabha, Mithuna, Kanya, Tula or Makara (or their navamsas) is bad;
    # in Karkataka, Dhanus or Meena (or their navamsas) it is very good, even 1st, 8th or 12th from the rashi.
    jup = planets.get("jupiter")
    if jup and jup.speed < 0:
        # Dr. Nemani, 13 Nov 2026: retrograde Jupiter has no power (combust and debilitated are caught by
        # the Jupiter strength check above).
        fails.append("Guru bala: Jupiter is retrograde, so it has no power (Dr. Nemani)")
    if jup:
        js, jn = int(jup.longitude // 30) + 1, get_navamsa_sign(jup.longitude)
        good = js in _GURU_GOOD_SIGNS or (jn in _GURU_GOOD_SIGNS and js not in _GURU_BAD_SIGNS)
        if js in _GURU_BAD_SIGNS or (jn in _GURU_BAD_SIGNS and js not in _GURU_GOOD_SIGNS):
            where = RASI_NAMES_EN[js] if js in _GURU_BAD_SIGNS else f"{RASI_NAMES_EN[jn]} navamsa"
            fails.append(f"Guru bala: Jupiter in {where}, poor for learning and fortune (book para 1949)")
        else:
            vr = ap.get("vatu_rasi_idx")
            house = (js - int(vr)) % 12 + 1 if vr else None
            if house in (1, 8, 12) and not good:
                fails.append(f"Guru bala for the vatu: Jupiter is {house}th from the vatu's rashi (book para 1948)")
            elif good:
                notes.append(f"Guru bala: Jupiter in {RASI_NAMES_EN[js]} gives full learning and fortune (book para 1948)")
                bonus += 3

    # Moon's sign (paras 1951-57)
    kind, effect = _MOON_SIGN.get(limbs.moon_rasi, ("neutral", ""))
    msg = f"Moon's sign {RASI_NAMES_EN[limbs.moon_rasi]}: {effect} (book paras 1951-57)"
    if kind == "bad":
        fails.append(msg)
    elif kind == "good":
        notes.append(msg)
        bonus += 3
    # Moon's navamsa and Shravana / Punarvasu 4th pada (para 1921), a preference
    moon = planets.get("moon")
    if moon:
        mn = get_navamsa_sign(moon.longitude)
        if mn in (4, 2, 3, 6, 7, 9, 12):
            notes.append(f"Moon in {RASI_NAMES_EN[mn]} navamsa ({'its own' if mn == 4 else 'a benefic'}'s navamsa, book para 1921)")
            bonus += 2
    if limbs.nakshatra_name.lower().startswith(("shravana", "punarvasu")) and limbs.pada == 4:
        notes.append(f"{limbs.nakshatra_name} 4th pada (book para 1921)")
        bonus += 2

    # Sun or Mars aspecting the 12th house (para 1937): the vatu's father loses his sight
    house_of = {p.name_en.lower(): h for h, plist in (lagna.house_planets or {}).items() for p in plist}
    if house_of.get("sun") == 6:
        fails.append("Sun aspects the 12th: harm to the father's eyesight (book para 1937)")
    if house_of.get("mars") in (5, 6, 9):
        fails.append("Mars aspects the 12th: harm to the father's eyesight (book para 1937)")
    return fails, notes, bonus


def _planets_by_name(lagna: LagnaWindow) -> Dict[str, Any]:
    out = {}
    for h, plist in lagna.house_planets.items():
        for p in plist:
            out[p.name_en.lower()] = p
    return out


def _planet_rule_check(key, in_h, not_in_h, not_signs, planets, moon_waxing,
                       in_naks=frozenset(), not_naks=frozenset()) -> Tuple[bool, str]:
    def benefic(p):
        return p.name_en == "Moon" and moon_waxing or p.name_en in ("Mercury", "Jupiter", "Venus")

    if key in ("benefic", "malefic"):
        group = [p for p in planets.values() if (benefic(p) if key == "benefic" else p.is_malefic)]
        if in_h and not any(p.house_num in in_h for p in group):
            return False, f"No {key} in house(s) {sorted(in_h)}"
        bad = [p.name_en for p in group if p.house_num in not_in_h]
        if bad:
            return False, f"{', '.join(bad)} in house(s) {sorted(not_in_h)}"
        return True, f"{key.title()} placement satisfied"
    p = planets.get(key)
    if p is None:
        return True, ""
    if in_h and p.house_num not in in_h:
        return False, f"{p.name_en} is in house {p.house_num}, not in {sorted(in_h)}"
    if p.house_num in not_in_h:
        return False, f"{p.name_en} is in house {p.house_num}"
    if p.rasi_idx in not_signs:
        return False, f"{p.name_en} is in a forbidden sign"
    nak = int(p.longitude // (360.0 / 27.0)) + 1
    if nak in not_naks:
        return False, f"{p.name_en} is in a forbidden nakshatra"
    if in_naks and nak not in in_naks:
        return False, f"{p.name_en} is not in the listed nakshatras"
    return True, f"{p.name_en} in house {p.house_num}"


# ─────────────────────────────────────────────────────────────────────────────
# Hard filters for one segment
# ─────────────────────────────────────────────────────────────────────────────
RITU_NIGHTS = set(range(4, 17)) - {11, 13}      # classical garbhadhana nights (plan R6b; to be confirmed)


def _hora_lord(when: datetime, panchang: Dict[str, Any], day: date, vaara_idx: int) -> Optional[int]:
    """Planet id ruling the hora at `when`: the day from sunrise to sunset and the night after it are each cut
    into 12 horas; the first belongs to the weekday lord, then in the order Sun, Venus, Mercury, Moon,
    Saturn, Jupiter, Mars. None if sunrise/sunset are missing or `when` is before this day's sunrise."""
    from app.engines.doshas import HORA_ORDER
    try:
        base = datetime(day.year, day.month, day.day)
        rise = base + timedelta(hours=_hms_to_hours(panchang.get("sunrise"), default=-1))
        sset = base + timedelta(hours=_hms_to_hours(panchang.get("sunset"), default=-1))
    except (TypeError, ValueError):
        return None
    if rise <= base - timedelta(hours=1) or sset <= rise or when < rise:
        return None
    day_len = sset - rise
    if when < sset:
        n = int((when - rise) / (day_len / 12))
    else:
        n = 12 + min(11, int((when - sset) / ((timedelta(hours=24) - day_len) / 12)))
    start = HORA_ORDER.index(vaara_idx % 7)          # weekday index 0 = Sunday = Sun's id, ... 6 = Saturn
    return HORA_ORDER[(start + n) % 7]
