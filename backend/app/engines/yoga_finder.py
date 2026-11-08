"""
Special Yogas search (category index section 17): find windows where chosen yogas form,
without picking an event.

A window qualifies when at least one chosen yoga forms (if any were chosen) and every chosen
condition holds: abhijit, pushkara navamsa, panchaka-free, tarabala, chandrabala, and free of
Rahu/Yama/Gulika, durmuhurta and varjyam. Days run sunrise to sunrise; the weekday is the
scan day's.
"""
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.engines.lagna_scanner import RASI_NAMES_EN, is_pushkara_navamsa
from app.engines.limb_timeline import ascendant_at, local_to_jd, split_by_limbs, varjyam_windows
from app.engines.panchang import compute_day_panchang
from app.engines.special_yogas import WEEKDAYS, yoga_tables, yogas_at
from app.engines.time_windows import TimeWindow, subtract_blocked_intervals
from app.engines.universal_filters import (
    evaluate_chandrabala, evaluate_panchaka, evaluate_tarabala, extract_inauspicious_windows,
)

CONDITIONS = {
    "abhijit": ("Abhijit muhurta", "అభిజిత్ ముహూర్తం"),
    "pushkara_navamsa": ("Pushkara navamsa", "పుష్కర నవాంశ"),
    "panchaka_free": ("Panchaka-free", "పంచక రహితం"),
    "tarabala": ("Tarabala favourable", "తారాబల అనుకూలం"),
    "chandrabala": ("Chandrabala favourable", "చంద్రబల అనుకూలం"),
    "bad_times_free": ("Free of Rahu, Yama, Gulika", "రాహు, యమ, గుళిక రహితం"),
    "durmuhurta_free": ("Durmuhurta-free", "దుర్ముహూర్త రహితం"),
    "varjyam_free": ("Varjyam-free", "వర్జ్య రహితం"),
}


def yoga_catalog() -> Dict[str, Any]:
    """Choosable yogas (good and twofold) and conditions, for the tab's form."""
    yogas = [{"id": k, "name_en": v.get("name_en", k), "name_te": v.get("name_te", k), "type": v.get("type"),
              "confirmed": bool(v.get("confirmed"))}
             for k, v in yoga_tables().items() if v.get("type") in ("good", "twofold")]
    conds = [{"id": k, "name_en": en, "name_te": te} for k, (en, te) in CONDITIONS.items()]
    return {"yogas": yogas, "conditions": conds}


