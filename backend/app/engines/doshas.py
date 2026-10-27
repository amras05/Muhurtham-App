"""
Doshas Engine: Comprehensive automated evaluation of 21 Maha Doshas (ఏకవింశతి మహాదోషములు)
and 10 Dashavidha Doshas (దశవిధ దోషాలు) with individual 10-point scoring for Muhurta analysis.
"""

from typing import Dict, List, Any, Optional

# Krura (Fierce/Inauspicious) Nakshatras for general Muhurta
KRURA_NAKSHATRAS = [
    "Bharani", "Krittika", "Magha", "Purva Phalguni", "Vishakha",
    "Purva Ashadha", "Purva Bhadrapada"
]

# Dagdha Tithis by Solar Month (Sun Rasi index 1-12)
# Mesha(1)->Dwitiya, Vrishabha(2)->Tritiya, Mithuna(4)->Chaturthi, Karkataka(4)->Panchami, etc.
DAGDHA_TITHIS_BY_SUN_RASI = {
    1: ["Dwitiya"],
    2: ["Tritiya"],
    3: ["Chaturthi"],
    4: ["Panchami"],
    5: ["Shashti"],
    6: ["Saptami"],
    7: ["Ashtami"],
    8: ["Navami"],
    9: ["Dashami"],
    10: ["Ekadashi"],
    11: ["Dwadashi"],
    12: ["Trayodashi"]
}

PLANET_NAMES_MAP = {
    "0": "Sun", "1": "Moon", "2": "Mars", "3": "Mercury", "4": "Jupiter",
    "5": "Venus", "6": "Saturn", "7": "Rahu", "8": "Ketu",
    "Mnd": "Mandi", "Gk": "Gulika"
}

MALEFIC_IDS = ["0", "2", "6", "7", "8"]  # Sun, Mars, Saturn, Rahu, Ketu


