"""
Godavari Pushkaralu (user's rule, 13 Nov 2026).

While Jupiter is in Simha rashi it is the Godavari's pushkara year, and Dr. Nemani says Jupiter in Simha
has no power (no Guru bala). The user's rule: places near the Godavari get no auspicious muhurtas for
that whole time, and the search says why.

The river is traced by an approximate course from Trimbakeshwar to the delta (both main mouths).
NEAR_KM is how close a place must be to count as "near the Godavari".
"""
from datetime import date, timedelta
from functools import lru_cache
from math import asin, cos, radians, sin, sqrt
from typing import Any, Dict, List, Optional, Tuple

NEAR_KM = 30.0

# (lat, lon) along the main stream, source to sea; then the Vasishta branch from Dowleswaram.
GODAVARI_COURSE: List[Tuple[float, float]] = [
    (19.93, 73.53),   # Trimbakeshwar (source)
    (20.00, 73.79),   # Nashik
    (19.88, 74.48),   # Kopargaon
    (19.60, 75.02),   # Pravara confluence
    (19.48, 75.38),   # Paithan
    (19.25, 76.10),
    (18.97, 76.75),   # Gangakhed
    (19.15, 77.31),   # Nanded
    (18.88, 77.95),   # Basar
    (18.97, 78.34),   # Sriram Sagar (Pochampad)
    (18.95, 78.75),
    (18.95, 79.09),   # Dharmapuri
    (18.87, 79.45),   # Mancherial
    (18.81, 79.91),   # Kaleshwaram
    (18.55, 80.20),
    (18.20, 80.55),   # Eturnagaram
    (17.90, 80.75),
    (17.67, 80.89),   # Bhadrachalam
    (17.58, 81.27),   # Kunavaram
    (17.25, 81.64),   # Polavaram
    (17.00, 81.78),   # Rajahmundry
    (16.94, 81.78),   # Dowleswaram
    (16.80, 82.05),
    (16.73, 82.22),   # Yanam (Gautami mouth)
]
VASISHTA_BRANCH: List[Tuple[float, float]] = [
    (16.94, 81.78), (16.70, 81.75), (16.43, 81.70), (16.32, 81.73),   # Narsapur, Antarvedi
]

_JUPITER_SIMHA = 5


def _km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    la1, lo1, la2, lo2 = map(radians, (a[0], a[1], b[0], b[1]))
    h = sin((la2 - la1) / 2) ** 2 + cos(la1) * cos(la2) * sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(h))


def _seg_km(p: Tuple[float, float], a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Distance from p to segment a-b, on a local flat projection (fine at these scales)."""
    k = cos(radians(p[0]))
    ax, ay, bx, by, px, py = a[1] * k, a[0], b[1] * k, b[0], p[1] * k, p[0]
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return _km(p, (ay + t * dy, (ax + t * dx) / k))


def km_from_godavari(lat: float, lon: float) -> float:
    p = (lat, lon)
    best = float("inf")
    for course in (GODAVARI_COURSE, VASISHTA_BRANCH):
        for a, b in zip(course, course[1:]):
            best = min(best, _seg_km(p, a, b))
    return best


def _setting() -> Dict[str, Any]:
    """The super admin's Godavari setting (Settings › Finder and sharing, plan D7): on/off and distance."""
    try:
        from app.auth.app_settings import get_setting
        s = get_setting("godavari") or {}
        return {"enabled": bool(s.get("enabled", True)), "km": float(s.get("km", NEAR_KM))}
    except Exception:   # settings unreadable: the rule as first decided
        return {"enabled": True, "km": NEAR_KM}


def near_godavari(lat: float, lon: float) -> bool:
    s = _setting()
    return s["enabled"] and km_from_godavari(lat, lon) <= s["km"]


@lru_cache(maxsize=4096)
def jupiter_in_simha(day: date) -> bool:
    import swisseph as swe
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    jd = swe.julday(day.year, day.month, day.day, 6.5)          # local noon in India, in UT
    lon = swe.calc_ut(jd, swe.JUPITER, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)[0][0] % 360.0
    return int(lon // 30) + 1 == _JUPITER_SIMHA


def simha_periods(start: date, end: date) -> List[Tuple[date, date]]:
    """The spans of [start, end] with Jupiter in Simha."""
    out: List[Tuple[date, date]] = []
    d, cur = start, None
    while d <= end:
        if jupiter_in_simha(d):
            cur = cur or d
        elif cur:
            out.append((cur, d - timedelta(days=1)))
            cur = None
        d += timedelta(days=1)
    if cur:
        out.append((cur, end))
    return out


def pushkaralu_notice(start: date, end: date, lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """The notice to show for this search, or None when the place is not near the Godavari or Jupiter is
    not in Simha in the range."""
    km = km_from_godavari(lat, lon)
    s = _setting()
    if not s["enabled"] or km > s["km"]:
        return None
    spans = []
    for a, b in simha_periods(start, end):          # give each period in full, not cut to this search's range
        while jupiter_in_simha(a - timedelta(days=1)):
            a -= timedelta(days=1)
        while jupiter_in_simha(b + timedelta(days=1)):
            b += timedelta(days=1)
        spans.append((a, b))
    if not spans:
        return None
    rng = ", ".join(f"{a:%d %b %Y} – {b:%d %b %Y}" for a, b in spans)
    return {
        "id": "godavari_pushkaralu",
        "en": (f"Godavari Pushkaralu: Jupiter is in Simha ({rng}). There are no muhurtas for places near the "
               f"Godavari then. This place is about {km:.0f} km from the river."),
        "te": (f"గోదావరి పుష్కరాలు: గురుడు సింహరాశిలో ఉన్నాడు ({rng}). ఈ కాలంలో గోదావరి సమీప ప్రాంతాలకు "
               f"ముహూర్తాలు లేవు. ఈ ప్రదేశం నదికి సుమారు {km:.0f} కి.మీ. దూరంలో ఉంది."),
        "km": round(km, 1), "periods": [[a.isoformat(), b.isoformat()] for a, b in spans],
    }
