"""
Panchanga limbs at any instant, and the time-based facts the dosha engine needs.

The day panchang (engines/panchang.py) is a sunrise snapshot. A muhurta is judged
by the limbs running at the muhurta time (plan M5 7.5, M21 "minute-level timeline"),
so this module computes tithi, nakshatra, yoga, karana and Moon rashi directly from
sidereal (Lahiri) Sun and Moon longitudes, and finds the exact moments they change.

Also provides:
  - book varjyam windows (plan M4 6.4: ghati offset scaled to the real nakshatra length)
  - sankranti proximity (plan M11 #2)
  - eclipse windows (plan M11 #14)
  - the omen (utpata) calendar admins keep in app.utpata_events (plan M11 #15)
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import swisseph as swe

from app.core.logging import logger
from app.engines.vocab import (
    KARANA_CANONICAL, MOVABLE_SIGNS, NAKSHATRA_CANONICAL, YOGA_CANONICAL,
    karana_of_position, tithi_name,
)

NAK_SPAN = 360.0 / 27.0
GHATI_HOURS = 24.0 / 60.0  # 1 ghati = 24 minutes
_FLAGS = swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED

# Varjyam (nakshatra tyajya) start, in ghatis elapsed from the nakshatra's start, for a
# 60-ghati nakshatra. Book table (Part 1, end): Ashwini "51-54" = ghatis 51 to 54,
# i.e. it begins after 50 ghatis and lasts 4. Clock times in the book are examples only.
VARJYAM_START_GHATI = {
    1: 50, 2: 24, 3: 30, 4: 40, 5: 14, 6: 21, 7: 30, 8: 20, 9: 32,
    10: 30, 11: 20, 12: 18, 13: 21, 14: 20, 15: 14, 16: 14, 17: 10, 18: 14,
    19: 56, 20: 24, 21: 20, 22: 10, 23: 10, 24: 18, 25: 16, 26: 24, 27: 30,
}
VARJYAM_LENGTH_GHATI = 4


# ── Time conversions ─────────────────────────────────────────────────────────
def local_to_jd(dt: datetime, tz_offset: float) -> float:
    h = dt.hour + dt.minute / 60.0 + dt.second / 3600.0 - tz_offset
    return swe.julday(dt.year, dt.month, dt.day, h)


def jd_to_local(jd: float, tz_offset: float) -> datetime:
    y, m, d, h = swe.revjul(jd + tz_offset / 24.0)
    return datetime(y, m, d) + timedelta(seconds=round(h * 3600.0))


# ── Sun / Moon ───────────────────────────────────────────────────────────────
def sun_moon(jd: float) -> Tuple[float, float, float, float]:
    """(sun_lon, sun_speed, moon_lon, moon_speed), sidereal Lahiri, degrees and deg/day."""
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    s = swe.calc_ut(jd, swe.SUN, _FLAGS)[0]
    m = swe.calc_ut(jd, swe.MOON, _FLAGS)[0]
    return s[0] % 360.0, s[3], m[0] % 360.0, m[3]


def _angle_tithi(jd):
    s, ss, m, ms = sun_moon(jd)
    return (m - s) % 360.0, ms - ss


def _angle_nak(jd):
    _, _, m, ms = sun_moon(jd)
    return m, ms


def _angle_yoga(jd):
    s, ss, m, ms = sun_moon(jd)
    return (s + m) % 360.0, ss + ms


def _angle_sun(jd):
    s, ss, _, _ = sun_moon(jd)
    return s, ss


def _solve_boundary(jd: float, angle_fn, span: float, forward: bool) -> float:
    """Time when angle_fn next (or last) crosses a multiple of `span`. Newton iteration."""
    a, _ = angle_fn(jd)
    k = int(a // span)
    target = (k + 1) * span if forward else k * span
    t = jd
    for _ in range(6):
        a, rate = angle_fn(t)
        diff = (target - a + 180.0) % 360.0 - 180.0
        if abs(diff) < 1e-7 or rate == 0:
            break
        t += diff / rate
    return t


@dataclass
class Limbs:
    tithi: int            # 1-30
    paksha: str           # 'shukla' / 'krishna'
    tithi_number: int     # 1-15
    tithi_name: str
    nakshatra: int        # 1-27
    nakshatra_name: str
    pada: int             # 1-4
    yoga: int             # 1-27
    yoga_name: str
    karana_position: int  # 1-60
    karana: int           # 1-11
    karana_name: str
    moon_rasi: int        # 1-12
    sun_rasi: int         # 1-12
    sun_lon: float
    moon_lon: float
    moon_waxing: bool

    def as_panchang_fields(self) -> Dict[str, Any]:
        """Same keys the day panchang uses, so callers can overlay them."""
        return {
            "tithi_number": self.tithi_number,
            "tithi_index_raw": self.tithi,
            "tithi_name": self.tithi_name,
            "paksha": self.paksha,
            "nakshatra_name": self.nakshatra_name,
            "nakshatra_index": self.nakshatra,
            "nakshatra_number": self.nakshatra,
            "nakshatra_pada": self.pada,
            "yoga_name": self.yoga_name,
            "yoga_index": self.yoga,
            "karana_name": self.karana_name,
            "moon_rasi_index": self.moon_rasi,
        }


def limbs_at(jd: float) -> Limbs:
    s, _, m, _ = sun_moon(jd)
    return limbs_from_longitudes(s, m)


def limbs_from_longitudes(s: float, m: float) -> Limbs:
    """Limbs from sidereal Sun and Moon longitudes (degrees)."""
    s, m = s % 360.0, m % 360.0
    elong = (m - s) % 360.0
    tithi = int(elong // 12.0) + 1
    nak = int(m // NAK_SPAN) + 1
    yoga = int(((s + m) % 360.0) // NAK_SPAN) + 1
    kpos = int(elong // 6.0) + 1
    kid = karana_of_position(kpos)
    return Limbs(
        tithi=tithi,
        paksha="shukla" if tithi <= 15 else "krishna",
        tithi_number=(tithi - 1) % 15 + 1,
        tithi_name=tithi_name(tithi),
        nakshatra=nak,
        nakshatra_name=NAKSHATRA_CANONICAL[nak],
        pada=int((m % NAK_SPAN) // (NAK_SPAN / 4.0)) + 1,
        yoga=yoga,
        yoga_name=YOGA_CANONICAL[yoga],
        karana_position=kpos,
        karana=kid,
        karana_name=KARANA_CANONICAL[kid],
        moon_rasi=int(m // 30.0) + 1,
        sun_rasi=int(s // 30.0) + 1,
        sun_lon=s,
        moon_lon=m,
        moon_waxing=elong < 180.0,
    )


def tithi_bounds(jd: float) -> Tuple[float, float]:
    return _solve_boundary(jd, _angle_tithi, 12.0, False), _solve_boundary(jd, _angle_tithi, 12.0, True)


def nakshatra_bounds(jd: float) -> Tuple[float, float]:
    return _solve_boundary(jd, _angle_nak, NAK_SPAN, False), _solve_boundary(jd, _angle_nak, NAK_SPAN, True)


def limb_spans(jd: float) -> Dict[str, Tuple[float, float]]:
    """Start and end (JD) of the tithi, nakshatra, yoga and karana running at jd."""
    return {
        "tithi": tithi_bounds(jd),
        "nakshatra": nakshatra_bounds(jd),
        "yoga": (_solve_boundary(jd, _angle_yoga, NAK_SPAN, False), _solve_boundary(jd, _angle_yoga, NAK_SPAN, True)),
        "karana": (_solve_boundary(jd, _angle_tithi, 6.0, False), _solve_boundary(jd, _angle_tithi, 6.0, True)),
    }


def ascendant_at(jd: float, lat: float, lon: float) -> float:
    """Sidereal (Lahiri) ascendant longitude in degrees at jd (UT)."""
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    _, ascmc = swe.houses_ex(jd, lat, lon, b"W", swe.FLG_SIDEREAL)
    return ascmc[0] % 360.0


def moon_phase(jd: float) -> Dict[str, Any]:
    """Waxing or waning, and the lit fraction of the Moon (0-100)."""
    import math
    s, _, m, _ = sun_moon(jd)
    elong = (m - s) % 360.0
    return {"waxing": elong < 180.0, "illumination": round(50.0 * (1 - math.cos(math.radians(elong))))}


def next_limb_change(jd: float) -> float:
    """Earliest next change of karana (covers tithi), nakshatra, yoga or Moon rashi."""
    return min(
        _solve_boundary(jd, _angle_tithi, 6.0, True),
        _solve_boundary(jd, _angle_nak, NAK_SPAN, True),
        _solve_boundary(jd, _angle_yoga, NAK_SPAN, True),
        _solve_boundary(jd, _angle_nak, 30.0, True),
    )


def split_by_limbs(start: datetime, end: datetime, tz_offset: float) -> List[Tuple[datetime, datetime, Limbs]]:
    """Splits [start, end] wherever any limb changes. Each segment carries its limbs."""
    out: List[Tuple[datetime, datetime, Limbs]] = []
    cur = start
    guard = 0
    while cur < end and guard < 12:
        guard += 1
        jd = local_to_jd(cur, tz_offset) + 1e-6
        nxt = jd_to_local(next_limb_change(jd), tz_offset)
        seg_end = min(end, nxt) if nxt > cur else end
        mid = cur + (seg_end - cur) / 2
        out.append((cur, seg_end, limbs_at(local_to_jd(mid, tz_offset))))
        cur = seg_end
    return out


# ── Varjyam (book table) ─────────────────────────────────────────────────────
def varjyam_windows(day_start: datetime, day_end: datetime, tz_offset: float) -> List[Dict[str, Any]]:
    """
    Varjyam windows overlapping [day_start, day_end]:
    start = nakshatra_start + (ghati_offset / 60) * nakshatra_duration, length 4/60 of it.
    """
    out: List[Dict[str, Any]] = []
    jd = local_to_jd(day_start, tz_offset)
    jd_end = local_to_jd(day_end, tz_offset)
    seen = set()
    guard = 0
    while jd < jd_end and guard < 6:
        guard += 1
        ns, ne = nakshatra_bounds(jd + 1e-6)
        nak = limbs_at((ns + ne) / 2).nakshatra
        if (nak, round(ns, 3)) not in seen:
            seen.add((nak, round(ns, 3)))
            dur = ne - ns
            vs = ns + dur * VARJYAM_START_GHATI[nak] / 60.0
            ve = vs + dur * VARJYAM_LENGTH_GHATI / 60.0
            s_dt, e_dt = jd_to_local(vs, tz_offset), jd_to_local(ve, tz_offset)
            if e_dt > day_start and s_dt < day_end:
                out.append({"start": s_dt, "end": e_dt, "nakshatra": NAKSHATRA_CANONICAL[nak]})
        jd = ne + 1e-6
    return out


# ── Sankranti (M11 #2) ───────────────────────────────────────────────────────
def sankranti_proximity(jd: float) -> Dict[str, Any]:
    """
    Blocks 16 ghatis before and after the Sun's entry into a sign; 30 ghatis for the
    movable-sign entries (Mesha, Karkataka, Tula, Makara).
    """
    s, ss, _, _ = sun_moon(jd)
    deg_in = s % 30.0
    sign_now = int(s // 30.0) + 1
    next_sign = sign_now % 12 + 1
    hours_since = deg_in / ss * 24.0
    hours_until = (30.0 - deg_in) / ss * 24.0
    after_lim = (30 if sign_now in MOVABLE_SIGNS else 16) * GHATI_HOURS
    before_lim = (30 if next_sign in MOVABLE_SIGNS else 16) * GHATI_HOURS
    if hours_since <= after_lim:
        return {"in_window": True, "sign": sign_now, "relation": "after", "hours": hours_since,
                "limit_ghatis": after_lim / GHATI_HOURS}
    if hours_until <= before_lim:
        return {"in_window": True, "sign": next_sign, "relation": "before", "hours": hours_until,
                "limit_ghatis": before_lim / GHATI_HOURS}
    return {"in_window": False, "sign": sign_now}


# ── Eclipses (M11 #14) ───────────────────────────────────────────────────────
@lru_cache(maxsize=512)
def _eclipses_near(day_jd: int) -> Tuple[Tuple[float, str, bool, int], ...]:
    """
    Global solar and lunar eclipses (penumbral-only lunar eclipses excluded) with maximum
    between 200 days before and 10 days after day_jd. Tuple of (jd_max, kind, is_total, nakshatra).
    """
    found = []
    lo, hi = day_jd - 200.0, day_jd + 10.0
    searches = (
        ("solar", swe.sol_eclipse_when_glob, 0),
        ("lunar", swe.lun_eclipse_when, swe.ECL_TOTAL | swe.ECL_PARTIAL),
    )
    for kind, fn, ecltype in searches:
        t = hi
        for _ in range(12):
            try:
                retflag, tret = fn(t, swe.FLG_SWIEPH, ecltype, True)
            except Exception as ex:  # ephemeris files missing etc.
                logger.error(f"Eclipse search failed ({kind}): {ex}")
                raise
            tmax = tret[0]
            if tmax < lo:
                break
            nak = limbs_at(tmax).nakshatra
            found.append((tmax, kind, bool(retflag & swe.ECL_TOTAL), nak))
            t = tmax - 1.0
    return tuple(sorted(found))


def eclipse_status(jd: float, moon_nakshatra: int) -> Dict[str, Any]:
    """
    Strict profile: a total eclipse blocks 7 days on each side, a partial one 3.5 days
    on each side; the eclipse nakshatra stays unfit for 6 months afterwards.
    """
    for tmax, kind, total, nak in _eclipses_near(int(jd)):
        span = 7.0 if total else 3.5
        if abs(jd - tmax) <= span:
            return {"blocked": True, "reason": "window", "kind": kind, "total": total,
                    "days": round(jd - tmax, 1), "nakshatra": NAKSHATRA_CANONICAL[nak]}
        if 0 <= jd - tmax <= 182.6 and moon_nakshatra == nak:
            return {"blocked": True, "reason": "nakshatra", "kind": kind, "total": total,
                    "days": round(jd - tmax, 1), "nakshatra": NAKSHATRA_CANONICAL[nak]}
    return {"blocked": False}


# ── Utpata calendar (M11 #15) ────────────────────────────────────────────────
# Admins record omens on the Content page (table app.utpata_events). Read through a
# 60-second cache; adding or removing an entry clears it in that process at once.
_UTPATA_TTL = 60.0
_utpata_cache: Dict[str, Any] = {"at": None, "rows": None}


class UtpataUnavailable(RuntimeError):
    """The omen calendar could not be read and nothing was cached: #15 can't be judged."""


