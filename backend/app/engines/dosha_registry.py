"""
One rule record per dosha (plan B2), read from rules/shared/dosha_registry.yaml.

The engine (engines/doshas.py) judges each dosha; the registry says what the check is, where it
applies, what it reads, its status (evaluated, needs a person's details, to be confirmed,
awaiting the author) and its stable book id. Each audit row gets its record's book_id and status,
so the result can link to the rule (B3) and the remedies (B4) by id.
"""
import functools
from pathlib import Path
from typing import Any, Dict, List

import yaml

from app.core.logging import logger

_FILE = Path(__file__).resolve().parent.parent / "rules" / "shared" / "dosha_registry.yaml"
_COUNTS = {"mahadoshas": 21, "dashavidha": 10}
_REQUIRED = ("number", "id", "name_en", "name_te", "scope", "severity", "status", "inputs", "book_id")
_STATUSES = ("evaluated", "needs_person", "to_confirm", "awaiting_author")


@functools.lru_cache(maxsize=1)
def registry() -> Dict[str, List[Dict[str, Any]]]:
    """Both lists, checked: 21 + 10 records, numbered 1..N, every field present. An unreadable or
    broken file is logged and gives empty lists; the audit still runs, without the record links."""
    try:
        with open(_FILE, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except (OSError, yaml.YAMLError) as ex:
        logger.error(f"dosha_registry.yaml unreadable: {ex}")
        return {k: [] for k in _COUNTS}
    out: Dict[str, List[Dict[str, Any]]] = {}
    for group, n in _COUNTS.items():
        recs = data.get(group) or []
        problems = [f"{group}: expected {n} records, found {len(recs)}"] if len(recs) != n else []
        if sorted(r.get("number") for r in recs) != list(range(1, len(recs) + 1)):
            problems.append(f"{group}: numbers are not 1..{len(recs)}")
        for r in recs:
            missing = [k for k in _REQUIRED if r.get(k) in (None, "")]
            if missing:
                problems.append(f"{group} #{r.get('number')}: missing {', '.join(missing)}")
            if r.get("status") not in _STATUSES:
                problems.append(f"{group} #{r.get('number')}: unknown status {r.get('status')!r}")
        if problems:
            logger.error("dosha_registry.yaml: " + "; ".join(problems))
            out[group] = []
        else:
            out[group] = sorted(recs, key=lambda r: r["number"])
    return out


def _by_id() -> Dict[str, Dict[str, Any]]:
    return {r["id"]: r for recs in registry().values() for r in recs}


_warned: set = set()


def link_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Add book_id and rule_status to each audit row from its record (in place; returns rows).
    A row whose id has no record is logged once, so a renamed check can't drift unnoticed."""
    recs = _by_id()
    if not recs:
        return rows
    for r in rows:
        rec = recs.get(r.get("id"))
        if rec is None:
            if r.get("id") not in _warned:
                _warned.add(r.get("id"))
                logger.warning(f"Dosha '{r.get('id')}' has no record in dosha_registry.yaml")
            continue
        r["book_id"] = rec["book_id"]
        r["rule_status"] = rec["status"]
    return rows
