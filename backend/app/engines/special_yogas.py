"""
Special yogas, extra dosha checks (list C) and per-category dosha profiles.

Tables live in rules/shared/special_yogas.yaml and rules/shared/dosha_profiles.yaml so the
author can correct them without code changes. Everything is evaluated per window, from the
tithi / nakshatra / weekday actually running then (not the sunrise snapshot).
"""
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

from app.core.logging import logger
from app.engines.vocab import NAKSHATRA_INDEX, norm_key

SHARED = Path(__file__).resolve().parent.parent / "rules" / "shared"
WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
SEVERITIES = ("info", "mild", "serious", "fatal")


@lru_cache(maxsize=1)
def yoga_tables() -> Dict[str, Dict[str, Any]]:
    try:
        with open(SHARED / "special_yogas.yaml", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except (OSError, yaml.YAMLError) as ex:
        logger.error(f"special_yogas.yaml unreadable: {ex}")
        return {}
    tables = data.get("yogas") or {}
    for y in tables.values():   # nakshatra names -> indexes once
        if "table" in y and y.get("basis") == "vara_nakshatra":
            y["_nak"] = {d: {NAKSHATRA_INDEX[norm_key(n)] for n in naks} for d, naks in y["table"].items()}
        if "nakshatras" in y:
            y["_nak_set"] = {NAKSHATRA_INDEX[norm_key(n)] for n in y["nakshatras"]}
    return tables


@lru_cache(maxsize=1)
def _profiles() -> Dict[str, Any]:
    try:
        with open(SHARED / "dosha_profiles.yaml", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except (OSError, yaml.YAMLError) as ex:
        logger.error(f"dosha_profiles.yaml unreadable: {ex}")
        return {}


def _merge(base: Dict[str, Any], over: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    out = dict(base)
    for k, v in (over or {}).items():
        out[k] = _merge(out.get(k) or {}, v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


@lru_cache(maxsize=128)
def _profile_cached(tab: str, event_id: str) -> Dict[str, Any]:
    p = _profiles()
    prof = _merge(p.get("default") or {}, (p.get("tabs") or {}).get(tab))
    return _merge(prof, (p.get("events") or {}).get(event_id))


def profile_for(tab: str, event_id: str) -> Dict[str, Any]:
    """default <- tab <- event."""
    return _profile_cached(tab or "", event_id or "")


def yogas_at(vara_idx: int, tithi_30: int, nak_idx: int) -> List[str]:
    """Ids of the special yogas formed by this weekday, tithi (1-30) and nakshatra."""
    day = WEEKDAYS[vara_idx % 7]
    t15 = (tithi_30 - 1) % 15 + 1
    is_amavasya = tithi_30 == 30
    found = []
    for yid, y in yoga_tables().items():
        basis = y.get("basis")
        if basis == "vara_tithi":
            if not is_amavasya and t15 in (y.get("table") or {}).get(day, []):
                found.append(yid)
        elif basis == "vara_nakshatra":
            if nak_idx in y.get("_nak", {}).get(day, set()):
                found.append(yid)
        elif basis == "vara_tithi_nakshatra":
            if day in y.get("varas", []) and t15 in y.get("tithis", []) and nak_idx in y.get("_nak_set", set()):
                found.append(yid)
    return found


def _yoga_excluded_for(yid: str, vara_idx: int, nak_idx: int, event_id: str) -> bool:
    """Traditional 'not for' exceptions, e.g. Thursday + Pushya amrita siddhi not for marriage."""
    y = yoga_tables().get(yid, {})
    day = WEEKDAYS[vara_idx % 7]
    for combo, events in (y.get("not_for") or {}).items():
        d, _, nak = combo.partition("_")
        if d == day and NAKSHATRA_INDEX.get(norm_key(nak)) == nak_idx and event_id in events:
            return True
    return False


def evaluate_yogas(vara_idx: int, tithi_30: int, nak_idx: int, tab: str, event_id: str
                   ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    """
    Returns (good yogas shown as a bonus, yoga dosha rows, bonus points) for this window,
    with the category's profile applied.
    """
    prof = profile_for(tab, event_id).get("yogas") or {}
    good, bad, points = [], [], 0
    for yid in yogas_at(vara_idx, tithi_30, nak_idx):
        y = yoga_tables()[yid]
        rule = prof.get(yid) or {}
        excluded = _yoga_excluded_for(yid, vara_idx, nak_idx, event_id)
        base = {"id": yid, "name_en": y.get("name_en", yid), "name_te": y.get("name_te", yid),
                "confirmed": bool(y.get("confirmed"))}
        if rule.get("severity") in SEVERITIES:
            bad.append({**base, "status": "fail", "severity": rule["severity"],
                        "desc_en": f"{base['name_en']} is unwanted for this event",
                        "desc_te": f"ఈ కార్యానికి {base['name_te']} అనుకూలం కాదు",
                        "book_ref": "Special yogas (author to confirm)"})
        elif excluded:
            good.append({**base, "points": 0, "note_en": "Traditionally not used for this event",
                         "note_te": "ఈ కార్యానికి సంప్రదాయంగా వాడరు"})
        else:
            pts = int(rule.get("points", 0))
            points += pts
            good.append({**base, "points": pts})
    return good, bad, points


# ── Extra checks (category index, part 3 C) ───────────────────────────────────

# Paksharandhra: the first ghatis of these tithis are avoided (classical counts; author to confirm).
PAKSHARANDHRA_GHATIS = {4: 8, 6: 9, 8: 14, 9: 25, 12: 10, 14: 5}
MALEFICS = {"Sun", "Mars", "Saturn", "Rahu", "Ketu"}
SPECIAL_ASPECTS = {"Mars": (4, 7, 8), "Saturn": (3, 7, 10), "Jupiter": (5, 7, 9)}


def _aspects(planet: str, from_house: int, target: int) -> bool:
    for n in SPECIAL_ASPECTS.get(planet, (7,)):
        if (from_house - 1 + n - 1) % 12 + 1 == target:
            return True
    return False


def _row(cid: str, name_en: str, name_te: str, status: str, severity: str, desc_en: str, desc_te: str) -> Dict[str, Any]:
    return {"id": cid, "name_en": name_en, "name_te": name_te, "status": status,
            "severity": severity if status == "fail" else "info",
            "is_pass": None if status in ("not_evaluated", "not_applicable") else status == "pass",
            "desc_en": desc_en, "desc_te": desc_te, "book_ref": "Category index part 3 C (author to confirm)"}


def _level(v: Any) -> str:
    """A check's level from the profile; YAML turns a bare `off` into False."""
    return "off" if v in (None, False, "off", "no") else str(v)


def extra_checks(tab: str, event_id: str, tithi_30: int, tithi_span: Tuple[float, float], window_jd: float,
                 sunrise_jds: List[float], house_planets: Dict[int, List[Any]]) -> List[Dict[str, Any]]:
    """
    List C checks for one window. tithi_span is the running tithi's (start, end) JD; sunrise_jds
    are the sunrises around it (for kshaya tithi); house_planets is the lagna chart by house.
    """
    sev = {k: _level(v) for k, v in (profile_for(tab, event_id).get("extra_checks") or {}).items()}
    rows: List[Dict[str, Any]] = []
    t15 = (tithi_30 - 1) % 15 + 1

    level = sev.get("paksharandhra", "off")
    if level != "off":
        gh = PAKSHARANDHRA_GHATIS.get(t15)
        if gh and tithi_30 != 30:
            t0, t1 = tithi_span
            limit = t0 + (t1 - t0) * gh / 60.0
            bad = window_jd < limit
            rows.append(_row("paksharandhra", "Paksharandhra", "పక్షరంధ్రం", "fail" if bad else "pass", level,
                             f"Within the first {gh} ghatis of this tithi" if bad else f"Past the first {gh} ghatis of this tithi",
                             f"ఈ తిథి మొదటి {gh} ఘటికలలో ఉంది" if bad else f"ఈ తిథి మొదటి {gh} ఘటికలు దాటింది"))
        else:
            rows.append(_row("paksharandhra", "Paksharandhra", "పక్షరంధ్రం", "not_applicable", "info",
                             "Not a paksharandhra tithi", "పక్షరంధ్ర తిథి కాదు"))

    level = sev.get("kshaya_tithi", "off")
    if level != "off":
        t0, t1 = tithi_span
        kshaya = not any(t0 <= sr <= t1 for sr in sunrise_jds)
        rows.append(_row("kshaya_tithi", "Kshaya tithi", "క్షయ తిథి", "fail" if kshaya else "pass", level,
                         "This tithi sees no sunrise (kshaya)" if kshaya else "This tithi has a sunrise",
                         "ఈ తిథికి సూర్యోదయం లేదు (క్షయ తిథి)" if kshaya else "ఈ తిథికి సూర్యోదయం ఉంది"))

    level = sev.get("papa_drishti", "off")
    if level != "off":
        hits = []
        for h, plist in (house_planets or {}).items():
            for p in plist:
                if p.name_en in MALEFICS:
                    for target, label in ((1, "lagna"), (7, "7th")):
                        if _aspects(p.name_en, int(h), target):
                            hits.append(f"{p.name_en} → {label}")
        rows.append(_row("papa_drishti", "Papa drishti on lagna / 7th", "లగ్న / సప్తమ పాపదృష్టి",
                         "fail" if hits else "pass", level,
                         ("Malefic aspect: " + ", ".join(hits)) if hits else "No malefic aspects the lagna or 7th",
                         ("పాపగ్రహ దృష్టి: " + ", ".join(hits)) if hits else "లగ్నం, సప్తమంపై పాపదృష్టి లేదు"))

    for cid, en, te in (("bandhana_nakshatra", "Bandhana nakshatra", "బంధన నక్షత్రం"),
                        ("tithi_tyajya", "Tithi tyajya", "తిథి త్యాజ్యం")):
        if sev.get(cid, "off") != "off":
            rows.append(_row(cid, en, te, "not_evaluated", "info",
                             "Needs the book's table (author to supply)", "గ్రంథంలోని పట్టిక కావాలి (రచయిత ఇవ్వాలి)"))
    return rows


def apply_dosha_profile(rows: List[Dict[str, Any]], tab: str, event_id: str,
                        active_pariharas: List[str], lenient: bool) -> List[Dict[str, Any]]:
    """
    Per-category severity overrides and doshapavada. An exempted dosha keeps status 'fail'
    with `exemption` filled in; in Lenient mode it is downgraded to 'info' severity.
    """
    prof = profile_for(tab, event_id)
    sev_over = prof.get("dosha_severity") or {}
    exemptions = prof.get("exemptions") or {}
    active = set(active_pariharas)
    out = []
    for r in rows:
        r = dict(r)
        did = r.get("id")
        if did in sev_over and sev_over[did] in SEVERITIES and r.get("status") == "fail":
            r["severity"] = sev_over[did]
        relief = [pid for pid in exemptions.get(did, []) if pid in active]
        if relief and r.get("status") == "fail":
            r["exemption"] = relief
            if lenient:
                r["severity"] = "info"
        out.append(r)
    return out