def _hms(base: date, s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        parts = s.split()[0].split(":")
        h, m, sec = int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0
        dt = datetime(base.year, base.month, base.day) + timedelta(hours=h, minutes=m, seconds=sec)
        return dt + timedelta(days=1) if "(+1)" in s else dt
    except (ValueError, IndexError):
        return None


def _lagna_runs(start: datetime, end: datetime, tz: float, lat: float, lon: float) -> List[Tuple[datetime, datetime, int, bool]]:
    """(start, end, lagna sign 1-12, in pushkara navamsa) runs, sampled each minute."""
    runs: List[Tuple[datetime, datetime, int, bool]] = []
    t = start
    cur = None
    run_start = start
    while t < end:
        asc = ascendant_at(local_to_jd(t, tz), lat, lon)
        key = (int(asc // 30) + 1, is_pushkara_navamsa(asc))
        if key != cur:
            if cur is not None:
                runs.append((run_start, t, cur[0], cur[1]))
            cur, run_start = key, t
        t += timedelta(minutes=1)
    if cur is not None:
        runs.append((run_start, end, cur[0], cur[1]))
    return runs


def find_yoga_windows(start_date: date, days: int, lat: float, lon: float, tz: float, place_name: str,
                      yogas: List[str], conditions: List[str], janma_nak_idx: Optional[int] = None,
                      janma_rasi_idx: Optional[int] = None, min_minutes: float = 5.0) -> Dict[str, Any]:
    chosen = [y for y in yogas if y in yoga_tables()]
    conds = [c for c in conditions if c in CONDITIONS]
    warnings: List[str] = []
    if "tarabala" in conds and not janma_nak_idx:
        conds.remove("tarabala")
        warnings.append("Tarabala not checked: janma nakshatra not given")
    if "chandrabala" in conds and not janma_rasi_idx:
        conds.remove("chandrabala")
        warnings.append("Chandrabala not checked: janma rashi not given")
    need_lagna = "pushkara_navamsa" in conds or "panchaka_free" in conds

    out: List[Dict[str, Any]] = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        p = compute_day_panchang(d.year, d.month, d.day, lat, lon, tz, place_name, hour=12)
        sunrise = _hms(d, p.get("sunrise")) or datetime(d.year, d.month, d.day, 6)
        day_end = sunrise + timedelta(days=1)
        vara = (d.weekday() + 1) % 7

        lagna_runs = _lagna_runs(sunrise, day_end, tz, lat, lon) if need_lagna else [(sunrise, day_end, 0, False)]
        segs: List[Tuple[datetime, datetime, Any, int, bool]] = []
        for a, b, limbs in split_by_limbs(sunrise, day_end, tz):
            for la, lb, sign, push in lagna_runs:
                s, e = max(a, la), min(b, lb)
                if s < e:
                    segs.append((s, e, limbs, sign, push))

        abh = p.get("abhijit_muhurta") or {}
        abh_s, abh_e = _hms(d, abh.get("start")), _hms(d, abh.get("end"))

        blocked: List[TimeWindow] = []
        kalas = extract_inauspicious_windows(p, datetime(d.year, d.month, d.day))
        for w in kalas:
            t = w.metadata.get("type")
            if (t in ("rahu", "yama", "gulika") and "bad_times_free" in conds) or (t == "durmuhurta" and "durmuhurta_free" in conds):
                blocked.append(w)
        if "varjyam_free" in conds:
            blocked += [TimeWindow(start=v["start"], end=v["end"], label="Varjyam", metadata={"type": "varjyam"})
                        for v in varjyam_windows(sunrise, day_end, tz)]

        for s, e, limbs, sign, push in segs:
            found = [y for y in yogas_at(vara, limbs.tithi, limbs.nakshatra) if y in chosen]
            if chosen and not found:
                continue
            if "abhijit" in conds:
                if not (abh_s and abh_e):
                    continue
                s, e = max(s, abh_s), min(e, abh_e)
                if s >= e:
                    continue
            if "pushkara_navamsa" in conds and not push:
                continue
            if "panchaka_free" in conds and not evaluate_panchaka(limbs.tithi_number, vara, limbs.nakshatra, sign,
                                                                  tithi_30=limbs.tithi)["is_pass"]:
                continue
            tara = evaluate_tarabala(limbs.nakshatra, janma_nak_idx) if janma_nak_idx else None
            if "tarabala" in conds and not tara["is_pass"]:
                continue
            if "chandrabala" in conds and not evaluate_chandrabala(limbs.moon_rasi, janma_rasi_idx)["is_pass"]:
                continue
            for cw in subtract_blocked_intervals([TimeWindow(start=s, end=e, label="")], blocked, min_duration_minutes=min_minutes):
                row = {
                    "date": cw.start.date().isoformat(),
                    "panchang_day": d.isoformat(),
                    "start": cw.start.strftime("%H:%M"),
                    "end": cw.end.strftime("%H:%M"),
                    "duration_minutes": round((cw.end - cw.start).total_seconds() / 60.0, 1),
                    "vaara": WEEKDAYS[vara].title(),
                    "tithi": f"{limbs.tithi_name} ({limbs.paksha.title()})",
                    "nakshatra": limbs.nakshatra_name,
                    "yogas": [{"id": y, "name_en": yoga_tables()[y]["name_en"], "name_te": yoga_tables()[y]["name_te"]}
                              for y in found],
                    "conditions": conds,
                }
                if sign:
                    row["lagna"] = RASI_NAMES_EN[sign]
                if tara:
                    row["tara"] = tara.get("name_en")
                out.append(row)

    # Merge touching rows with the same yogas and limbs (lagna changes only matter if asked for).
    merged: List[Dict[str, Any]] = []
    for r in out:
        last = merged[-1] if merged else None
        same = last and last["date"] == r["date"] and last["end"] == r["start"] and \
            all(last.get(k) == r.get(k) for k in ("tithi", "nakshatra", "lagna")) and last["yogas"] == r["yogas"]
        if same:
            last["end"] = r["end"]
            last["duration_minutes"] = round(last["duration_minutes"] + r["duration_minutes"], 1)
        else:
            merged.append(dict(r))
    return {"days_scanned": days, "total": len(merged), "windows": merged, "warnings": warnings,
            "yogas": chosen, "conditions": conds}
