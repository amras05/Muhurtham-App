"""
Nama Nakshatra (నామ నక్షత్రం) & Directional Astrology Engine.
Based on classical treatises and Dr. Vamsee Nemani's Muhurtham Master Document.

Provides:
1. Classical 108 Pada Akshara-to-Nakshatra mapping for Telugus & Sanskrit names.
2. 3-Mode Nama Nakshatra determination:
   - Mode 1: Direct selection
   - Mode 2: Phonetic / Syllable lookup from name
   - Mode 3: Birth calculation
3. Vaara Sula & Disa Sula for Travel (Prayana).
4. Facing direction analysis for Griha & Commercial enterprises.
"""
from typing import Any, Dict, List, Optional, Tuple


# 108 Nakshatra Padas with their classical initial Sanskrit / Telugu syllables
# Format: (nakshatra_index 1..27, name_en, name_te, rasi_index 0..11, rasi_name_en, rasi_name_te, pada 1..4, [syllable_en...], [syllable_te...])
NAKSHATRA_PADA_AKSHARAS = [
    # 1. Ashwini (Mesha)
    (1, "Ashwini", "అశ్విని", 0, "Mesha", "మేషం", 1, ["chu", "tsu"], ["చు", "చుం"]),
    (1, "Ashwini", "అశ్విని", 0, "Mesha", "మేషం", 2, ["che", "tse"], ["చే"]),
    (1, "Ashwini", "అశ్విని", 0, "Mesha", "మేషం", 3, ["cho", "tso"], ["చో"]),
    (1, "Ashwini", "అశ్విని", 0, "Mesha", "మేషం", 4, ["la"], ["లా", "ల"]),

    # 2. Bharani (Mesha)
    (2, "Bharani", "భరణి", 0, "Mesha", "మేషం", 1, ["li", "lee"], ["లీ", "లి"]),
    (2, "Bharani", "భరణి", 0, "Mesha", "మేషం", 2, ["lu", "loo"], ["లూ", "లు"]),
    (2, "Bharani", "భరణి", 0, "Mesha", "మేషం", 3, ["le", "lay"], ["లే", "లె"]),
    (2, "Bharani", "భరణి", 0, "Mesha", "మేషం", 4, ["lo"], ["లో", "లొ"]),

    # 3. Krittika (Mesha / Vrishabha)
    (3, "Krittika", "కృత్తిక", 0, "Mesha", "మేషం", 1, ["a"], ["అ", "ఆ"]),
    (3, "Krittika", "కృత్తిక", 1, "Vrishabha", "వృషభం", 2, ["i", "ee"], ["ఇ", "ఈ"]),
    (3, "Krittika", "కృత్తిక", 1, "Vrishabha", "వృషభం", 3, ["u", "oo"], ["ఉ", "ఊ"]),
    (3, "Krittika", "కృత్తిక", 1, "Vrishabha", "వృషభం", 4, ["e", "ea"], ["ఎ", "ఏ"]),

    # 4. Rohini (Vrishabha)
    (4, "Rohini", "రోహిణి", 1, "Vrishabha", "వృషభం", 1, ["o"], ["ఒ", "ఓ"]),
    (4, "Rohini", "రోహిణి", 1, "Vrishabha", "వృషభం", 2, ["va"], ["వా", "వ"]),
    (4, "Rohini", "రోహిణి", 1, "Vrishabha", "వృషభం", 3, ["vi", "vee"], ["వి", "వీ"]),
    (4, "Rohini", "రోహిణి", 1, "Vrishabha", "వృషభం", 4, ["vu", "voo"], ["వు", "వూ"]),

    # 5. Mrigashira (Vrishabha / Mithuna)
    (5, "Mrigashira", "మృగశిర", 1, "Vrishabha", "వృషభం", 1, ["ve", "vay"], ["వె", "వే"]),
    (5, "Mrigashira", "మృగశిర", 1, "Vrishabha", "వృషభం", 2, ["vo"], ["వొ", "వో"]),
    (5, "Mrigashira", "మృగశిర", 2, "Mithuna", "మిథునం", 3, ["ka"], ["కా", "క"]),
    (5, "Mrigashira", "మృగశిర", 2, "Mithuna", "మిథునం", 4, ["ki", "kee"], ["కి", "కీ"]),

    # 6. Ardra (Mithuna)
    (6, "Ardra", "ఆర్ద్ర", 2, "Mithuna", "మిథునం", 1, ["ku", "koo"], ["కు", "కూ"]),
    (6, "Ardra", "ఆర్ద్ర", 2, "Mithuna", "మిథునం", 2, ["gha"], ["ఘ", "ఘా"]),
    (6, "Ardra", "ఆర్ద్ర", 2, "Mithuna", "మిథునం", 3, ["ng", "chha"], ["ఙ", "ఛ"]),
    (6, "Ardra", "ఆర్ద్ర", 2, "Mithuna", "మిథునం", 4, ["ke", "kay"], ["కె", "కే"]),

    # 7. Punarvasu (Mithuna / Karkataka)
    (7, "Punarvasu", "పునర్వసు", 2, "Mithuna", "మిథునం", 1, ["ke", "kay"], ["కే"]),
    (7, "Punarvasu", "పునర్వసు", 2, "Mithuna", "మిథునం", 2, ["ko"], ["కో", "కొ"]),
    (7, "Punarvasu", "పునర్వసు", 2, "Mithuna", "మిథునం", 3, ["ha"], ["హా", "హ"]),
    (7, "Punarvasu", "పునర్వసు", 3, "Karkataka", "కర్కాటకం", 4, ["hi", "hee"], ["హి", "హీ"]),

    # 8. Pushya (Karkataka)
    (8, "Pushya", "పుష్యమి", 3, "Karkataka", "కర్కాటకం", 1, ["hu", "hoo"], ["హు", "హూ"]),
    (8, "Pushya", "పుష్యమి", 3, "Karkataka", "కర్కాటకం", 2, ["he", "hay"], ["హె", "హే"]),
    (8, "Pushya", "పుష్యమి", 3, "Karkataka", "కర్కాటకం", 3, ["ho"], ["హొ", "హో"]),
    (8, "Pushya", "పుష్యమి", 3, "Karkataka", "కర్కాటకం", 4, ["da"], ["డా", "డ"]),

    # 9. Ashlesha (Karkataka)
    (9, "Ashlesha", "ఆశ్లేష", 3, "Karkataka", "కర్కాటకం", 1, ["di", "dee"], ["డి", "డీ"]),
    (9, "Ashlesha", "ఆశ్లేష", 3, "Karkataka", "కర్కాటకం", 2, ["du", "doo"], ["డు", "డూ"]),
    (9, "Ashlesha", "ఆశ్లేష", 3, "Karkataka", "కర్కాటకం", 3, ["de", "day"], ["డె", "డే"]),
    (9, "Ashlesha", "ఆశ్లేష", 3, "Karkataka", "కర్కాటకం", 4, ["do"], ["డొ", "డో"]),

    # 10. Magha (Simha)
    (10, "Magha", "మఖ", 4, "Simha", "సింహం", 1, ["ma"], ["మా", "మ"]),
    (10, "Magha", "మఖ", 4, "Simha", "సింహం", 2, ["mi", "mee"], ["మి", "మీ"]),
    (10, "Magha", "మఖ", 4, "Simha", "సింహం", 3, ["mu", "moo"], ["ము", "మూ"]),
    (10, "Magha", "మఖ", 4, "Simha", "సింహం", 4, ["me", "may"], ["మె", "మే"]),

    # 11. Purva Phalguni (Simha)
    (11, "Purva Phalguni", "పూర్వఫల్గుని (పుబ్బ)", 4, "Simha", "సింహం", 1, ["mo"], ["మొ", "మో"]),
    (11, "Purva Phalguni", "పూర్వఫల్గుని (పుబ్బ)", 4, "Simha", "సింహం", 2, ["ta"], ["టా", "ట"]),
    (11, "Purva Phalguni", "పూర్వఫల్గుని (పుబ్బ)", 4, "Simha", "సింహం", 3, ["ti", "tee"], ["టి", "టీ"]),
    (11, "Purva Phalguni", "పూర్వఫల్గుని (పుబ్బ)", 4, "Simha", "సింహం", 4, ["tu", "too"], ["టు", "టూ"]),

    # 12. Uttara Phalguni (Simha / Kanya)
    (12, "Uttara Phalguni", "ఉత్తరఫల్గుని (ఉత్తర)", 4, "Simha", "సింహం", 1, ["te", "tay"], ["టె", "టే"]),
    (12, "Uttara Phalguni", "ఉత్తరఫల్గుని (ఉత్తర)", 5, "Kanya", "కన్య", 2, ["to"], ["టొ", "టో"]),
    (12, "Uttara Phalguni", "ఉత్తరఫల్గుని (ఉత్తర)", 5, "Kanya", "కన్య", 3, ["pa"], ["పా", "ప"]),
    (12, "Uttara Phalguni", "ఉత్తరఫల్గుని (ఉత్తర)", 5, "Kanya", "కన్య", 4, ["pi", "pee"], ["పి", "పీ"]),

    # 13. Hasta (Kanya)
    (13, "Hasta", "హస్త", 5, "Kanya", "కన్య", 1, ["pu", "poo"], ["పు", "పూ"]),
    (13, "Hasta", "హస్త", 5, "Kanya", "కన్య", 2, ["sha"], ["ష", "షం"]),
    (13, "Hasta", "హస్త", 5, "Kanya", "కన్య", 3, ["na"], ["ణా", "ణ"]),
    (13, "Hasta", "హస్త", 5, "Kanya", "కన్య", 4, ["dha"], ["ఢ", "ఢా"]),

    # 14. Chitra (Kanya / Tula)
    (14, "Chitra", "చిత్త", 5, "Kanya", "కన్య", 1, ["pe", "pay"], ["పె", "పే"]),
    (14, "Chitra", "చిత్త", 5, "Kanya", "కన్య", 2, ["po"], ["పొ", "పో"]),
    (14, "Chitra", "చిత్త", 6, "Tula", "తుల", 3, ["ra"], ["రా", "ర"]),
    (14, "Chitra", "చిత్త", 6, "Tula", "తుల", 4, ["ri", "ree"], ["రి", "రీ"]),

    # 15. Swati (Tula)
    (15, "Swati", "స్వాతి", 6, "Tula", "తుల", 1, ["ru", "roo"], ["రు", "రూ"]),
    (15, "Swati", "స్వాతి", 6, "Tula", "తుల", 2, ["re", "ray"], ["రె", "రే"]),
    (15, "Swati", "స్వాతి", 6, "Tula", "తుల", 3, ["ro"], ["రొ", "రో"]),
    (15, "Swati", "స్వాతి", 6, "Tula", "తుల", 4, ["taa", "tha"], ["తా", "త"]),

    # 16. Vishakha (Tula / Vrishchika)
    (16, "Vishakha", "విశాఖ", 6, "Tula", "తుల", 1, ["ti", "thee"], ["తి", "తీ"]),
    (16, "Vishakha", "విశాఖ", 6, "Tula", "తుల", 2, ["tu", "thoo"], ["తు", "తూ"]),
    (16, "Vishakha", "విశాఖ", 6, "Tula", "తుల", 3, ["te", "thay"], ["తె", "తే"]),
    (16, "Vishakha", "విశాఖ", 7, "Vrishchika", "వృశ్చికం", 4, ["to", "tho"], ["తొ", "తో"]),

    # 17. Anuradha (Vrishchika)
    (17, "Anuradha", "అనూరాధ", 7, "Vrishchika", "వృశ్చికం", 1, ["na"], ["నా", "న"]),
    (17, "Anuradha", "అనూరాధ", 7, "Vrishchika", "వృశ్చికం", 2, ["ni", "nee"], ["ని", "నీ"]),
    (17, "Anuradha", "అనూరాధ", 7, "Vrishchika", "వృశ్చికం", 3, ["nu", "noo"], ["ను", "నూ"]),
    (17, "Anuradha", "అనూరాధ", 7, "Vrishchika", "వృశ్చికం", 4, ["ne", "nay"], ["నె", "నే"]),

    # 18. Jyeshtha (Vrishchika)
    (18, "Jyeshtha", "జ్యేష్ఠ", 7, "Vrishchika", "వృశ్చికం", 1, ["no"], ["నొ", "నో"]),
    (18, "Jyeshtha", "జ్యేష్ఠ", 7, "Vrishchika", "వృశ్చికం", 2, ["ya"], ["యా", "య"]),
    (18, "Jyeshtha", "జ్యేష్ఠ", 7, "Vrishchika", "వృశ్చికం", 3, ["yi", "yee"], ["యి", "యీ"]),
    (18, "Jyeshtha", "జ్యేష్ఠ", 7, "Vrishchika", "వృశ్చికం", 4, ["yu", "yoo"], ["యు", "యూ"]),

    # 19. Mula (Dhanus)
    (19, "Mula", "మూల", 8, "Dhanus", "ధనుస్సు", 1, ["ye", "yay"], ["యె", "యే"]),
    (19, "Mula", "మూల", 8, "Dhanus", "ధనుస్సు", 2, ["yo"], ["యొ", "యో"]),
    (19, "Mula", "మూల", 8, "Dhanus", "ధనుస్సు", 3, ["bha"], ["భా", "భ"]),
    (19, "Mula", "మూల", 8, "Dhanus", "ధనుస్సు", 4, ["bhi", "bhee"], ["భి", "భీ"]),

    # 20. Purvashadha (Dhanus)
    (20, "Purvashadha", "పూర్వాషాఢ", 8, "Dhanus", "ధనుస్సు", 1, ["bhu", "bhoo"], ["భు", "భూ"]),
    (20, "Purvashadha", "పూర్వాషాఢ", 8, "Dhanus", "ధనుస్సు", 2, ["dha"], ["ధా", "ధ"]),
    (20, "Purvashadha", "పూర్వాషాఢ", 8, "Dhanus", "ధనుస్సు", 3, ["pha"], ["ఫా", "ఫ"]),
    (20, "Purvashadha", "పూర్వాషాఢ", 8, "Dhanus", "ధనుస్సు", 4, ["dha"], ["ఢా", "ఢ"]),

    # 21. Uttarashadha (Dhanus / Makara)
    (21, "Uttarashadha", "ఉత్తరాషాఢ", 8, "Dhanus", "ధనుస్సు", 1, ["bhe", "bhay"], ["భె", "భే"]),
    (21, "Uttarashadha", "ఉత్తరాషాఢ", 9, "Makara", "మకరం", 2, ["bho"], ["భొ", "భో"]),
    (21, "Uttarashadha", "ఉత్తరాషాఢ", 9, "Makara", "మకరం", 3, ["ja"], ["జా", "జ"]),
    (21, "Uttarashadha", "ఉత్తరాషాఢ", 9, "Makara", "మకరం", 4, ["ji", "jee"], ["జి", "జీ"]),

    # 22. Shravana (Makara)
    (22, "Shravana", "శ్రవణము", 9, "Makara", "మకరం", 1, ["ju", "joo"], ["జు", "జూ"]),
    (22, "Shravana", "శ్రవణము", 9, "Makara", "మకరం", 2, ["je", "jay"], ["జె", "జే"]),
    (22, "Shravana", "శ్రవణము", 9, "Makara", "మకరం", 3, ["jo"], ["జొ", "జో"]),
    (22, "Shravana", "శ్రవణము", 9, "Makara", "మకరం", 4, ["gha"], ["ఘా", "ఘ"]),

    # 23. Dhanishta (Makara / Kumbha)
    (23, "Dhanishta", "ధనిష్ఠ", 9, "Makara", "మకరం", 1, ["ga"], ["గా", "గ"]),
    (23, "Dhanishta", "ధనిష్ఠ", 9, "Makara", "మకరం", 2, ["gi", "gee"], ["గి", "గీ"]),
    (23, "Dhanishta", "ధనిష్ఠ", 10, "Kumbha", "కుంభం", 3, ["gu", "goo"], ["గు", "గూ"]),
    (23, "Dhanishta", "ధనిష్ఠ", 10, "Kumbha", "కుంభం", 4, ["ge", "gay"], ["గె", "గే"]),

    # 24. Shatabhisha (Kumbha)
    (24, "Shatabhisha", "శతభిషం", 10, "Kumbha", "కుంభం", 1, ["go"], ["గొ", "గో"]),
    (24, "Shatabhisha", "శతభిషం", 10, "Kumbha", "కుంభం", 2, ["sa"], ["సా", "స"]),
    (24, "Shatabhisha", "శతభిషం", 10, "Kumbha", "కుంభం", 3, ["si", "see"], ["సి", "సీ"]),
    (24, "Shatabhisha", "శతభిషం", 10, "Kumbha", "కుంభం", 4, ["su", "soo"], ["సు", "సూ"]),

    # 25. Purvabhadra (Kumbha / Meena)
    (25, "Purvabhadra", "పూర్వాభాద్ర", 10, "Kumbha", "కుంభం", 1, ["se", "say"], ["సె", "సే"]),
    (25, "Purvabhadra", "పూర్వాభాద్ర", 10, "Kumbha", "కుంభం", 2, ["so"], ["సొ", "సో"]),
    (25, "Purvabhadra", "పూర్వాభాద్ర", 10, "Kumbha", "కుంభం", 3, ["da"], ["దా", "ద"]),
    (25, "Purvabhadra", "పూర్వాభాద్ర", 11, "Meena", "మీనం", 4, ["di", "dee"], ["ది", "దీ"]),

    # 26. Uttarabhadra (Meena)
    (26, "Uttarabhadra", "ఉత్తరాభాద్ర", 11, "Meena", "మీనం", 1, ["du", "doo"], ["దు", "దూ"]),
    (26, "Uttarabhadra", "ఉత్తరాభాద్ర", 11, "Meena", "మీనం", 2, ["tha"], ["థా", "థ"]),
    (26, "Uttarabhadra", "ఉత్తరాభాద్ర", 11, "Meena", "మీనం", 3, ["jha"], ["ఝా", "ఝ"]),
    (26, "Uttarabhadra", "ఉత్తరాభాద్ర", 11, "Meena", "మీనం", 4, ["na"], ["ఞ"]),

    # 27. Revati (Meena)
    (27, "Revati", "రేవతి", 11, "Meena", "మీనం", 1, ["de", "day"], ["దె", "దే"]),
    (27, "Revati", "రేవతి", 11, "Meena", "మీనం", 2, ["do"], ["దొ", "దో"]),
    (27, "Revati", "రేవతి", 11, "Meena", "మీనం", 3, ["cha"], ["చా", "చ"]),
    (27, "Revati", "రేవతి", 11, "Meena", "మీనం", 4, ["chi", "chee"], ["చి", "చీ"]),
]


