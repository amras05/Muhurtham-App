"""
Pushkara navamsha / bhaga and amsha inside a window; lagna clipped to a window.
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


# The book's two lagna strengths (paras 1180-81): pushkaramsha and vargottama. "Shubhamsha" is not a
# book term and is not used (11 Nov 2026).
AMSHA_NAMES = {"pushkara": ("Pushkaramsha", "పుష్కరాంశ"), "vargottama": ("Vargottamamsha", "వర్గోత్తమాంశ"),
               "none": ("Ordinary amsha", "సామాన్య అంశ")}


def window_amsha(start: datetime, end: datetime, tz_offset: float, lat: float, lon: float) -> Dict[str, Any]:
    """The best navamsa the lagna passes through inside the window, and when (11 Nov 2026).
    Pushkaramsha (book para 1181) > Vargottamamsha (navamsa = lagna sign, para 1180).
    A navamsa lasts about 13 minutes, so the window is checked every 2 minutes."""
    from app.engines.limb_timeline import ascendant_at
    rank = {"pushkara": 2, "vargottama": 1, "none": 0}
    best = ("none", start, None)
    t = start + timedelta(minutes=1)
    while t < end:
        asc = ascendant_at(local_to_jd(t, tz_offset), lat, lon)
        nav, rasi = get_navamsa_sign(asc), int(asc // 30) + 1
        kind = "pushkara" if _in_pushkara(asc) else "vargottama" if nav == rasi else "none"
        if rank[kind] > rank[best[0]]:
            best = (kind, t, nav)
            if kind == "pushkara":
                break
        t += timedelta(minutes=2)
    kind, at, nav = best
    return {"type": kind, "name_en": AMSHA_NAMES[kind][0], "name_te": AMSHA_NAMES[kind][1],
            "at": at.strftime("%H:%M") if kind != "none" else None,
            "navamsa": RASI_NAMES_EN[nav] if nav else None}


def window_pushkara(lagna: LagnaWindow, start: datetime, end: datetime, tz_offset: float,
                    lat: float, lon: float) -> Dict[str, Any]:
    """Whether this muhurta window holds the pushkara navamsha and the pushkara bhaga (Parishilana, 21 Nov
    2026). Navamsha: the exact spans already worked out for the lagna, clipped to the window. Bhaga: the moment
    the rising degree reaches the sign's pushkara bhaga degree (PUSHKARA_BHAGA_DEGS), found by bisection, and the
    span within 1.5 degrees of it (the same tolerance as the day's pushkara box)."""
    from app.core.constants import PUSHKARA_BHAGA_DEGS
    nav = [{"start": a.strftime("%H:%M"), "end": b.strftime("%H:%M"), "navamsa": n}
           for a, b, n in (lagna.pushkara_spans or []) if min(b, end) > max(a, start)]
    target = PUSHKARA_BHAGA_DEGS.get(lagna.lagna_idx - 1, 15.0)
    bhaga = {"degree": target, "in_window": False, "at": None, "span": None}
    try:
        at, a, b = _bhaga_moments(lagna.start, lagna.end, lagna.lagna_idx, tz_offset, lat, lon)
        if at is not None:
            bhaga.update(at=at.strftime("%H:%M"), span=f"{a:%H:%M}–{b:%H:%M}",
                         in_window=start <= at <= end, touches_window=min(b, end) > max(a, start))
    except (ValueError, TypeError) as ex:
        logger.error(f"Pushkara bhaga not worked out for {lagna.start:%Y-%m-%d %H:%M}: {ex}")
    return {"navamsha": {"in_window": bool(nav), "spans": nav}, "bhaga": bhaga}


@lru_cache(maxsize=2048)
def _bhaga_moments(l_start: datetime, l_end: datetime, lagna_idx: int, tz_offset: float, lat: float,
                   lon: float) -> Tuple[Optional[datetime], Optional[datetime], Optional[datetime]]:
    """(exact pushkara bhaga moment, start and end of the +-1.5 degree span) for one lagna. Depends only on the
    lagna, so it is worked out once per lagna, not once per window (21 Nov 2026, speed)."""
    from app.core.constants import PUSHKARA_BHAGA_DEGS
    from app.engines.limb_timeline import ascendant_at
    base = (lagna_idx - 1) * 30.0
    target = PUSHKARA_BHAGA_DEGS.get(lagna_idx - 1, 15.0)

    def risen(t: datetime) -> float:           # degrees risen inside the lagna sign, clamped to 0-30
        d = (ascendant_at(local_to_jd(t, tz_offset), lat, lon) - base) % 360.0
        return d if d <= 30.0 else (0.0 if d > 180.0 else 30.0)

    r_lo, r_hi = risen(l_start), risen(l_end)

    def moment(deg: float) -> Optional[datetime]:
        if r_lo >= deg or r_hi < deg:          # reached before the lagna's start here (e.g. at sunrise) or never
            return None
        lo, hi = l_start, l_end
        for _ in range(20):
            mid = lo + (hi - lo) / 2
            if risen(mid) >= deg:
                hi = mid
            else:
                lo = mid
        return hi

    at = moment(target)
    if at is None:
        return None, None, None
    return at, moment(max(0.0, target - 1.5)) or l_start, moment(min(30.0, target + 1.5)) or l_end


def lagna_for_window(lagna: LagnaWindow, start: datetime, end: datetime) -> LagnaWindow:
    """This lagna as seen by one window: pushkara navamsa only if the window overlaps an exact span (plan R6a)."""
    spans = [(max(a, start), min(b, end), nav) for a, b, nav in (lagna.pushkara_spans or []) if min(b, end) > max(a, start)]
    return dataclasses.replace(lagna, is_pushkara_navamsa=bool(spans), pushkara_spans=spans)


def pushkara_text(lagna: LagnaWindow, with_sign: bool = True) -> str:
    """'10:42–10:55 (Tula navamsa)' for the pushkara minutes inside a window ('' if none)."""
    return ", ".join(f"{a.strftime('%H:%M')}–{b.strftime('%H:%M')}" + (f" ({nav} navamsa)" if with_sign else "")
                     for a, b, nav in (lagna.pushkara_spans or []))