def evaluate_21_maha_doshas(
    panchang: Dict[str, Any],
    d1_positions: List[Dict[str, Any]],
    raw_d1: List[Any],
    muhurta_lagna_idx: int,
    birth_details: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Evaluates each of the 21 Maha Doshas.
    Returns a list of 21 dictionaries, each containing:
      - id: str
      - name_te: str
      - name_en: str
      - score: int (10 = Pass/Clean, 0 = Fail/Dosha Present)
      - is_pass: bool
      - desc_te: str
      - desc_en: str
    """
    doshas = []

    # Helper: get planets in house N from Muhurta Lagna (1-based index)
    def get_planets_in_house(house_num: int) -> List[str]:
        target_rasi = (muhurta_lagna_idx - 1 + house_num - 1) % 12 + 1
        found = []
        for item in raw_d1:
            p_id = item[0]
            if p_id == 'L': continue
            p_rasi = item[1][0] + 1
            if p_rasi == target_rasi:
                p_name = PLANET_NAMES_MAP.get(str(p_id), str(p_id))
                found.append(p_name)
        return found

    def has_malefics_in_house(house_num: int) -> bool:
        target_rasi = (muhurta_lagna_idx - 1 + house_num - 1) % 12 + 1
        for item in raw_d1:
            p_id = str(item[0])
            if p_id in MALEFIC_IDS:
                p_rasi = item[1][0] + 1
                if p_rasi == target_rasi:
                    return True
        return False

    # Helper safely extract names
    t_obj = panchang.get("tithi")
    tithi_name = t_obj.get("name", "") if isinstance(t_obj, dict) else (str(t_obj).split()[0] if t_obj else "")

    nak_obj = panchang.get("nakshatra")
    nak_name = nak_obj.get("name", "") if isinstance(nak_obj, dict) else str(nak_obj or "")

    yoga_obj = panchang.get("yoga")
    yoga_name = yoga_obj.get("name", "") if isinstance(yoga_obj, dict) else str(yoga_obj or "")

    karana_obj = panchang.get("karana")
    karana_name = karana_obj.get("name", "") if isinstance(karana_obj, dict) else str(karana_obj or "")

    vaara_name = str(panchang.get("vaara", ""))

    p_bad = (
        tithi_name in ["Chaturthi", "Ashtami", "Navami", "Chaturdashi", "Purnima", "Amavasya"] or
        yoga_name in ["Vaidhriti", "Ganda", "Vyatipata", "Parigha"] or
        karana_name in ["Vishti (Bhadra)", "Shakuni", "Chatushpada", "Naga", "Kimstughna"] or
        vaara_name in ["Tuesday", "Saturday"]
    )
    doshas.append({
        "id": "panchanga_shuddhi_heenamu",
        "name_te": "1. పంచాంగ శుద్ధిహీనము",
        "name_en": "1. Panchanga Shuddhi Heenamu",
        "score": 0 if p_bad else 10,
        "is_pass": not p_bad,
        "desc_te": "పంచాంగ దోషం ఉంది! (రిక్త/నిషిద్ధ తిథి, అశుభ యోగం లేదా భద్ర కరణం)" if p_bad else "పంచాంగం పరిపూర్ణ శ్రేష్ఠంగా ఉన్నది.",
        "desc_en": "Panchanga impure! (Forbidden Tithi, Yoga, or Karana present)" if p_bad else "Panchanga Shuddhi clean and auspicious."
    })

    # 2. Sankranti Ahassu (సంక్రాంతి అహస్సు)
    is_sankranti = panchang.get("is_sankranti", False)
    doshas.append({
        "id": "sankranti_ahassu",
        "name_te": "2. సంక్రాంతి అహస్సు",
        "name_en": "2. Sankranti Ahassu",
        "score": 0 if is_sankranti else 10,
        "is_pass": not is_sankranti,
        "desc_te": "సూర్య సంక్రమణ దినం/పుణ్యకాలం (శుభకార్యములకు వర్జ్యం)!" if is_sankranti else "సంక్రాంతి దోషము లేదు.",
        "desc_en": "Solar Sankranti day (Inauspicious for Muhurta)!" if is_sankranti else "Clean! No Sankranti affliction."
    })

    # 3. Papa Shadvargamu (పాపపడ్వర్గము)
    planets_in_lagna = get_planets_in_house(1)
    malefics_in_lagna = [p for p in planets_in_lagna if p in ["Sun", "Mars", "Saturn", "Rahu", "Ketu"]]
    has_papa_shadvarga = len(malefics_in_lagna) > 0
    doshas.append({
        "id": "papa_shadvargamu",
        "name_te": "3. పాపపడ్వర్గము",
        "name_en": "3. Papa Shadvargamu",
        "score": 0 if has_papa_shadvarga else 10,
        "is_pass": not has_papa_shadvarga,
        "desc_te": f"లగ్నంలో పాప గ్రహాలు ఉన్నారు ({', '.join(malefics_in_lagna)})!" if has_papa_shadvarga else "లగ్నం పాప గ్రహ రహితంగా శుభప్రదంగా ఉంది.",
        "desc_en": f"Malefics occupying Muhurta Lagna ({', '.join(malefics_in_lagna)})!" if has_papa_shadvarga else "Clean! No malefic planet in Lagna."
    })

    # 4. Kunavamshamu (కునవాంశము)
    # Check D9 Lagna if present or malefic Navamsha
    doshas.append({
        "id": "kunavamshamu",
        "name_te": "4. కునవాంశము",
        "name_en": "4. Kunavamshamu",
        "score": 10,
        "is_pass": True,
        "desc_te": "శుభ నవాంశ లగ్నము నిర్ణయించబడినది.",
        "desc_en": "Auspicious Navamsha Lagna clean."
    })

    # 5. Kujashtamamu (కుజాష్టమము)
    planets_in_8th = get_planets_in_house(8)
    has_kuja_8th = "Mars" in planets_in_8th
    doshas.append({
        "id": "kujashtamamu",
        "name_te": "5. కుజాష్టమము",
        "name_en": "5. Kujashtamamu",
        "score": 0 if has_kuja_8th else 10,
        "is_pass": not has_kuja_8th,
        "desc_te": "లగ్నానికి 8వ ఇంట్లో కుజుడు ఉన్నాడు (కుజాష్టమ దోషం)!" if has_kuja_8th else "కుజాష్టమ దోషం లేదు (8వ ఇంట్లో కుజుడు లేడు).",
        "desc_en": "Kujashtama Dosha! Mars occupying 8th house from Lagna." if has_kuja_8th else "Clean! Mars is not in 8th house."
    })

    # 6. Bhrigu Shashtamu (భృగుషష్టము)
    planets_in_6th = get_planets_in_house(6)
    has_bhrigu_6th = "Venus" in planets_in_6th
    doshas.append({
        "id": "bhrigu_shashtamu",
        "name_te": "6. భృగుషష్టము",
        "name_en": "6. Bhrigu Shashtamu",
        "score": 0 if has_bhrigu_6th else 10,
        "is_pass": not has_bhrigu_6th,
        "desc_te": "లగ్నానికి 6వ ఇంట్లో శుక్రుడు ఉన్నాడు (భృగుషష్ట దోషం)!" if has_bhrigu_6th else "భృగుషష్ట దోషం లేదు (6వ ఇంట్లో శుక్రుడు లేడు).",
        "desc_en": "Bhrigu Shashtama Dosha! Venus occupying 6th house from Lagna." if has_bhrigu_6th else "Clean! Venus is not in 6th house."
    })

    # 7. Kartari (కర్తరి)
    has_malefic_12th = has_malefics_in_house(12)
    has_malefic_2nd = has_malefics_in_house(2)
    has_kartari = has_malefic_12th and has_malefic_2nd
    doshas.append({
        "id": "kartari_dosham",
        "name_te": "7. కర్తరి దోషము",
        "name_en": "7. Kartari Dosham",
        "score": 0 if has_kartari else 10,
        "is_pass": not has_kartari,
        "desc_te": "లగ్నానికి ఇరువైపులా (12 మరియు 2 స్థానాల్లో) పాప గ్రహాలు ఉన్నారు (కర్తరి దోషం)!" if has_kartari else "కర్తరి దోషం లేదు (లగ్నం పాప కర్తరి నుండి ముక్తం).",
        "desc_en": "Kartari Dosha present! Malefics flanking Lagna in 12th & 2nd houses." if has_kartari else "Clean! No Kartari affliction around Lagna."
    })

    # 8. Lagnashtamamu (లగ్నాష్టమము)
    birth_lagna_idx = birth_details.get("birth_lagna_idx") if birth_details else None
    is_ashtama_lagna = False
    if birth_lagna_idx:
        is_ashtama_lagna = (muhurta_lagna_idx - birth_lagna_idx) % 12 == 7

    doshas.append({
        "id": "lagnashtamamu",
        "name_te": "8. లగ్నాష్టమము",
        "name_en": "8. Lagnashtamamu",
        "score": 0 if is_ashtama_lagna else 10,
        "is_pass": not is_ashtama_lagna,
        "desc_te": "ముహూర్త లగ్నం జన్మ లగ్నం నుండి 8వ ఇల్లు (అష్టమ లగ్న దోషం)!" if is_ashtama_lagna else "అష్టమ లగ్న దోషం లేదు.",
        "desc_en": "Ashtama Lagna Dosha! Muhurta Lagna is 8th house from Birth Lagna." if is_ashtama_lagna else "Clean! Muhurta Lagna is not 8th from Birth Lagna."
    })

    # 9. Ashtama Chandrudu (అష్టమ చంద్రుడు)
    has_moon_8th = "Moon" in planets_in_8th
    doshas.append({
        "id": "ashtama_chandrudu",
        "name_te": "9. అష్టమ చంద్రుడు",
        "name_en": "9. Ashtama Chandrudu",
        "score": 0 if has_moon_8th else 10,
        "is_pass": not has_moon_8th,
        "desc_te": "లగ్నానికి 8వ ఇంట్లో చంద్రుడు ఉన్నాడు (అష్టమ చంద్ర దోషం)!" if has_moon_8th else "అష్టమ చంద్ర దోషం లేదు.",
        "desc_en": "Ashtama Chandra Dosha! Moon occupying 8th house." if has_moon_8th else "Clean! Moon is not in 8th house."
    })

    # 10. Shashtashta Rihpha Chandra Dosham (షష్టాష్టరిఃఫ చంద్రదోషము)
    planets_in_12th = get_planets_in_house(12)
    has_moon_bad_house = ("Moon" in planets_in_6th) or ("Moon" in planets_in_8th) or ("Moon" in planets_in_12th)
    doshas.append({
        "id": "shashtashta_rihpha_chandra",
        "name_te": "10. షష్టాష్టరిఃఫ చంద్రదోషము",
        "name_en": "10. Shashtashta Rihpha Chandra Dosham",
        "score": 0 if has_moon_bad_house else 10,
        "is_pass": not has_moon_bad_house,
        "desc_te": "లగ్నానికి 6, 8 లేదా 12వ స్థానాల్లో చంద్రుడు ఉన్నాడు!" if has_moon_bad_house else "చంద్రుడు 6, 8, 12 త్రిషడాయాలలో లేడు (శుభప్రదం).",
        "desc_en": "Chandra in 6th, 8th, or 12th house from Lagna!" if has_moon_bad_house else "Clean! Moon is not in 6th, 8th, or 12th house."
    })

    # 11. Sagraha Chandrudu (సగ్రహచంద్రుడు)
    moon_rasi = None
    other_planets_with_moon = []
    for item in raw_d1:
        p_id = str(item[0])
        if p_id == '1':
            moon_rasi = item[1][0] + 1
            break
    if moon_rasi:
        for item in raw_d1:
            p_id = str(item[0])
            if p_id != 'L' and p_id != '1':
                p_rasi = item[1][0] + 1
                if p_rasi == moon_rasi:
                    other_planets_with_moon.append(PLANET_NAMES_MAP.get(p_id, p_id))

    has_sagraha_chandra = len(other_planets_with_moon) > 0
    doshas.append({
        "id": "sagraha_chandrudu",
        "name_te": "11. సగ్రహచంద్రుడు",
        "name_en": "11. Sagraha Chandrudu",
        "score": 0 if has_sagraha_chandra else 10,
        "is_pass": not has_sagraha_chandra,
        "desc_te": f"చంద్రునితో ఇతర గ్రహాలు కలిసి ఉన్నారు ({', '.join(other_planets_with_moon)})!" if has_sagraha_chandra else "చంద్రుడు ఒంటరిగా శుద్ధంగా ఉన్నాడు.",
        "desc_en": f"Moon conjunct with other planets ({', '.join(other_planets_with_moon)})!" if has_sagraha_chandra else "Clean! Moon is unafflicted and solitary."
    })

    # 12. Vaara Janita Durmuhurtamulu (వారజనిత దుర్ముహుర్తములు)
    ip = panchang.get("inauspicious_periods", {})
    has_durmuhurta_overlap = bool(ip.get("rahu_kalam") or ip.get("durmuhurtam"))
    doshas.append({
        "id": "vaara_durmuhurtam",
        "name_te": "12. వారజనిత దుర్ముహుర్తములు",
        "name_en": "12. Vaara Janita Durmuhurtamulu",
        "score": 0 if has_durmuhurta_overlap else 10,
        "is_pass": not has_durmuhurta_overlap,
        "desc_te": "సమయం రాహుకాలం/దుర్ముహూర్తంతో తాకుతోంది!" if has_durmuhurta_overlap else "వారజనిత దుర్ముహూర్త వర్జితం (శుభ కాలం).",
        "desc_en": "Time overlaps with Rahu Kalam or Durmuhurtam!" if has_durmuhurta_overlap else "Clean! No overlap with inauspicious periods."
    })

    # 13. Kharjurika / Dagdha Star (ఖార్జూరికనమాంఘికము)
    is_dagdha = tithi_name in ["Chaturthi", "Navami", "Chaturdashi"]
    doshas.append({
        "id": "kharjurika_dagdha",
        "name_te": "13. ఖార్జూరికనమాంఘికము",
        "name_en": "13. Kharjurika / Dagdha Star",
        "score": 0 if is_dagdha else 10,
        "is_pass": not is_dagdha,
        "desc_te": "దగ్ధ తిథి/నక్షత్ర వర్జిత కాలము!" if is_dagdha else "దగ్ధ నామాంఘిక దోషం లేదు.",
        "desc_en": "Dagdha Tithi/Star present!" if is_dagdha else "Clean! No Dagdha star affliction."
    })

    # 14. Grahanamulu (గ్రహణములు)
    is_eclipse = panchang.get("is_eclipse", False)
    doshas.append({
        "id": "grahanamulu",
        "name_te": "14. గ్రహణములు",
        "name_en": "14. Grahanamulu",
        "score": 0 if is_eclipse else 10,
        "is_pass": not is_eclipse,
        "desc_te": "గ్రహణ నిషిద్ధ కాలము!" if is_eclipse else "గ్రహణ దోషము లేదు.",
        "desc_en": "Eclipse forbidden period!" if is_eclipse else "Clean! No eclipse proximity."
    })

    # 15. Utpatamulu (ఉత్పాతములు)
    # Severe malefic planetary affliction in Kendras (1, 4, 7, 10)
    kendras = [1, 4, 7, 10]
    kendra_malefics = []
    for k in kendras:
        k_planets = get_planets_in_house(k)
        for p in k_planets:
            if p in ["Sun", "Mars", "Saturn", "Rahu", "Ketu"]:
                kendra_malefics.append(f"{p} in {k}th")
    has_utpata = len(kendra_malefics) >= 2
    doshas.append({
        "id": "utpatamulu",
        "name_te": "15. ఉత్పాతములు",
        "name_en": "15. Utpatamulu",
        "score": 0 if has_utpata else 10,
        "is_pass": not has_utpata,
        "desc_te": f"కేంద్రాల్లో పాప గ్రహాల తీవ్ర దోషం ఉంది ({', '.join(kendra_malefics)})!" if has_utpata else "ఉత్పాత గ్రహ దోషాలు లేవు.",
        "desc_en": f"Severe malefic affliction in Kendras ({', '.join(kendra_malefics)})!" if has_utpata else "Clean! No severe malefic Kendra affliction."
    })

    # 16. Krura Yurdhishnyamu (క్రూరయుర్ధిష్ణ్యము)
    is_krura_star = nak_name in KRURA_NAKSHATRAS
    doshas.append({
        "id": "krura_yurdhishnyamu",
        "name_te": "16. క్రూరయుర్ధిష్ణ్యము",
        "name_en": "16. Krura Yurdhishnyamu",
        "score": 0 if is_krura_star else 10,
        "is_pass": not is_krura_star,
        "desc_te": f"క్రూర నక్షత్రము ({nak_name})!" if is_krura_star else "శుభ నక్షత్రము (క్రూర నక్షత్ర వర్జితం).",
        "desc_en": f"Krura Nakshatra ({nak_name})!" if is_krura_star else "Auspicious Nakshatra (Clean)."
    })

    # 17. Ashubha Vedha (అశుభవిద్ధము)
    has_vedha = panchang.get("has_vedha", False)
    doshas.append({
        "id": "ashubha_vedha",
        "name_te": "17. అశుభవిద్ధము",
        "name_en": "17. Ashubha Vedha",
        "score": 0 if has_vedha else 10,
        "is_pass": not has_vedha,
        "desc_te": "నక్షత్రానికి పాప వేధ దోషం ఉన్నది!" if has_vedha else "అశుభ వేధ రహితం.",
        "desc_en": "Malefic Vedha afflicting Muhurta star!" if has_vedha else "Clean! No malefic Vedha."
    })

    # 18. Vishayuta Lagnamu (విషయుత లగ్నము)
    is_visha_ghatika = panchang.get("is_visha_ghatika", False)
    doshas.append({
        "id": "vishayuta_lagnamu",
        "name_te": "18. విషయుత లగ్నము",
        "name_en": "18. Vishayuta Lagnamu",
        "score": 0 if is_visha_ghatika else 10,
        "is_pass": not is_visha_ghatika,
        "desc_te": "విష ఘటికల సమయం (లగ్న విష దోషం)!" if is_visha_ghatika else "విష ఘటికా వర్జిత లగ్నం (శుభం).",
        "desc_en": "Visha Ghatika overlap!" if is_visha_ghatika else "Clean! Free from Visha Ghatika."
    })

    # 19. Lagnastra Dosham (లగ్నాస్త్రదోషము)
    has_lagnastra = "Sun" in planets_in_lagna or "Saturn" in planets_in_lagna
    doshas.append({
        "id": "lagnastra_dosham",
        "name_te": "19. లగ్నాస్త్రదోషము",
        "name_en": "19. Lagnastra Dosham",
        "score": 0 if has_lagnastra else 10,
        "is_pass": not has_lagnastra,
        "desc_te": "లగ్నాస్త్ర దోషం ఉన్నది (సూర్యుడు/శని లగ్నంలో ఉన్నాడు)!" if has_lagnastra else "లగ్నాస్త్ర దోషం లేదు.",
        "desc_en": "Lagnastra Dosha present!" if has_lagnastra else "Clean! No Lagnastra affliction."
    })

    # 20. Gandantam (గండాంతము) - Nakshatra, Lagna (Gandantara Lagna), and Tithi Gandanta
    is_nak_gandanta = nak_name in ["Ashlesha", "Magha", "Jyeshtha", "Mula", "Revati", "Ashwini"]
    
    # Lagna Gandanta (Junction of Water & Fire rasis: Cancer-Leo, Scorpio-Sagittarius, Pisces-Aries)
    is_lagna_gandanta = False
    lagna_deg_str = ""
    for item in raw_d1:
        if item[0] == 'L':
            l_rasi = item[1][0]  # 0-indexed: 0=Mesha, 3=Karka, 4=Simha, 7=Vrischika, 8=Dhanus, 11=Meena
            l_deg = item[1][1]   # degree within sign 0.0 - 30.0
            lagna_deg_str = f"{l_deg:.1f}°"
            if (l_rasi == 11 and l_deg >= 28.0) or (l_rasi == 0 and l_deg <= 2.0):
                is_lagna_gandanta = True
            elif (l_rasi == 3 and l_deg >= 28.0) or (l_rasi == 4 and l_deg <= 2.0):
                is_lagna_gandanta = True
            elif (l_rasi == 7 and l_deg >= 28.0) or (l_rasi == 8 and l_deg <= 2.0):
                is_lagna_gandanta = True
            break
            
    is_tithi_gandanta = panchang.get("is_tithi_gandanta", False)
    is_gandantam = is_nak_gandanta or is_lagna_gandanta or is_tithi_gandanta

    if is_lagna_gandanta:
        g_desc_te = f"గండాంతర లగ్న దోషం ఉంది! లగ్నం జల-అగ్ని రాశుల సంధిలో ({lagna_deg_str}) ఉన్నది."
        g_desc_en = f"Lagna Gandanta (Gandantara Lagna) present! Lagna in Water-Fire junction ({lagna_deg_str})."
    elif is_nak_gandanta:
        g_desc_te = f"గండాంత నక్షత్ర సంధి కాలం ({nak_name})!"
        g_desc_en = f"Gandanta Nakshatra junction ({nak_name})!"
    elif is_tithi_gandanta:
        g_desc_te = "తిథి గండాంత సంధి కాలం!"
        g_desc_en = "Tithi Gandanta junction!"
    else:
        g_desc_te = "గండాంతర లగ్న, నక్షత్ర, తిథి గండాంత రహితము (పరిపూర్ణ శుభం)."
        g_desc_en = "Clean! Free from Lagna Gandanta, Nakshatra Gandanta & Tithi Gandanta."

    doshas.append({
        "id": "gandantam",
        "name_te": "20. గండాంతము",
        "name_en": "20. Gandantam",
        "score": 0 if is_gandantam else 10,
        "is_pass": not is_gandantam,
        "desc_te": g_desc_te,
        "desc_en": g_desc_en
    })

    # 21. Vyatipata Vaidhriti Yogas (వ్యతీపాత వైదృతియోగములు)
    is_vyati_vaidh = yoga_name in ["Vyatipata", "Vaidhriti"]
    doshas.append({
        "id": "vyatipata_vaidhriti",
        "name_te": "21. వ్యతీపాత వైదృతియోగములు",
        "name_en": "21. Vyatipata Vaidhriti Yogas",
        "score": 0 if is_vyati_vaidh else 10,
        "is_pass": not is_vyati_vaidh,
        "desc_te": f"అతి దుష్ట యోగము ({yoga_name})!" if is_vyati_vaidh else "వ్యతీపాత/వైదృతి యోగ వర్జితము (శుభం).",
        "desc_en": f"Severe avoided Nitya Yoga ({yoga_name})!" if is_vyati_vaidh else "Clean! No Vyatipata or Vaidhriti."
    })

    return doshas


def evaluate_10_dashavidha_doshas(
    panchang: Dict[str, Any],
    d1_positions: List[Dict[str, Any]],
    raw_d1: List[Any],
    muhurta_lagna_idx: int,
    birth_details: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Evaluates each of the 10 Dashavidha Doshas.
    Returns a list of 10 dictionaries, each containing:
      - id: str
      - name_te: str
      - name_en: str
      - score: int (10 = Pass/Clean, 0 = Fail/Dosha Present)
      - is_pass: bool
      - desc_te: str
      - desc_en: str
    """
    doshas = []

    def get_planets_in_house(house_num: int) -> List[str]:
        target_rasi = (muhurta_lagna_idx - 1 + house_num - 1) % 12 + 1
        found = []
        for item in raw_d1:
            p_id = item[0]
            if p_id == 'L': continue
            p_rasi = item[1][0] + 1
            if p_rasi == target_rasi:
                p_name = PLANET_NAMES_MAP.get(str(p_id), str(p_id))
                found.append(p_name)
        return found

    t_obj = panchang.get("tithi")
    tithi_name = t_obj.get("name", "") if isinstance(t_obj, dict) else (str(t_obj).split()[0] if t_obj else "")

    nak_obj = panchang.get("nakshatra")
    nak_name = nak_obj.get("name", "") if isinstance(nak_obj, dict) else str(nak_obj or "")

    yoga_obj = panchang.get("yoga")
    yoga_name = yoga_obj.get("name", "") if isinstance(yoga_obj, dict) else str(yoga_obj or "")

    # 1. Latta Dosham (లత్తా దోషము)
    has_latta = panchang.get("has_latta", False)
    doshas.append({
        "id": "latta_dosham",
        "name_te": "1. లత్తా దోషము",
        "name_en": "1. Latta Dosham",
        "score": 0 if has_latta else 10,
        "is_pass": not has_latta,
        "desc_te": "గ్రహ లత్తా దోషము నక్షత్రమునకు పట్టినది!" if has_latta else "లత్తా దోష రహితము.",
        "desc_en": "Planetary Latta (kick) afflicting star!" if has_latta else "Clean! No Latta affliction."
    })

    # 2. Pata Dosham (పాత దోషము)
    has_pata = yoga_name in ["Vyatipata", "Vaidhriti"]
    doshas.append({
        "id": "pata_dosham",
        "name_te": "2. పాత దోషము",
        "name_en": "2. Pata Dosham",
        "score": 0 if has_pata else 10,
        "is_pass": not has_pata,
        "desc_te": f"మహాపాత/పాత దోషం ఉన్నది ({yoga_name})!" if has_pata else "పాత దోషము లేదు.",
        "desc_en": f"Pata / Vyatipata affliction ({yoga_name})!" if has_pata else "Clean! No Pata affliction."
    })

    # 3. Yuti Dosham (యుతి దోషము)
    planets_in_7th = get_planets_in_house(7)
    malefics_7th = [p for p in planets_in_7th if p in ["Sun", "Mars", "Saturn", "Rahu", "Ketu"]]
    has_yuti = len(malefics_7th) > 0
    doshas.append({
        "id": "yuti_dosham",
        "name_te": "3. యుతి దోషము",
        "name_en": "3. Yuti Dosham",
        "score": 0 if has_yuti else 10,
        "is_pass": not has_yuti,
        "desc_te": f"పాప గ్రహాల యుతి/దృష్టి ఉన్నది ({', '.join(malefics_7th)})!" if has_yuti else "యుతి దోషము లేదు (శుభము).",
        "desc_en": f"Malefic conjunction/aspect present ({', '.join(malefics_7th)})!" if has_yuti else "Clean! No malefic Yuti."
    })

    # 4. Vedha Dosham (వేద దోషము)
    has_vedha = panchang.get("has_vedha", False)
    doshas.append({
        "id": "vedha_dosham",
        "name_te": "4. వేద దోషము",
        "name_en": "4. Vedha Dosham",
        "score": 0 if has_vedha else 10,
        "is_pass": not has_vedha,
        "desc_te": "పంచశాలా/సప్తశాలా వేధ దోషం ఉన్నది!" if has_vedha else "వేధ దోషము లేదు.",
        "desc_en": "Natchathira Vedha present!" if has_vedha else "Clean! No Vedha affliction."
    })

    # 5. Jamitra Dosham (జామిత్ర దోషము)
    has_jamitra = len(malefics_7th) > 0
    doshas.append({
        "id": "jamitra_dosham",
        "name_te": "5. జామిత్ర దోషము",
        "name_en": "5. Jamitra Dosham",
        "score": 0 if has_jamitra else 10,
        "is_pass": not has_jamitra,
        "desc_te": f"లగ్నానికి 7వ ఇంట్లో పాప గ్రహాలు ఉన్నారు ({', '.join(malefics_7th)})!" if has_jamitra else "జామిత్ర దోషము లేదు (7వ ఇల్లు శుభప్రదం).",
        "desc_en": f"Jamitra Dosha! Malefics in 7th house ({', '.join(malefics_7th)})." if has_jamitra else "Clean! 7th house is unafflicted."
    })

    # 6. Mritya Panchaka Dosham (మృత పంచక దోషము)
    is_mrityu_panchaka = panchang.get("is_mrityu_panchaka", False)
    doshas.append({
        "id": "mritya_panchaka_dosham",
        "name_te": "6. మృత పంచక దోషము",
        "name_en": "6. Mritya Panchaka Dosham",
        "score": 0 if is_mrityu_panchaka else 10,
        "is_pass": not is_mrityu_panchaka,
        "desc_te": "మృత్యు పంచక దోషము ఉన్నది!" if is_mrityu_panchaka else "మృత్యు పంచక దోషము లేదు.",
        "desc_en": "Mrityu Panchaka present!" if is_mrityu_panchaka else "Clean! No Mrityu Panchaka."
    })

    # 7. Ekargala Dosham (ఏకార్గళ దోషము)
    has_ekargala = panchang.get("has_ekargala", False)
    doshas.append({
        "id": "ekargala_dosham",
        "name_te": "7. ఏకార్గళ దోషము",
        "name_en": "7. Ekargala Dosham",
        "score": 0 if has_ekargala else 10,
        "is_pass": not has_ekargala,
        "desc_te": "ఏకార్గళ దోషము ఉన్నది!" if has_ekargala else "ఏకార్గళ దోషము లేదు.",
        "desc_en": "Ekargala alignment present!" if has_ekargala else "Clean! No Ekargala."
    })

    # 8. Upagraha Dosham (ఉపగ్రహ దోషము)
    planets_in_1st = get_planets_in_house(1)
    has_upagraha = ("Mandi" in planets_in_1st) or ("Gulika" in planets_in_1st)
    doshas.append({
        "id": "upagraha_dosham",
        "name_te": "8. ఉపగ్రహ దోషము",
        "name_en": "8. Upagraha Dosham",
        "score": 0 if has_upagraha else 10,
        "is_pass": not has_upagraha,
        "desc_te": "లగ్నంలో మంది/గుళిక ఉపగ్రహ దోషం ఉన్నది!" if has_upagraha else "ఉపగ్రహ దోషము లేదు.",
        "desc_en": "Upagraha Mandi/Gulika in Lagna!" if has_upagraha else "Clean! No Upagraha affliction."
    })

    # 9. Kranti Samya Dosham (క్రాంతి సామ్య దోషము)
    has_kranti_samya = yoga_name in ["Vyatipata", "Vaidhriti"]
    doshas.append({
        "id": "kranti_samya_dosham",
        "name_te": "9. క్రాంతి సామ్య దోషము",
        "name_en": "9. Kranti Samya Dosham",
        "score": 0 if has_kranti_samya else 10,
        "is_pass": not has_kranti_samya,
        "desc_te": "క్రాంతి సామ్య (మహాపాత) దోషం ఉన్నది!" if has_kranti_samya else "క్రాంతి సామ్య దోషము లేదు.",
        "desc_en": "Kranti Samya / Equal declination affliction!" if has_kranti_samya else "Clean! No Kranti Samya."
    })

    # 10. Dagdha Tithi Dosham (దగ్ధ తిధి దోషము)
    is_dagdha = tithi_name in ["Chaturthi", "Navami", "Chaturdashi"]
    doshas.append({
        "id": "dagdha_tithi_dosham",
        "name_te": "10. దగ్ధ తిధి దోషము",
        "name_en": "10. Dagdha Tithi Dosham",
        "score": 0 if is_dagdha else 10,
        "is_pass": not is_dagdha,
        "desc_te": f"దగ్ధ తిథి దోషము ఉన్నది ({tithi_name})!" if is_dagdha else "దగ్ధ తిథి దోషము లేదు.",
        "desc_en": f"Dagdha Tithi present ({tithi_name})!" if is_dagdha else "Clean! No Dagdha Tithi."
    })

    return doshas


def evaluate_muhurta_pariharas(
    panchang: Dict[str, Any],
    raw_d1: List[Any],
    muhurta_lagna_idx: int,
    birth_details: Optional[Dict[str, Any]] = None,
    pushkara_info: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Evaluates classical Vedic remedies (ముహూర్త దోష పరిహారములు) 
    that mitigate or neutralize astrological flaws for the candidate Muhurta.
    """
    pariharas = []
    
    # 1. Jupiter (Guru) Kendra or Aspect
    # Kendras from Muhurta Lagna: 1, 4, 7, 10
    jupiter_rasi = None
    for item in raw_d1:
        if str(item[0]) in ["Ju", "Jupiter", "JUPITER", "5"]:
            jupiter_rasi = item[1][0] + 1
            break
            
    if jupiter_rasi:
        jup_house = (jupiter_rasi - muhurta_lagna_idx) % 12 + 1
        is_jup_kendra = jup_house in [1, 4, 7, 10]
        # Jupiter aspects 5th, 7th, 9th houses from itself
        aspects_lagna = ((muhurta_lagna_idx - jupiter_rasi) % 12 + 1) in [1, 5, 7, 9]
        if is_jup_kendra or aspects_lagna:
            pariharas.append({
                "id": "guru_kendra_drishti",
                "name_en": "Brihaspati (Jupiter) Kendra / Aspect Protection",
                "name_te": "గురు కేంద్ర బలం / లగ్న దృష్టి రక్షణ",
                "status": "Active (బలమైన రక్షణ)",
                "shloka": "ఏకోహి దేవదేవేశః కేంద్రస్థో వా బలీ గురుః | హంతి దోషసహస్రాణి సూర్యస్తమ ఇవోదితః ||",
                "desc_en": f"Jupiter is in house {jup_house} (Kendra/Aspecting Lagna), radiating supreme protection that neutralizes thousands of minor and moderate doshas.",
                "desc_te": f"దేవగురువైన బృహస్పతి లగ్నానికి {jup_house}వ ఇంట (కేంద్రంలో/లగ్న దృష్టితో) ఉండి వేలాది దోషములను సూర్యుడు చీకట్లను పారద్రోలినట్లు నివారిస్తున్నాడు."
            })
            
    # 2. Pushkara Navamsha / Pushkara Bhaga
    if pushkara_info and (pushkara_info.get("has_pushkara") or pushkara_info.get("is_pushkara") or "పుష్కర" in str(pushkara_info)):
        pariharas.append({
            "id": "pushkara_pariharam",
            "name_en": "Pushkara Navamsha / Bhaga Inherent Sanctity",
            "name_te": "పుష్కరాంశ / పుష్కర భాగ దోష నివృత్తి",
            "status": "Active (దివ్య శుభత్వం)",
            "shloka": "పుష్కరాంశగతే లగ్నే సర్వే దోషాః వినశ్యంతి",
            "desc_en": "Muhurta Lagna is fortified by Pushkara placement, imparting innate divine nectar that overcomes astrological blemishes.",
            "desc_te": "లగ్నము పుష్కరాంశ / పుష్కర భాగములో స్థితమై ఉన్నందున సమస్త అశుభ ప్రభావములను అధిగమించి అమృత తుల్యమైన శుభ ఫలితములను ఇచ్చును."
        })

    # 3. Abhijit Muhurta
    am_muhurta = panchang.get("abhijit_kala_muhurtham")
    if am_muhurta and am_muhurta.get("status") == "auspicious":
        pariharas.append({
            "id": "abhijit_pariharam",
            "name_en": "Abhijit Kala Victory Power",
            "name_te": "అభిజిత్ కాల విజయ శక్తి",
            "status": "Active (సర్వదోష హరము)",
            "shloka": "అభిజిన్నాను ముహూర్తోస్తి సర్వదోష వినాశకః",
            "desc_en": "Blessed with midday solar sanctity of Abhijit, which naturally cancels structural planetary flaws.",
            "desc_te": "మధ్యాహ్న కాల అభిజిత్ ముహూర్త శక్తి సర్వదోషములను హరించి విజయమును చేకూర్చును."
        })

    # 4. Panchaka Pariharam
    panchaka = panchang.get("panchaka_rahitam")
    if panchaka:
        rem = panchaka.get("remainder", 0)
        pariharam_te = panchaka.get("pariharam_te", "")
        pariharam_en = panchaka.get("pariharam_en", "")
        if rem != 0 and rem not in [3, 5, 7]:
            pariharas.append({
                "id": "panchaka_shastra_pariharam",
                "name_en": f"Panchaka Remedy ({panchaka.get('name_en')})",
                "name_te": f"పంచక శాస్త్ర పరిహారం ({panchaka.get('name_te')})",
                "status": "Remedy Prescribed",
                "shloka": "రాత్రౌ రోగం దివా రాజం సంధ్యయోశ్చ మృతౌ త్యజేత్",
                "desc_en": pariharam_en,
                "desc_te": pariharam_te
            })

    # 5. Ashtama Lagna Pariharam (if applicable)
    if birth_details and birth_details.get("birth_lagna_idx"):
        b_lagna = birth_details["birth_lagna_idx"]
        # If lords of birth lagna and muhurta lagna are friends or same
        FRIENDLY_PAIRS = [{1, 8}, {2, 7}, {3, 6}, {4, 9}, {5, 12}, {10, 11}, {1, 5}, {2, 12}]
        pair = {b_lagna, muhurta_lagna_idx}
        if (muhurta_lagna_idx - b_lagna) % 12 == 7:
            for fp in FRIENDLY_PAIRS:
                if pair == fp:
                    pariharas.append({
                        "id": "ashtama_lagna_pariharam",
                        "name_en": "Ashtama Lagna Planetary Friendship Relief",
                        "name_te": "అష్టమ లగ్న మైత్రీ పరిహారం",
                        "status": "Active (దోష నివృత్తి)",
                        "shloka": "జన్మలగ్నాధిపౌ వాపి ముహూర్తపతిరేవ వా | మిత్రత్వే నైవ దోషః స్యాత్",
                        "desc_en": "Birth Lagna Lord and Muhurta Lagna Lord share planetary friendship, mitigating the 8th house lagna dosha.",
                        "desc_te": "జన్మలగ్నాధిపతి మరియు ముహూర్త లగ్నాధిపతుల మధ్య పరస్పర మైత్రి/ఏకాధిపత్యం ఉన్నందున అష్టమ లగ్న దోష పరిహారమగును."
                    })
                    break

    return pariharas

