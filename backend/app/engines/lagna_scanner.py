"""
Lagna & Planetary House Scanner Engine (Layer 1).
Computes exact Lagna start/end intervals, Navamsa signs, Pushkara navamsas,
and full D1/D9 planetary house placements to evaluate house occupancy rules
(e.g., Ashtama Shuddhi, malefics in 3/6/11, benefics in Kendras).
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple
import swisseph as swe

from app.engines.time_windows import TimeWindow
from app.schemas.rules import HouseRule

# Canonical Rashi Names
RASI_NAMES_EN = [
    "", "Mesha", "Vrishabha", "Mithuna", "Karkataka", "Simha", "Kanya",
    "Tula", "Vrishchika", "Dhanus", "Makara", "Kumbha", "Meena"
]

RASI_NAMES_TE = [
    "", "మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య",
    "తుల", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"
]

# Rashi mobility
RASHI_MOBILITY = {
    1: "chara", 2: "sthira", 3: "dvisvabhava",
    4: "chara", 5: "sthira", 6: "dvisvabhava",
    7: "chara", 8: "sthira", 9: "dvisvabhava",
    10: "chara", 11: "sthira", 12: "dvisvabhava"
}

# Planets tracked in Muhurtha
PLANET_IDS = [
    (swe.SUN, "Sun", "సూర్యుడు", True),        # id, name_en, name_te, is_malefic
    (swe.MOON, "Moon", "చంద్రుడు", False),
    (swe.MARS, "Mars", "కుజుడు", True),
    (swe.MERCURY, "Mercury", "బుధుడు", False),
    (swe.JUPITER, "Jupiter", "గురుడు", False),
    (swe.VENUS, "Venus", "శుక్రుడు", False),
    (swe.SATURN, "Saturn", "శని", True),
    (swe.MEAN_NODE, "Rahu", "రాహువు", True),
]

# Pushkara Navamsa mapping: (Rasi_idx 1-12) -> set of navamsa indices (1-9) that are Pushkara
# Mesha, Simha, Dhanus (Fire): 7th (Tula) and 9th (Dhanus) navamsas
# Vrishabha, Kanya, Makara (Earth): 3rd (Meena) and 5th (Vrishabha) navamsas
# Mithuna, Tula, Kumbha (Air): 6th (Kanya) and 8th (Dhanus) navamsas
# Karkataka, Vrishchika, Meena (Water): 1st (Karkataka) and 3rd (Kanya) navamsas
PUSHKARA_NAVAMSAS = {
    1: {7, 9}, 5: {7, 9}, 9: {7, 9},
    2: {3, 5}, 6: {3, 5}, 10: {3, 5},
    3: {6, 8}, 7: {6, 8}, 11: {6, 8},
    4: {1, 3}, 8: {1, 3}, 12: {1, 3}
}


@dataclass
class PlanetPlacement:
    planet_id: int
    name_en: str
    name_te: str
    is_malefic: bool
    longitude: float
    rasi_idx: int         # 1-12
    rasi_degree: float     # 0.0 - 30.0
    navamsa_idx: int      # 1-12 sign
    house_num: int        # 1-12 relative to Lagna
    speed: float = 0.0    # degrees per day; negative = retrograde (11 Nov 2026)


@dataclass
class LagnaWindow(TimeWindow):
    lagna_idx: int = 1               # 1-12
    lagna_name_en: str = ""
    lagna_name_te: str = ""
    mobility: str = ""               # chara, sthira, dvisvabhava
    navamsa_idx: int = 1             # 1-12
    navamsa_name_en: str = ""
    is_pushkara_navamsa: bool = False
    house_planets: Dict[int, List[PlanetPlacement]] = field(default_factory=dict) # house 1-12 -> planets
    # Exact pushkara navamsa spans inside this lagna (plan R6a): (start, end, navamsa sign name).
    # A lagna (~2 h) holds two pushkara navamsas of ~13 minutes each; the finder checks each
    # muhurta window against these instead of the lagna's midpoint.
    pushkara_spans: List[Tuple[datetime, datetime, str]] = field(default_factory=list)


def get_navamsa_sign(longitude: float) -> int:
    """Calculate the D9 Navamsa sign (1-12) from sidereal longitude (0-360°)."""
    lon = longitude % 360.0
    total_navamsas = int(lon / (30.0 / 9.0))  # each navamsa is 3°20' = 3.3333°
    return (total_navamsas % 12) + 1


def is_pushkara_navamsa(longitude: float) -> bool:
    """Check if the given longitude falls in a Pushkara Navamsa."""
    lon = longitude % 360.0
    rasi_idx = int(lon // 30) + 1
    rem_deg = lon % 30.0
    nav_pos = int(rem_deg / (30.0 / 9.0)) + 1  # 1 to 9
    return nav_pos in PUSHKARA_NAVAMSAS.get(rasi_idx, set())


def get_planet_positions(jd_ut: float) -> List[PlanetPlacement]:
    """Calculate sidereal positions of the 9 grahas at a given Julian Date."""
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    placements = []

    for pid, name_en, name_te, is_mal in PLANET_IDS:
        flags = swe.FLG_SIDEREAL | swe.FLG_SPEED
        res, _ = swe.calc_ut(jd_ut, pid, flags)
        lon = res[0] % 360.0
        rasi_idx = int(lon // 30) + 1
        rasi_deg = lon % 30.0
        nav_idx = get_navamsa_sign(lon)

        placements.append(
            PlanetPlacement(
                planet_id=pid,
                name_en=name_en,
                name_te=name_te,
                is_malefic=is_mal,
                longitude=lon,
                rasi_idx=rasi_idx,
                rasi_degree=rasi_deg,
                navamsa_idx=nav_idx,
                house_num=1,  # Calculated when paired with Lagna
                speed=res[3],
            )
        )

    # Compute Ketu (exactly 180° opposite Rahu)
    rahu_pos = next(p for p in placements if p.planet_id == swe.MEAN_NODE)
    ketu_lon = (rahu_pos.longitude + 180.0) % 360.0
    ketu_rasi = int(ketu_lon // 30) + 1
    placements.append(
        PlanetPlacement(
            planet_id=99,
            name_en="Ketu",
            name_te="కేతువు",
            is_malefic=True,
            longitude=ketu_lon,
            rasi_idx=ketu_rasi,
            rasi_degree=ketu_lon % 30.0,
            navamsa_idx=get_navamsa_sign(ketu_lon),
            house_num=1,
        )
    )

    return placements


def _pushkara_spans(lagna_deg_at, rasi_idx: int, start_h: float, end_h: float,
                    base_date: datetime) -> List[Tuple[datetime, datetime, str]]:
    """Exact times the rising degree is inside each pushkara navamsa of this sign (bisection, < 1 s)."""
    base = (rasi_idx - 1) * 30.0

    def offset(h: float) -> float:          # degrees risen inside this sign, 0-30
        d = (lagna_deg_at(h) - base) % 360.0
        return d if d <= 30.0 else (0.0 if d > 180.0 else 30.0)

    def first_at(target: float) -> Optional[float]:
        if offset(start_h) >= target:
            return start_h
        if offset(end_h) < target:
            return None
        lo, hi = start_h, end_h
        for _ in range(24):
            mid = 0.5 * (lo + hi)
            if offset(mid) >= target:
                hi = mid
            else:
                lo = mid
        return hi

    out: List[Tuple[datetime, datetime, str]] = []
    span = 30.0 / 9.0
    for n in sorted(PUSHKARA_NAVAMSAS.get(rasi_idx, ())):
        a, b = (n - 1) * span, n * span
        t_a = first_at(a)
        if t_a is None:
            continue
        t_b = first_at(b) or end_h
        if t_b > t_a:
            nav_name = RASI_NAMES_EN[get_navamsa_sign(base + a + span / 2)]
            out.append((base_date + timedelta(hours=t_a), base_date + timedelta(hours=t_b), nav_name))
    return out


def scan_day_lagnas(
    year: int, month: int, day: int,
    lat: float, lon: float, tz_offset: float,
    sunrise_h: float
) -> List[LagnaWindow]:
    """
    Computes exact Lagna intervals across a 24-hour sunrise-to-sunrise span.
    Populates planetary house occupancy and Navamsa data for each Lagna.
    """
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    base_date = datetime(year, month, day)

    def get_lagna_deg(hour_val: float) -> float:
        ut_h = hour_val - tz_offset
        jd_base = swe.julday(year, month, day, 0.0)
        jd_t = jd_base + ut_h / 24.0
        _, ascmc = swe.houses_ex(jd_t, lat, lon, b'P', swe.FLG_SIDEREAL)
        return ascmc[0] % 360.0

    # 1. Step through 24h at 2-minute increments to find Lagna boundary transitions
    transitions: List[Tuple[int, float]] = []  # (rasi_idx, hour_val)
    curr_h = sunrise_h
    prev_rasi = int(get_lagna_deg(curr_h) // 30) + 1
    transitions.append((prev_rasi, curr_h))

    for step in range(1, int(24 * 60 / 2)):
        t_h = sunrise_h + (step * 2.0 / 60.0)
        r = int(get_lagna_deg(t_h) // 30) + 1
        if r != prev_rasi:
            # Binary search for exact boundary to ~5-second precision
            low_h, high_h = t_h - (2.0 / 60.0), t_h
            for _ in range(12):
                mid_h = 0.5 * (low_h + high_h)
                if int(get_lagna_deg(mid_h) // 30) + 1 == prev_rasi:
                    low_h = mid_h
                else:
                    high_h = mid_h
            boundary_h = 0.5 * (low_h + high_h)
            transitions.append((r, boundary_h))
            prev_rasi = r

    transitions.append((prev_rasi, sunrise_h + 24.0))

    # 2. Build LagnaWindows with mid-point planetary house placements
    lagna_windows: List[LagnaWindow] = []
    jd_base = swe.julday(year, month, day, 0.0)

    for i in range(len(transitions) - 1):
        rasi_idx, start_h = transitions[i]
        _, end_h = transitions[i + 1]

        start_dt = base_date + timedelta(hours=start_h)
        end_dt = base_date + timedelta(hours=end_h)

        mid_h = 0.5 * (start_h + end_h)
        mid_jd = jd_base + (mid_h - tz_offset) / 24.0
        lagna_deg = get_lagna_deg(mid_h)

        nav_idx = get_navamsa_sign(lagna_deg)
        spans = _pushkara_spans(get_lagna_deg, rasi_idx, start_h, end_h, base_date)
        pushkara = bool(spans)          # the lagna holds a pushkara navamsa (windows are checked exactly)

        # Compute planetary house numbers relative to this Lagna
        planets = get_planet_positions(mid_jd)
        house_map: Dict[int, List[PlanetPlacement]] = {h: [] for h in range(1, 13)}

        for p in planets:
            # Whole sign houses: house = (planet_rasi - lagna_rasi) % 12 + 1
            house = ((p.rasi_idx - rasi_idx) % 12) + 1
            p.house_num = house
            house_map[house].append(p)

        lw = LagnaWindow(
            start=start_dt,
            end=end_dt,
            label=f"{RASI_NAMES_EN[rasi_idx]} Lagna",
            metadata={
                "lagna_idx": rasi_idx,
                "lagna_en": RASI_NAMES_EN[rasi_idx],
                "lagna_te": RASI_NAMES_TE[rasi_idx],
                "navamsa_en": RASI_NAMES_EN[nav_idx],
                "navamsa_te": RASI_NAMES_TE[nav_idx],
                "pushkara_navamsa": pushkara,
            },
            lagna_idx=rasi_idx,
            lagna_name_en=RASI_NAMES_EN[rasi_idx],
            lagna_name_te=RASI_NAMES_TE[rasi_idx],
            mobility=RASHI_MOBILITY.get(rasi_idx, "chara"),
            navamsa_idx=nav_idx,
            navamsa_name_en=RASI_NAMES_EN[nav_idx],
            is_pushkara_navamsa=pushkara,
            house_planets=house_map,
            pushkara_spans=spans,
        )
        lagna_windows.append(lw)

    return lagna_windows


def evaluate_house_rules(
    lagna_window: LagnaWindow,
    rules: List[HouseRule]
) -> Tuple[bool, List[str]]:
    """
    Evaluates astrological house rules against a LagnaWindow.
    Returns (is_passed, reasons).
    """
    passed = True
    reasons = []

    for hr in rules:
        houses = [hr.house] if isinstance(hr.house, int) else hr.house
        condition = hr.planets.lower()

        for h in houses:
            planets_in_h = lagna_window.house_planets.get(h, [])
            malefics = [p for p in planets_in_h if p.is_malefic]
            benefics = [p for p in planets_in_h if not p.is_malefic]

            if condition == "none":
                # House must be completely empty (e.g. Ashtama Shuddhi - 8th house)
                if planets_in_h:
                    passed = False
                    p_names = ", ".join(p.name_en for p in planets_in_h)
                    reasons.append(f"House {h} must be empty, but contains: {p_names}")
                else:
                    reasons.append(f"House {h} is clean (Ashtama/House Shuddhi satisfied)")

            elif condition in ("no_malefics", "shubha_preferred"):
                if malefics:
                    passed = False
                    m_names = ", ".join(p.name_en for p in malefics)
                    reasons.append(f"House {h} contains malefics: {m_names}")
                elif benefics:
                    reasons.append(f"House {h} contains benefics ({', '.join(p.name_en for p in benefics)})")

            elif condition == "papa_allowed":
                # Malefics in Upachaya (3, 6, 11) are auspicious
                if malefics:
                    m_names = ", ".join(p.name_en for p in malefics)
                    reasons.append(f"Upachaya house {h} strengthened by malefics: {m_names}")

    return passed, reasons

