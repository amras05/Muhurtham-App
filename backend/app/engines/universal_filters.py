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

# Dhruvaka constants per lagna, as printed in the book (Part 1, "Dhruvaka").
# The book omits Mithuna; that lagna falls back to the standard method and says so.
DHRUVAKA_CONSTANTS = {
    1: 4,   # Mesha
    2: 6,   # Vrishabha
    4: 5,   # Karkataka
    5: 4,   # Simha
    6: 3,   # Kanya
    7: 2,   # Tula
    8: 1,   # Vrishchika
    9: 0,   # Dhanus
    10: 1,  # Makara
    11: 2,  # Kumbha
    12: 3,  # Meena
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
    method: str = "standard",
    tithi_30: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Panchaka rahita (Book Part 1; plan M8).
      'standard'  : tithi (1-15 of the paksha) + vara (Sunday=1) + nakshatra (Ashwini=1) + lagna (Mesha=1), mod 9
      'matantara' : Method 2 — elapsed tithis of the paksha + lagna, mod 9
      'masadiga'  : Method 3 — tithi counted 1-30 from Shukla Pratipada + vara + nakshatra + lagna, mod 9
      'dhruvaka'  : standard sum + the book's lagna constant, mod 9 (Mithuna constant missing in the book)
    Remainders 1 Mrityu, 2 Agni, 4 Raja, 6 Chora, 8 Roga fail; 0, 3, 5, 7 are panchaka-free.
    """
    t_val = int(tithi_num or 1)
    v_val = (int(vaara_idx or 0) % 7) + 1  # 1=Sunday .. 7=Saturday
    n_val = int(nak_idx or 1)
    l_val = int(lagna_rasi or 1)
    note = ""

    method_key = (method or "standard").lower().strip()
    if method_key == "dhruvaka" and l_val not in DHRUVAKA_CONSTANTS:
        method_key = "standard"
        note = "Book gives no dhruvaka constant for Mithuna; standard method used."
    if method_key == "dhruvaka":
        dh = DHRUVAKA_CONSTANTS[l_val]
        total = t_val + v_val + n_val + l_val + dh
        formula = f"({t_val}[తిథి] + {v_val}[వారం] + {n_val}[నక్షత్రం] + {l_val}[లగ్నం] + {dh}[ధ్రువకం]) % 9"
        note = "Dhruvaka method: the book's five-constant procedure is awaiting the author's explanation."
    elif method_key == "matantara":
        elapsed = t_val - 1
        total = elapsed + l_val
        formula = f"({elapsed}[గత తిథి] + {l_val}[లగ్నం]) % 9"
    elif method_key == "masadiga":
        t30 = int(tithi_30 or t_val)
        total = t30 + v_val + n_val + l_val
        formula = f"({t30}[మాసాది తిథి] + {v_val}[వారం] + {n_val}[నక్షత్రం] + {l_val}[లగ్నం]) % 9"
    else:
        method_key = "standard"
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
        "pariharam_te": info["pariharam_te"],
        "note": note,
    }


# ==============================================================================
# Tarabala & Chandrabala Evaluators
# ==============================================================================

def evaluate_tarabala(transit_nak_idx: int, janma_nak_idx: int) -> Dict[str, Any]:
    """
    9-fold Tarabala (Book Part 1; plan M9 11.1): count from the janma nakshatra to the
    muhurta nakshatra inclusive. Navaka rule ("Prathamam prathamam tyajyam"):
    Janma is avoided only in the first navaka (count 1-9), Vipat only in the second
    (10-18), Pratyak only in the third (19-27); Naidhana in all three.
    """
    if not janma_nak_idx or janma_nak_idx < 1:
        return {"is_pass": True, "tara_num": 0, "name_en": "Not specified", "name_te": "వర్తించదు"}

    count = ((int(transit_nak_idx) - int(janma_nak_idx)) % 27) + 1
    tara_num = ((count - 1) % 9) + 1  # 1 to 9
    navaka = (count - 1) // 9 + 1     # 1 to 3
    name_en, name_te, _ = TARA_NAMES[tara_num]
    is_pass = not (
        tara_num == 7
        or (tara_num == 1 and navaka == 1)
        or (tara_num == 3 and navaka == 2)
        or (tara_num == 5 and navaka == 3)
    )

    return {
        "janma_nak_idx": janma_nak_idx,
        "transit_nak_idx": transit_nak_idx,
        "count": count,
        "navaka": navaka,
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

def extract_inauspicious_windows(
    panchang_data: Dict[str, Any],
    base_date: datetime,
    include: Optional[Dict[str, bool]] = None,
) -> List[TimeWindow]:
    """
    Rahu kalam, Yamagandam, Gulika kalam and Durmuhurta as TimeWindows (plan M10).
    `include` switches each type on or off: keys 'rahu', 'yama', 'gulika', 'durmuhurta'
    (all on by default). Varjyam is computed from the book's ghati table in
    engines/limb_timeline.varjyam_windows, not here.
    """
    inc = {"rahu": True, "yama": True, "gulika": True, "durmuhurta": True}
    inc.update(include or {})
    blocked_windows: List[TimeWindow] = []

    def parse_hms_time(value: Any) -> Optional[datetime]:
        if value is None or value == "None":
            return None
        try:
            if isinstance(value, (int, float)):
                hours = float(value)
            else:
                parts = [float(p) for p in str(value).split(":")]
                hours = parts[0] + (parts[1] / 60.0 if len(parts) > 1 else 0.0) + (parts[2] / 3600.0 if len(parts) > 2 else 0.0)
            return base_date + timedelta(seconds=round(hours * 3600.0))
        except (TypeError, ValueError):
            return None

    def add(span: Any, label: str, kind: str) -> None:
        if not isinstance(span, dict):
            return
        s, e = parse_hms_time(span.get("start")), parse_hms_time(span.get("end"))
        if s and e and s < e:
            blocked_windows.append(TimeWindow(start=s, end=e, label=label, metadata={"type": kind}))

    if inc["rahu"]:
        add(panchang_data.get("rahu_kalam"), "Rahu Kalam", "rahu")
    if inc["yama"]:
        add(panchang_data.get("yamagandam"), "Yamagandam", "yama")
    if inc["gulika"]:
        add(panchang_data.get("gulika_kalam"), "Gulika Kalam", "gulika")
    if inc["durmuhurta"]:
        dms = panchang_data.get("durmuhurtam") or []
        if isinstance(dms, dict):
            dms = [dms]
        for idx, dm in enumerate(dms):
            add(dm, f"Durmuhurta #{idx + 1}", "durmuhurta")

    return blocked_windows
