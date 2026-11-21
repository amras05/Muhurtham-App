"""
The search: per-day caches, the day loop, building each candidate and its detail, summaries.
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
from app.engines.rule_interpreter.rules_loader import SHUNYA_MASA, VAARA_MAP, _hms_to_hours, compile_rule  # noqa: F401
from app.engines.rule_interpreter.planets import RITU_NIGHTS, _hora_lord, samvatsara_lord  # noqa: F401
from app.engines.rule_interpreter.pushkara import lagna_for_window, pushkara_text, window_amsha, window_pushkara  # noqa: F401
from app.engines.rule_interpreter.window_rules import anga_checks, evaluate_window_for_rule  # noqa: F401
from app.engines.rule_interpreter.dosha_rulings import _LAGNA_EXTRA_IDS, _NOT_LAGNA_DOSHA, _is_panchanga_miss, _lagna_dosha_rows, _mark_duplicates, apply_author_severity, dosha_audit, doshapavada, except_by_benefics  # noqa: F401
from app.engines.rule_interpreter.scoring import _share, dosha_scoring_for  # noqa: F401


# ─────────────────────────────────────────────────────────────────────────────
# Search
# ─────────────────────────────────────────────────────────────────────────────
# ── Per-day caches (21 Nov 2026, speed) ─────────────────────────────────────────────
# The day's panchang, lagnas and pushkara box depend only on the date and the place, but every search
# worked them out again: "All main ceremonies" runs one search per event over the same days, so each day
# was computed up to 8 times. Callers only read these results or copy them before changing them; a deep
# copy is handed out anyway so a later change in place cannot leak into another search.
import copy as _copy

_DAY_CACHE_SIZE = 512


@lru_cache(maxsize=_DAY_CACHE_SIZE)
def _day_panchang(y: int, m: int, d: int, lat: float, lon: float, tz: float, place: str) -> Dict[str, Any]:
    return compute_day_panchang(y, m, d, lat, lon, tz, place, hour=6.0)


@lru_cache(maxsize=_DAY_CACHE_SIZE)
def _day_lagnas(y: int, m: int, d: int, lat: float, lon: float, tz: float, sr_h: float) -> Tuple[LagnaWindow, ...]:
    return tuple(scan_day_lagnas(y, m, d, lat, lon, tz, sr_h))


_PUSHKARA_CACHE: Dict[Any, Any] = {}


def _day_pushkara(cur_date: date, lat: float, lon: float, tz: float, place_name: str, panchang: Dict[str, Any],
                  b_rasi_idx: Optional[int], place_obj) -> Any:
    key = (cur_date, lat, lon, tz, place_name, b_rasi_idx)
    if key not in _PUSHKARA_CACHE:
        if len(_PUSHKARA_CACHE) >= _DAY_CACHE_SIZE:
            _PUSHKARA_CACHE.pop(next(iter(_PUSHKARA_CACHE)))      # drop the oldest entry
        _PUSHKARA_CACHE[key] = compute_pushkara_window(cur_date, lat, lon, tz, place_name, panchang,
                                                       birth_lagna_idx=b_rasi_idx, birth_place_obj=place_obj)
    return _copy.deepcopy(_PUSHKARA_CACHE[key])


TARABALA_PARAM_KEYS = {
    "groom": "groom_nak_idx", "bride": "bride_nak_idx", "father": "father_nak_idx",
    "mother": "mother_nak_idx", "guru": "guru_nak_idx", "owner": "owner_nama_nak_idx",
    "spouse": "spouse_nama_nak_idx",
}


def _ordinal_age(ref: date, day: date, unit: str) -> int:
    """1-based ordinal: the day of birth is day 1, the first month is month 1, and so on."""
    if unit == "days":
        return (day - ref).days + 1
    months = (day.year - ref.year) * 12 + (day.month - ref.month) - (1 if day.day < ref.day else 0)
    if unit == "months":
        return months + 1
    return months // 12 + 1


def _age_allowed(rule_age, ref_date: Optional[date], gender: Optional[str], day: date) -> Tuple[Optional[bool], str]:
    """(True/False, reason) or (None, warning) when the reference date is missing."""
    if ref_date is None:
        return None, f"Age window not checked: needs the {'date of birth' if rule_age.reference == 'birth' else 'conception date'}"
    if day < ref_date:
        return False, "Before the reference date"
    n = _ordinal_age(ref_date, day, rule_age.unit)
    allowed = set(rule_age.allowed or [])
    g = (gender or "").lower()
    if g == "boy":
        allowed |= set(rule_age.boy or [])
    elif g == "girl":
        allowed |= set(rule_age.girl or [])
    else:
        allowed |= set(rule_age.boy or []) | set(rule_age.girl or [])
    unit = rule_age.unit[:-1]
    if rule_age.min_ordinal and n >= rule_age.min_ordinal:
        return True, f"{unit.title()} {n} (from {rule_age.min_ordinal} onwards)"
    if n in allowed:
        return True, f"{unit.title()} {n} is in the allowed window"
    return False, f"{unit.title()} {n} is outside the allowed window {sorted(allowed)}"


def _age_tier(rule_age, ref_date: Optional[date], gender: Optional[str], day: date) -> Tuple[Optional[int], str]:
    """0 = preferred age, 1 = second choice ("if needed"), 2 = outside both; None when the reference
    date is missing or the day is before it (11 Nov 2026)."""
    if ref_date is None or day < ref_date:
        return None, ""
    ok, why = _age_allowed(rule_age, ref_date, gender, day)
    if ok:
        return 0, why
    n = _ordinal_age(ref_date, day, rule_age.unit)
    if n in set(rule_age.fallback or []):
        return 1, f"{rule_age.unit[:-1].title()} {n}: allowed if needed {sorted(rule_age.fallback)}"
    return 2, why


# ── Anadhyaya (book paras 1994-2004; 11 Nov 2026) ─────────────────────────────────────────────
# Tithi index 1-30: shukla 1-15 (15 = Purnima), krishna 16-30 (K2 = 17, K7 = 22, 30 = Amavasya).
# Months are amanta (1 Chaitra ... 12 Phalguna).
NITYA_ANADHYAYA = {1: "Pratipada", 16: "Pratipada", 8: "Ashtami", 23: "Ashtami", 14: "Chaturdashi",
                   29: "Chaturdashi", 15: "Purnima", 30: "Amavasya"}                       # para 1996
NAIMITTIKA_ANADHYAYA = {                                                                    # paras 2001, 2003
    1: {3}, 2: {3}, 4: {6, 10, 17}, 6: {3, 11, 28}, 7: {11}, 8: {5, 9, 11, 17},
    10: {3, 9, 11}, 11: {7, 11, 12}, 12: {17}}
TRISHTAKA = {9: {22, 23, 24}, 10: {22, 23, 24}, 11: {22, 23, 24}, 12: {22, 23, 24}}          # para 2004: K7-K9
SANKRANTI_ANADHYAYA = {1: "Mesha", 4: "Karkataka", 7: "Tula", 10: "Makara"}                  # para 1995: 1.5 days


def _anadhyaya_reason(tithi: int, masa: Optional[int], jd: float) -> Optional[str]:
    """Why this moment is an anadhyaya for upanayana, or None. Para 2003's fifth krishna day (the
    trayodashi reached by Bharani) is not used: its wording is unclear (Dr. Nemani to confirm)."""
    from app.engines.limb_timeline import limbs_at
    paksha = "S" if tithi <= 15 else "K"
    label = f"{paksha}{tithi if tithi <= 15 else tithi - 15}"
    from app.models.names import LUNAR_MONTH_NAMES
    month = LUNAR_MONTH_NAMES[masa] if masa and 1 <= masa <= 12 else ""
    if tithi in NITYA_ANADHYAYA:
        return f"Nitya anadhyaya: {NITYA_ANADHYAYA[tithi]} (book para 1996)"
    if masa and tithi in TRISHTAKA.get(masa, set()):
        return f"Trishtaka: {month} {label} (book para 2004)"
    if masa and tithi in NAIMITTIKA_ANADHYAYA.get(masa, set()):
        return f"Naimittika anadhyaya: {month} {label} (book paras 2001-2003)"
    now_sign, before_sign = limbs_at(jd).sun_rasi, limbs_at(jd - 1.5).sun_rasi
    if now_sign != before_sign and now_sign in SANKRANTI_ANADHYAYA:
        return f"Sankranti anadhyaya: within 1.5 days of {SANKRANTI_ANADHYAYA[now_sign]} sankranti (book para 1995)"
    # Para 1959: no upanayana when one of the days from the day before to the 4th day is an anadhyaya.
    # Read as the day before and the next two days; naimittika anadhyaya and trishtaka only (the nitya
    # tithis fall every few days and would leave almost no date; Dr. Nemani to confirm).
    for off, word in ((-1, "the day before"), (1, "the next day"), (2, "the day after next")):
        t2 = limbs_at(jd + off).tithi
        m2 = masa
        if masa and off > 0 and t2 < tithi:
            m2 = masa % 12 + 1
        elif masa and off < 0 and t2 > tithi:
            m2 = (masa - 2) % 12 + 1
        if m2 and (t2 in NAIMITTIKA_ANADHYAYA.get(m2, set()) or t2 in TRISHTAKA.get(m2, set())):
            lab = f"{'S' if t2 <= 15 else 'K'}{t2 if t2 <= 15 else t2 - 15}"
            return f"Anadhyaya near the muhurta: {LUNAR_MONTH_NAMES[m2]} {lab} is {word} (book para 1959)"
    return None


def _clip_time_of_day(start: datetime, end: datetime, mode: Optional[str],
                      sunrise: datetime, sunset: datetime) -> Optional[Tuple[datetime, datetime]]:
    if not mode:
        return start, end
    if mode == "forenoon":
        lo, hi = sunrise, sunrise + (sunset - sunrise) / 2
    elif mode == "daytime":
        lo, hi = sunrise, sunset
    else:  # night: sunset to the next sunrise
        lo, hi = sunset, sunrise + timedelta(days=1)
    s, e = max(start, lo), min(end, hi)
    return (s, e) if s < e else None


_REASON_GROUPS = [
    (re.compile(r"^Tithi .* (is excluded|is not an allowed)"), "Tithi not allowed for this event"),
    (re.compile(r"^Nakshatra .* (is excluded|is not an allowed)"), "Nakshatra not allowed for this event"),
    (re.compile(r"^Yoga .* (is excluded|is not an allowed)"), "Yoga not allowed for this event"),
    (re.compile(r"^Karana .* (is excluded|is not an allowed)"), "Karana not allowed for this event"),
    (re.compile(r"^Lagna .* (is excluded|is not an allowed)"), "Lagna not allowed for this event"),
    (re.compile(r"^Panchaka: "), "Panchaka dosha"),
    (re.compile(r"^(Nitya anadhyaya|Naimittika anadhyaya|Trishtaka|Sankranti anadhyaya)"), "Anadhyaya day (no upanayana)"),
    (re.compile(r"^Anadhyaya near the muhurta"), "Anadhyaya within the day before to the 4th day"),
    (re.compile(r"^Combust \w+ in the lagna"), "A combust planet in the lagna"),
    (re.compile(r"^Moon's sign "), "Moon's sign not favourable for upanayana"),
    (re.compile(r"^Guru bala"), "Guru bala not favourable"),
    (re.compile(r"^(Varnesha|Vedadhipati) weak"), "Varnesha / vedadhipati weak"),
    (re.compile(r"^Tarabala failed for the (\w+)"), None),
    (re.compile(r"^Tarabala failed"), "Tarabala failed for the main person"),
    (re.compile(r"^Chandrabala failed"), "Chandrabala failed for the main person"),
    (re.compile(r"^House (\d+) must"), None),
]


def _reason_key(why: str) -> str:
    """Group detailed rejection reasons so the summary shows what really blocks results."""
    for rx, label in _REASON_GROUPS:
        m = rx.search(why)
        if m:
            if label:
                return label
            if why.startswith("Tarabala"):
                return f"Tarabala failed for the {m.group(1)}"
            return f"House {m.group(1)} placement rule"
    return why


TIME_PREFERENCES = {"morning", "afternoon", "evening", "night"}


def _clip_preference(start: datetime, end: datetime, pref: Optional[str],
                     sunrise: datetime, sunset: datetime) -> Optional[Tuple[datetime, datetime]]:
    """
    The user's preferred part of the day (Input Data Master, sections 11 and 22):
    morning = sunrise to midday, afternoon = midday to sunset,
    evening = the first quarter of the night, night = sunset to the next sunrise.
    """
    if not pref or pref not in TIME_PREFERENCES:
        return start, end
    midday = sunrise + (sunset - sunrise) / 2
    next_sunrise = sunrise + timedelta(days=1)
    lo, hi = {
        "morning": (sunrise, midday),
        "afternoon": (midday, sunset),
        "evening": (sunset, sunset + (next_sunrise - sunset) / 4),
        "night": (sunset, next_sunrise),
    }[pref]
    s, e = max(start, lo), min(end, hi)
    return (s, e) if s < e else None


def _day_periods(kinds, sunrise: datetime, sunset: datetime) -> List[TimeWindow]:
    """
    Blocked parts of the day. Approximations pending the author's definitions:
      third_yama  = third quarter of daytime
      ghati_26_30 = the 26th ghati for 5 ghatis after sunrise
      pradosha    = 3 ghatis after sunset
      midnight    = the middle muhurta (1/15) of the night
      dawn        = 3 ghatis before the next sunrise
    """
    out = []
    day = sunset - sunrise
    night = (sunrise + timedelta(days=1)) - sunset
    g = timedelta(minutes=24)
    spans = {
        "third_yama": (sunrise + day / 2, sunrise + day * 3 / 4),
        "ghati_26_30": (sunrise + 25 * g, sunrise + 30 * g),
        "pradosha": (sunset, sunset + 3 * g),
        "midnight": (sunset + night * 7 / 15, sunset + night * 8 / 15),
        "dawn": (sunrise + timedelta(days=1) - 3 * g, sunrise + timedelta(days=1)),
    }
    for k in kinds or []:
        a, b = spans[k]
        out.append(TimeWindow(start=a, end=b, label=k.replace("_", " ").title(), metadata={"type": k}))
    return out


def _parse_date(v: Any) -> Optional[date]:
    if not v:
        return None
    if isinstance(v, date):
        return v
    return datetime.strptime(str(v), "%Y-%m-%d").date()


def _day_level_reject(cr: "CompiledRule", panchang: Dict[str, Any], day: date,
                      ap: Dict[str, Any], tz_offset: float) -> Optional[str]:
    """Checks that hold for the whole day (masa, moudhya, Jupiter's sign). Returns a reason or None."""
    from app.engines.limb_timeline import limbs_at, local_to_jd as _l2j, moudhya_status, sun_moon
    hf = cr.hf
    cm = panchang.get("chandramana") or {}
    masa = cm.get("month_number")
    noon_jd = _l2j(datetime(day.year, day.month, day.day, 12), tz_offset)
    sun_rasi = limbs_at(noon_jd).sun_rasi

    if hf.common.masa_shubha and masa:
        if cm.get("is_adhika_masa"):
            return "Adhika masa (no shubha karya)"
        if SHUNYA_MASA.get(masa) == sun_rasi:
            return "Shunya masa (no shubha karya)"
    if masa and cr.masa_exclude and masa in cr.masa_exclude:
        return f"{cm.get('month_name', 'This lunar month')} is excluded"
    if masa and cr.masa_allow and masa not in cr.masa_allow:
        return f"{cm.get('month_name', 'This lunar month')} is not an allowed month"
    for m, signs in cr.masa_sun_exclude:
        if masa == m and sun_rasi in signs:
            return f"{cm.get('month_name')} masa with the Sun in this sign is excluded"
    if hf.trijyeshtha and masa == 3 and (ap.get("groom_eldest") or ap.get("bride_eldest")):
        return "Trijyeshtha: an eldest child does not marry in Jyeshtha masa"
    for p in cr.no_moudhya:
        st = moudhya_status(int(noon_jd - 0.5), p)
        if st["state"] != "clear":
            word = {"combust": "combust (moudhya)", "bala": "in its bala (child) days", "vriddha": "in its vriddha (old) days"}[st["state"]]
            return f"{p.title()} is {word}"
    if hf.simha_guru:
        import swisseph as swe
        swe.set_sid_mode(swe.SIDM_LAHIRI)
        jup = swe.calc_ut(noon_jd, swe.JUPITER, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0] % 360.0
        sun_lon = sun_moon(noon_jd)[0]
        if int(jup // 30) + 1 == 5 and 76.0 + 40.0 / 60.0 <= sun_lon < 200.0:
            return "Jupiter in Simha with the Sun between Ardra pada 4 and Swati pada 4"
    if hf.guru_bala_couple:
        import swisseph as swe
        swe.set_sid_mode(swe.SIDM_LAHIRI)
        jup_rasi = int((swe.calc_ut(noon_jd, swe.JUPITER, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0] % 360.0) // 30) + 1
        b, g = ap.get("bride_rasi_idx"), ap.get("groom_rasi_idx")
        if b and (jup_rasi - int(b)) % 12 + 1 in (8, 12):
            return "Guru bala: Jupiter is 8th or 12th from the bride's rashi"
        if g and (jup_rasi - int(g)) % 12 + 1 in (3, 6):
            return "Guru bala: Jupiter is 3rd or 6th from the groom's rashi"
    return None


def _kartari_mode(rule: RuleDefinition) -> str:
    return getattr(rule, "kartari", None) or "none"


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
    strictness: str = "lenient",
    rule_variant: Optional[str] = None,
    people: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Main entry point: scans the date range and returns ranked windows plus full
    candidate details (D1 chart, 21 Mahadoshas, Dashavidha, pariharas, balas).
    """
    try:
        cr = compile_rule(activity_id, rule_variant or None)
    except ValueError as ex:
        logger.error(f"Rule '{activity_id}' has an invalid value: {ex}")
        return {"error": f"Rule file '{activity_id}' has an invalid value: {ex}"}
    if not cr:
        return {"error": f"Unknown activity rule '{activity_id}'"}
    rule = cr.rule
    common = cr.hf.common
    strict = (strictness or "lenient").lower() == "strict"

    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, "%Y-%m-%d").date()

    results: List[Dict[str, Any]] = []
    candidates: List[Dict[str, Any]] = []
    rejections: Counter = Counter()
    place_obj = drik.Place(place_name, lat, lon, tz_offset)

    b_nak_idx = birth_details.get("janma_nak_idx") if birth_details else None
    b_rasi_idx = birth_details.get("janma_moon_rasi_idx") if birth_details else None
    travel_dir = activity_params.get("travel_direction") if activity_params else None
    facing_dir = (activity_params.get("door_facing") or activity_params.get("plot_facing")) if activity_params else None

    participants: List[Dict[str, Any]] = []
    if birth_details and (b_rasi_idx or birth_details.get("birth_lagna_idx")):
        p = {"label": birth_details.get("person_name") or "the person"}
        if b_rasi_idx:
            p["janma_rasi"] = int(b_rasi_idx)
        if birth_details.get("birth_lagna_idx"):
            p["janma_lagna"] = int(birth_details["birth_lagna_idx"])
        participants.append(p)

    ap = dict(activity_params or {})     # a copy: per-day helper values must not leak into the result
    warnings: List[str] = []
    # Godavari Pushkaralu (user's rule, 13 Nov 2026): while Jupiter is in Simha, places near the Godavari get
    # no auspicious muhurtas, and the search says so. Death rites and medical events are not affected.
    from app.engines.godavari import jupiter_in_simha, near_godavari, pushkaralu_notice
    pushkara_near = (rule.tab or rule.category) not in ("pitru", "health") and near_godavari(lat, lon)
    notices: List[Dict[str, Any]] = []
    if pushkara_near:
        n = pushkaralu_notice(start_date, start_date + timedelta(days=max(0, days_to_scan - 1)), lat, lon)
        if n:
            notices.append(n)
    hf = cr.hf

    # Dependent muhurta (e.g. ankurarpana): scan only the nights before the main event.
    if rule.depends_on:
        main = _parse_date(ap.get("main_event_date"))
        if not main:
            return {"error": f"'{rule.id}' needs main_event_date (the date of the main samskara)"}
        scan_days = sorted({main - timedelta(days=n) for n in rule.depends_on.nights_before}
                           | {main + timedelta(days=n) for n in rule.depends_on.days_after})
    else:
        scan_days = [start_date + timedelta(days=i) for i in range(days_to_scan)]

    age_ref = None
    if hf.age_rule:
        age_ref = _parse_date(ap.get("child_dob") if hf.age_rule.reference == "birth" else ap.get("conception_date"))
        if age_ref is None:
            warnings.append(_age_allowed(hf.age_rule, None, None, start_date)[1] + "; muhurtas are shown regardless of age")

    extra_taras = []
    for who in hf.tarabala_for or []:
        idx = ap.get(TARABALA_PARAM_KEYS.get(who, ""))
        if idx:
            extra_taras.append((who, int(idx)))
        else:
            warnings.append(f"Tarabala for the {who} not checked: nakshatra not given")

    if hf.upanayana_strength:
        if not ap.get("varna"):
            warnings.append("Varnesha not checked: varna not given")
        if not ap.get("veda_shakha"):
            warnings.append("Vedadhipati not checked: veda shakha not given")
        if not ap.get("vatu_rasi_idx"):
            warnings.append("Guru bala for the vatu not checked: the vatu's janma rashi not given")
    if hf.guru_bala_couple and not (ap.get("bride_rasi_idx") or ap.get("groom_rasi_idx")):
        warnings.append("Guru bala not checked: bride's and groom's janma rashi not given")

    # Garbhadhana night count (plan R6b, decision G1): nights counted from the first day of the period.
    # Classical rule until Dr. Nemani confirms the book's: nights 4-16, not 11 or 13. Son/daughter
    # (even/odd night) timing is never offered (PCPNDT Act). The date is used for this search only.
    ritu_start = None
    if rule.id == "garbhadhana":
        if ap.get("period_start_date"):
            ritu_start = datetime.strptime(ap["period_start_date"], "%Y-%m-%d").date()
            warnings.append("Nights counted from the first day of the period: nights 4 to 16 are used, except the 11th "
                            "and 13th (classical rule, to be confirmed by Dr. Nemani). Son or daughter timing is not offered.")
        else:
            warnings.append("Night count not applied: give the first day of the last period to use it.")

    for d_offset, cur_date in enumerate(scan_days):
        base_dt = datetime(cur_date.year, cur_date.month, cur_date.day)
        if ritu_start is not None:
            night = (cur_date - ritu_start).days + 1      # the night that begins on this day's evening
            if night not in RITU_NIGHTS:
                rejections["Not one of the allowed nights after the period (4 to 16, not 11 or 13)"] += 1
                continue

        day_age = None
        if hf.age_rule and age_ref is not None:
            if cur_date < age_ref:
                rejections["Before the date of birth" if hf.age_rule.reference == "birth" else "Before the conception date"] += 1
                continue
            tier, why_age = _age_tier(hf.age_rule, age_ref, ap.get("child_gender"), cur_date)
            if strict and tier == 2:
                rejections["Outside the age window"] += 1
                continue
            day_age = {"tier": tier, "text": why_age}

        # 1. Day panchang (sunrise snapshot: vara, kalas, display values)
        panchang = _copy.deepcopy(_day_panchang(cur_date.year, cur_date.month, cur_date.day,
                                                lat, lon, tz_offset, place_name))
        sr_h = _hms_to_hours(panchang.get("sunrise"), default=6.0)
        vaara_idx = VAARA_MAP.get(str(panchang.get("vaara", "")).lower().strip(), 0)
        day_start = base_dt + timedelta(hours=sr_h)
        day_end = day_start + timedelta(hours=24)
        sunset_dt = base_dt + timedelta(hours=_hms_to_hours(panchang.get("sunset"), default=18.0))

        day_reject = _day_level_reject(cr, panchang, cur_date, ap, tz_offset)
        # Show all (21 Nov 2026): a whole-day rule the day misses (month, moudhya, Jupiter's sign, guru bala)
        # is noted on every window of the day instead of dropping the day; Strict still drops it.
        day_miss = None
        if day_reject and not strict:
            day_miss, day_reject = day_reject, None
        # The user's own rulings stay hard in both modes: the Godavari Pushkaralu rule (13 Nov 2026).
        if not day_reject and pushkara_near and jupiter_in_simha(cur_date):
            day_reject = "Godavari Pushkaralu: Jupiter in Simha, no muhurtas near the Godavari"
        if day_reject:
            rejections[day_reject] += 1
            continue
        # Lunar months the person chose to search (11 Nov 2026), e.g. Magha to Jyeshtha.
        wanted_months = ap.get("lunar_months") or []
        if wanted_months and (panchang.get("chandramana") or {}).get("month_number") not in wanted_months:
            rejections["Outside the lunar months you chose"] += 1
            continue

        # 2. Bad periods. Every type is computed for the dosha checks; only the ones
        #    the rule asks to avoid are subtracted from the windows.
        all_kalas = extract_inauspicious_windows(panchang, base_dt)
        varjyam = [TimeWindow(start=v["start"], end=v["end"], label=f"Varjyam ({v['nakshatra']})",
                              metadata={"type": "varjyam"})
                   for v in varjyam_windows(day_start, day_end, tz_offset)]
        # Book para 1681 (11 Nov 2026): "by shastra only the vara-janita durmuhurtas should be followed";
        # Rahu kalam (a southern custom) and Gulika (a northern one) do not cut windows. They are shown on
        # the card for information. The rule files' avoid_rahu_kalam / avoid_yamagandam / avoid_gulika
        # flags are kept but no longer cut.
        CUSTOM_KALAS = ("rahu", "yama", "gulika")
        avoid = {"durmuhurta": common.avoid_durmuhurta, "varjyam": common.avoid_varjyam}
        custom_kalas = [w for w in all_kalas if w.metadata.get("type") in CUSTOM_KALAS]
        blocked = [w for w in all_kalas + varjyam
                   if w.metadata.get("type") not in CUSTOM_KALAS and avoid.get(w.metadata.get("type"), True)]
        blocked += _day_periods(hf.exclude_periods, day_start, sunset_dt)
        durmuhurta_spans = [(w.start, w.end) for w in all_kalas if w.metadata.get("type") == "durmuhurta"]
        varjyam_spans = [(w.start, w.end) for w in varjyam]

        if hf.upanayana_strength:
            # Jupiter's and Venus's bala / vriddha days, for the varnesha and vedadhipati (book para 1927)
            from app.engines.limb_timeline import moudhya_status as _moudhya
            day_jd = int(local_to_jd(datetime(cur_date.year, cur_date.month, cur_date.day, 12), tz_offset) - 0.5)
            ap["_moudhya"] = {pl: _moudhya(day_jd, pl)["state"] for pl in ("jupiter", "venus")}
            ap["_year_lord"] = samvatsara_lord(cur_date, tz_offset)

        # 3. Lagnas across the day
        lagnas = list(_day_lagnas(cur_date.year, cur_date.month, cur_date.day, lat, lon, tz_offset, sr_h))
        dosha_cache: Dict[Any, Any] = {}     # whole-lagna dosha rows (A4), shared by every window of a lagna

        pushkara_info = _day_pushkara(cur_date, lat, lon, tz_offset, place_name, panchang, b_rasi_idx, place_obj)
        sula_check = check_travel_directional_sula(panchang.get("vaara", ""), travel_dir) if travel_dir else None

        # 4. Evaluate each lagna, segment by segment
        for lagna in lagnas:
            clipped = _clip_time_of_day(lagna.start, lagna.end, hf.time_of_day, day_start, sunset_dt)
            if clipped is None:
                rejections[f"Outside the allowed time of day ({hf.time_of_day})"] += 1
                continue
            clipped = _clip_preference(clipped[0], clipped[1], ap.get("time_preference"), day_start, sunset_dt)
            if clipped is None:
                rejections[f"Outside your preferred time ({ap.get('time_preference')})"] += 1
                continue
            for seg_start, seg_end, limbs in split_by_limbs(clipped[0], clipped[1], tz_offset):
                seg_lagna = lagna_for_window(lagna, seg_start, seg_end)   # pushkara only where it really is
                misses: Optional[List[str]] = None if strict else ([day_miss] if day_miss else [])
                ok, score, rules_passed, why = evaluate_window_for_rule(
                    cr, seg_lagna, limbs, vaara_idx, birth_details, panchaka_method, ap, soft_misses=misses
                )
                if ok and hf.anadhyaya:
                    why_an = _anadhyaya_reason(limbs.tithi, (panchang.get("chandramana") or {}).get("month_number"),
                                               local_to_jd(seg_start, tz_offset))
                    if why_an:
                        if misses is None:
                            ok, why = False, [why_an]
                        else:
                            misses.append(why_an)
                if ok:
                    for who, nidx in extra_taras:
                        tb = evaluate_tarabala(limbs.nakshatra, nidx)
                        if not tb["is_pass"]:
                            if misses is None:
                                ok, why = False, [f"Tarabala failed for the {who}: {tb['name_en']} tara"]
                                break
                            misses.append(f"Tarabala failed for the {who}: {tb['name_en']} tara")
                        else:
                            rules_passed.append(f"Tarabala for the {who}: {tb['name_en']}")
                if not ok:
                    rejections[_reason_key(why[0]) if why else "hard filter"] += 1
                    continue

                seg = TimeWindow(start=seg_start, end=seg_end, label=f"{lagna.lagna_name_en} Lagna")
                clean_windows = subtract_blocked_intervals([seg], blocked, min_duration_minutes=min_window_minutes)
                if not clean_windows:
                    rejections["Covered by Durmuhurta / Varjyam / an excluded time of day"] += 1

                for cw in clean_windows:
                    # The final window may be shorter than the segment (Rahu kalam etc. removed):
                    # it keeps the pushkara points and reason only if it still holds pushkara minutes.
                    cw_lagna = lagna_for_window(lagna, cw.start, cw.end)
                    cw_score, cw_reasons = score, [r for r in rules_passed if not r.startswith("Pushkara navamsa")]
                    if seg_lagna.is_pushkara_navamsa and not cw_lagna.is_pushkara_navamsa:
                        cw_score -= 5
                    elif cw_lagna.is_pushkara_navamsa:
                        cw_reasons.append(f"Pushkara navamsa: {pushkara_text(cw_lagna)} (+5)")
                    cand = _build_candidate(
                        rule, cr, cw, cw_lagna, limbs, panchang, vaara_idx, cur_date, d_offset, tz_offset,
                        place_obj, birth_details, participants, panchaka_method, pushkara_info,
                        sula_check, facing_dir, b_nak_idx, b_rasi_idx, cw_score, cw_reasons,
                        durmuhurta_spans, varjyam_spans, strict, rejections,
                        extras={"blocked": blocked, "lat": lat, "lon": lon, "people": people or [], "misses": misses or [],
                                "custom_kalas": custom_kalas, "dosha_cache": dosha_cache},
                    )
                    if cand is None:
                        continue
                    if day_age is not None:
                        cand["age"] = day_age
                    candidates.append(cand)
                    results.append(_window_summary(cand, cw_lagna, rule, cw_score))

    # Age (11 Nov 2026): every muhurta is listed. Those in the preferred years come first, then the
    # "if needed" years, then the rest; each card shows the age (Strict still refuses outside the window).
    tiers = sorted({c["age"]["tier"] for c in candidates if c.get("age")})
    if tiers:
        ar = hf.age_rule
        unit = ar.unit if ar else "years"
        if tiers[0] == 0 and len(tiers) > 1:
            warnings.append(f"Muhurtas in the preferred {unit} {sorted(ar.allowed or [])} are listed first; "
                            f"the others follow, each marked with the age.")
        elif tiers[0] == 1:
            warnings.append(f"No muhurta in the preferred {unit} {sorted(ar.allowed or [])} within these dates; "
                            f"{unit} {sorted(ar.fallback or [])} (allowed if needed) are listed first.")
        elif tiers[0] == 2:
            warnings.append(f"No muhurta in the allowed {unit} within these dates; all muhurtas are shown, "
                            f"each marked with the age.")
    age_rank = {(c["date"], c["window_start"]): (c.get("age") or {}).get("tier", 0) for c in candidates}

    sorted_candidates = sorted(candidates, key=lambda x: (age_rank.get((x["date"], x["window_start"]), 0),
                                                          -x["percentage"], -x.get("rule_score", 0), x["date"], x["window_start"]))
    sorted_results = sorted(results, key=lambda x: (age_rank.get((x["date"], x["start_time"]), 0),
                                                    -x.get("percentage", 0), -x.get("score", 0), x["date"], x["start_time"]))

    return {
        "activity_id": rule.id,
        "title_en": rule.title_en,
        "title_te": rule.title_te,
        "category": rule.category,
        "informational": rule.informational,
        "source": rule.source.model_dump(),
        "strictness": "strict" if strict else "lenient",
        "rule_variant": cr.variant,
        "days_scanned": len(scan_days),
        "total_candidates": len(sorted_candidates),
        "candidates": sorted_candidates,
        "total_windows_found": len(sorted_results),
        "windows": sorted_results,
        "rejection_summary": [{"reason": r, "count": c} for r, c in rejections.most_common(10)],
        "warnings": warnings,
        "notices": notices,
        "birth_details": _birth_display(birth_details),
        "activity_params": activity_params,
    }


MOUDHYA_TE = {"combust": "మౌఢ్యం", "bala": "బాల్యం", "vriddha": "వార్ధక్యం", "clear": "బలంగా ఉంది"}


def _fmt(dt: datetime) -> str:
    return dt.strftime("%d %b %H:%M")


def _result_detail(rule, cw, lagna, limbs, cur_date, tz_offset, pct, failed, not_eval, cautions,
                   extras: Dict[str, Any]) -> Dict[str, Any]:
    """
    What the results screen shows beyond the panchang (category index, part 5): limb start/end,
    pada, lagna degree, every participant's tarabala/chandrabala, Guru/Shukra/Moon state,
    the bad periods that cut this lagna, and a one-line verdict.
    """
    jd_start = local_to_jd(cw.start, tz_offset)

    spans = limb_spans(jd_start)
    names = {"tithi": f"{limbs.tithi_name} ({limbs.paksha.title()})", "nakshatra": limbs.nakshatra_name,
             "yoga": limbs.yoga_name, "karana": limbs.karana_name}
    limb_times = {k: {"name": names[k], "start": _fmt(jd_to_local(a, tz_offset)), "end": _fmt(jd_to_local(b, tz_offset))}
                  for k, (a, b) in spans.items()}
    limb_times["nakshatra"]["pada"] = limbs.pada

    lagna_info = {"name": lagna.lagna_name_en, "name_te": lagna.lagna_name_te, "navamsa": lagna.navamsa_name_en,
                  "is_pushkara_navamsa": lagna.is_pushkara_navamsa, "pushkara_minutes": pushkara_text(lagna) or None}
    try:
        # One minute inside the window: at the exact boundary the scanner and Swiss Ephemeris
        # can disagree by seconds about which sign is rising.
        probe = min(cw.start + timedelta(minutes=1), cw.end)
        asc = ascendant_at(local_to_jd(probe, tz_offset), extras["lat"], extras["lon"])
        deg = asc % 30.0
        mins = int(round(deg * 60))
        lagna_info.update(degree=round(deg, 2), degree_dms=f"{min(mins // 60, 29)}°{(mins % 60 if mins < 1800 else 59):02d}'",
                          degree_at=probe.strftime("%H:%M"), sign_at_start=RASI_NAMES_EN[int(asc // 30) + 1])
    except (KeyError, ValueError, TypeError) as ex:
        logger.error(f"Lagna degree not computed: {ex}")

    people_rows = []
    for p in extras.get("people", []):
        row = {"role": p.get("role"), "name": p.get("name"), "star_basis_used": p.get("star_basis_used")}
        if p.get("star_used"):
            tb = evaluate_tarabala(limbs.nakshatra, int(p["star_used"]))
            row["tara"] = {"name": tb.get("name_en"), "name_te": tb.get("name_te"),
                           "is_pass": tb.get("is_pass")}
        if p.get("rasi_idx"):
            cb = evaluate_chandrabala(limbs.moon_rasi, int(p["rasi_idx"]))
            row["chandrabala"] = {"house": cb.get("house_diff"), "is_pass": cb.get("is_pass"),
                                  "desc_en": cb.get("verdict_en"), "desc_te": cb.get("verdict_te")}
        people_rows.append(row)

    day_jd = int(local_to_jd(datetime(cur_date.year, cur_date.month, cur_date.day, 12), tz_offset))
    strength = []
    for planet in ("jupiter", "venus"):
        st = moudhya_status(day_jd, planet)
        strength.append({"planet": planet, "state": st["state"], "state_te": MOUDHYA_TE.get(st["state"], st["state"]),
                         "days": st.get("days")})
    ph = moon_phase(jd_start)
    strength.append({"planet": "moon", "state": "waxing" if ph["waxing"] else "waning",
                     "state_te": "వృద్ధి చంద్రుడు" if ph["waxing"] else "క్షీణ చంద్రుడు",
                     "illumination": ph["illumination"]})

    cut_by = []
    for w in extras.get("blocked", []):
        if w.start < lagna.end and w.end > lagna.start:
            cut_by.append({"type": w.metadata.get("type", ""), "label": w.label,
                           "start": w.start.strftime("%H:%M"), "end": w.end.strftime("%H:%M")})

    grade_en, grade_te = (("Best", "ఉత్తమం") if pct >= 75 else ("Middling", "మధ్యమం") if pct >= 50 else ("Avoid", "నిషిద్ధం"))
    major = [d for d in failed if d.get("severity") in ("fatal", "serious")]
    minor = [d for d in failed if d.get("severity") not in ("fatal", "serious")]
    en = [f"{grade_en}: passes this event's own rules"]
    te = [f"{grade_te}: ఈ కార్యపు నియమాలు సరిపోయాయి"]
    if major:
        en.append("serious doshas: " + ", ".join(d["name_en"].split(". ", 1)[-1] for d in major))
        te.append("తీవ్ర దోషాలు: " + ", ".join(d["name_te"].split(". ", 1)[-1] for d in major))
    if minor:
        en.append(f"{len(minor)} minor dosha(s)")
        te.append(f"{len(minor)} స్వల్ప దోషాలు")
    if not failed:
        en.append("no dosha found among those checked")
        te.append("పరిశీలించిన వాటిలో దోషం లేదు")
    if not_eval:
        en.append(f"{len(not_eval)} check(s) not evaluated")
        te.append(f"{len(not_eval)} పరిశీలనలు జరగలేదు")
    if lagna.is_pushkara_navamsa:
        en.append(f"lagna in pushkara navamsa {pushkara_text(lagna, with_sign=False)}")
        te.append(f"లగ్నం పుష్కర నవాంశలో {pushkara_text(lagna, with_sign=False)}")

    return {
        "limb_times": limb_times,
        "lagna": lagna_info,
        "people": people_rows,
        "planet_strength": strength,
        "cut_by": cut_by,
        "verdict_en": "; ".join(en) + ".",
        "verdict_te": "; ".join(te) + ".",
    }


def _birth_display(birth_details: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """birth_details plus readable names, so the client never has to resolve indexes."""
    if not birth_details:
        return birth_details
    out = dict(birth_details)
    nak = birth_details.get("janma_nak_idx")
    if nak and 1 <= int(nak) <= 27:
        out["janma_nakshatra"] = NAKSHATRA_CANONICAL[int(nak)]
    rasi = birth_details.get("janma_moon_rasi_idx")
    if rasi and 1 <= int(rasi) <= 12:
        out["birth_moon_rasi"] = RASI_NAMES_EN[int(rasi)]
    lg = birth_details.get("birth_lagna_idx")
    if lg and 1 <= int(lg) <= 12:
        out["birth_lagna"] = RASI_NAMES_EN[int(lg)]
    return out


def _build_candidate(rule, cr, cw, lagna, limbs, panchang, vaara_idx, cur_date, d_offset, tz_offset,
                     place_obj, birth_details, participants, panchaka_method, pushkara_info,
                     sula_check, facing_dir, b_nak_idx, b_rasi_idx, score, rules_passed,
                     durmuhurta_spans, varjyam_spans, strict, rejections,
                     extras: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    cautions: List[str] = []
    mid_dt = cw.start + (cw.end - cw.start) / 2
    eval_h = mid_dt.hour + mid_dt.minute / 60.0 + mid_dt.second / 3600.0
    d1_positions, raw_d1 = compute_d1_positions(mid_dt.date(), eval_h, place_obj)

    seg_panchang = dict(panchang)
    seg_panchang.update(limbs.as_panchang_fields())
    seg_panchang["vaara_number"] = vaara_idx

    ctx = {
        "jd": local_to_jd(mid_dt, tz_offset),
        "day": cur_date,
        "lat": place_obj.latitude, "lon": place_obj.longitude,     # omens by state (plan F2 / G2)
        "window": (cw.start, cw.end),
        "lagna_window": (lagna.start, lagna.end),
        "varjyam": varjyam_spans,
        "durmuhurta": durmuhurta_spans,
        "tz_offset": tz_offset,
        "category": rule.category,
        "event_id": rule.id,                                        # which vedha chakra (21 Nov 2026)
        "hora_lord": _hora_lord(mid_dt, panchang, cur_date, vaara_idx),   # vedha doshapavada
        "kartari": _kartari_mode(rule),
        "limbs": limbs,
        "limbs_checked": cr.limbs_checked,
        "participants": participants,
    }
    common = cr.hf.common
    # Super admin setting (20 Nov 2026): a set switched to "Don't calculate in score" is still worked out
    # and shown on the result, but it neither lowers nor caps the percentage.
    ds = dosha_scoring_for(rule, common)
    whole = _lagna_dosha_rows(lagna, panchang, vaara_idx, cur_date, tz_offset, place_obj, birth_details, ctx,
                              (extras or {}).get("dosha_cache"))
    if whole is not None:
        maha_doshas, dashavidha = whole
    else:   # the lagna could not be cut into pieces: judge the window's middle, as before
        logger.warning(f"Whole-lagna dosha check fell back to the window middle for {lagna.start:%Y-%m-%d %H:%M}")
        maha_doshas = evaluate_21_maha_doshas(seg_panchang, d1_positions, raw_d1, lagna.lagna_idx, birth_details, context=ctx)
        dashavidha = evaluate_10_dashavidha_doshas(seg_panchang, d1_positions, raw_d1, lagna.lagna_idx, birth_details, context=ctx)
    if ds["mahadoshas"]:
        _mark_duplicates(dashavidha)
    pariharas = evaluate_muhurta_pariharas(seg_panchang, raw_d1, lagna.lagna_idx,
                                           birth_details=birth_details, pushkara_info=pushkara_info)

    # Category dosha profile (severity overrides, doshapavada), special yogas and list C checks.
    tab = rule.tab or rule.category
    active_pids = [pr.get("id") for pr in pariharas if pr.get("id")]
    maha_doshas = apply_dosha_profile(maha_doshas, tab, rule.id, active_pids, not strict)
    dashavidha = apply_dosha_profile(dashavidha, tab, rule.id, active_pids, not strict)
    maha_doshas, dashavidha, good_benefics = apply_author_severity(maha_doshas, dashavidha, lagna)
    good_yogas, yoga_doshas, yoga_points = evaluate_yogas(vaara_idx, limbs.tithi, limbs.nakshatra, tab, rule.id)
    jd_mid = local_to_jd(mid_dt, tz_offset)
    day_sunrise = datetime(cur_date.year, cur_date.month, cur_date.day) + timedelta(
        hours=_hms_to_hours(panchang.get("sunrise"), default=6.0))
    sr_jd = local_to_jd(day_sunrise, tz_offset)
    extra = extra_checks(tab, rule.id, limbs.tithi, tithi_bounds(jd_mid), local_to_jd(cw.start, tz_offset),
                         [sr_jd - 1.0, sr_jd, sr_jd + 1.0, sr_jd + 2.0], lagna.house_planets,
                         local_to_jd(cw.end, tz_offset))
    # A7 (21 Nov 2026): a good Jupiter, Mercury or Venus in the lagna neutralises every dosha, these too.
    except_by_benefics(yoga_doshas + extra, good_benefics)
    # This event's own chart rules that the window misses (Show-all mode): one failed row each.
    for i, msg in enumerate((extras or {}).get("misses") or []):
        extra.append({"id": f"rule_miss_{i + 1}", "number": None,
                      "name_en": f"Event rule not matched: {msg}", "name_te": f"కార్య నియమం సరిపోలలేదు: {msg}",
                      "status": "fail", "is_pass": False, "score": 0, "severity": "serious",
                      "desc_en": msg, "desc_te": msg, "ref": rule.source.page if rule.source else ""})
    score += yoga_points
    link_rows(maha_doshas)          # book_id and rule status from rules/shared/dosha_registry.yaml (plan B2)
    link_rows(dashavidha)

    checked = []
    if ds["mahadoshas"]:
        checked += maha_doshas
    if ds["dashavidha"]:
        checked += dashavidha
    checked += yoga_doshas + extra
    # Doshapavada (book paras 1972-78): "remove all" exceptions cancel the lagna doshas (not the 21
    # mahadoshas, not day / tithi / personal checks); partial ones are a plus row in the table.
    apavada = doshapavada(lagna) if cr.hf.doshapavada else []
    if any(a["kind"] == "all" for a in apavada):
        why = next(a for a in apavada if a["kind"] == "all")
        for d in list(dashavidha) + list(extra):
            is_miss = str(d.get("id", "")).startswith("rule_miss_")
            lagna_dosha = (is_miss and not str(d.get("desc_en", "")).startswith(_NOT_LAGNA_DOSHA)
                           and not _is_panchanga_miss(str(d.get("desc_en", "")))) or \
                          (not is_miss and d.get("id") in _LAGNA_EXTRA_IDS) or d in dashavidha
            if d.get("status") == "fail" and lagna_dosha:
                d["status"], d["severity"], d["excepted_by"] = "excepted", "info", why["id"]
                d["desc_en"] = f"{d.get('desc_en') or ''} Excepted: {why['en']}.".strip()
                d["desc_te"] = f"{d.get('desc_te') or ''} మినహాయింపు: {why['te']}.".strip()
    for a in apavada:
        if a["kind"] == "partial":
            row = {"id": f"apavada_{a['id']}", "number": None, "name_en": f"Doshapavada: {a['en']}",
                   "name_te": f"దోషాపవాదం: {a['te']}", "status": "pass", "is_pass": True, "score": 10,
                   "severity": "info", "desc_en": a["en"], "desc_te": a["te"]}
            extra.append(row)
            checked.append(row)
    failed = [d for d in checked if d["status"] == "fail"]
    fatal = [d for d in failed if d["severity"] == "fatal"]
    audit = dosha_audit(maha_doshas if ds["mahadoshas"] else [], dashavidha if ds["dashavidha"] else [],
                        yoga_doshas + extra, good_benefics)
    if strict and fatal:
        rejections[f"Fatal dosha: {fatal[0]['name_en'].split('. ', 1)[-1]}"] += 1
        return None
    for d in failed:
        if d["severity"] in SEVERE_FOR_SCORING:
            cautions.append(f"{d['name_en']}: {d['desc_en']}")
    not_eval = [d["name_en"] for d in checked if d["status"] == "not_evaluated"]

    panchaka_info = evaluate_panchaka(limbs.tithi_number, vaara_idx, limbs.nakshatra, lagna.lagna_idx,
                                      method=panchaka_method, tithi_30=limbs.tithi)

    tara_info = None
    if b_nak_idx:
        tr = evaluate_tarabala(limbs.nakshatra, b_nak_idx)
        tara_info = {"name": tr.get("name_en"), "name_te": tr.get("name_te"),
                     "remainder": tr.get("tara_num"), "is_pass": tr.get("is_pass", True)}
    chandra_info = None
    if b_rasi_idx:
        cb = evaluate_chandrabala(limbs.moon_rasi, b_rasi_idx)
        chandra_info = {"is_pass": cb.get("is_pass", True), "house": cb.get("house_diff"),
                        "msg": cb.get("verdict_en"), "desc_en": cb.get("verdict_en"), "desc_te": cb.get("verdict_te")}

    facing_check = check_facing_compatibility(facing_dir, b_rasi_idx) if facing_dir else None

    all_reasons = list(rules_passed)
    planets_in_8 = [p.name_en for p in lagna.house_planets.get(8, [])]
    if not planets_in_8:
        all_reasons.append("Ashtama shuddhi: the 8th house is empty.")
    else:
        cautions.append(f"8th house occupied by {', '.join(planets_in_8)}")
    if sula_check and sula_check.get("has_sula"):
        cautions.append(sula_check.get("desc_en"))
    if not_eval:
        cautions.append(f"Not evaluated (data or author input missing): {', '.join(not_eval)}")

    serious = [d for d in failed if d["severity"] == "serious"]
    # One percentage (dosha questionnaire A3/A8, 21 Nov 2026; replaces the three separate scores of the same
    # morning). Each part is the share of its checks passed ("excepted" = passed; "to be confirmed",
    # "not applicable" and "not evaluated" left out), so every failed dosha lowers the percentage:
    #   panchanga shuddhi (30%) = the event's own rules, every one passed or missed (weekday, tithi, nakshatra,
    #                             yoga, karana, month, lagna, houses, planets, balas);
    #   mahadoshas (70%, or 60% where the dashavidha doshas are checked);
    #   dashavidha (10%, marriage only).
    # A set switched off in Settings (or with no checks) gets no share; the other parts share its weight. maha_score and
    # dasha_score still show each part on its own. The extra checks (chakras, papa drishti, ...) and the
    # special-yoga doshas are listed on the result but are in no part.
    # `points` below is the old +10/-10 total of the counted rows, kept only in audit_points.
    def _rows(lst):
        return [d for d in lst if d["status"] in ("pass", "fail", "excepted", "to_confirm")]
    applicable = [d for d in checked if d["status"] in ("pass", "fail", "excepted", "to_confirm")]
    points = sum(10 if d["status"] == "pass" else -10 if d["status"] == "fail" else 0 for d in applicable)
    # A7 (21 Nov 2026): the Sun in the 11th does good to the lagna. Listed as a reason; since option B
    # (panchanga shuddhi = the five angas) it no longer changes the percentage.
    if any(p.name_en == "Sun" for p in (lagna.house_planets or {}).get(11, [])):
        rules_passed = list(rules_passed) + ["Sun in the 11th from the lagna does good to the lagna (Dr. Nemani)."]
        all_reasons.append(rules_passed[-1])
    # Panchanga shuddhi (user, 21 Nov 2026, option B): the five angas only, each passed or not against this
    # event's lists, so 5 of 5 = 100%. The event's other rules (lagna, houses, planets, balas, month) are listed
    # as "not met" rows but hold no share; a serious one still caps the % at 74 below.
    angas = anga_checks(cr, limbs, vaara_idx)
    main_part = sum(1 for a in angas if a["ok"]) / len(angas)
    main_rows = [d for d in _rows(extra) if str(d.get("id", "")).startswith("rule_miss_")]
    dasha_rows = _rows(dashavidha) if ds["dashavidha"] else []
    maha_rows = _rows(maha_doshas) if ds["mahadoshas"] else []
    dasha_part, maha_part = _share(dasha_rows), _share(maha_rows)

    def _score(rows, part):
        if part is None:
            return None
        return {"percentage": round(100 * part), "checked": len([d for d in rows if d["status"] != "to_confirm"]),
                "passed": sum(1 for d in rows if d["status"] in ("pass", "excepted")),
                "failed": sum(1 for d in rows if d["status"] == "fail")}
    maha_score, dasha_score = _score(maha_rows, maha_part), _score(dasha_rows, dasha_part)
    w_p = ds["panchanga_weight"]
    w_d = ds["dashavidha_weight"] if dasha_part is not None else 0
    w_m = (100 - w_p - w_d) if maha_part is not None else 0
    parts = [(w, part) for w, part in ((w_p, main_part), (w_m, maha_part), (w_d, dasha_part)) if part is not None]
    total_w = sum(w for w, _ in parts)
    # A part with no checks (e.g. no event rules recorded) drops out and the others share its weight.
    dosha_part = sum(w * part for w, part in parts) / total_w if total_w else None
    pct = round(100 * dosha_part) if dosha_part is not None else 50
    pct = int(min(98, max(5, pct)))
    dasha_failed = [d for d in dasha_rows if d["status"] == "fail"]
    # Caps from the basic rules only: a missed serious rule keeps the window from "best"; a directional sula
    # holds it low.
    if any(d["status"] == "fail" and d.get("severity") in SEVERE_FOR_SCORING for d in main_rows):
        pct = min(pct, 74)
    pct = max(5, pct)
    if sula_check and sula_check.get("has_sula"):
        pct = min(pct, 40)
    verdict = "ఉత్తమ ముహూర్తం" if pct >= 75 else ("మధ్యమ ముహూర్తం" if pct >= 50 else "నిషిద్ధం")

    planets_in_1 = [p.name_en for p in lagna.house_planets.get(1, [])]
    tithi_disp = f"{limbs.tithi_name} ({limbs.paksha.title()})"
    detailed_eval = {
        # Each anga against this event's own lists (was hard-coded "passed" for vara, tithi and nakshatra).
        "vaara": {"name": panchang.get("vaara"), "is_pass": angas[0]["ok"]},
        "tithi": {"name": limbs.tithi_name, "number": limbs.tithi_number, "paksha": limbs.paksha, "is_pass": angas[1]["ok"]},
        "nakshatra": {"name": limbs.nakshatra_name, "pada": limbs.pada, "is_pass": angas[2]["ok"]},
        "yoga": {"name": limbs.yoga_name, "index": limbs.yoga, "is_pass": angas[3]["ok"]},
        "karana": {"name": limbs.karana_name, "is_pass": angas[4]["ok"]},
        "panchanga_shuddhi": {"passed": sum(1 for a in angas if a["ok"]), "checked": len(angas), "angas": angas},
        "lagna": {"name": lagna.lagna_name_en, "name_te": lagna.lagna_name_te,
                  "navamsa": lagna.navamsa_name_en, "is_pushkara_navamsa": lagna.is_pushkara_navamsa,
                  "pushkara_minutes": pushkara_text(lagna) or None},
        "ashtama_shuddhi": {"has_shuddhi": not planets_in_8, "planets_in_8th": planets_in_8,
                            "ashtama_rasi": RASI_NAMES_EN[(lagna.lagna_idx + 6) % 12 + 1],
                            "muhurta_lagna": lagna.lagna_name_en},
        "lagna_shuddhi": {"has_shuddhi": True, "planets_in_lagna": planets_in_1,
                          "muhurta_lagna": lagna.lagna_name_en},
        "maha_doshas": maha_doshas,
        "dashavidha_doshas": dashavidha,
        "dashavidha_enforced": ds["dashavidha"],
        "mahadoshas_scored": ds["mahadoshas"],
        "special_yogas": good_yogas,
        "yoga_doshas": yoga_doshas,
        "extra_checks": extra,
        "pariharas": pariharas,
        "panchaka": panchaka_info,
        "tara": tara_info,
        "chandrabalam": chandra_info,
        "sula_check": sula_check,
        "facing_check": facing_check,
    }

    cand_panchang = dict(panchang)
    cand_panchang["tithi"] = tithi_disp
    cand_panchang["nakshatra"] = limbs.nakshatra_name
    cand_panchang["yoga"] = limbs.yoga_name
    cand_panchang["karana"] = limbs.karana_name
    cand_panchang["lagna"] = lagna.lagna_name_en
    # PyJHora's varjyam has zero length; show the book-table spans actually used for filtering.
    cand_panchang["varjyam"] = [{"start": a.strftime("%H:%M:%S"), "end": b.strftime("%H:%M:%S")}
                                for a, b in varjyam_spans]

    try:
        amsha = window_amsha(cw.start, cw.end, tz_offset, (extras or {})["lat"], (extras or {})["lon"])
    except (KeyError, ValueError, TypeError) as ex:
        logger.error(f"Amsha not worked out: {ex}")
        amsha = None
    try:
        pushkara_window = window_pushkara(lagna, cw.start, cw.end, tz_offset, (extras or {})["lat"], (extras or {})["lon"])
    except KeyError as ex:
        logger.error(f"Window pushkara not worked out, missing {ex}")
        pushkara_window = None
    detail = _result_detail(rule, cw, lagna, limbs, cur_date, tz_offset, pct, failed, not_eval,
                            cautions, extras or {})

    return {
        "date": cw.start.date().isoformat(),
        "panchang_day": cur_date.isoformat(),
        "day_number": d_offset + 1,
        "day_label_en": f"{rule.title_en} · {lagna.lagna_name_en} Lagna ({cw.start_time} – {cw.end_time})",
        "day_label_te": f"{rule.title_te} · {lagna.lagna_name_te} లగ్నం ({cw.start_time} – {cw.end_time})",
        "window_start": cw.start_time,
        "window_end": cw.end_time,
        "duration_minutes": cw.duration_minutes,
        "duration_ghatis": cw.duration_ghatis,
        "percentage": pct,                 # panchanga shuddhi 30 + mahadoshas 70 (30/60/10 with dashavidha)
        "maha_score": maha_score,          # the mahadosha part on its own (None when switched off)
        "dasha_score": dasha_score,        # the dashavidha part on its own (None when not checked)
        "amsha": amsha,               # Pushkaramsha / Vargottamamsha and the time it starts
        "pushkara_window": pushkara_window,   # pushkara navamsha spans and pushkara bhaga inside THIS window
        "doshapavada": apavada,       # the book's exceptions in this lagna (paras 1972-78)
        "custom_kalas": [{"type": w.metadata.get("type"), "name": w.label,
                          "start": w.start.strftime("%H:%M"), "end": w.end.strftime("%H:%M")}
                         for w in (extras or {}).get("custom_kalas", []) if w.start < cw.end and w.end > cw.start],
        "audit_points": {"points": points, "applicable": len(applicable),    # how the percentage was made
                         "main_share": None if main_part is None else round(100 * main_part),
                         "dosha_share": None if dosha_part is None else round(100 * dosha_part),
                         "dasha_share": None if dasha_part is None else round(100 * dasha_part),
                         "maha_share": None if maha_part is None else round(100 * maha_part),
                         "panchanga_weight": w_p, "maha_weight": w_m, "dashavidha_weight": w_d,
                         "dasha_failed": len(dasha_failed)},
        "rule_score": score,          # the event's own preference points (weekday, lagna, pushkara): breaks ties
        "verdict": verdict,
        "reasons": all_reasons,
        "cautions": cautions,
        "tara": tara_info["name"] if tara_info else None,
        "pushkara_info": pushkara_info,
        "special_yogas": good_yogas,
        "panchang": cand_panchang,
        "d1_chart": d1_positions,
        "detailed_eval": detailed_eval,
        "detail": {**detail, "audit": audit},
        "audit": audit,
        "source": rule.source.model_dump(),
    }


def _window_summary(cand: Dict[str, Any], lagna: LagnaWindow, rule: RuleDefinition, score: int) -> Dict[str, Any]:
    p = cand["panchang"]
    return {
        "date": cand["date"],
        "start_time": cand["window_start"],
        "end_time": cand["window_end"],
        "duration_minutes": cand["duration_minutes"],
        "duration_ghatis": cand["duration_ghatis"],
        "lagna_en": lagna.lagna_name_en,
        "lagna_te": lagna.lagna_name_te,
        "navamsa_en": lagna.navamsa_name_en,
        "is_pushkara_navamsa": lagna.is_pushkara_navamsa,
        "pushkara_navamsa_minutes": pushkara_text(lagna) or None,
        "score": score,
        "percentage": cand["percentage"],
        "maha_score": cand.get("maha_score"),
        "dasha_score": cand.get("dasha_score"),
        "verdict": cand["verdict"],
        "rules_passed": cand["reasons"],
        "cautions": cand["cautions"],
        "source": rule.source.model_dump(),
        "panchang_snapshot": {
            "vaara": p.get("vaara"),
            "tithi": p.get("tithi"),
            "nakshatra": p.get("nakshatra"),
            "yoga": p.get("yoga"),
            "karana": p.get("karana"),
        },
    }