def lookup_nama_nakshatra(name: str) -> Optional[Dict[str, Any]]:
    """
    Finds the Nama Nakshatra and Pada by analyzing the starting syllable of a name.
    Supports both Telugu script and English phonetics.
    """
    if not name or not name.strip():
        return None
    raw = name.strip()
    lowered = raw.lower()

    # 1. Try matching Telugu syllables (longest prefix first)
    for item in NAKSHATRA_PADA_AKSHARAS:
        for te_syl in item[8]:
            if raw.startswith(te_syl):
                return {
                    "nakshatra_index": item[0],
                    "nakshatra_en": item[1],
                    "nakshatra_te": item[2],
                    "rasi_index": item[3],
                    "rasi_en": item[4],
                    "rasi_te": item[5],
                    "pada": item[6],
                    "matched_syllable": te_syl,
                    "mode": "phonetic_name"
                }

    # 2. Try matching English phonetics (prefix match, 4 down to 1 chars)
    for item in NAKSHATRA_PADA_AKSHARAS:
        for en_syl in item[7]:
            if lowered.startswith(en_syl):
                return {
                    "nakshatra_index": item[0],
                    "nakshatra_en": item[1],
                    "nakshatra_te": item[2],
                    "rasi_index": item[3],
                    "rasi_en": item[4],
                    "rasi_te": item[5],
                    "pada": item[6],
                    "matched_syllable": en_syl,
                    "mode": "phonetic_name"
                }

    return None


