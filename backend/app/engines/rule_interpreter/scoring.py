"""
How the percentage is made (A8): which dosha sets count, their weights, share of checks passed.
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


# Dr. Nemani via the user (dosha questionnaire A1/A2, 21 Nov 2026): the 21 mahadoshas are checked for every
# muhurta; the 10 dashavidha doshas only for marriage (the same events that use the pancha-shalaka chakra).
DASHAVIDHA_EVENTS = {"vivaha", "dvitiya_vivaha", "nutana_vadhu_pravesha"}
# A8 (21 Nov 2026): percentage = panchanga shuddhi 30% + mahadoshas 70%; where the dashavidha doshas are
# checked, 30 / 60 / 10. The dashavidha share is taken out of the mahadosha share.
PANCHANGA_WEIGHT, DASHAVIDHA_WEIGHT = 30, 10


def default_dosha_sets(event_id: str) -> Tuple[bool, bool]:
    """(mahadoshas checked, dashavidha checked) for an event before any Settings override."""
    return True, event_id in DASHAVIDHA_EVENTS


def dosha_scoring_for(rule, common) -> Dict[str, Any]:
    """Which dosha sets count in this event's score, and how (Settings › Finder › Doshas).
    Layers: the ruling default (default_dosha_sets), then the category, then the event's own override.
    The rule files' mahadoshas_21 / dashavidha_10 flags no longer decide this (A1/A2, 21 Nov 2026)."""
    maha, dasha = default_dosha_sets(rule.id)
    weight, cap, main_weight = 70, 49, 70
    p_weight, d_weight = PANCHANGA_WEIGHT, DASHAVIDHA_WEIGHT
    try:
        from app.auth.app_settings import get_setting
        s = get_setting("dosha_scoring") or {}
        weight, cap = int(s.get("dasha_weight", weight)), int(s.get("dasha_cap", cap))
        main_weight = int(s.get("main_weight", main_weight))
        p_weight = int(s.get("panchanga_weight", p_weight))
        d_weight = int(s.get("dashavidha_weight", d_weight))
        for layer in ((s.get("tabs") or {}).get(rule.tab or rule.category), (s.get("events") or {}).get(rule.id)):
            if not isinstance(layer, dict):
                continue
            if layer.get("mahadoshas") in ("on", "off"):
                maha = layer["mahadoshas"] == "on"
            if layer.get("dashavidha") in ("on", "off"):
                dasha = layer["dashavidha"] == "on"
    except Exception as ex:   # settings unreadable: the ruling defaults and 30 / 70 (30 / 60 / 10)
        logger.warning(f"Dosha scoring setting unavailable, using defaults: {type(ex).__name__}")
    p_weight = max(0, min(100, p_weight))
    d_weight = max(0, min(100 - p_weight, d_weight))
    return {"mahadoshas": maha, "dashavidha": dasha, "weight": max(0, min(100, weight)), "cap": max(5, min(98, cap)),
            "main_weight": max(0, min(100, main_weight)),
            "panchanga_weight": p_weight, "dashavidha_weight": d_weight}


def _share(rows: List[Dict[str, Any]]) -> Optional[float]:
    """0-1: the share of checks passed (user, 21 Nov 2026; replaced +10/-10, where each fail cancelled a
    pass). An "excepted" dosha (cancelled by a parihara) counts as passed; "to be confirmed" is left out."""
    rows = [d for d in rows if d["status"] in ("pass", "fail", "excepted")]
    if not rows:
        return None
    return sum(1 for d in rows if d["status"] in ("pass", "excepted")) / len(rows)
