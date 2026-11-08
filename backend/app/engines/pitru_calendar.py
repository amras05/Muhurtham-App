"""
Pitru calendar (category index section 12): the annual shraddha date from the death tithi,
the 96 yearly shraddhas (Shannavati), and the day counts after a death.

All dates come from the per-instant limb engine (Swiss Ephemeris, Lahiri). A tithi is fixed to
a civil day by its rule:
  aparahna  the day whose aparahna (4th fifth of daytime) the tithi covers most; a tie goes to
            the first day; a tithi that touches no aparahna goes to the day it begins (flagged).
  udaya     the day whose sunrise falls in the tithi; a kshaya tithi goes to the day it begins.
Lunar months are Amanta (named by the Sun's sign at the opening new moon; no sankranti in the
month = adhika).
"""
from datetime import date, datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml
from jhora import utils
from jhora.panchanga import drik

from app.core.logging import logger
from app.engines.limb_timeline import (
    _angle_sun, _angle_tithi, _angle_yoga, jd_to_local, limbs_at, local_to_jd, sun_moon,
)

SHARED = Path(__file__).resolve().parent.parent / "rules" / "shared"
MASA_EN = [None, "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
           "Ashvayuja", "Kartika", "Margashira", "Pushya", "Magha", "Phalguna"]
MASA_TE = [None, "చైత్ర", "వైశాఖ", "జ్యేష్ఠ", "ఆషాఢ", "శ్రావణ", "భాద్రపద", "ఆశ్వయుజ", "కార్తీక",
           "మార్గశిర", "పుష్య", "మాఘ", "ఫాల్గుణ"]
SIGN_EN = [None, "Mesha", "Vrishabha", "Mithuna", "Karkataka", "Simha", "Kanya", "Tula", "Vrishchika",
           "Dhanus", "Makara", "Kumbha", "Meena"]
TITHI_EN = ["Pratipada", "Dvitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami",
            "Navami", "Dashami", "Ekadashi", "Dvadashi", "Trayodashi", "Chaturdashi", "Purnima"]
SYNODIC = 29.530589


def tithi_label(t30: int) -> str:
    if t30 == 30:
        return "Amavasya"
    return f"{'Shukla' if t30 <= 15 else 'Krishna'} {TITHI_EN[(t30 - 1) % 15]}"