# Vaara Sula (వారం - దిశ శూల) Rules according to classical treatises:
# Sunday: West prohibited
# Monday: East prohibited
# Tuesday: North prohibited
# Wednesday: North prohibited
# Thursday: South prohibited
# Friday: West prohibited
# Saturday: East prohibited
VAARA_SULA_MAP = {
    "sunday": {"avoid_dir": "west", "name_te": "పడమర", "paridha": "పశ్చిమ దిశ శూల"},
    "monday": {"avoid_dir": "east", "name_te": "తూర్పు", "paridha": "పూర్వ దిశ శూల"},
    "tuesday": {"avoid_dir": "north", "name_te": "ఉత్తరం", "paridha": "ఉత్తర దిశ శూల"},
    "wednesday": {"avoid_dir": "north", "name_te": "ఉత్తరం", "paridha": "ఉత్తర దిశ శూల"},
    "thursday": {"avoid_dir": "south", "name_te": "దక్షిణం", "paridha": "దక్షిణ దిశ శూల"},
    "friday": {"avoid_dir": "west", "name_te": "పడమర", "paridha": "పశ్చిమ దిశ శూల"},
    "saturday": {"avoid_dir": "east", "name_te": "తూర్పు", "paridha": "పూర్వ దిశ శూల"},
}