def clear_utpata_cache() -> None:
    _utpata_cache["at"] = None


def _utpata_rows() -> List[Dict[str, Any]]:
    import time
    from sqlalchemy import text
    from app.db.engine import app_engine
    at = _utpata_cache["at"]
    if at is not None and time.monotonic() - at < _UTPATA_TTL:
        return _utpata_cache["rows"]
    try:
        with app_engine().connect() as c:
            rows = [{"from": r.event_date, "to": r.end_date or r.event_date, "kind": r.kind,
                     "note_en": r.description_en or r.description_te or r.kind,
                     "note_te": r.description_te or r.description_en or r.kind, "region": r.region}
                    for r in c.execute(text("""SELECT event_date, end_date, kind, description_en, description_te, region
                                               FROM app.utpata_events WHERE deleted_at IS NULL"""))]
    except Exception as ex:
        if _utpata_cache["rows"] is not None:      # keep judging with the last list we read
            logger.warning(f"Omen calendar unavailable, using the last copy: {type(ex).__name__}")
            return _utpata_cache["rows"]
        logger.error(f"Omen calendar unavailable: {type(ex).__name__}")
        raise UtpataUnavailable() from ex
    _utpata_cache["rows"], _utpata_cache["at"] = rows, time.monotonic()
    return rows


