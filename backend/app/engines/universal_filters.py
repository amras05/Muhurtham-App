"""
Universal Filters Engine (Layer 2).
Provides comprehensive validation for:
1. Multi-Method Panchaka: Standard (mod 9), Dhruvaka (Rashi constants), and Matantara.
2. 21 Mahadoshas and 10 Dashavidha doshas evaluation.
3. Participant Tarabala (9-fold Tara) and Chandrabala (Janma Rasi vs Transit Moon).
4. Inauspicious Kala interval extraction (Rahu, Yama, Gulika, Varjyam, Durmuhurtham).
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.engines.doshas import evaluate_21_maha_doshas, evaluate_10_dashavidha_doshas
from app.engines.time_windows import TimeWindow

# Canonical Dhruvaka constants for 12 Rashis (Restoring missing Mithuna = 8 from treatise)
# 1: Mesha, 2: Vrishabha, 3: Mithuna, 4: Karkataka, 5: Simha, 6: Kanya,
# 7: Tula, 8: Vrishchika, 9: Dhanus, 10: Makara, 11: Kumbha, 12: Meena
DHRUVAKA_CONSTANTS = {
    1: 5,   # Mesha
    2: 7,   # Vrishabha
    3: 8,   # Mithuna (canonical restoration)
    4: 5,   # Karkataka
    5: 3,   # Simha
    6: 1,   # Kanya
    7: 2,   # Tula
    8: 4,   # Vrishchika
    9: 6,   # Dhanus
    10: 8,  # Makara
    11: 9,  # Kumbha
    12: 3   # Meena
}

PANCHAKA_CLASSIFICATIONS = {
    1: {
        "name_en": "Mrityu Panchakam",
        "name_te": "మృత్యు పంచకం",
        "is_pass": False,
        "danger_level": "extreme",
        "effect_en": "Danger to life, severe harm, failure",
        "effect_te": "మరణ భయం, కార్య వినాశనం",
        "pariharam_en": "Donation of sandalwood / sesame seeds",
        "pariharam_te": "చందన లేదా తిల దానము"
    },
    2: {
        "name_en": "Agni Panchakam",
        "name_te": "అగ్ని పంచకం",
        "is_pass": False,
        "danger_level": "high",
        "effect_en": "Danger from fire, burns, disputes",
        "effect_te": "అగ్ని భయం, గృహ కలహాలు",
        "pariharam_en": "Donation of gold or ghee",
        "pariharam_te": "సువర్ణ లేదా ఆజ్యా (నెయ్యి) దానము"
    },
    4: {
        "name_en": "Raja Panchakam",
        "name_te": "రాజ పంచకం",
        "is_pass": False,
        "danger_level": "medium",
        "effect_en": "Government/legal penalties, royal displeasure",
        "effect_te": "రాజ ద్వేషం, న్యాయ పరమైన నష్టాలు",
        "pariharam_en": "Donation of land or red fruits",
        "pariharam_te": "భూ లేదా రక్త ఫల దానము"
    },
    6: {
        "name_en": "Chora Panchakam",
        "name_te": "చోర పంచకం",
        "is_pass": False,
        "danger_level": "medium",
        "effect_en": "Theft, cheating, monetary loss",
        "effect_te": "చోర భయం, మోసం, ధన నష్టం",
        "pariharam_en": "Donation of silver or copper vessel",
        "pariharam_te": "రజత లేదా తామ్ర పాత్ర దానము"
    },
    8: {
        "name_en": "Roga Panchakam",
        "name_te": "రోగ పంచకం",
        "is_pass": False,
        "danger_level": "high",
        "effect_en": "Illness, chronic disease, bodily affliction",
        "effect_te": "రోగ భయం, శారీరక పీడ",
        "pariharam_en": "Donation of medicine or blue cloth",
        "pariharam_te": "ఔషధ లేదా నీల వస్త్ర దానము"
    },
    # Auspicious remainders (0, 3, 5, 7)
    0: {
        "name_en": "Shubha Panchakam (Panchaka Rahitam)",
        "name_te": "శుభ పంచకం (దోష రహితం)",
        "is_pass": True,
        "danger_level": "none",
        "effect_en": "Auspicious and favorable",
        "effect_te": "శుభప్రదం, కార్యసిద్ధి",
        "pariharam_en": "None needed",
        "pariharam_te": "పరిహారం అవసరం లేదు"
    }
}
# Map 3, 5, 7 to Shubha
PANCHAKA_CLASSIFICATIONS[3] = PANCHAKA_CLASSIFICATIONS[0]
PANCHAKA_CLASSIFICATIONS[5] = PANCHAKA_CLASSIFICATIONS[0]
PANCHAKA_CLASSIFICATIONS[7] = PANCHAKA_CLASSIFICATIONS[0]

# 9-fold Tarabala definitions
TARA_NAMES = [
    ("None", "ఏదీ కాదు", False),
    ("Janma", "జన్మ తార", False),        # 1: Body/health caution
    ("Sampat", "సంపత్ తార", True),       # 2: Wealth & success (Auspicious)
    ("Vipat", "విపత్ తార", False),       # 3: Danger & obstacles (Avoid)
    ("Kshema", "క్షేమ తార", True),       # 4: Security & prosperity (Auspicious)
    ("Pratyak", "ప్రత్యక్ తార", False),   # 5: Opposition & hurdles (Avoid)
    ("Sadhana", "సాధన తార", True),       # 6: Realization & victory (Auspicious)
    ("Naidhana", "నైధన తార", False),     # 7: Destruction/affliction (Avoid)
    ("Mitra", "మిత్ర తార", True),         # 8: Friendship & happiness (Auspicious)
    ("Parama Mitra", "పరమ మిత్ర తార", True) # 9: Highest success (Auspicious)
]


# ==============================================================================
# Multi-Method Panchaka Evaluator
# ==============================================================================

def evaluate_panchaka(
    tithi_num: int,
    vaara_idx: int,
    nak_idx: int,
    lagna_rasi: int,
    method: str = "standard"
) -> Dict[str, Any]:
    """
    Evaluates Panchaka using three recognized traditions:
    1. 'standard': (Tithi + Vaara + Nakshatra + Lagna) % 9
    2. 'dhruvaka': (Tithi + Vaara + Nakshatra + Dhruvaka[Lagna]) % 9
    3. 'matantara': Paksha / Masadi adjusted tradition
    """
    t_val = int(tithi_num or 1)
    v_val = (int(vaara_idx or 0) % 7) + 1  # 1=Sunday .. 7=Saturday
    n_val = int(nak_idx or 1)
    l_val = int(lagna_rasi or 1)

    method_key = method.lower().strip()
    if method_key == "dhruvaka":
        dhruvaka_val = DHRUVAKA_CONSTANTS.get(l_val, l_val)
        total = t_val + v_val + n_val + dhruvaka_val
        formula = f"({t_val}[తిథి] + {v_val}[వారం] + {n_val}[నక్షత్రం] + {dhruvaka_val}[ధ్రువకం]) % 9"
    elif method_key == "matantara":
        # In Matantara: Krishna paksha uses reverse offset
        offset = 0 if t_val <= 15 else 1
        total = t_val + v_val + n_val + l_val + offset
        formula = f"({t_val} + {v_val} + {n_val} + {l_val} + {offset}[మతాంతరం]) % 9"
    else:  # standard
        total = t_val + v_val + n_val + l_val
        formula = f"({t_val}[తిథి] + {v_val}[వారం] + {n_val}[నక్షత్రం] + {l_val}[లగ్నం]) % 9"

    rem = total % 9
    info = PANCHAKA_CLASSIFICATIONS.get(rem, PANCHAKA_CLASSIFICATIONS[0])

    return {
        "method": method_key,
        "remainder": rem,
        "total": total,
        "formula": f"{formula} = {rem}",
        "name_en": info["name_en"],
        "name_te": info["name_te"],
        "is_pass": info["is_pass"],
        "danger_level": info.get("danger_level", "none"),
        "effect_en": info["effect_en"],
        "effect_te": info["effect_te"],
        "pariharam_en": info["pariharam_en"],
        "pariharam_te": info["pariharam_te"]
    }


# ==============================================================================
# Tarabala & Chandrabala Evaluators
# ==============================================================================

def evaluate_tarabala(transit_nak_idx: int, janma_nak_idx: int) -> Dict[str, Any]:
    """
    Computes 9-fold Tarabala: count from Janma Nakshatra to Transit Nakshatra.
    Auspicious Taras: 2 (Sampat), 4 (Kshema), 6 (Sadhana), 8 (Mitra), 9 (Parama Mitra).
    """
    if not janma_nak_idx or janma_nak_idx < 1:
        return {"is_pass": True, "tara_num": 0, "name_en": "Not specified", "name_te": "వర్తించదు"}

    count = ((int(transit_nak_idx) - int(janma_nak_idx)) % 27) + 1
    tara_num = ((count - 1) % 9) + 1  # 1 to 9
    name_en, name_te, is_pass = TARA_NAMES[tara_num]

    return {
        "janma_nak_idx": janma_nak_idx,
        "transit_nak_idx": transit_nak_idx,
        "count": count,
        "tara_num": tara_num,
        "name_en": name_en,
        "name_te": name_te,
        "is_pass": is_pass,
        "verdict_en": "Favorable" if is_pass else "Inauspicious",
        "verdict_te": "అనుకూలం" if is_pass else "వర్జ్యం",
    }


def evaluate_chandrabala(transit_moon_rasi_idx: int, janma_moon_rasi_idx: int) -> Dict[str, Any]:
    """
    Computes Chandrabala: position of Transit Moon relative to Janma Rasi (1-12).
    Auspicious: 1, 3, 6, 7, 10, 11.
    Inauspicious: 6, 8, 12 (8th house is Chandrashtama - strictly avoided!).
    """
    if not janma_moon_rasi_idx or janma_moon_rasi_idx < 1:
        return {"is_pass": True, "house_diff": 0, "name_en": "Not specified", "name_te": "వర్తించదు"}

    house_diff = ((int(transit_moon_rasi_idx) - int(janma_moon_rasi_idx)) % 12) + 1
    is_chandrashtama = (house_diff == 8)
    is_favorable = house_diff in (1, 3, 6, 7, 10, 11) and not is_chandrashtama

    return {
        "janma_rasi_idx": janma_moon_rasi_idx,
        "transit_moon_rasi_idx": transit_moon_rasi_idx,
        "house_diff": house_diff,
        "is_pass": is_favorable,
        "is_chandrashtama": is_chandrashtama,
        "verdict_en": "Favorable" if is_favorable else ("Chandrashtama (Avoid)" if is_chandrashtama else "Weak"),
        "verdict_te": "అనుకూలం" if is_favorable else ("చంద్రాష్టమం (వర్జ్యం)" if is_chandrashtama else "ప్రతికూలం"),
    }


# ==============================================================================
# Inauspicious Kala Window Extractor
# ==============================================================================

def extract_inauspicious_windows(panchang_data: Dict[str, Any], base_date: datetime) -> List[TimeWindow]:
    """
    Extracts Rahu Kaalam, Yamagandam, Gulika Kaalam, Durmuhurtham, and Varjyam
    as TimeWindows for interval subtraction.
    """
    blocked_windows: List[TimeWindow] = []

    def parse_hms_time(time_str: str) -> Optional[datetime]:
        if not time_str or time_str == "None":
            return None
        try:
            parts = [float(p) for p in time_str.split(":")]
            h = int(parts[0])
            m = int(parts[1]) if len(parts) > 1 else 0
            s = int(parts[2]) if len(parts) > 2 else 0
            # Handle next-day overflow if hours >= 24
            day_offset = h // 24
            h = h % 24
            return base_date.replace(hour=h, minute=m, second=s) + timedelta(days=day_offset)
        except Exception:
            return None

    # 1. Rahu Kaalam
    rahu = panchang_data.get("rahu_kaalam", {})
    r_start, r_end = parse_hms_time(rahu.get("start")), parse_hms_time(rahu.get("end"))
    if r_start and r_end and r_start < r_end:
        blocked_windows.append(TimeWindow(start=r_start, end=r_end, label="Rahu Kaalam", metadata={"type": "rahu"}))

    # 2. Yamagandam
    yama = panchang_data.get("yamagandam", {})
    y_start, y_end = parse_hms_time(yama.get("start")), parse_hms_time(yama.get("end"))
    if y_start and y_end and y_start < y_end:
        blocked_windows.append(TimeWindow(start=y_start, end=y_end, label="Yamagandam", metadata={"type": "yama"}))

    # 3. Gulika Kaalam
    gulika = panchang_data.get("gulika_kaalam", {})
    g_start, g_end = parse_hms_time(gulika.get("start")), parse_hms_time(gulika.get("end"))
    if g_start and g_end and g_start < g_end:
        blocked_windows.append(TimeWindow(start=g_start, end=g_end, label="Gulika Kaalam", metadata={"type": "gulika"}))

    # 4. Durmuhurtham intervals (can be 1 or 2 periods per day)
    durmuhurtas = panchang_data.get("durmuhurtham", [])
    if isinstance(durmuhurtas, list):
        for idx, dm in enumerate(durmuhurtas):
            dm_start, dm_end = parse_hms_time(dm.get("start")), parse_hms_time(dm.get("end"))
            if dm_start and dm_end and dm_start < dm_end:
                blocked_windows.append(
                    TimeWindow(start=dm_start, end=dm_end, label=f"Durmuhurtham #{idx+1}", metadata={"type": "durmuhurta"})
                )

    # 5. Varjyam (Visha Ghatikas)
    varjyams = panchang_data.get("varjyam", [])
    if isinstance(varjyams, list):
        for idx, vj in enumerate(varjyams):
            v_start, v_end = parse_hms_time(vj.get("start")), parse_hms_time(vj.get("end"))
            if v_start and v_end and v_start < v_end:
                blocked_windows.append(
                    TimeWindow(start=v_start, end=v_end, label=f"Varjyam #{idx+1}", metadata={"type": "varjyam"})
                )

    return blocked_windows