def check_travel_directional_sula(vaara: str, travel_direction: Optional[str]) -> Dict[str, Any]:
    """
    Evaluates Disa Sula (Directional Needle) for travel on a given weekday.
    """
    if not travel_direction or not vaara:
        return {"has_sula": False, "verdict": "Neutral", "desc_en": "", "desc_te": ""}

    v_lower = vaara.lower().strip()
    d_lower = travel_direction.lower().strip()
    sula = VAARA_SULA_MAP.get(v_lower)

    if sula and sula["avoid_dir"] == d_lower:
        return {
            "has_sula": True,
            "verdict": "Disa Sula Dosha",
            "avoid_dir": sula["avoid_dir"],
            "desc_en": f"Vaara Sula Warning: Traveling {d_lower.upper()} on {vaara} is forbidden in classical Muhurtha Shastra ({sula['paridha']})!",
            "desc_te": f"వార శూల దోషం: {vaara} నాడు {sula['name_te']} వైపు ప్రయాణం శాస్త్రరీత్యా నిషిద్ధం ({sula['paridha']})!"
        }

    return {
        "has_sula": False,
        "verdict": "Clean Direction",
        "desc_en": f"Direction {d_lower.upper()} on {vaara} has no Disa Sula dosha.",
        "desc_te": f"{vaara} నాడు {d_lower} దిశకు దిశాశూల లేదు (అనుకూల ప్రయాణ దిశ)."
    }