def utpata_on(day: date) -> Optional[Dict[str, Any]]:
    """The admin-recorded omen covering `day`, if any. Raises UtpataUnavailable if it can't be read."""
    for row in _utpata_rows():
        if row["from"] <= day <= row["to"]:
            return row
    return None


# ── Guru / Shukra moudhya (plan M16 18.4) ────────────────────────────────────
_MOUDHYA_PLANETS = {"jupiter": swe.JUPITER, "venus": swe.VENUS}
_COMBUST_ORB = {"jupiter": 11.0, "venus": 10.0}


def _elongation(jd: float, pid: int) -> Tuple[float, bool]:
    """(signed degrees planet minus Sun in [-180, 180), is_retrograde)."""
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    s = swe.calc_ut(jd, swe.SUN, _FLAGS)[0][0]
    p = swe.calc_ut(jd, pid, _FLAGS)[0]
    return (p[0] - s + 180.0) % 360.0 - 180.0, p[3] < 0


def _is_combust(jd: float, planet: str) -> Tuple[bool, float]:
    d, retro = _elongation(jd, _MOUDHYA_PLANETS[planet])
    orb = 8.0 if planet == "venus" and retro else _COMBUST_ORB[planet]
    return abs(d) <= orb, d


@lru_cache(maxsize=1024)
def moudhya_status(day_jd: int, planet: str) -> Dict[str, Any]:
    """
    Combust (moudhya) or in its bala (child) / vriddha (old) days, per the book:
      Venus: child 3 days after rising in the east, 10 after rising in the west;
             old 15 days before setting in the east, 10 before setting in the west.
      Jupiter: child 16 days after rising, old 16 days before setting.
    A planet ahead of the Sun (positive elongation) is an evening star (west);
    behind it, a morning star (east).
    """
    jd = float(day_jd) + 0.5
    comb, d = _is_combust(jd, planet)
    if comb:
        return {"state": "combust", "planet": planet}
    # Days since combustion ended (rising) and until it begins (setting), within 20 days
    since = until = None
    for i in range(1, 21):
        if since is None and _is_combust(jd - i, planet)[0]:
            since = i
        if until is None and _is_combust(jd + i, planet)[0]:
            until = i
        if since is not None and until is not None:
            break
    side = "west" if d > 0 else "east"
    if planet == "venus":
        child_lim = 10 if side == "west" else 3
        old_lim = 10 if side == "west" else 15
    else:
        child_lim = old_lim = 16
    if since is not None and since <= child_lim:
        return {"state": "bala", "planet": planet, "days": since, "side": side}
    if until is not None and until <= old_lim:
        return {"state": "vriddha", "planet": planet, "days": until, "side": side}
    return {"state": "clear", "planet": planet}
