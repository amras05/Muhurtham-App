"""
Shared Jyotisha vocabulary for the rule engine and dosha engine.

Rule YAML files are written by hand in several spellings ("uttara_phalguni",
"Chitta", "Dhanishta", "Pushyami"...). Every name is reduced to a key of lowercase
letters and resolved through the alias tables below, so a rule matches by exact
index rather than by substring.

Book reference: Muhurta Shastra (Dr. Vamsee Nemani), Part 1 tables and Part 5
planetary friendship table (implementation plan sections 4.2, 6.2, 7.2, 8.1, 18.8).
"""
import re
from typing import Dict, Iterable, Optional, Set


def norm_key(name: str) -> str:
    """'Uttara_Phalguni' / 'Uttara Phalguni' -> 'uttaraphalguni'."""
    return re.sub(r"[^a-z]", "", str(name or "").lower())


# ── Nakshatras (1-27) ────────────────────────────────────────────────────────
NAKSHATRA_CANONICAL = [
    None, "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
    "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]

_NAK_ALIASES = {
    1: ["ashwini", "aswini", "asvini", "ashvini"],
    2: ["bharani"],
    3: ["krittika", "kritika", "karthika", "kruthika", "krithika"],
    4: ["rohini"],
    5: ["mrigashira", "mrigasira", "mrigasirsha", "mrigashirsha", "mrugashira"],
    6: ["ardra", "arudra", "aridra"],
    7: ["punarvasu", "punarvasau"],
    8: ["pushya", "pushyami", "pushyam", "pushyamu"],
    9: ["ashlesha", "aslesha", "ashlesa"],
    10: ["magha", "makha"],
    11: ["purvaphalguni", "pubba", "purva", "poorvaphalguni"],
    12: ["uttaraphalguni", "uttara", "uthraphalguni"],
    13: ["hasta", "hastha"],
    14: ["chitra", "chitta", "chittha", "chaitra"],
    15: ["swati", "svati", "swathi"],
    16: ["vishakha", "visakha", "vishaka"],
    17: ["anuradha", "anuradh"],
    18: ["jyeshtha", "jyeshta", "jyesta", "jyeshtta"],
    19: ["mula", "moola", "mool"],
    20: ["purvaashadha", "purvashadha", "purvashada", "poorvashadha"],
    21: ["uttaraashadha", "uttarashadha", "uttarashada", "uthrashadha"],
    22: ["shravana", "sravana", "shravanam"],
    23: ["dhanishtha", "dhanishta", "dhanista", "sravishtha"],
    24: ["shatabhisha", "satabhisha", "shatabhishak", "satabhishak"],
    25: ["purvabhadrapada", "purvabhadra", "poorvabhadra"],
    26: ["uttarabhadrapada", "uttarabhadra", "uthrabhadra"],
    27: ["revati", "revathi"],
}
NAKSHATRA_INDEX: Dict[str, int] = {a: i for i, al in _NAK_ALIASES.items() for a in al}
ABHIJIT_KEYS = {"abhijit", "abhijith"}

# Nakshatra groups (plan 6.3) used by YAML group tokens such as "group:dhruva".
NAKSHATRA_GROUPS: Dict[str, Set[int]] = {
    "dhruva": {12, 21, 26, 4},
    "chara": {15, 7, 22, 23, 24},
    "ugra": {2, 10, 11, 20, 25},
    "mishra": {16, 3},
    "kshipra": {1, 13, 8},
    "mridu": {5, 27, 14, 17},
    "teekshna": {19, 18, 6, 9},
    "urdhvamukha": {6, 8, 22, 23, 24, 12, 21, 26, 4},
    "adhomukha": {19, 9, 16, 3, 11, 20, 25},
    "tiryanmukha": {5, 27, 14, 17, 13, 15, 7, 1, 18},
}


def nakshatra_index(name: str) -> Optional[int]:
    return NAKSHATRA_INDEX.get(norm_key(name))


def nakshatra_set(names: Iterable[str]) -> Set[int]:
    """Resolves a YAML list (names or 'group:<name>') to nakshatra indices 1-27."""
    out: Set[int] = set()
    for n in names or []:
        s = str(n).strip().lower()
        if s.startswith("group:"):
            out |= NAKSHATRA_GROUPS.get(norm_key(s[6:]), set())
            continue
        idx = nakshatra_index(s)
        if idx:
            out.add(idx)
    return out


# ── Tithis ───────────────────────────────────────────────────────────────────
# Tithi index 1-30: 1-15 Shukla (15 = Purnima), 16-30 Krishna (30 = Amavasya).
_TITHI_NAME_NUM = {
    "pratipada": 1, "prathama": 1, "padyami": 1, "pratipat": 1,
    "dwitiya": 2, "dvitiya": 2, "vidiya": 2,
    "tritiya": 3, "trutiya": 3, "tadiya": 3,
    "chaturthi": 4, "chavithi": 4,
    "panchami": 5,
    "shashti": 6, "shashthi": 6, "sashti": 6,
    "saptami": 7,
    "ashtami": 8,
    "navami": 9,
    "dashami": 10, "dasami": 10,
    "ekadashi": 11, "ekadasi": 11,
    "dwadashi": 12, "dvadashi": 12, "dwadasi": 12,
    "trayodashi": 13, "trayodasi": 13,
    "chaturdashi": 14, "chaturdasi": 14,
}
TITHI_CLASSES = {
    "nanda": {1, 6, 11}, "bhadra": {2, 7, 12}, "jaya": {3, 8, 13},
    "rikta": {4, 9, 14}, "purna": {5, 10, 15},
}
TITHI_NAMES_EN = [
    None, "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
    "Trayodashi", "Chaturdashi",
]


def tithi_name(tithi_30: int) -> str:
    n = (tithi_30 - 1) % 15 + 1
    if n == 15:
        return "Purnima" if tithi_30 == 15 else "Amavasya"
    return TITHI_NAMES_EN[n]


def tithi_token_set(tokens: Iterable[str]) -> Set[int]:
    """
    Resolves YAML tithi tokens to tithi indices 1-30.
      'rikta' / 'nanda' ...   -> class in both pakshas
      'ashtami'               -> both pakshas
      'krishna_ashtami'       -> Krishna paksha only (prefix 'shukla_' / 'krishna_' / 'bahula_')
      'purnima' / 'amavasya'  -> 15 / 30
      'parva' / 'pancha_parva'-> Krishna Ashtami, Krishna Chaturdashi, Purnima, Amavasya
    Unknown tokens raise ValueError so a typo in a rule file never passes silently.
    """
    out: Set[int] = set()
    for tok in tokens or []:
        raw = str(tok).strip().lower()
        paksha = None
        for pre, pk in (("shukla_", "s"), ("krishna_", "k"), ("bahula_", "k")):
            if raw.startswith(pre):
                paksha, raw = pk, raw[len(pre):]
        key = norm_key(raw)
        if key in ("purnima", "pournami", "pournima", "purnami"):
            out.add(15); continue
        if key in ("amavasya", "amavasai", "amavasi"):
            out.add(30); continue
        if key in ("parva", "panchaparva"):
            out |= {23, 29, 15, 30}; continue
        if key in TITHI_CLASSES:
            nums = TITHI_CLASSES[key]
        elif key in _TITHI_NAME_NUM:
            nums = {_TITHI_NAME_NUM[key]}
        else:
            raise ValueError(f"Unknown tithi token '{tok}'")
        for n in nums:
            if n == 15:  # class 'purna' -> Purnima and Amavasya
                if paksha in (None, "s"): out.add(15)
                if paksha in (None, "k"): out.add(30)
                continue
            if paksha in (None, "s"): out.add(n)
            if paksha in (None, "k"): out.add(n + 15)
    return out


# ── Yogas (1-27) ─────────────────────────────────────────────────────────────
YOGA_CANONICAL = [
    None, "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
    "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva", "Vyaghata",
    "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva",
    "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti",
]
_YOGA_ALIASES = {"soola": 9, "sula": 9, "ashani": 15, "variyana": 18, "vriyana": 18,
                 "siva": 20, "subha": 23, "sukla": 24, "vaidhrithi": 27, "sobhana": 5,
                 "soubhagya": 4, "dhrithi": 8}
YOGA_INDEX: Dict[str, int] = {norm_key(n): i for i, n in enumerate(YOGA_CANONICAL) if n}
YOGA_INDEX.update(_YOGA_ALIASES)
# Nine doshic yogas (plan 7.3 / M11 #21) with their reference nakshatras (M11 #13).
DOSHIC_YOGAS = {1, 6, 9, 10, 13, 15, 17, 19, 27}
DOSHIC_YOGA_NAKSHATRA = {1: 1, 6: 17, 9: 5, 10: 19, 13: 7, 15: 8, 17: 9, 19: 10, 27: 14}


def yoga_set(tokens: Iterable[str]) -> Set[int]:
    out: Set[int] = set()
    for tok in tokens or []:
        key = norm_key(tok)
        if key in ("doshic", "ashubha", "papa"):
            out |= DOSHIC_YOGAS; continue
        if key not in YOGA_INDEX:
            raise ValueError(f"Unknown yoga token '{tok}'")
        out.add(YOGA_INDEX[key])
    return out


# ── Karanas ──────────────────────────────────────────────────────────────────
KARANA_CANONICAL = [None, "Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija",
                    "Vishti (Bhadra)", "Shakuni", "Chatushpada", "Naga", "Kimstughna"]
_KARANA_ALIASES = {"bava": 1, "balava": 2, "baalava": 2, "kaulava": 3, "taitila": 4, "taitula": 4,
                   "gara": 5, "garaja": 5, "vanija": 6, "vishti": 7, "bhadra": 7, "vishtibhadra": 7,
                   "shakuni": 8, "sakuni": 8, "sakuna": 8, "chatushpada": 9, "naga": 10,
                   "kimstughna": 11, "kimstugna": 11}
INAUSPICIOUS_KARANAS = {7, 8, 9, 10, 11}


def karana_of_position(pos_60: int) -> int:
    """Karana position 1-60 in the lunar month (plan 8.1) -> karana id 1-11."""
    if pos_60 == 1:
        return 11
    if pos_60 >= 58:
        return {58: 8, 59: 9, 60: 10}[pos_60]
    return (pos_60 - 2) % 7 + 1


def karana_set(tokens: Iterable[str]) -> Set[int]:
    out: Set[int] = set()
    for tok in tokens or []:
        key = norm_key(tok)
        if key in ("inauspicious", "cruel", "krura"):
            out |= INAUSPICIOUS_KARANAS; continue
        if key not in _KARANA_ALIASES:
            raise ValueError(f"Unknown karana token '{tok}'")
        out.add(_KARANA_ALIASES[key])
    return out


# ── Rashis and planets ───────────────────────────────────────────────────────
RASI_CANONICAL = [None, "Mesha", "Vrishabha", "Mithuna", "Karkataka", "Simha", "Kanya",
                  "Tula", "Vrishchika", "Dhanus", "Makara", "Kumbha", "Meena"]
_RASI_ALIASES = {"vrischika": 8, "vrishchikam": 8, "dhanu": 9, "dhanussu": 9, "karkata": 4,
                 "karka": 4, "kataka": 4, "mithunam": 3, "thula": 7, "tulam": 7}
RASI_INDEX: Dict[str, int] = {norm_key(n): i for i, n in enumerate(RASI_CANONICAL) if n}
RASI_INDEX.update(_RASI_ALIASES)
MOVABLE_SIGNS = {1, 4, 7, 10}

# PyJHora planet ids: 0 Sun .. 8 Ketu
PLANET_NAME = {0: "Sun", 1: "Moon", 2: "Mars", 3: "Mercury", 4: "Jupiter",
               5: "Venus", 6: "Saturn", 7: "Rahu", 8: "Ketu"}
PLANET_NAME_TE = {0: "సూర్యుడు", 1: "చంద్రుడు", 2: "కుజుడు", 3: "బుధుడు", 4: "గురుడు",
                  5: "శుక్రుడు", 6: "శని", 7: "రాహువు", 8: "కేతువు"}
NATURAL_MALEFICS = {0, 2, 6, 7, 8}
NATURAL_BENEFICS = {3, 4, 5}  # the Moon is benefic only when waxing (see is_benefic)

# Sign lords (1-12 -> planet id)
SIGN_LORD = {1: 2, 2: 5, 3: 3, 4: 1, 5: 0, 6: 3, 7: 5, 8: 2, 9: 4, 10: 6, 11: 6, 12: 4}

# Planetary friendship (plan 18.8). friends[p] = set of planet ids p regards as friends.
FRIENDS = {
    0: {2, 4, 1}, 1: {0, 3}, 2: {0, 1, 4}, 3: {0, 5},
    4: {2, 1, 0}, 5: {6, 3}, 6: {3, 5},
}
ENEMIES = {
    0: {6, 5}, 1: set(), 2: {3}, 3: {1},
    4: {3, 5}, 5: {0, 1}, 6: {2, 0, 1},
}


def is_benefic(pid: int, moon_waxing: bool) -> bool:
    if pid == 1:
        return moon_waxing
    return pid in NATURAL_BENEFICS


def lords_compatible(sign_a: int, sign_b: int) -> bool:
    """
    Same lord, or one lord regards the other as a friend (plan M11 #8).
    One-way friendship reproduces exactly the six exceptions the book lists
    (Simha/Meena, Tula/Vrishabha, Dhanus/Karkataka, Mesha/Vrischika,
    Mithuna/Makara, Kumbha/Kanya) out of the twelve 8th-sign pairs.
    """
    la, lb = SIGN_LORD[sign_a], SIGN_LORD[sign_b]
    if la == lb:
        return True
    return lb in FRIENDS.get(la, set()) or la in FRIENDS.get(lb, set())