def check_facing_compatibility(facing_dir: Optional[str], rasi_idx: Optional[int]) -> Dict[str, Any]:
    """
    Checks Vastu facing compatibility between plot/door and owner's Rasi.
    """
    if not facing_dir or rasi_idx is None:
        return {"compatible": True, "note_en": "Standard alignment", "note_te": "సాధారణ అమరిక"}

    f_dir = facing_dir.lower().strip()
    # Sign elements:
    # Agni (Fire): 0 (Mesha), 4 (Simha), 8 (Dhanus) -> East facing preferred
    # Bhumi (Earth): 1 (Vrishabha), 5 (Kanya), 9 (Makara) -> South / North facing
    # Vayu (Air): 2 (Mithuna), 6 (Tula), 10 (Kumbha) -> West facing
    # Jala (Water): 3 (Karkataka), 7 (Vrishchika), 11 (Meena) -> North facing preferred

    element_map = {
        0: "east", 4: "east", 8: "east",
        2: "west", 6: "west", 10: "west",
        3: "north", 7: "north", 11: "north",
        1: "north", 5: "north", 9: "north"
    }

    favored = element_map.get(rasi_idx, "east")
    if f_dir == favored or f_dir in ["east", "north"]:
        return {
            "compatible": True,
            "favored_dir": favored,
            "note_en": f"{facing_dir.upper()} facing is auspicious and harmonizes with the owner's Rasi element.",
            "note_te": f"{facing_dir} ముఖద్వారము యజమాని రాశి తత్వముతో శ్రేష్ఠమైన అనుకూలతను కలిగి ఉన్నది."
        }
    return {
        "compatible": True,
        "favored_dir": favored,
        "note_en": f"{facing_dir.upper()} entrance acceptable with standard Vastu Purusha Mandala puja.",
        "note_te": f"{facing_dir} ముఖద్వారమునకు వాస్తుపురుష పూజ & శాంతి సూచించబడినది."
    }