@lru_cache(maxsize=1)
def tables() -> Dict[str, Any]:
    try:
        with open(SHARED / "pitru_calendar.yaml", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except (OSError, yaml.YAMLError) as ex:
        logger.error(f"pitru_calendar.yaml unreadable: {ex}")
        return {}


# ── Astronomy helpers ─────────────────────────────────────────────────────────

def _newton(jd: float, angle_fn, target: float) -> float:
    t = jd
    for _ in range(8):
        a, rate = angle_fn(t)
        diff = (target - a + 180.0) % 360.0 - 180.0
        if abs(diff) < 1e-7 or rate == 0:
            break
        t += diff / rate
    return t


def new_moon_before(jd: float) -> float:
    elong, _ = _angle_tithi(jd)
    return _newton(jd - elong / 12.19, _angle_tithi, 0.0)


def new_moon_after(jd: float) -> float:
    elong, _ = _angle_tithi(jd)
    return _newton(jd + (360.0 - elong) / 12.19, _angle_tithi, 0.0)


def _sun_sign(jd: float) -> int:
    return int(sun_moon(jd)[0] // 30.0) + 1


def lunar_month_at(jd: float) -> Dict[str, Any]:
    """Amanta month containing jd: its number (1 = Chaitra), adhika flag and new-moon bounds."""
    start = new_moon_before(jd)
    if start > jd:                    # Newton landed on the next new moon
        start = new_moon_before(start - 1.0)
    end = new_moon_after(start + 1.0)
    s1, s2 = _sun_sign(start), _sun_sign(end)
    return {"masa": s1 % 12 + 1, "adhika": s1 == s2, "start": start, "end": end}


def lunar_months(from_jd: float, to_jd: float) -> List[Dict[str, Any]]:
    out, jd = [], from_jd
    while jd < to_jd:
        m = lunar_month_at(jd)
        out.append(m)
        jd = m["end"] + 0.5
    return out


def tithi_span(month_start: float, t30: int) -> Tuple[float, float]:
    """(start, end) JD of tithi t30 in the lunar month opening at month_start."""
    approx = month_start + (t30 - 1) * SYNODIC / 30.0
    t0 = _newton(approx, _angle_tithi, ((t30 - 1) * 12.0) % 360.0)
    t1 = _newton(approx + SYNODIC / 30.0, _angle_tithi, (t30 * 12.0) % 360.0)
    return t0, t1


def _sun_times(d: date, lat: float, lon: float, tz: float) -> Tuple[datetime, datetime]:
    place = drik.Place("p", lat, lon, tz)
    jd = utils.julian_day_number(drik.Date(d.year, d.month, d.day), (12, 0, 0))
    base = datetime(d.year, d.month, d.day)
    return base + timedelta(hours=drik.sunrise(jd, place)[0]), base + timedelta(hours=drik.sunset(jd, place)[0])


def day_for_tithi(span: Tuple[float, float], rule: str, lat: float, lon: float, tz: float) -> Dict[str, Any]:
    """Civil day a tithi is observed on, by the aparahna or udaya rule."""
    t0, t1 = span
    s_loc, e_loc = jd_to_local(t0, tz), jd_to_local(t1, tz)
    days = sorted({(s_loc - timedelta(days=1)).date(), s_loc.date(), e_loc.date()})
    best, best_cov, note = None, 0.0, ""
    for d in days:
        sr, ss = _sun_times(d, lat, lon, tz)
        if rule == "udaya":
            if s_loc <= sr < e_loc:
                return {"date": d, "rule": "udaya", "note": ""}
            continue
        length = ss - sr
        a0, a1 = sr + length * 3 / 5, sr + length * 4 / 5
        cov = (min(a1, e_loc) - max(a0, s_loc)).total_seconds()
        if cov > best_cov + 1:
            best, best_cov = d, cov
    if best is None:
        best = s_loc.date()
        note = ("Tithi has no sunrise (kshaya): observed on the day it begins" if rule == "udaya"
                else "Tithi touches no aparahna: observed on the day it begins")
    return {"date": best, "rule": rule, "note": note,
            "aparahna_minutes": round(best_cov / 60.0) if rule == "aparahna" else None}


def sankrantis(year: int, tz: float) -> List[Dict[str, Any]]:
    out = []
    jd = local_to_jd(datetime(year, 1, 1), tz) - 31
    end = local_to_jd(datetime(year + 1, 1, 1), tz)
    while jd < end:
        s, _ = _angle_sun(jd)
        target = (int(s // 30.0) + 1) * 30.0 % 360.0
        t = _newton(jd + ((target - s) % 360.0) / 0.9856, _angle_sun, target)
        local = jd_to_local(t, tz)
        if local.year == year:
            sign = int(round(target / 30.0)) % 12 + 1
            out.append({"date": local.date(), "time": local.strftime("%H:%M"), "sign": SIGN_EN[sign]})
        jd = t + 5
    return out


def yoga_days(year: int, yoga_no: int, lat: float, lon: float, tz: float) -> List[Dict[str, Any]]:
    """Days of a nitya yoga (17 = Vyatipata, 27 = Vaidhriti) in the year, by the udaya rule."""
    span = 360.0 / 27.0
    out = []
    jd = local_to_jd(datetime(year, 1, 1), tz) - 30
    end = local_to_jd(datetime(year + 1, 1, 1), tz)
    while jd < end:
        a, rate = _angle_yoga(jd)
        target = (yoga_no - 1) * span
        t0 = _newton(jd + ((target - a) % 360.0) / 14.2, _angle_yoga, target)
        t1 = _newton(t0 + 1.0, _angle_yoga, yoga_no * span % 360.0)
        r = day_for_tithi((t0, t1), "udaya", lat, lon, tz)
        if r["date"].year == year:
            out.append({"date": r["date"], "note": r["note"]})
        jd = t1 + 2
    return out


# ── Public: annual shraddha, after-death counts, shannavati ───────────────────

def death_details(death_dt: datetime, tz: float) -> Dict[str, Any]:
    jd = local_to_jd(death_dt, tz)
    lm = lunar_month_at(jd)
    t30 = limbs_at(jd).tithi
    return {"tithi": t30, "tithi_label": tithi_label(t30), "masa": lm["masa"], "adhika": lm["adhika"],
            "masa_en": MASA_EN[lm["masa"]], "masa_te": MASA_TE[lm["masa"]]}


def annual_shraddha(death_dt: datetime, years: int, lat: float, lon: float, tz: float) -> Dict[str, Any]:
    """The death tithi in the same (nija) Amanta month, for the next `years` years."""
    dd = death_details(death_dt, tz)
    out = []
    for k in range(1, years + 1):
        around = local_to_jd(death_dt + timedelta(days=365.25 * k), tz)
        months = [m for m in lunar_months(around - 50, around + 50) if m["masa"] == dd["masa"] and not m["adhika"]]
        if not months:
            continue
        m = min(months, key=lambda x: abs(x["start"] - around))
        r = day_for_tithi(tithi_span(m["start"], dd["tithi"]), "aparahna", lat, lon, tz)
        out.append({"year_no": k, "date": r["date"].isoformat(), "weekday": r["date"].strftime("%A"),
                    "aparahna_minutes": r["aparahna_minutes"], "note": r["note"]})
    notes = ["Adhika-masa years: the shraddha is placed in the nija month (author to confirm)."]
    if dd["adhika"]:
        notes.append("The death fell in an adhika month; later years use the nija month of that name.")
    return {"death": dd, "shraddha": out, "notes": notes}


def after_death(death_dt: datetime, lat: float, lon: float, tz: float) -> Dict[str, Any]:
    """Day counts from the date of death (day of death = day 1) and the 12 masikas."""
    d0 = death_dt.date()
    rows = [{"date": (d0 + timedelta(days=i - 1)).isoformat(), "day": i, "rite_en": "Tilodaka and vasodaka",
             "rite_te": "తిలోదకం, వాసోదకం"} for i in range(1, 11)]
    rows.append({"date": (d0 + timedelta(days=10)).isoformat(), "day": 11, "rite_en": "Ekadashaha", "rite_te": "ఏకాదశాహం"})
    rows.append({"date": (d0 + timedelta(days=11)).isoformat(), "day": 12, "rite_en": "Sapindikarana (12th day)",
                 "rite_te": "సపిండీకరణం (12వ రోజు)"})
    dd = death_details(death_dt, tz)
    jd = local_to_jd(death_dt, tz)
    first_month = new_moon_after(jd) + 0.5           # masikas start in the next lunar month
    for i, m in enumerate(lunar_months(first_month, first_month + 372)[:12], start=1):
        r = day_for_tithi(tithi_span(m["start"], dd["tithi"]), "aparahna", lat, lon, tz)
        rows.append({"date": r["date"].isoformat(), "day": (r["date"] - d0).days + 1,
                     "rite_en": f"Masika shraddha {i} ({MASA_EN[m['masa']]}{' adhika' if m['adhika'] else ''})",
                     "rite_te": f"మాసిక శ్రాద్ధం {i} ({MASA_TE[m['masa']]}{' అధిక' if m['adhika'] else ''})",
                     "note": r["note"]})
    first = annual_shraddha(death_dt, 1, lat, lon, tz)["shraddha"]
    if first:
        rows.append({"date": first[0]["date"], "day": (date.fromisoformat(first[0]["date"]) - d0).days + 1,
                     "rite_en": "First annual shraddha (abdika)", "rite_te": "ప్రథమ ఆబ్దికం"})
    rows.sort(key=lambda r: r["date"])
    return {"death": dd, "rites": rows,
            "notes": ["Day of death counts as day 1.",
                      "Traipakshika and the una-masikas need the book's rule (author to supply)."]}


def shannavati(year: int, lat: float, lon: float, tz: float) -> Dict[str, Any]:
    """The 96 shraddha days of a civil year."""
    tb = tables()
    y0, y1 = local_to_jd(datetime(year, 1, 1), tz), local_to_jd(datetime(year + 1, 1, 1), tz)
    months = lunar_months(y0 - 40, y1 + 40)
    rows: List[Dict[str, Any]] = []

    def add(kind_en, kind_te, d, extra=""):
        if d.year == year:
            rows.append({"date": d.isoformat(), "weekday": d.strftime("%A"), "kind_en": kind_en,
                         "kind_te": kind_te, "detail": extra})

    def by_tithi(masa, t30, rule, kind_en, kind_te):
        for m in months:
            if m["masa"] == masa and not m["adhika"]:
                r = day_for_tithi(tithi_span(m["start"], t30), rule, lat, lon, tz)
                add(kind_en, kind_te, r["date"], f"{MASA_EN[masa]} {tithi_label(t30)}" + (f" · {r['note']}" if r["note"] else ""))

    for m in months:   # amavasya of every month (darsha), aparahna
        r = day_for_tithi(tithi_span(m["start"], 30), "aparahna", lat, lon, tz)
        add("Amavasya", "అమావాస్య", r["date"], f"{MASA_EN[m['masa']]}{' adhika' if m['adhika'] else ''}")
    for s in sankrantis(year, tz):
        add("Sankranti", "సంక్రాంతి", s["date"], f"{s['sign']} {s['time']}")
    for d in tb.get("manvadi", {}).get("days", []):
        by_tithi(d["masa"], d["tithi"], tb["manvadi"].get("day_rule", "udaya"), "Manvadi", "మన్వాది")
    for d in tb.get("yugadi", {}).get("days", []):
        by_tithi(d["masa"], d["tithi"], tb["yugadi"].get("day_rule", "udaya"), "Yugadi", "యుగాది")
    for y in yoga_days(year, 17, lat, lon, tz):
        add("Vyatipata", "వ్యతీపాతం", y["date"], y["note"])
    for y in yoga_days(year, 27, lat, lon, tz):
        add("Vaidhriti", "వైధృతి", y["date"], y["note"])
    mh = tb.get("mahalaya", {})
    for t in range(16, 31):
        by_tithi(mh.get("masa", 6), t, mh.get("day_rule", "aparahna"), "Mahalaya", "మహాలయం")
    for key, en, te in (("ashtaka", "Ashtaka", "అష్టకా"), ("anvashtaka", "Anvashtaka", "అన్వష్టకా"),
                        ("purvedyuh", "Purvedyuh", "పూర్వేద్యుః")):
        t = tb.get(key, {})
        for masa in t.get("masas", []):
            by_tithi(masa, t["tithi"], t.get("day_rule", "aparahna"), en, te)

    rows.sort(key=lambda r: r["date"])
    counts: Dict[str, int] = {}
    for r in rows:
        counts[r["kind_en"]] = counts.get(r["kind_en"], 0) + 1
    return {"year": year, "total": len(rows), "counts": counts, "days": rows,
            "confirmed": bool(tb.get("confirmed")),
            "notes": ["Classical lists (Nirnaya Sindhu); the author to confirm them against the book.",
                      "Counts can differ from 96 in a year with an adhika month or a repeated yoga."]}
