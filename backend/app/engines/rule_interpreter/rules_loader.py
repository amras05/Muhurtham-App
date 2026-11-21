"""
Rule files: find, merge (extends), validate, compile and list the muhurta rules.
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


RULES_ROOT = Path(__file__).resolve().parents[2] / "rules"    # app/rules (this file is app/engines/rule_interpreter/)

# In-memory caches
_RULES_CACHE: Dict[str, RuleDefinition] = {}
_COMPILED_CACHE: Dict[str, "CompiledRule"] = {}
_CATALOG_CACHE: Optional[List[Dict[str, Any]]] = None

VAARA_MAP = {
    0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
    4: "thursday", 5: "friday", 6: "saturday",
    "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3,
    "thursday": 4, "friday": 5, "saturday": 6,
}

# Kept for importers of the old constant (tithi index 1-30)
TITHI_RIKTA = [4, 9, 14, 19, 24, 29]


def _hms_to_hours(hms_str: Optional[str], default: float = 6.0) -> float:
    if not hms_str:
        return default
    try:
        parts = [float(p) for p in str(hms_str).split(":")]
        return parts[0] + (parts[1] / 60.0) + (parts[2] / 3600.0 if len(parts) > 2 else 0.0)
    except (TypeError, ValueError):
        return default


# ─────────────────────────────────────────────────────────────────────────────
# Rule loading and compilation
# ─────────────────────────────────────────────────────────────────────────────
def _rule_file(event_id: str) -> Optional[Path]:
    for category_dir in RULES_ROOT.iterdir():
        if category_dir.is_dir() and category_dir.name != "shared":
            candidate = category_dir / f"{event_id}.yaml"
            if candidate.exists():
                return candidate
    return None


def _deep_merge(base: Dict[str, Any], over: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base)
    for k, v in over.items():
        out[k] = _deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


# Keys a child event never inherits from the event it extends (they describe the event itself).
_OWN_KEYS = ("id", "title_en", "title_te", "description_en", "description_te", "tab", "also_in", "sub_group",
             "participants")


def resolve_raw_rule(event_id: str, _seen: Optional[Set[str]] = None) -> Optional[Dict[str, Any]]:
    """
    Raw rule dict with `extends:` applied: the child is deep-merged over its base, so a new event
    can reuse the book rules of an existing one and override only what differs.
    """
    path = _rule_file(event_id)
    if not path:
        return None
    with open(path, encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    raw.setdefault("category", path.parent.name)
    parent_id = raw.get("extends")
    if not parent_id:
        return raw
    seen = (_seen or set()) | {event_id}
    if parent_id in seen:
        raise ValueError(f"'{event_id}' extends '{parent_id}' in a loop")
    base = resolve_raw_rule(parent_id, seen)
    if base is None:
        raise ValueError(f"'{event_id}' extends unknown event '{parent_id}'")
    base_title = base.get("title_en", parent_id)
    base = {k: v for k, v in base.items() if k not in _OWN_KEYS}
    merged = _deep_merge(base, raw)
    note = f"Uses the rules of '{base_title}' until the author gives rules for this event."
    src = dict(merged.get("source") or {})
    src["notes"] = f"{note} {src.get('notes') or ''}".strip()
    merged["source"] = src
    return merged


def load_rule(event_id: str) -> Optional[RuleDefinition]:
    """Finds and loads a rule definition by its event_id across all category folders."""
    if event_id in _RULES_CACHE:
        return _RULES_CACHE[event_id]
    raw_data = resolve_raw_rule(event_id)
    if raw_data is None:
        return None
    rule_def = RuleDefinition(**raw_data)
    _RULES_CACHE[event_id] = rule_def
    return rule_def


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
                    raw = resolve_raw_rule(y_file.stem)
                    catalog.append({
                        "extends": raw.get("extends"),
                        "id": raw.get("id", y_file.stem),
                        "category": cat_dir.name,
                        "tab": raw.get("tab") or cat_dir.name,
                        "also_in": raw.get("also_in") or [],
                        "sub_group": raw.get("sub_group"),
                        "participants": participants_for(raw.get("participants"), raw.get("tab") or cat_dir.name,
                                                         raw.get("tab_inputs") or []),
                        "title_en": raw.get("title_en", y_file.stem),
                        "title_te": raw.get("title_te", ""),
                        "source_part": (raw.get("source") or {}).get("part"),
                        "source_section": (raw.get("source") or {}).get("section"),
                        "tab_inputs": raw.get("tab_inputs") or [],
                        "informational": bool(raw.get("informational", False)),
                        "description_en": raw.get("description_en", ""),
                        "description_te": raw.get("description_te", ""),
                        "alternatives": [{"id": k, "title_en": v.get("title_en", k), "title_te": v.get("title_te", "")}
                                         for k, v in (raw.get("alternatives") or {}).items()],
                    })
                except (OSError, yaml.YAMLError, AttributeError, ValueError) as ex:
                    logger.error(f"Skipping unreadable rule file {y_file}: {ex}")
                    continue

    _CATALOG_CACHE = catalog
    return catalog


COMBUST_ORB = {"moon": 12.0, "mars": 17.0, "mercury": 14.0, "jupiter": 11.0, "venus": 10.0, "saturn": 15.0}
PLANET_KEYS = {"sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu", "benefic", "malefic"}


class CompiledRule:
    """A RuleDefinition (or one of its alternatives) with every name resolved to exact indices."""

    def __init__(self, rule: RuleDefinition, variant: Optional[str] = None):
        if variant:
            if variant not in rule.alternatives:
                raise ValueError(f"Unknown variant '{variant}' for '{rule.id}'")
            hf = rule.alternatives[variant].hard_filters
        else:
            hf = rule.hard_filters
        self.rule = rule
        self.hf = hf
        self.variant = variant
        self.vaara_allow = {VAARA_MAP[v.lower()] for v in hf.vaara_allow or []}
        self.vaara_exclude = {VAARA_MAP[v.lower()] for v in hf.vaara_exclude or []}

        allow: Set[int] = set(tithi_token_set(hf.tithi_allow or []))
        for n in hf.tithi_numbers_both_paksha or []:
            allow |= {15, 30} if n == 15 else {n, n + 15}
        allow |= set(hf.tithi_shukla_numbers or [])
        allow |= {n + 15 for n in hf.tithi_krishna_numbers or []}
        self.tithi_allow = allow
        self.tithi_exclude = tithi_token_set(hf.tithi_exclude or [])

        self.nak_allow = nakshatra_set(hf.nakshatra_allow or [])
        self.nak_exclude = nakshatra_set(hf.nakshatra_exclude or [])
        self._check_names("nakshatra_allow", hf.nakshatra_allow, self.nak_allow)
        self._check_names("nakshatra_exclude", hf.nakshatra_exclude, self.nak_exclude)

        self.yoga_allow = yoga_set(hf.yoga_allow or [])
        self.yoga_exclude = yoga_set(hf.yoga_exclude or [])
        self.karana_allow = karana_set(hf.karana_allow or [])
        self.karana_exclude = karana_set(hf.karana_exclude or [])

        self.lagna_allow = {self._rasi(l) for l in hf.lagna_allow or []}
        self.lagna_exclude = {self._rasi(l) for l in hf.lagna_exclude or []}
        self.lagna_types = {t.lower() for t in hf.lagna_types or []}
        self.sun_sign_allow = {self._rasi(x) for x in hf.sun_sign_allow or []}
        self.sun_sign_exclude = {self._rasi(x) for x in hf.sun_sign_exclude or []}
        self.no_moudhya = [p.lower() for p in hf.no_moudhya or []]
        for p in self.no_moudhya:
            if p not in ("jupiter", "venus"):
                raise ValueError(f"no_moudhya: only jupiter and venus are supported, not '{p}'")
        self.masa_allow = {_masa(m) for m in hf.masa_allow or []}
        self.masa_exclude = {_masa(m) for m in hf.masa_exclude or []}
        self.masa_sun_exclude = [(_masa(r.masa), {self._rasi(x) for x in r.sun_signs}) for r in hf.masa_sun_exclude or []]
        self.not_combust = [p.lower() for p in hf.not_combust or []]
        for p in self.not_combust:
            if p not in COMBUST_ORB:
                raise ValueError(f"not_combust: unknown planet '{p}'")
        self.planet_rules = []
        for pr in hf.planet_rules or []:
            key = pr.planet.lower()
            if key not in PLANET_KEYS:
                raise ValueError(f"planet_rules: unknown planet '{pr.planet}'")
            for names in (pr.in_nakshatras, pr.not_in_nakshatras):
                self._check_names("planet_rules", names, set())
            self.planet_rules.append((key, set(pr.in_houses or []), set(pr.not_in_houses or []),
                                      {self._rasi(x) for x in pr.not_in_signs or []}, pr.soft_points, pr.note,
                                      nakshatra_set(pr.in_nakshatras or []), nakshatra_set(pr.not_in_nakshatras or [])))

        self.limbs_checked = [name for name, present in (
            ("vara", bool(self.vaara_allow or self.vaara_exclude)),
            ("tithi", bool(self.tithi_allow or self.tithi_exclude)),
            ("nakshatra", bool(self.nak_allow or self.nak_exclude)),
            ("yoga", bool(self.yoga_allow or self.yoga_exclude)),
            ("karana", bool(self.karana_allow or self.karana_exclude)),
        ) if present]

    @staticmethod
    def _rasi(name: str) -> int:
        idx = RASI_INDEX.get(norm_key(name))
        if not idx:
            raise ValueError(f"Unknown lagna '{name}'")
        return idx

    @staticmethod
    def _check_names(field: str, names, _resolved: Set[int]) -> None:
        for n in names or []:
            s = str(n).lower()
            if s.startswith("group:") or norm_key(s) in ("abhijit", "abhijith"):
                continue
            if not nakshatra_set([n]):
                raise ValueError(f"Unknown nakshatra '{n}' in {field}")


def compile_rule(event_id: str, variant: Optional[str] = None) -> Optional[CompiledRule]:
    key = f"{event_id}::{variant or ''}"
    if key in _COMPILED_CACHE:
        return _COMPILED_CACHE[key]
    rule = load_rule(event_id)
    if not rule:
        return None
    compiled = CompiledRule(rule, variant)
    for alt in rule.alternatives:
        if variant is None:
            CompiledRule(rule, alt)  # validate every alternative when the rule is first used
    _COMPILED_CACHE[key] = compiled
    return compiled


LUNAR_MONTH_INDEX = {"chaitra": 1, "vaishakha": 2, "vaisakha": 2, "jyeshtha": 3, "ashadha": 4, "shravana": 5,
                     "bhadrapada": 6, "ashwina": 7, "ashwayuja": 7, "kartika": 8, "margashira": 9,
                     "margasira": 9, "pushya": 10, "pausha": 10, "magha": 11, "phalguna": 12}
# Shunya masa: Sun sign that makes the lunar month shunya (plan M1 3.8)
SHUNYA_MASA = {1: 12, 4: 3, 6: 6, 10: 9}  # Chaitra/Meena, Ashadha/Mithuna, Bhadrapada/Kanya, Pushya/Dhanus


def _masa(key: str) -> int:
    idx = LUNAR_MONTH_INDEX.get(norm_key(key))
    if not idx:
        raise ValueError(f"Unknown lunar month '{key}'")
    return idx
