"""
Dr. Nemani's dosha rulings applied to the computed doshas: benefics in the lagna (A7), severity, audit banner, doshapavada, whole-lagna judging (A4) and duplicates (A5).
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
from app.engines.rule_interpreter.planets import _hora_lord, _planet_weak, _planets_by_name  # noqa: F401


# ── Dr. Nemani's rulings (plan B1, 9 Nov 2026) ─────────────────────────────────────
# 1. The 21 mahadoshas are never allowed, for any event: a failed one is always fatal and no
#    category exemption softens it (Strict drops the window; Lenient shows it only as "why not").
# 2. Other doshas are allowed when Jupiter is in the muhurta lagna: a failed dashavidha dosha is
#    then "excepted". Questionnaire answers (12 Nov 2026): Q1 not when Jupiter is combust,
#    debilitated (Makara) or retrograde; Q2 "all of them", so the exception also covers
#    paksharandhra, kshaya tithi, papa drishti and the Mrityu / Dagdha / Yamaghanta yogas.
# Option A (9 Nov 2026) listed checks shown as "To be confirmed" until Dr. Nemani answered.
# Q3 (12 Nov 2026): papa shadvarga as coded (any one weak varga lord) is correct, so it is a mahadosha.
TO_CONFIRM: Dict[str, Tuple[str, str]] = {}
# A7 (21 Nov 2026, replaces the Jupiter-only rule of Q1/Q2): a good Jupiter, Mercury or Venus in the muhurta
# lagna neutralises the doshas, all of them, the 21 mahadoshas included. "Good" = not retrograde, not combust,
# not debilitated; Jupiter also not in Simha (Dr. Nemani, 13 Nov 2026: then it has no power).
LAGNA_BENEFICS = ("jupiter", "mercury", "venus")
_BENEFIC_TE = {"jupiter": "గురుడు", "mercury": "బుధుడు", "venus": "శుక్రుడు"}


def benefics_in_lagna(lagna: LagnaWindow) -> Tuple[List[str], List[str]]:
    """(good benefics in the lagna that neutralise doshas, why each other benefic in the lagna cannot)."""
    planets = {p.name_en.lower(): p for plist in (lagna.house_planets or {}).values() for p in plist}
    in_lagna = {p.name_en.lower(): p for p in (lagna.house_planets or {}).get(1, [])}
    good, why_not = [], []
    for name in LAGNA_BENEFICS:
        p = in_lagna.get(name)
        if not p:
            continue
        weak = _planet_weak(name, planets)
        if p.speed < 0:
            why_not.append(f"{p.name_en} in the lagna is retrograde, so it does not neutralise doshas")
        elif weak:
            why_not.append(f"{weak} in the lagna, so it does not neutralise doshas")
        elif name == "jupiter" and int(p.longitude // 30) + 1 == 5:
            why_not.append("Jupiter in the lagna is in Simha, so it has no power to neutralise doshas")
        else:
            good.append(name)
    return good, why_not


def except_by_benefics(rows: List[Dict[str, Any]], good: List[str]) -> None:
    """Mark failed rows as neutralised by the good benefics in the lagna (in place)."""
    if not good:
        return
    en = " and ".join(n.title() for n in good)
    te = ", ".join(_BENEFIC_TE[n] for n in good)
    note_en = f"Neutralised: {en} in the muhurta lagna (Dr. Nemani's ruling)."
    note_te = f"నివారణ: ముహూర్త లగ్నంలో {te} (డా. నేమాని గారి నిర్ణయం)."
    for r in rows:
        if r.get("status") == "fail":
            r["status"], r["severity"], r["excepted_by"] = "excepted", "info", "benefic_in_lagna"
            r.pop("exemption", None)
            for k, note in (("desc_en", note_en), ("desc_te", note_te)):
                r[k] = f"{r.get(k) or ''} {note}".strip()


def apply_author_severity(maha: List[Dict[str, Any]], dashavidha: List[Dict[str, Any]], lagna: LagnaWindow):
    """Mahadosha severity (fatal), then the A7 neutralisation. Returns (maha, dashavidha, good benefics)."""
    good, _ = benefics_in_lagna(lagna)
    maha_out = []
    for r in maha:
        r = dict(r)
        if r.get("status") == "fail" and r.get("id") in TO_CONFIRM:
            r["status"], r["severity"] = "to_confirm", "info"
            en, te = TO_CONFIRM[r["id"]]
            r["desc_en"] = f"{r.get('desc_en') or ''} {en}".strip()
            r["desc_te"] = f"{r.get('desc_te') or ''} {te}".strip()
        elif r.get("status") == "fail":
            r["severity"] = "fatal"
            r.pop("exemption", None)          # category exemptions never soften a mahadosha
        maha_out.append(r)
    dash_out = [dict(r) for r in dashavidha]
    except_by_benefics(maha_out, good)
    except_by_benefics(dash_out, good)
    return maha_out, dash_out, good


def dosha_audit(maha: List[Dict[str, Any]], dashavidha: List[Dict[str, Any]], others: List[Dict[str, Any]],
                benefics: List[str]) -> Dict[str, Any]:
    """The banner and colour: red = a mahadosha fails; amber = something excepted or a lesser dosha;
    green = nothing failed."""
    def count(rows, status):
        return sum(1 for r in rows if r.get("status") == status)
    maha_fail, dash_fail = count(maha, "fail"), count(dashavidha, "fail")
    excepted = [r.get("name_en") for r in maha + dashavidha if r.get("status") == "excepted"]
    other_fail = count(others, "fail")
    to_confirm = [r.get("name_en") for r in maha if r.get("status") == "to_confirm"]
    colour = "red" if maha_fail else ("amber" if (dash_fail or excepted or other_fail or to_confirm) else "green")
    return {
        "colour": colour,
        # names of the mahadoshas that did not match, for the result card ("Mahadosha not matched: …")
        "maha_failed_en": [r.get("name_en", "").split(". ", 1)[-1] for r in maha if r.get("status") == "fail"],
        "maha_failed_te": [r.get("name_te", "").split(". ", 1)[-1] for r in maha if r.get("status") == "fail"],
        "mahadosha": {"total": 21, "failed": maha_fail, "not_evaluated": count(maha, "not_evaluated"), "checked": bool(maha)},
        "dashavidha": {"total": 10, "failed": dash_fail, "excepted": len(excepted), "not_evaluated": count(dashavidha, "not_evaluated"),
                       "checked": bool(dashavidha)},
        "other_failed": other_fail,
        "excepted": excepted,
        "to_confirm": to_confirm,
        "jupiter_in_lagna": "jupiter" in benefics,     # kept for older clients
        "benefics_in_lagna": benefics,
    }


# ── Doshapavada for the upanayana lagna (book paras 1972-78; 11 Nov 2026) ──────────────────────
_PLANET_BY_ID = {0: "sun", 1: "moon", 2: "mars", 3: "mercury", 4: "jupiter", 5: "venus", 6: "saturn"}
# Chart (lagna) doshas the "remove all doshas" exceptions cancel. Day, tithi and personal checks are not
# lagna doshas and stay: tarabala, chandrabala, panchaka, anadhyaya, varnesha, age.
_NOT_LAGNA_DOSHA = ("Tarabala", "Chandrabala", "Panchaka", "Nitya anadhyaya", "Naimittika anadhyaya", "Trishtaka",
                    "Sankranti anadhyaya", "Anadhyaya near", "Varnesha", "Vedadhipati", "Guru bala", "Moon's sign")
_LAGNA_EXTRA_IDS = {"papa_drishti"}
# Words that mark a missed panchanga or whole-day rule (Show-all rows since 21 Nov 2026). These are not lagna
# doshas, so a doshapavada that cancels lagna doshas must leave them standing.
_PANCHANGA_MISS_WORDS = (" is not an allowed weekday", " is excluded for this event", "Tithi ", "Nakshatra ", "Yoga ",
                         "Karana ", "The Sun's sign", "Monday with a waning Moon", "dagdha tithi", "janma nakshatra",
                         "masa", " allowed month", " is excluded", "combust (moudhya)", "bala (child) days",
                         "vriddha (old) days", "Jupiter in Simha", "Trijyeshtha")


def _is_panchanga_miss(msg: str) -> bool:
    return any(w in msg for w in _PANCHANGA_MISS_WORDS) and "lagna" not in msg.lower()


def doshapavada(lagna: LagnaWindow) -> List[Dict[str, Any]]:
    """The book's exceptions present in this lagna chart. kind 'all' cancels every lagna dosha except the
    21 mahadoshas (Dr. Nemani: mahadoshas are never allowed); kind 'partial' counts as a plus."""
    from app.engines.vocab import SIGN_LORD
    planets = _planets_by_name(lagna)
    house = {name: h for h, plist in (lagna.house_planets or {}).items() for name in (p.name_en.lower() for p in plist)}
    strong = lambda name: name in planets and _planet_weak(name, planets) is None
    lord = _PLANET_BY_ID.get(SIGN_LORD.get(lagna.lagna_idx))
    out = []
    if house.get("sun") == 11:
        out.append({"id": "sun_11", "kind": "all", "en": "Sun in the 11th removes all doshas (book para 1978)",
                    "te": "లగ్నమునకు 11వ స్థానమున రవి సర్వ దోషములను హరించును (గ్రంథం 1978)"})
    if house.get("jupiter") == 1 and all(strong(x) for x in {lord, "jupiter", "sun", "moon"} if x):
        out.append({"id": "jupiter_lagna", "kind": "all",
                    "en": "Jupiter in the lagna with lagna lord, Jupiter, Sun and Moon strong removes 10 lakh doshas (book para 1975)",
                    "te": "పంచేష్టిక బలముతో గురుడు లగ్నమున 10 లక్షల దోషములను పోగొట్టును (గ్రంథం 1975)"})
    if house.get("venus") == 1:
        out.append({"id": "venus_lagna", "kind": "partial", "en": "Venus in the lagna removes 2 lakh doshas (book para 1974)",
                    "te": "శుక్రుడు లగ్నమున 2 లక్షల దోషములను హరించును (గ్రంథం 1974)"})
    if house.get("mercury") == 1 and strong("mercury"):
        out.append({"id": "mercury_lagna", "kind": "partial", "en": "Strong Mercury in the lagna removes 1 lakh doshas (book para 1973)",
                    "te": "బలవంతుడైన బుధుడు లగ్నమున లక్ష దోషములను పోగొట్టును (గ్రంథం 1973)"})
    if lord and house.get(lord) in (3, 6, 11):
        out.append({"id": "lord_upachaya", "kind": "partial",
                    "en": f"Lagna lord {lord.title()} in the {house[lord]}th removes 2 lakh doshas (book para 1976)",
                    "te": f"లగ్నాధిపతి {house[lord]}వ స్థానమున 2 లక్షల దోషములను హరించును (గ్రంథం 1976)"})
    m = next((x for x in ("sun", "mars", "saturn") if house.get(x) in (3, 6, 8, 11) and strong(x)), None)
    if m:
        out.append({"id": "malefic_upachaya", "kind": "partial",
                    "en": f"Strong {m.title()} in the {house[m]}th removes 2 lakh doshas (book para 1977)",
                    "te": f"బలవంతుడైన పాపగ్రహం {house[m]}వ స్థానమున 2 లక్షల దోషములను హరించును (గ్రంథం 1977)"})
    return out


# A4 (21 Nov 2026): the doshas are judged over the whole lagna, not at the middle of each window.
_STATUS_RANK = {"fail": 5, "to_confirm": 4, "not_evaluated": 3, "excepted": 2, "pass": 1}


def _merge_lagna_rows(samples: List[Tuple[Tuple[datetime, datetime], List[Dict[str, Any]]]]) -> List[Dict[str, Any]]:
    """One row per dosha: its worst status over the lagna's pieces. A dosha failing in any piece fails the
    whole lagna, and its description says when it is present."""
    if not samples:
        return []
    out = []
    for first in samples[0][1]:
        did = first.get("id")
        worst, hits = first, []
        for span, rows in samples:
            r = next((x for x in rows if x.get("id") == did), None)
            if r is None:
                continue
            if r.get("status") == "fail":
                hits.append(span)
                if worst.get("status") != "fail":
                    worst = r
            elif _STATUS_RANK.get(r.get("status"), 0) > _STATUS_RANK.get(worst.get("status"), 0):
                worst = r
        worst = dict(worst)
        if hits and len(samples) > 1:
            when = ", ".join(f"{a:%H:%M}–{b:%H:%M}" for a, b in hits)
            worst["desc_en"] = f"{worst.get('desc_en') or ''} Present in this lagna at {when}.".strip()
            worst["desc_te"] = f"{worst.get('desc_te') or ''} ఈ లగ్నంలో {when} సమయంలో ఉంది.".strip()
        out.append(worst)
    return out


def _lagna_dosha_rows(lagna: LagnaWindow, panchang: Dict[str, Any], vaara_idx: int, cur_date: date,
                      tz_offset: float, place_obj, birth_details, base_ctx: Dict[str, Any],
                      cache: Optional[Dict[Any, Any]]) -> Optional[Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]]:
    """The 21 mahadoshas and 10 dashavidha doshas over the whole lagna (A4). The lagna is cut wherever the
    tithi, nakshatra, yoga or karana changes and each piece is checked at its middle. Cached per lagna, since
    every window in a lagna gets the same answer. None if the lagna could not be cut (caller falls back)."""
    key = (lagna.start, lagna.end)
    if cache is not None and key in cache:
        maha, dasha = cache[key]
        return [dict(r) for r in maha], [dict(r) for r in dasha]
    maha_samples, dasha_samples = [], []
    for s, e, lb in split_by_limbs(lagna.start, lagna.end, tz_offset):
        mid = s + (e - s) / 2
        d1, raw = compute_d1_positions(mid.date(), mid.hour + mid.minute / 60.0 + mid.second / 3600.0, place_obj)
        sp = dict(panchang)
        sp.update(lb.as_panchang_fields())
        sp["vaara_number"] = vaara_idx
        ctx = dict(base_ctx, jd=local_to_jd(mid, tz_offset), limbs=lb, window=(s, e),
                   hora_lord=_hora_lord(mid, panchang, cur_date, vaara_idx))
        maha_samples.append(((s, e), evaluate_21_maha_doshas(sp, d1, raw, lagna.lagna_idx, birth_details, context=ctx)))
        dasha_samples.append(((s, e), evaluate_10_dashavidha_doshas(sp, d1, raw, lagna.lagna_idx, birth_details, context=ctx)))
    if not maha_samples:
        return None
    result = (_merge_lagna_rows(maha_samples), _merge_lagna_rows(dasha_samples))
    if cache is not None:
        cache[key] = result
    return [dict(r) for r in result[0]], [dict(r) for r in result[1]]


# The four mahadoshas that depend on the navamsha rising (user, 21 Nov 2026, "at the muhurta's navamsha"):
# judged inside the muhurta, not over the whole lagna, and the muhurta is narrowed to the navamshas free of them.
# A navamsha lasts 10-17 minutes, so "anywhere in the 2-hour lagna" failed almost every window. Awaiting
# Dr. Nemani's confirmation (questionnaire E5); the other 17 mahadoshas stay judged over the whole lagna (A4).
NAVAMSHA_DOSHA_IDS = ("papa_shadvargamu", "kunavamshamu", "lagnastra_dosham", "gandantam")
_NAV_SPAN = 30.0 / 9.0
NAVAMSHA_MIN_MINUTES = 8          # a narrowed muhurta shorter than this is not offered (our choice)


def _navamsha_pieces(lagna: LagnaWindow, start: datetime, end: datetime, tz_offset: float,
                     lat: float, lon: float) -> List[Tuple[datetime, datetime]]:
    """[start, end] cut wherever the rising degree crosses into the next navamsha (bisection, ~1 s accuracy)."""
    from app.engines.limb_timeline import ascendant_at
    base = (lagna.lagna_idx - 1) * 30.0

    def risen(t: datetime) -> float:
        d = (ascendant_at(local_to_jd(t, tz_offset), lat, lon) - base) % 360.0
        return d if d <= 30.0 else (0.0 if d > 180.0 else 30.0)

    r_end = risen(end)
    cuts = [start]
    k = int(risen(start) // _NAV_SPAN) + 1
    while k < 9 and k * _NAV_SPAN < r_end:
        lo, hi = cuts[-1], end
        for _ in range(18):
            mid = lo + (hi - lo) / 2
            if risen(mid) >= k * _NAV_SPAN:
                hi = mid
            else:
                lo = mid
        cuts.append(hi)
        k += 1
    cuts.append(end)
    return [(a, b) for a, b in zip(cuts, cuts[1:]) if b > a]


def navamsha_doshas(lagna: LagnaWindow, start: datetime, end: datetime, limbs, panchang: Dict[str, Any],
                    vaara_idx: int, cur_date: date, tz_offset: float, place_obj, birth_details,
                    base_ctx: Dict[str, Any]) -> Tuple[Optional[Tuple[datetime, datetime]], List[Dict[str, Any]]]:
    """The four navamsha mahadoshas inside one muhurta window, navamsha by navamsha.
    Returns (the longest run of navamshas free of all four, or None if no run lasts NAVAMSHA_MIN_MINUTES;
    the four rows: as found in that run, else the worst over the whole window)."""
    samples = []
    for a, b in _navamsha_pieces(lagna, start, end, tz_offset, place_obj.latitude, place_obj.longitude):
        mid = a + (b - a) / 2
        d1, raw = compute_d1_positions(mid.date(), mid.hour + mid.minute / 60.0 + mid.second / 3600.0, place_obj)
        sp = dict(panchang)
        sp.update(limbs.as_panchang_fields())
        sp["vaara_number"] = vaara_idx
        ctx = dict(base_ctx, jd=local_to_jd(mid, tz_offset), limbs=limbs, window=(a, b),
                   hora_lord=_hora_lord(mid, panchang, cur_date, vaara_idx))
        rows = [r for r in evaluate_21_maha_doshas(sp, d1, raw, lagna.lagna_idx, birth_details, context=ctx)
                if r.get("id") in NAVAMSHA_DOSHA_IDS]
        clean = all(r.get("status") in ("pass", "not_applicable") for r in rows)
        samples.append(((a, b), rows, clean))
    best, run = None, []
    for item in samples + [None]:
        if item is not None and item[2]:
            run.append(item)
            continue
        if run and (best is None or run[-1][0][1] - run[0][0][0] > best[-1][0][1] - best[0][0][0]):
            best = run
        run = []
    if best and (best[-1][0][1] - best[0][0][0]) >= timedelta(minutes=NAVAMSHA_MIN_MINUTES):
        return (best[0][0][0], best[-1][0][1]), _merge_lagna_rows([(s, r) for s, r, _ in best])
    return None, _merge_lagna_rows([(s, r) for s, r, _ in samples])


# A5 (21 Nov 2026): three dashavidha doshas are the same as a mahadosha and are counted once, as the mahadosha.
DASHAVIDHA_SAME_AS_MAHA = {"yuti_dosham": (11, "Sagraha chandra", "సగ్రహ చంద్రుడు"),
                           "vedha_dosham": (17, "Ashubha viddha", "అశుభవిద్ధము"),
                           "ekargala_dosham": (13, "Kharjurika (Ekargala)", "ఖార్జూరిక (ఏకార్గళ)")}


def _mark_duplicates(dashavidha: List[Dict[str, Any]]) -> None:
    for r in dashavidha:
        same = DASHAVIDHA_SAME_AS_MAHA.get(r.get("id"))
        if same:
            num, en, te = same
            r["status"], r["is_pass"], r["severity"], r["counted_as"] = "not_applicable", True, "info", num
            r["desc_en"] = f"Counted once, as mahadosha {num} ({en})."
            r["desc_te"] = f"ఒకసారే లెక్కిస్తాం: మహాదోషం {num} ({te})."
