"""
Muhurtham App — single source of truth for shared constants.

Constants that were previously duplicated across main.py, muhurta_finder.py,
doshas_engine.py, and samskaras_engine.py are consolidated here.
"""
from typing import Dict, List, Tuple


# ── Planet Name Mappings ──────────────────────────────────────
# Previously duplicated in: muhurta_finder.py, doshas_engine.py, samskaras_engine.py
PLANET_NAMES_MAP: Dict[str, str] = {
    "0": "Sun", "1": "Moon", "2": "Mars", "3": "Mercury", "4": "Jupiter",
    "5": "Venus", "6": "Saturn", "7": "Rahu", "8": "Ketu",
    "Mnd": "Mandi", "Gk": "Gulika",
}

# ── Malefic Planet IDs ────────────────────────────────────────
# Previously duplicated in: doshas_engine.py, samskaras_engine.py
MALEFIC_IDS: List[str] = ["0", "2", "6", "7", "8"]  # Sun, Mars, Saturn, Rahu, Ketu


# ── Tara (Star) Names ────────────────────────────────────────
# Previously duplicated in: muhurta_finder.py, samskaras_engine.py
TARA_NAMES: Dict[int, str] = {
    1: "Janma", 2: "Sampat", 3: "Vipat", 4: "Kshema", 5: "Pratyak",
    6: "Sadhana", 7: "Naidhana", 8: "Mitra", 9: "Paramamitra",
}

TARA_NAMES_TE: Dict[int, str] = {
    1: "జన్మ తార (అశుభం)", 2: "సంపత్ తార (శుభం)", 3: "విపత్ తార (అశుభం)",
    4: "క్షేమ తార (శుభం)", 5: "ప్రత్యక్ తార (అశుభం)", 6: "సాధన తార (శుభం)",
    7: "నైధన తార (అశుభం)", 8: "మిత్ర తార (శుభం)", 9: "పరమమిత్ర తార (శుభం)",
}

# Unfavorable tara indices (Janma, Vipat, Pratyak, Naidhana)
TARA_UNFAVORABLE: List[int] = [1, 3, 5, 7]


# ── Pushkara Navamsha Ranges ─────────────────────────────────
# Ranges per Rasi (0-indexed: 0=Mesha ... 11=Meena)
# Previously duplicated in: main.py, samskaras_engine.py
PUSHKARA_RANGES: Dict[int, List[Tuple[float, float]]] = {
    # Fiery (Mesha 0, Simha 4, Dhanus 8)
    0: [(20.0, 23.3333), (26.6667, 30.0)],
    4: [(20.0, 23.3333), (26.6667, 30.0)],
    8: [(20.0, 23.3333), (26.6667, 30.0)],
    # Earthy (Vrishabha 1, Kanya 5, Makara 9)
    1: [(6.6667, 10.0), (13.3333, 16.6667)],
    5: [(6.6667, 10.0), (13.3333, 16.6667)],
    9: [(6.6667, 10.0), (13.3333, 16.6667)],
    # Airy (Mithuna 2, Tula 6, Kumbha 10)
    2: [(16.6667, 20.0), (23.3333, 26.6667)],
    6: [(16.6667, 20.0), (23.3333, 26.6667)],
    10: [(16.6667, 20.0), (23.3333, 26.6667)],
    # Watery (Karkataka 3, Vrishchika 7, Meena 11)
    3: [(0.0, 3.3333), (6.6667, 10.0)],
    7: [(0.0, 3.3333), (6.6667, 10.0)],
    11: [(0.0, 3.3333), (6.6667, 10.0)],
}

PUSHKARA_BHAGA_DEGS: Dict[int, float] = {
    0: 21.0, 4: 21.0, 8: 21.0,    # Fiery
    1: 14.0, 5: 14.0, 9: 14.0,    # Earthy
    2: 24.0, 6: 24.0, 10: 24.0,   # Airy
    3: 7.0,  7: 7.0,  11: 7.0,    # Watery
}


# ── Rasi Names (Telugu) ──────────────────────────────────────
# Used in pushkara window computation and lagna display
RASI_NAMES_TE: List[str] = [
    "మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య",
    "తులా", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం",
]

# Aliases for backwards compatibility and readable naming
TELUGU_RASI_NAMES = RASI_NAMES_TE

