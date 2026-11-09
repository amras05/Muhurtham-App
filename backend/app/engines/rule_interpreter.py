"""
Generic Declarative Rule Interpreter Engine (Layer 3).
Loads YAML rules from backend/app/rules/{category}/{event_id}.yaml and evaluates them
against the muhurta timeline (plan M21 pipeline):

  1. Build each day's lagna windows, split wherever tithi, nakshatra, yoga, karana or
     Moon rashi changes, so every segment is judged by the limbs running at that time.
  2. Apply the event's hard filters (vara, tithi, nakshatra, yoga, karana, lagna, houses,
     panchaka, participant balas).
  3. Subtract the bad periods the rule asks to avoid (Rahu, Yama, Gulika, Durmuhurta,
     and varjyam from the book's ghati table).
  4. Evaluate the 21 Mahadoshas and 10 Dashavidha doshas for each remaining window.
     Strict: a failed 'fatal' Mahadosha excludes the window. Lenient: it is kept with
     a visible warning and a score penalty.
  5. Score, attach the reason trail, rank.
"""
from collections import Counter
import dataclasses
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import re

import yaml

from app.core.logging import logger
from app.engines.lagna_scanner import RASI_NAMES_EN, LagnaWindow, evaluate_house_rules, scan_day_lagnas
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
    DOSHIC_YOGAS, INAUSPICIOUS_KARANAS, NAKSHATRA_CANONICAL, RASI_INDEX, karana_set, nakshatra_set,
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

RULES_ROOT = Path(__file__).resolve().parent.parent / "rules"

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
VARNESHA = {"brahmana": ("jupiter", "venus"), "kshatriya": ("sun", "mars"), "vaishya": ("moon",)}
VEDADHIPATI = {"rig": "jupiter", "yajur": "venus", "sama": "mars", "atharva": "mercury"}
DEBILITATION = {"sun": 7, "moon": 8, "mars": 4, "mercury": 12, "jupiter": 10, "venus": 6, "saturn": 1}
GURU_BALA_VATU_BAD = {4, 8, 12}


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


def _upanayana_strength(planets: Dict[str, Any], ap: Dict[str, Any]) -> Tuple[bool, List[str]]:
    notes: List[str] = []
    varna = (ap.get("varna") or "").lower()
    for pname in VARNESHA.get(varna, ()):
        why = _planet_weak(pname, planets)
        if why:
            return False, [f"Varnesha weak: {why}"]
        notes.append(f"Varnesha {pname.title()} is strong")
    shakha = (ap.get("veda_shakha") or "").lower()
    if shakha in VEDADHIPATI:
        why = _planet_weak(VEDADHIPATI[shakha], planets)
        if why:
            return False, [f"Vedadhipati weak: {why}"]
        notes.append(f"Vedadhipati {VEDADHIPATI[shakha].title()} is strong")
    vatu_rasi, jup = ap.get("vatu_rasi_idx"), planets.get("jupiter")
    if vatu_rasi and jup:
        house = (int(jup.longitude // 30) + 1 - int(vatu_rasi)) % 12 + 1
        if house in GURU_BALA_VATU_BAD:
            return False, [f"Guru bala for the vatu: Jupiter is {house}th from the vatu's rashi"]
        notes.append(f"Guru bala for the vatu: Jupiter {house}th from the rashi")
    return True, notes


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


# ── Dr. Nemani's rulings (plan B1, 9 Nov 2026) ─────────────────────────────────────
# 1. The 21 mahadoshas are never allowed, for any event: a failed one is always fatal and no
#    category exemption softens it (Strict drops the window; Lenient shows it only as "why not").
# 2. Other doshas are allowed when Jupiter is in the muhurta lagna: a failed dashavidha dosha is
#    then "excepted". Whether this also covers the extra checks and doshic yogas, and whether a
#    combust or debilitated Jupiter still counts, is still to be confirmed by him.
AUTHOR_NOTE_EN = "Excepted: Jupiter is in the muhurta lagna (Dr. Nemani's ruling)."
# Option A (9 Nov 2026): checks whose coded reading may be broader than the book. They are shown as
# "To be confirmed" but do not block a window or count as a mahadosha until Dr. Nemani confirms.
TO_CONFIRM = {"papa_shadvargamu": ("To be confirmed by Dr. Nemani: our reading fails if any one of the six varga lords is weak.",
                                   "డా. నేమాని గారు నిర్ధారించాలి: ఆరు వర్గాధిపతుల్లో ఒక్కరు బలహీనంగా ఉన్నా దోషంగా తీసుకున్నాము.")}
AUTHOR_NOTE_TE = "మినహాయింపు: ముహూర్త లగ్నంలో గురుడు ఉన్నాడు (డా. నేమాని గారి నిర్ణయం)."


def apply_author_severity(maha: List[Dict[str, Any]], dashavidha: List[Dict[str, Any]], lagna: LagnaWindow):
    jupiter = any(p.name_en == "Jupiter" for p in (lagna.house_planets or {}).get(1, []))
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
            r.pop("exemption", None)          # no exemption for a mahadosha
        maha_out.append(r)
    dash_out = []
    for r in dashavidha:
        r = dict(r)
        if r.get("status") == "fail" and jupiter:
            r["status"] = "excepted"
            r["severity"] = "info"
            r["excepted_by"] = "jupiter_in_lagna"
            for k, note in (("desc_en", AUTHOR_NOTE_EN), ("desc_te", AUTHOR_NOTE_TE)):
                r[k] = f"{r.get(k) or ''} {note}".strip()
        dash_out.append(r)
    return maha_out, dash_out, jupiter


def dosha_audit(maha: List[Dict[str, Any]], dashavidha: List[Dict[str, Any]], others: List[Dict[str, Any]],
                jupiter_in_lagna: bool) -> Dict[str, Any]:
    """The banner and colour: red = a mahadosha fails; amber = something excepted or a lesser dosha;
    green = nothing failed."""
    def count(rows, status):
        return sum(1 for r in rows if r.get("status") == status)
    maha_fail, dash_fail = count(maha, "fail"), count(dashavidha, "fail")
    excepted = [r.get("name_en") for r in dashavidha if r.get("status") == "excepted"]
    other_fail = count(others, "fail")
    to_confirm = [r.get("name_en") for r in maha if r.get("status") == "to_confirm"]
    colour = "red" if maha_fail else ("amber" if (dash_fail or excepted or other_fail or to_confirm) else "green")
    return {
        "colour": colour,
        "mahadosha": {"total": 21, "failed": maha_fail, "not_evaluated": count(maha, "not_evaluated"), "checked": bool(maha)},
        "dashavidha": {"total": 10, "failed": dash_fail, "excepted": len(excepted), "not_evaluated": count(dashavidha, "not_evaluated"),
                       "checked": bool(dashavidha)},
        "other_failed": other_fail,
        "excepted": excepted,
        "to_confirm": to_confirm,
        "jupiter_in_lagna": jupiter_in_lagna,
    }


def lagna_for_window(lagna: LagnaWindow, start: datetime, end: datetime) -> LagnaWindow:
    """This lagna as seen by one window: pushkara navamsa only if the window overlaps an exact span (plan R6a)."""
    spans = [(max(a, start), min(b, end), nav) for a, b, nav in (lagna.pushkara_spans or []) if min(b, end) > max(a, start)]
    return dataclasses.replace(lagna, is_pushkara_navamsa=bool(spans), pushkara_spans=spans)


def pushkara_text(lagna: LagnaWindow, with_sign: bool = True) -> str:
    """'10:42–10:55 (Tula navamsa)' for the pushkara minutes inside a window ('' if none)."""
    return ", ".join(f"{a.strftime('%H:%M')}–{b.strftime('%H:%M')}" + (f" ({nav} navamsa)" if with_sign else "")
                     for a, b, nav in (lagna.pushkara_spans or []))


def evaluate_window_for_rule(
    cr: CompiledRule,
    lagna: LagnaWindow,
    limbs: Limbs,
    vaara_idx: int,
    birth_details: Optional[Dict[str, Any]] = None,
    panchaka_method: str = "standard",
    activity_params: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, int, List[str], List[str]]:
    """
    Evaluates one lagna segment against the compiled rule.
    Returns (is_passed, score, rules_passed, reasons_failed).
    """
    hf = cr.hf
    sc = cr.rule.soft_scoring
    passed: List[str] = []
    score = 0
    vaara_str = VAARA_MAP[vaara_idx]

    def fail(msg: str):
        return False, 0, [], [msg]

    # 1. Vara (the day's weekday, sunrise to sunrise)
    if vaara_idx in cr.vaara_exclude:
        return fail(f"{vaara_str.title()} is excluded for this event")
    if cr.vaara_allow and vaara_idx not in cr.vaara_allow:
        return fail(f"{vaara_str.title()} is not an allowed weekday")
    passed.append(f"Weekday ({vaara_str.title()}) is acceptable")

    # 2. Tithi (at this time)
    t_label = f"{limbs.tithi_name} ({limbs.paksha.title()})"
    if limbs.tithi in cr.tithi_exclude:
        return fail(f"Tithi {t_label} is excluded")
    if cr.tithi_allow and limbs.tithi not in cr.tithi_allow:
        return fail(f"Tithi {t_label} is not an allowed tithi")
    passed.append(f"Tithi {t_label} is acceptable")

    # 3. Nakshatra
    if limbs.nakshatra in cr.nak_exclude:
        return fail(f"Nakshatra {limbs.nakshatra_name} is excluded")
    if cr.nak_allow and limbs.nakshatra not in cr.nak_allow:
        return fail(f"Nakshatra {limbs.nakshatra_name} is not an allowed nakshatra")
    passed.append(f"Nakshatra {limbs.nakshatra_name} (pada {limbs.pada}) is acceptable")

    # 4. Yoga
    if limbs.yoga in cr.yoga_exclude:
        return fail(f"Yoga {limbs.yoga_name} is excluded")
    if cr.yoga_allow and limbs.yoga not in cr.yoga_allow:
        return fail(f"Yoga {limbs.yoga_name} is not an allowed yoga")

    # 5. Karana
    if limbs.karana in cr.karana_exclude:
        return fail(f"Karana {limbs.karana_name} is excluded")
    if cr.karana_allow and limbs.karana not in cr.karana_allow:
        return fail(f"Karana {limbs.karana_name} is not an allowed karana")

    # 5a. Dagdha tithi and waning-Moon Monday
    if hf.exclude_dagdha_tithi:
        from app.engines.doshas import _DAGDHA_BY_SUN_SIGN
        if limbs.tithi_number == _DAGDHA_BY_SUN_SIGN[limbs.sun_rasi]:
            return fail(f"{limbs.tithi_name} is the dagdha tithi for this solar month")
    if hf.monday_needs_waxing_moon and vaara_idx == 1 and not limbs.moon_waxing:
        return fail("Monday with a waning Moon")

    # 5b. Person's own janma nakshatra
    if hf.exclude_janma_nakshatra and birth_details and birth_details.get("janma_nak_idx") == limbs.nakshatra:
        return fail(f"{limbs.nakshatra_name} is the person's own janma nakshatra")

    if hf.exclude_janma_counts and birth_details and birth_details.get("janma_nak_idx"):
        cnt = (limbs.nakshatra - int(birth_details["janma_nak_idx"])) % 27 + 1
        if cnt in hf.exclude_janma_counts:
            return fail(f"{limbs.nakshatra_name} is count {cnt} from the janma nakshatra (avoided)")

    # 5c. Sun sign (ayana / solar month)
    if limbs.sun_rasi in cr.sun_sign_exclude:
        return fail("The Sun's sign is excluded for this event")
    if cr.sun_sign_allow and limbs.sun_rasi not in cr.sun_sign_allow:
        return fail("The Sun's sign is outside the allowed months (e.g. not Uttarayana)")

    # 6. Lagna
    if cr.lagna_types and lagna.mobility.lower() not in cr.lagna_types:
        return fail(f"{lagna.lagna_name_en} lagna ({lagna.mobility}) is not an allowed lagna type")
    if cr.lagna_allow and lagna.lagna_idx not in cr.lagna_allow:
        return fail(f"{lagna.lagna_name_en} is not an allowed lagna")
    if lagna.lagna_idx in cr.lagna_exclude:
        return fail(f"{lagna.lagna_name_en} lagna is excluded")

    # 7. House occupancy (e.g. ashtama shuddhi)
    if hf.house_rules:
        h_pass, h_reasons = evaluate_house_rules(lagna, hf.house_rules)
        if not h_pass:
            failing = [r for r in h_reasons if "must be empty" in r or "contains malefics" in r]
            return False, 0, [], failing or h_reasons
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
            return fail(msg + (f" ({note})" if note else ""))
        if msg:
            passed.append(msg)
    moon = planets.get("moon")
    if hf.moon_free_of_malefics and moon:
        with_moon = [p.name_en for p in planets.values() if p.is_malefic and p.rasi_idx == moon.rasi_idx]
        if with_moon:
            return fail(f"Moon is with malefic(s): {', '.join(with_moon)}")
        passed.append("Moon is free of malefics")
    if hf.mars_saturn_not_opposed and planets.get("mars") and planets.get("saturn"):
        if (planets["mars"].rasi_idx - planets["saturn"].rasi_idx) % 12 == 6:
            return fail("Mars and Saturn are in mutual 7th")
    if hf.travel_checks:
        ok_t, msg_t = _travel_check(limbs, vaara_idx, planets, activity_params or {})
        if not ok_t:
            return fail(msg_t)
        if msg_t:
            passed.append(msg_t)
        purpose = (activity_params or {}).get("travel_purpose")
        if purpose in TRAVEL_PURPOSE_LAGNAS and lagna.lagna_idx in TRAVEL_PURPOSE_LAGNAS[purpose]:
            score += 3
            passed.append(f"Lagna suits the purpose ({purpose}) (+3)")
    if hf.upanayana_strength:
        ok_u, notes_u = _upanayana_strength(planets, activity_params or {})
        if not ok_u:
            return fail(notes_u[0])
        passed.extend(notes_u)
    sun = planets.get("sun")
    for pname in cr.not_combust:
        p = planets.get(pname)
        if sun and p:
            dist = abs((p.longitude - sun.longitude + 180.0) % 360.0 - 180.0)
            if dist <= COMBUST_ORB[pname]:
                return fail(f"{p.name_en} is combust ({dist:.1f}° from the Sun)")
            passed.append(f"{p.name_en} is not combust")

    # 8. Panchaka rahita
    if hf.common.panchaka_rahita:
        p_res = evaluate_panchaka(limbs.tithi_number, vaara_idx, limbs.nakshatra, lagna.lagna_idx,
                                  method=panchaka_method, tithi_30=limbs.tithi)
        if not p_res["is_pass"]:
            return fail(f"Panchaka: {p_res['name_en']} ({p_res['effect_en']})")
        passed.append(f"Panchaka rahita: {p_res['name_en']}")

    # 9. Participant balas
    if birth_details:
        if birth_details.get("janma_nak_idx"):
            tb = evaluate_tarabala(limbs.nakshatra, birth_details["janma_nak_idx"])
            if not tb["is_pass"]:
                return fail(f"Tarabala failed: {tb['name_en']} tara (navaka {tb['navaka']})")
            passed.append(f"Tarabala: {tb['name_en']} tara")
            score += 3
        if birth_details.get("janma_moon_rasi_idx"):
            cb = evaluate_chandrabala(limbs.moon_rasi, birth_details["janma_moon_rasi_idx"])
            if not cb["is_pass"]:
                return fail(f"Chandrabala failed: {cb['verdict_en']}")
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


# ─────────────────────────────────────────────────────────────────────────────
# Search
# ─────────────────────────────────────────────────────────────────────────────
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
    strictness: str = "strict",
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
    strict = (strictness or "strict").lower() == "strict"

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

    ap = activity_params or {}
    warnings: List[str] = []
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
            warnings.append(_age_allowed(hf.age_rule, None, None, start_date)[1])

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

        if hf.age_rule and age_ref is not None:
            ok_age, why_age = _age_allowed(hf.age_rule, age_ref, ap.get("child_gender"), cur_date)
            if not ok_age:
                rejections["Outside the age window"] += 1
                continue

        # 1. Day panchang (sunrise snapshot: vara, kalas, display values)
        panchang = compute_day_panchang(
            cur_date.year, cur_date.month, cur_date.day,
            lat, lon, tz_offset, place_name, hour=6.0
        )
        sr_h = _hms_to_hours(panchang.get("sunrise"), default=6.0)
        vaara_idx = VAARA_MAP.get(str(panchang.get("vaara", "")).lower().strip(), 0)
        day_start = base_dt + timedelta(hours=sr_h)
        day_end = day_start + timedelta(hours=24)
        sunset_dt = base_dt + timedelta(hours=_hms_to_hours(panchang.get("sunset"), default=18.0))

        day_reject = _day_level_reject(cr, panchang, cur_date, ap, tz_offset)
        if day_reject:
            rejections[day_reject] += 1
            continue

        # 2. Bad periods. Every type is computed for the dosha checks; only the ones
        #    the rule asks to avoid are subtracted from the windows.
        all_kalas = extract_inauspicious_windows(panchang, base_dt)
        varjyam = [TimeWindow(start=v["start"], end=v["end"], label=f"Varjyam ({v['nakshatra']})",
                              metadata={"type": "varjyam"})
                   for v in varjyam_windows(day_start, day_end, tz_offset)]
        avoid = {"rahu": common.avoid_rahu_kalam, "yama": common.avoid_yamagandam,
                 "gulika": common.avoid_gulika, "durmuhurta": common.avoid_durmuhurta,
                 "varjyam": common.avoid_varjyam}
        blocked = [w for w in all_kalas + varjyam if avoid.get(w.metadata.get("type"), True)]
        blocked += _day_periods(hf.exclude_periods, day_start, sunset_dt)
        durmuhurta_spans = [(w.start, w.end) for w in all_kalas if w.metadata.get("type") == "durmuhurta"]
        varjyam_spans = [(w.start, w.end) for w in varjyam]

        # 3. Lagnas across the day
        lagnas = scan_day_lagnas(cur_date.year, cur_date.month, cur_date.day, lat, lon, tz_offset, sr_h)

        pushkara_info = compute_pushkara_window(
            cur_date, lat, lon, tz_offset, place_name, panchang,
            birth_lagna_idx=b_rasi_idx, birth_place_obj=place_obj
        )
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
                ok, score, rules_passed, why = evaluate_window_for_rule(
                    cr, seg_lagna, limbs, vaara_idx, birth_details, panchaka_method, ap
                )
                if ok:
                    for who, nidx in extra_taras:
                        tb = evaluate_tarabala(limbs.nakshatra, nidx)
                        if not tb["is_pass"]:
                            ok, why = False, [f"Tarabala failed for the {who}: {tb['name_en']} tara"]
                            break
                        rules_passed.append(f"Tarabala for the {who}: {tb['name_en']}")
                if not ok:
                    rejections[_reason_key(why[0]) if why else "hard filter"] += 1
                    continue

                seg = TimeWindow(start=seg_start, end=seg_end, label=f"{lagna.lagna_name_en} Lagna")
                clean_windows = subtract_blocked_intervals([seg], blocked, min_duration_minutes=min_window_minutes)
                if not clean_windows:
                    rejections["Covered by Rahu / Yama / Gulika / Durmuhurta / Varjyam"] += 1

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
                        extras={"blocked": blocked, "lat": lat, "lon": lon, "people": people or []},
                    )
                    if cand is None:
                        continue
                    candidates.append(cand)
                    results.append(_window_summary(cand, cw_lagna, rule, cw_score))

    sorted_candidates = sorted(candidates, key=lambda x: (-x["percentage"], x["date"], x["window_start"]))
    sorted_results = sorted(results, key=lambda x: (-x.get("percentage", 0), x["date"], x["start_time"]))

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
        "window": (cw.start, cw.end),
        "lagna_window": (lagna.start, lagna.end),
        "varjyam": varjyam_spans,
        "durmuhurta": durmuhurta_spans,
        "tz_offset": tz_offset,
        "category": rule.category,
        "kartari": _kartari_mode(rule),
        "limbs": limbs,
        "limbs_checked": cr.limbs_checked,
        "participants": participants,
    }
    common = cr.hf.common
    maha_doshas = evaluate_21_maha_doshas(seg_panchang, d1_positions, raw_d1, lagna.lagna_idx, birth_details, context=ctx)
    dashavidha = evaluate_10_dashavidha_doshas(seg_panchang, d1_positions, raw_d1, lagna.lagna_idx, birth_details, context=ctx)
    pariharas = evaluate_muhurta_pariharas(seg_panchang, raw_d1, lagna.lagna_idx,
                                           birth_details=birth_details, pushkara_info=pushkara_info)

    # Category dosha profile (severity overrides, doshapavada), special yogas and list C checks.
    tab = rule.tab or rule.category
    active_pids = [pr.get("id") for pr in pariharas if pr.get("id")]
    maha_doshas = apply_dosha_profile(maha_doshas, tab, rule.id, active_pids, not strict)
    dashavidha = apply_dosha_profile(dashavidha, tab, rule.id, active_pids, not strict)
    maha_doshas, dashavidha, jupiter_in_lagna = apply_author_severity(maha_doshas, dashavidha, lagna)
    good_yogas, yoga_doshas, yoga_points = evaluate_yogas(vaara_idx, limbs.tithi, limbs.nakshatra, tab, rule.id)
    jd_mid = local_to_jd(mid_dt, tz_offset)
    day_sunrise = datetime(cur_date.year, cur_date.month, cur_date.day) + timedelta(
        hours=_hms_to_hours(panchang.get("sunrise"), default=6.0))
    sr_jd = local_to_jd(day_sunrise, tz_offset)
    extra = extra_checks(tab, rule.id, limbs.tithi, tithi_bounds(jd_mid), local_to_jd(cw.start, tz_offset),
                         [sr_jd - 1.0, sr_jd, sr_jd + 1.0, sr_jd + 2.0], lagna.house_planets)
    score += yoga_points

    checked = []
    if common.mahadoshas_21:
        checked += maha_doshas
    if common.dashavidha_10:
        checked += dashavidha
    checked += yoga_doshas + extra
    failed = [d for d in checked if d["status"] == "fail"]
    fatal = [d for d in failed if d["severity"] == "fatal"]
    audit = dosha_audit(maha_doshas if common.mahadoshas_21 else [], dashavidha if common.dashavidha_10 else [],
                        yoga_doshas + extra, jupiter_in_lagna)
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
    pct = score * 10 - 12 * len(serious) - 25 * len(fatal) + (10 if lagna.is_pushkara_navamsa else 0) + 50
    pct = int(min(98, max(5, pct)))
    # Soft points must not lift a window with a serious dosha to "best", or a fatal one
    # (kept only in Lenient mode) above "avoid".
    if fatal:
        pct = min(pct, 49)
    elif serious:
        pct = min(pct, 74)
    if sula_check and sula_check.get("has_sula"):
        pct = min(pct, 40)
    verdict = "ఉత్తమ ముహూర్తం" if pct >= 75 else ("మధ్యమ ముహూర్తం" if pct >= 50 else "నిషిద్ధం")

    planets_in_1 = [p.name_en for p in lagna.house_planets.get(1, [])]
    tithi_disp = f"{limbs.tithi_name} ({limbs.paksha.title()})"
    detailed_eval = {
        "vaara": {"name": panchang.get("vaara"), "is_pass": True},
        "tithi": {"name": limbs.tithi_name, "number": limbs.tithi_number, "paksha": limbs.paksha, "is_pass": True},
        "nakshatra": {"name": limbs.nakshatra_name, "pada": limbs.pada, "is_pass": True},
        "yoga": {"name": limbs.yoga_name, "index": limbs.yoga, "is_pass": limbs.yoga not in DOSHIC_YOGAS},
        "karana": {"name": limbs.karana_name, "is_pass": limbs.karana not in INAUSPICIOUS_KARANAS},
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
        "dashavidha_enforced": common.dashavidha_10,
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
        "percentage": pct,
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
