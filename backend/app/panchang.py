"""
Complete Drik Panchang — all panchangam elements computed via PyJHora's
drik module (modern astronomical Drik Siddhanta, Lahiri/Chitrapaksha ayanamsa).

Region-based: pass lat/lon/tz_offset for any location and get accurate,
location-specific timings for sunrise, sunset, tithi, nakshatra, etc.
"""
from jhora.panchanga import drik, drik1
from jhora import utils, const
import swisseph as swe

# Monkey patch pyjhora's reset functions to prevent it from resetting Swiss Ephemeris 
# to other modes. We force it to stay on Lahiri ayanamsa at all times.
drik.reset_ayanamsa_mode = lambda: swe.set_sid_mode(swe.SIDM_LAHIRI)
drik1.reset_ayanamsa_mode = lambda: swe.set_sid_mode(swe.SIDM_LAHIRI)

from .names import (
    VAARA_NAMES, tithi_to_number_and_paksha, LUNAR_MONTH_NAMES,
    CANONICAL_NAKSHATRA, CANONICAL_TITHI, CANONICAL_KARANA, CANONICAL_YOGA,
    NAKSHATRA_NAMES, TITHI_NAMES, RASI_NAMES,
    TELUGU_SAMVATSARAS, TELUGU_LUNAR_MONTH_NAMES, RUTHU_NAMES, AYANAM_NAMES,
    PANCHAKA_CLASSIFICATIONS,
)

# Lahiri/Chitrapaksha ayanamsa — the standard for Telugu panchangams
# and the Nemani family tradition this application is built on.
drik.set_ayanamsa_mode("LAHIRI")

RASI_NAMES_TE = [
    None, "మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య",
    "తుల", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"
]

def compute_panchaka_rahitam(tithi_num: int, vaara_idx: int, nak_idx: int, lagna_rasi: int) -> dict:
    try:
        tithi_val = int(tithi_num) if tithi_num else 1
        vaara_val = (int(vaara_idx) % 7) + 1  # 1=Sunday ... 7=Saturday
        nak_val = int(nak_idx) if nak_idx else 1
        lagna_val = int(lagna_rasi) if lagna_rasi else 1
        total = tithi_val + vaara_val + nak_val + lagna_val
        rem = total % 9
        info = PANCHAKA_CLASSIFICATIONS.get(rem, PANCHAKA_CLASSIFICATIONS[0])
        return {
            "remainder": rem,
            "total": total,
            "formula": f"({tithi_val} [తిథి] + {vaara_val} [వారం] + {nak_val} [నక్షత్రం] + {lagna_val} [లగ్నం]) % 9 = {rem}",
            "name_en": info["name_en"],
            "name_te": info["name_te"],
            "is_pass": info["is_pass"],
            "effect_en": info["effect_en"],
            "effect_te": info["effect_te"],
            "pariharam_en": info["pariharam_en"],
            "pariharam_te": info["pariharam_te"],
        }
    except Exception:
        return {
            "remainder": 0,
            "total": 0,
            "formula": "—",
            "name_en": "Panchaka Rahitam (Subha Panchakam)",
            "name_te": "పంచకరహితం (శుభ పంచకం)",
            "is_pass": True,
            "effect_en": "Auspicious",
            "effect_te": "శుభప్రదం",
            "pariharam_en": "Clean",
            "pariharam_te": "దోష రహితం"
        }

def compute_kala_vibhajana(sr_hrs: float, ss_hrs: float, tomorrow_sr_hrs: float = None) -> dict:
    try:
        day_dur = ss_hrs - sr_hrs
        step = day_dur / 5.0
        
        tm_sr = tomorrow_sr_hrs if tomorrow_sr_hrs else (sr_hrs + 24.0)
        night_dur = tm_sr - ss_hrs
        night_step = night_dur / 5.0
        
        p1_s, p1_e = sr_hrs, sr_hrs + step
        p2_s, p2_e = p1_e, sr_hrs + 2 * step
        p3_s, p3_e = p2_e, sr_hrs + 3 * step
        p4_s, p4_e = p3_e, sr_hrs + 4 * step
        p5_s, p5_e = p4_e, ss_hrs
        
        pradosha_s, pradosha_e = ss_hrs, ss_hrs + (48.0 / 60.0)
        nisitha_s, nisitha_e = ss_hrs + 2 * night_step, ss_hrs + 3 * night_step
        brahma_s, brahma_e = tm_sr - (96.0 / 60.0), tm_sr - (48.0 / 60.0)
        
        return {
            "pratah_kalam": {
                "name_en": "Pratah Kalam",
                "name_te": "ప్రాతః కాలం",
                "start": _decimal_hours_to_hms(p1_s),
                "end": _decimal_hours_to_hms(p1_e),
                "desc_en": "First 1/5th of day from Sunrise. Auspicious for morning bath, Japa & rituals.",
                "desc_te": "సూర్యోదయం నుండి మొదటి భాగం. స్నాన, జప, దైవ ప్రార్థనలకు అనుకూలం."
            },
            "sangava_kalam": {
                "name_en": "Sangava Kalam",
                "name_te": "సంగవ కాలం",
                "start": _decimal_hours_to_hms(p2_s),
                "end": _decimal_hours_to_hms(p2_e),
                "desc_en": "Second 1/5th of day. Highly auspicious for education, vows & starting good works.",
                "desc_te": "రెండవ భాగం. శుభకార్యములు, వేదాధ్యయనం, నూతన పనుల ప్రారంభమునకు శ్రేష్ఠం."
            },
            "madhyahnika_kalam": {
                "name_en": "Madhyahnika Kalam",
                "name_te": "మధ్యాహ్నిక కాలం",
                "start": _decimal_hours_to_hms(p3_s),
                "end": _decimal_hours_to_hms(p3_e),
                "desc_en": "Third 1/5th of day (contains Abhijit Muhurta). Auspicious for Midday Sandhya & Daivika rituals.",
                "desc_te": "మూడవ భాగం (అభిజిత్ ముహూర్తమును కలిగి ఉండును). మాధ్యాహ్నిక సంధ్యావందనం, పూజలకు అనుకూలం."
            },
            "aparahna_kalam": {
                "name_en": "Aparahna Kalam",
                "name_te": "అపరాహ్న కాలం",
                "start": _decimal_hours_to_hms(p4_s),
                "end": _decimal_hours_to_hms(p4_e),
                "desc_en": "Fourth 1/5th of day. Auspicious for Pitru karyas and contemplation; moderate for Samskaras.",
                "desc_te": "నాల్గవ భాగం. పితృకార్యములు, శ్రాద్ధములకు ప్రశస్తం. సాధారణ శుభకార్యములకు మధ్యమం."
            },
            "sayahna_kalam": {
                "name_en": "Sayahna Kalam",
                "name_te": "సాయాహ్న కాలం",
                "start": _decimal_hours_to_hms(p5_s),
                "end": _decimal_hours_to_hms(p5_e),
                "desc_en": "Fifth 1/5th of day before Sunset. Ideal for evening prayers and temple visits.",
                "desc_te": "ఐదవ భాగం (సూర్యాస్తమయము వరకు). సాయం సంధ్య, దీపారాధన, దేవాలయ దర్శనమునకు శ్రేష్ఠం."
            },
            "pradosha_kalam": {
                "name_en": "Pradosha Kalam",
                "name_te": "ప్రదోష కాలం",
                "start": _decimal_hours_to_hms(pradosha_s),
                "end": _decimal_hours_to_hms(pradosha_e),
                "desc_en": "First 48 mins after Sunset. Ideal for Shiva Puja & lamp lighting.",
                "desc_te": "సూర్యాస్తమయం తర్వాత 48 నిమిషాలు. శివ పూజ, దీపారాధనలకు పరమ పవిత్రం."
            },
            "nisitha_kalam": {
                "name_en": "Nisitha Kalam",
                "name_te": "నిశీథ కాలం",
                "start": _decimal_hours_to_hms(nisitha_s),
                "end": _decimal_hours_to_hms(nisitha_e),
                "desc_en": "Midnight period. Sacred for Maha Shivaratri & Krishna Janmashtami pujas.",
                "desc_te": "మధ్యరాత్రి సమయం. విశేష శివరాత్రి, జన్మాష్టమి పూజలకు ప్రశస్తం."
            },
            "brahma_muhurtham": {
                "name_en": "Brahma Muhurtham",
                "name_te": "బ్రాహ్మీ ముహూర్తం",
                "start": _decimal_hours_to_hms(brahma_s),
                "end": _decimal_hours_to_hms(brahma_e),
                "desc_en": "96 to 48 mins before Sunrise. The most spiritually potent time for meditation and learning.",
                "desc_te": "సూర్యోదయానికి 96 నుండి 48 నిముషాల ముందు. జ్ఞాన, ధ్యాన, సకల సిద్ధులకు అత్యంత శ్రేష్ఠమైనది."
            }
        }
    except Exception:
        return {}

def compute_all_12_lagnas(year: int, month: int, day: int, lat: float, lon: float, tz_offset: float, sr_h: float) -> list:
    try:
        swe.set_sid_mode(swe.SIDM_LAHIRI)
        def get_lagna_lon(h_val):
            ut_hour = h_val - tz_offset
            jd_ut_mid = swe.julday(year, month, day, 0.0)
            jd_t = jd_ut_mid + ut_hour / 24.0
            cusps, ascmc = swe.houses_ex(jd_t, lat, lon, b'P', swe.FLG_SIDEREAL)
            return ascmc[0] % 360.0

        lagnas = []
        curr_h = sr_h
        prev_rasi = int(get_lagna_lon(curr_h) // 30) + 1
        start_h = curr_h

        # 2-minute increments over 24 hours
        for step in range(1, int(24 * 60 / 2)):
            t_h = sr_h + (step * 2.0 / 60.0)
            r = int(get_lagna_lon(t_h) // 30) + 1
            if r != prev_rasi:
                low_h = t_h - 2.0 / 60.0
                high_h = t_h
                for _ in range(12):
                    mid_h = 0.5 * (low_h + high_h)
                    if int(get_lagna_lon(mid_h) // 30) + 1 == prev_rasi:
                        low_h = mid_h
                    else:
                        high_h = mid_h
                end_h = 0.5 * (low_h + high_h)
                lagnas.append({
                    "rasi_index": prev_rasi,
                    "lagna_index": prev_rasi,
                    "rasi_en": RASI_NAMES[prev_rasi],
                    "lagna_name": RASI_NAMES[prev_rasi],
                    "rasi_te": RASI_NAMES_TE[prev_rasi],
                    "lagna_name_te": RASI_NAMES_TE[prev_rasi],
                    "start_time": _decimal_hours_to_hms(start_h),
                    "end_time": _decimal_hours_to_hms(end_h),
                    "start_h": start_h,
                    "end_h": end_h
                })
                prev_rasi = r
                start_h = end_h

        lagnas.append({
            "rasi_index": prev_rasi,
            "lagna_index": prev_rasi,
            "rasi_en": RASI_NAMES[prev_rasi],
            "lagna_name": RASI_NAMES[prev_rasi],
            "rasi_te": RASI_NAMES_TE[prev_rasi],
            "lagna_name_te": RASI_NAMES_TE[prev_rasi],
            "start_time": _decimal_hours_to_hms(start_h),
            "end_time": _decimal_hours_to_hms(sr_h + 24.0),
            "start_h": start_h,
            "end_h": sr_h + 24.0
        })
        return lagnas
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Time formatting helpers
# ---------------------------------------------------------------------------

def _decimal_hours_to_hms(h: float) -> str:
    if h is None:
        return None

    day_offset = 0
    if h < 0.0:
        day_offset = -1
        h = abs(h)
        while h >= 24.0:
            h -= 24.0
            day_offset -= 1
    else:
        while h >= 24.0:
            h -= 24.0
            day_offset += 1

    hh = int(h)
    remainder = (h - hh) * 60
    mm = int(remainder)
    ss = int((remainder - mm) * 60 + 0.5)

    if ss >= 60:
        ss -= 60
        mm += 1
    if mm >= 60:
        mm -= 60
        hh += 1
    if hh >= 24:
        hh -= 24
        day_offset += 1

    suffix = f" ({day_offset:+d})" if day_offset != 0 else ""
    return f"{hh:02d}:{mm:02d}:{ss:02d}{suffix}"

def _format_pair(pair) -> dict:
    if not pair or len(pair) < 2:
        return None
    a, b = pair[0], pair[1]
    start = a if isinstance(a, str) else _decimal_hours_to_hms(a)
    end = b if isinstance(b, str) else _decimal_hours_to_hms(b)
    return {"start": start, "end": end}

def parse_hms_to_hours(hms_str: str):
    if not hms_str:
        return None
    try:
        offset = 0
        if "(-1)" in hms_str:
            offset = -24
        elif "(+1)" in hms_str:
            offset = 24
        clean = hms_str.split()[0]
        parts = clean.split(":")
        h = float(parts[0])
        m = float(parts[1])
        s = float(parts[2]) if len(parts) > 2 else 0.0
        return offset + h + m / 60.0 + s / 3600.0
    except Exception:
        return None

def to_hours(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        return parse_hms_to_hours(val)
    return None



# ---------------------------------------------------------------------------
# Special Muhurta Yogas Helper (సిద్ధి, సర్వార్థ సిద్ధి, అమృత సిద్ధి, etc.)
# ---------------------------------------------------------------------------

def get_sun_nakshatra_index(year, month, day, hour, minute, second, lat, lon, tz_offset):
    try:
        ut_hour = (hour + minute/60.0 + second/3600.0) - tz_offset
        jd_ut_mid = swe.julday(year, month, day, 0.0)
        jd_t = jd_ut_mid + ut_hour / 24.0
        swe.set_sid_mode(swe.SIDM_LAHIRI)
        flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL
        sun_lon = swe.calc_ut(jd_t, swe.SUN, flags)[0][0] % 360.0
        return int(sun_lon // (360.0 / 27.0)) + 1
    except Exception:
        return None

def compute_special_yogas(vaara, tithi_num, nak_name, nak_idx, sun_nak_idx=None):
    """
    Evaluates special Vedic Yogas (సిద్ధి, సర్వార్థ సిద్ధి, అమృత సిద్ధి, ద్విపుష్కర, త్రిపుష్కర, మృత్యు, అధ, దగ్ధ, యమఘాత)
    based on Vaara, Tithi, and Nakshatra.
    """
    yogas = []
    
    v = vaara.capitalize()
    t_num = tithi_num % 15
    if t_num == 0: t_num = 15
    
    # 1. Siddhi Yogam (సిద్ధి యోగం - Tithi + Vaara)
    if (v == "Friday" and t_num in [1, 6, 11]) or \
       (v == "Wednesday" and t_num in [2, 7, 12]) or \
       (v == "Tuesday" and t_num in [3, 8, 13]) or \
       (v == "Saturday" and t_num in [4, 9, 14]) or \
       (v == "Thursday" and t_num in [5, 10, 15]):
        yogas.append({
            "name_en": "Siddhi Yogam",
            "name_te": "సిద్ధి యోగం",
            "type": "good",
            "desc_en": "Auspicious Siddhi Yoga formed by Tithi + Weekday combination.",
            "desc_te": "శుభ సిద్ధి యోగము (తిథి + వార సంయోగం)."
        })
        
    # 2. Sarvartha Siddhi Yogam (సర్వార్థ సిద్ధి యోగం - Nakshatra + Vaara)
    ss_map = {
        "Monday": ["Rohini", "Mrigashira", "Pushya", "Anuradha", "Shravana"],
        "Tuesday": ["Uttara Bhadrapada", "Krittika", "Ashlesha", "Ashwini"],
        "Wednesday": ["Anuradha", "Hasta", "Krittika", "Mrigashira", "Rohini"],
        "Thursday": ["Anuradha", "Ashwini", "Pushya", "Revati"],
        "Friday": ["Anuradha", "Ashwini", "Punarvasu", "Shravana", "Revati"],
        "Saturday": ["Rohini", "Swati", "Shravana"],
        "Sunday": ["Mula", "Uttara Ashadha", "Uttara Phalguni", "Uttara Bhadrapada", "Ashwini", "Pushya", "Hasta"]
    }
    if nak_name in ss_map.get(v, []):
        yogas.append({
            "name_en": "Sarvartha Siddhi Yogam",
            "name_te": "సర్వార్థ సిద్ధి యోగం",
            "type": "good",
            "desc_en": "Highly auspicious Sarvartha Siddhi Yoga for all endeavors.",
            "desc_te": "సర్వ కార్య సిద్ధిప్రదమైన సర్వార్థ సిద్ధి యోగము."
        })

    # 3. Amrita Siddhi Yogam (అమృత సిద్ధి యోగం - Nakshatra + Vaara)
    as_map = {
        "Sunday": "Hasta",
        "Monday": "Mrigashira",
        "Tuesday": "Ashwini",
        "Wednesday": "Anuradha",
        "Thursday": "Pushya",
        "Friday": "Revati",
        "Saturday": "Rohini"
    }
    if as_map.get(v) == nak_name:
        notes = []
        if v == "Thursday" and nak_name == "Pushya": notes.append("Avoid for Marriage / వివాహ నిషిద్ధం")
        if v == "Saturday" and nak_name == "Rohini": notes.append("Avoid for Travel / ప్రయాణ నిషిద్ధం")
        notes.append("Avoid for Housewarming / గృహప్రవేశ నిషిద్ధం")
        note_str = " (" + ", ".join(notes) + ")" if notes else ""
        yogas.append({
            "name_en": "Amrita Siddhi Yogam",
            "name_te": f"అమృత సిద్ధి యోగం{note_str}",
            "type": "good",
            "desc_en": f"Auspicious Amrita Siddhi Yoga{note_str}.",
            "desc_te": f"శ్రేష్ఠమైన అమృత సిద్ధి యోగము{note_str}."
        })

    # 4. Dvipushkara Yogam (ద్విపుష్కర యోగం - Tithi + Vaara + Nakshatra)
    if (v == "Sunday" and t_num == 2 and nak_name == "Dhanishtha") or \
       (v == "Tuesday" and t_num == 7 and nak_name == "Chitra") or \
       (v == "Saturday" and t_num == 12 and nak_name == "Mrigashira"):
        yogas.append({
            "name_en": "Dvipushkara Yogam (2x Benefit)",
            "name_te": "ద్విపుష్కర యోగం (ఫలితాలు 2 సార్లు పునరావృతం)",
            "type": "good",
            "desc_en": "Auspicious 2x Multiplier Yoga (Great for buying house/gold).",
            "desc_te": "శ్రేష్ఠమైన ద్విపుష్కర యోగం (ఇళ్ళు, బంగారం కొనడానికి అత్యంత అనుకూలం)."
        })

    # 5. Tripushkara Yogam (త్రిపుష్కర యోగం - Tithi + Vaara + Nakshatra)
    if (v == "Sunday" and t_num == 2 and nak_name in ["Krittika", "Vishakha"]) or \
       (v == "Tuesday" and t_num == 7 and nak_name in ["Punarvasu", "Uttara Ashadha"]) or \
       (v == "Saturday" and t_num == 12 and nak_name in ["Uttara Phalguni", "Uttara Bhadrapada"]):
        yogas.append({
            "name_en": "Tripushkara Yogam (3x Benefit)",
            "name_te": "త్రిపుష్కర యోగం (ఫలితాలు 3 సార్లు పునరావృతం)",
            "type": "good",
            "desc_en": "Auspicious 3x Multiplier Yoga (Great for buying property/gold).",
            "desc_te": "శ్రేష్ఠమైన త్రిపుష్కర యోగం (మూడుసార్లు శ్రేష్ఠ ఫలితాల పునరావృతం)."
        })

    # 6. Mrityu Yogam (మృత్యు యోగం - Tithi + Vaara)
    if (v in ["Tuesday", "Sunday"] and t_num in [1, 6, 11]) or \
       (v in ["Monday", "Friday"] and t_num in [7, 12]) or \
       (v == "Wednesday" and t_num in [3, 8, 13]) or \
       (v == "Thursday" and t_num in [4, 9, 14]) or \
       (v == "Saturday" and t_num in [5, 10, 15]):
        yogas.append({
            "name_en": "Mrityu Yogam",
            "name_te": "మృత్యు యోగం",
            "type": "bad",
            "desc_en": "Inauspicious Mrityu Yoga - Avoid auspicious activities.",
            "desc_te": "అశుభకరమైన మృత్యు యోగము - శుభ కార్యములకు వర్జ్యము."
        })

    # 7. Adha Yogam (అధ యోగం - Tithi + Vaara)
    if (v == "Sunday" and t_num in [7, 12]) or \
       (v == "Monday" and t_num == 11) or \
       (v == "Tuesday" and t_num == 10) or \
       (v == "Wednesday" and t_num in [1, 9]) or \
       (v == "Thursday" and t_num == 8) or \
       (v == "Friday" and t_num == 7) or \
       (v == "Saturday" and t_num == 6):
        yogas.append({
            "name_en": "Adha Yogam",
            "name_te": "అధ యోగం",
            "type": "bad",
            "desc_en": "Inauspicious Adha Yoga per Panchang Shastra.",
            "desc_te": "అశుభకరమైన అధ యోగము."
        })

    # 8. Dagdha Yogam (దగ్ధ యోగం - Nakshatra + Vaara)
    dagdha_map = {
        "Sunday": "Bharani",
        "Monday": "Chitra",
        "Tuesday": "Uttara Ashadha",
        "Wednesday": "Dhanishtha",
        "Thursday": "Uttara Phalguni",
        "Friday": "Jyeshtha",
        "Saturday": "Revati"
    }
    if dagdha_map.get(v) == nak_name:
        yogas.append({
            "name_en": "Dagdha Yogam",
            "name_te": "దగ్ధ యోగం",
            "type": "bad",
            "desc_en": "Inauspicious Dagdha Yoga - Should be avoided.",
            "desc_te": "అశుభకరమైన దగ్ధ యోగము."
        })

    # 9. Yamaghata Yogam (యమఘాత యోగం - Nakshatra + Vaara)
    yama_map = {
        "Sunday": "Magha",
        "Monday": "Vishakha",
        "Tuesday": "Ardra",
        "Wednesday": "Mula",
        "Thursday": "Krittika",
        "Friday": "Rohini",
        "Saturday": "Hasta"
    }
    if yama_map.get(v) == nak_name:
        yogas.append({
            "name_en": "Yamaghata Yogam",
            "name_te": "యమఘాత యోగం",
            "type": "bad",
            "desc_en": "Highly inauspicious Yamaghata Yoga - Avoid completely.",
            "desc_te": "అత్యంత అశుభకరమైన యమఘాత యోగము."
        })

    # 10. Yoga Sadhana (చంద్రసంఖ్య + రవి సంఖ్య)
    YOGA_SADHANA_NAMES = [
        None,
        {"en": "Vishkambha Yoga", "te": "విష్కంభ యోగం", "type": "bad"},
        {"en": "Priti Yoga", "te": "ప్రీతి యోగం", "type": "good"},
        {"en": "Ayushman Yoga", "te": "ఆయుష్మాన్ యోగం", "type": "good"},
        {"en": "Saubhagya Yoga", "te": "సౌభాగ్య యోగం", "type": "good"},
        {"en": "Shobhana Yoga", "te": "శోభన యోగం", "type": "good"},
        {"en": "Atiganda Yoga", "te": "అతిగండ యోగం", "type": "bad"},
        {"en": "Sukarma Yoga", "te": "సుకర్మ యోగం", "type": "good"},
        {"en": "Dhriti Yoga", "te": "ధృతి యోగం", "type": "good"},
        {"en": "Shula Yoga", "te": "శూల యోగం", "type": "bad"},
        {"en": "Ganda Yoga", "te": "గండ యోగం", "type": "bad"},
        {"en": "Vriddhi Yoga", "te": "వృద్ధి యోగం", "type": "good"},
        {"en": "Dhruva Yoga", "te": "ధ్రువ యోగం", "type": "good"},
        {"en": "Vyaghata Yoga", "te": "వ్యాఘాత యోగం", "type": "bad"},
        {"en": "Harshana Yoga", "te": "హర్షణ యోగం", "type": "good"},
        {"en": "Vajra Yoga", "te": "వజ్ర యోగం", "type": "bad"},
        {"en": "Siddhi Yoga", "te": "సిద్ధి యోగం", "type": "good"},
        {"en": "Vyatipata Yoga", "te": "వ్యతీపాత యోగం", "type": "bad"},
        {"en": "Variyan Yoga", "te": "వరీయాన్ యోగం", "type": "good"},
        {"en": "Parigha Yoga", "te": "పరిఘ యోగం", "type": "bad"},
        {"en": "Shiva Yoga", "te": "శివ యోగం", "type": "good"},
        {"en": "Siddha Yoga", "te": "సిద్ధ యోగం", "type": "good"},
        {"en": "Sadhya Yoga", "te": "సాధ్య యోగం", "type": "good"},
        {"en": "Shubha Yoga", "te": "శుభ యోగం", "type": "good"},
        {"en": "Shukla Yoga", "te": "శుక్ల యోగం", "type": "good"},
        {"en": "Brahma Yoga", "te": "బ్రహ్మ యోగం", "type": "good"},
        {"en": "Indra Yoga", "te": "ఇంద్ర యోగం", "type": "good"},
        {"en": "Vaidhriti Yoga", "te": "వైధృతి యోగం", "type": "bad"},
    ]

    if sun_nak_idx is not None and nak_idx is not None:
        c_sankhya = (nak_idx - 22) % 27 + 1   # Count from Shravana (22)
        r_sankhya = (sun_nak_idx - 8) % 27 + 1  # Count from Pushya (8)
        total_sankhya = c_sankhya + r_sankhya
        yoga_idx = (total_sankhya - 1) % 27 + 1
        y_info = YOGA_SADHANA_NAMES[yoga_idx]
        
        yogas.append({
            "name_en": f"Yoga Sadhana: {y_info['en']}",
            "name_te": f"యోగ సాధన: {y_info['te']}",
            "type": y_info["type"],
            "desc_en": f"{y_info['en']} formed via Chandra & Ravi Nakshatra Yoga Sadhana.",
            "desc_te": f"చంద్ర-రవి నక్షత్ర యోగ సాధన ద్వారా ఏర్పడిన {y_info['te']}."
        })

    return yogas


# ---------------------------------------------------------------------------
# Main panchang computation
# ---------------------------------------------------------------------------

def compute_day_panchang(year: int, month: int, day: int,
                          lat: float, lon: float, tz_offset: float,
                          place_name: str = "Location",
                          hour: int = 6, minute: int = 0, second: int = 0) -> dict:
    drik.set_ayanamsa_mode("LAHIRI")

    place = drik.Place(place_name, lat, lon, tz_offset)
    date_in = drik.Date(year, month, day)
    jd = utils.julian_day_number(date_in, (hour, minute, second))

    # Vaara
    vaara_idx = drik.vaara(jd, place)
    vaara_str = VAARA_NAMES[vaara_idx]

    # Sunrise / Sunset
    sunrise_raw = drik.sunrise(jd, place)
    sunset_raw = drik.sunset(jd, place)
    sunrise_str = sunrise_raw[1] if len(sunrise_raw) > 1 else _decimal_hours_to_hms(sunrise_raw[0])
    sunset_str = sunset_raw[1] if len(sunset_raw) > 1 else _decimal_hours_to_hms(sunset_raw[0])
    sr_hrs = sunrise_raw[0]
    ss_hrs = sunset_raw[0]

    # Tithi
    tithi_raw = drik.tithi(jd, place)
    tithi_idx_30 = tithi_raw[0]
    tithi_num, paksha = tithi_to_number_and_paksha(tithi_idx_30)
    tithi_name_raw = utils.TITHI_LIST[tithi_idx_30 - 1]
    tithi_name = CANONICAL_TITHI.get(tithi_name_raw, tithi_name_raw)
    tithi_start_hrs = tithi_raw[1]
    tithi_end_hrs = tithi_raw[2] if len(tithi_raw) > 2 else None

    # Nakshatra
    nak_raw = drik.nakshatra(jd, place)
    nak_idx = nak_raw[0]
    nak_pada = nak_raw[1]
    nak_name_raw = utils.NAKSHATRA_LIST[nak_idx - 1]
    nak_name = CANONICAL_NAKSHATRA.get(nak_name_raw, nak_name_raw)
    nak_start_hrs = nak_raw[2]
    nak_end_hrs = nak_raw[3]

    padas_list = []
    try:
        h_start = abs(nak_start_hrs) - 24.0 if nak_start_hrs < 0 else nak_start_hrs
        h_end = nak_end_hrs
        jd_ut_mid = swe.julday(year, month, day, 0.0)
        
        def get_moon_lon(h):
            ut_hour = h - tz_offset
            jd_t = jd_ut_mid + ut_hour / 24.0
            swe.set_sid_mode(swe.SIDM_LAHIRI)
            flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL
            return swe.calc_ut(jd_t, swe.MOON, flags)[0][0]

        def find_crossing_hour(target_lon, a, b):
            for _ in range(25):
                mid = (a + b) / 2.0
                lon = get_moon_lon(mid)
                diff = (lon - target_lon + 180) % 360 - 180
                if diff < 0:
                    a = mid
                else:
                    b = mid
            return (a + b) / 2.0

        L_start = (nak_idx - 1) * (360.0 / 27.0)
        last_t = h_start
        for p in range(1, 5):
            p_end_lon = L_start + p * (360.0 / 108.0)
            t_end = find_crossing_hour(p_end_lon, last_t, h_end)
            t_start_val = -(24.0 + last_t) if last_t < 0.0 else last_t
            t_end_val = -(24.0 + t_end) if t_end < 0.0 else t_end
            
            padas_list.append({
                "pada": p,
                "start_time": _decimal_hours_to_hms(t_start_val),
                "end_time": _decimal_hours_to_hms(t_end_val)
            })
            last_t = t_end
    except Exception:
        padas_list = []

    next_nak = None
    if len(nak_raw) >= 7:
        next_nak_idx = nak_raw[4]
        next_nak_name_raw = utils.NAKSHATRA_LIST[next_nak_idx - 1]
        next_nak = {
            "name": CANONICAL_NAKSHATRA.get(next_nak_name_raw, next_nak_name_raw),
            "pada": nak_raw[5],
            "start_time": _decimal_hours_to_hms(nak_end_hrs),
            "end_time": _decimal_hours_to_hms(nak_raw[6]),
        }

    # Yoga
    yoga_raw = drik.yogam(jd, place)
    yoga_idx = yoga_raw[0]
    yoga_name_raw = utils.YOGAM_LIST[yoga_idx - 1]
    yoga_name = CANONICAL_YOGA.get(yoga_name_raw, yoga_name_raw)
    yoga_start_hrs = yoga_raw[1]
    yoga_end_hrs = yoga_raw[2]

    # Karana
    karana_raw = drik.karana(jd, place)
    karana_idx = karana_raw[0]
    karana_name_raw = utils.KARANA_LIST[karana_idx - 1]
    karana_name = CANONICAL_KARANA.get(karana_name_raw, karana_name_raw)
    karana_start_hrs = karana_raw[1]
    karana_end_hrs = karana_raw[2] if len(karana_raw) > 2 else None

    # Inauspicious times
    rahu_kalam = drik.raahu_kaalam(jd, place)
    yamagandam = drik.yamaganda_kaalam(jd, place)
    gulika_kalam = drik.gulikai_kaalam(jd, place)
    
    dur_raw = drik.durmuhurtam(jd, place)
    durmuhurtam_list = []
    if dur_raw:
        for i in range(0, len(dur_raw), 2):
            if i + 1 < len(dur_raw):
                durmuhurtam_list.append({"start": dur_raw[i], "end": dur_raw[i + 1]})

    abhijit = None
    try:
        am = drik.abhijit_muhurta(jd, place)
        if am and len(am) >= 2: abhijit = _format_pair(am)
    except Exception: pass

    brahma = None
    try:
        bm = drik.brahma_muhurtha(jd, place)
        if bm and len(bm) >= 2: brahma = _format_pair(bm)
    except Exception: pass

    godhuli = None
    try:
        gm = drik.godhuli_muhurtha(jd, place)
        if gm and len(gm) >= 2: godhuli = _format_pair(gm)
    except Exception: pass

    varjyam = None
    try:
        vj = drik.varjyam(jd, place)
        if vj and len(vj) >= 2: varjyam = _format_pair(vj)
    except Exception: pass

    amrit_kalam = None
    try:
        ak = drik.amrit_kaalam(jd, place)
        if ak:
            if isinstance(ak, list):
                amrit_kalam = []
                for period in ak:
                    if isinstance(period, (list, tuple)) and len(period) >= 2:
                        amrit_kalam.append({"start": period[0], "end": period[1]})
            elif isinstance(ak, tuple) and len(ak) >= 2:
                amrit_kalam = [{"start": ak[0], "end": ak[1]}]
    except Exception: pass

    abhijit_kala_muhurtham = {
        "start": None,
        "end": None,
        "status": "none",
        "is_partial": False,
        "msg_en": "None (completely blocked by inauspicious periods)",
        "msg_te": "లేదు (పూర్తిగా అశుభ సమయాల కలయిక వలన)"
    }
    try:
        if am and len(am) >= 2:
            am_start = to_hours(am[0])
            am_end = to_hours(am[1])
            if am_start is not None and am_end is not None:
                blocked = []
                def add_block(period, buffer_mins=10.0):
                    if not period:
                        return
                    if isinstance(period, list) and len(period) > 0:
                        if isinstance(period[0], (list, tuple)):
                            for sub in period:
                                add_block(sub, buffer_mins)
                            return
                    if len(period) >= 2:
                        s_h = to_hours(period[0])
                        e_h = to_hours(period[1])
                        if s_h is not None and e_h is not None:
                            buf_h = buffer_mins / 60.0
                            blocked.append((s_h - buf_h, e_h + buf_h))

                add_block(rahu_kalam)
                add_block(yamagandam)
                add_block(gulika_kalam)
                if dur_raw:
                    for i in range(0, len(dur_raw), 2):
                        if i + 1 < len(dur_raw):
                            add_block([dur_raw[i], dur_raw[i+1]])
                if vj:
                    add_block(vj)

                # Subtract blocked intervals
                active = [(am_start, am_end)]
                for b_start, b_end in blocked:
                    new_active = []
                    for a_start, a_end in active:
                        if b_end <= a_start or b_start >= a_end:
                            new_active.append((a_start, a_end))
                        else:
                            if b_start > a_start:
                                new_active.append((a_start, b_start))
                            if b_end < a_end:
                                new_active.append((b_end, a_end))
                    active = new_active

                # Find longest active window
                longest = None
                max_dur = 0.0
                for a_start, a_end in active:
                    dur = a_end - a_start
                    if dur > max_dur:
                        max_dur = dur
                        longest = (a_start, a_end)

                if longest and max_dur >= 5.0 / 60.0:
                    is_partial = (max_dur < (am_end - am_start) - 0.01)
                    if is_partial:
                        msg_en = f"Suggested clean window: {_decimal_hours_to_hms(longest[0])} – {_decimal_hours_to_hms(longest[1])} (overlaps with bad timings)"
                        msg_te = f"శుభ సమయం: {_decimal_hours_to_hms(longest[0])} – {_decimal_hours_to_hms(longest[1])} (పాక్షిక అశుభ కాల కలయిక)"
                    else:
                        msg_en = f"Auspicious window: {_decimal_hours_to_hms(longest[0])} – {_decimal_hours_to_hms(longest[1])}"
                        msg_te = f"శుభ సమయం: {_decimal_hours_to_hms(longest[0])} – {_decimal_hours_to_hms(longest[1])}"

                    abhijit_kala_muhurtham = {
                        "start": _decimal_hours_to_hms(longest[0]),
                        "end": _decimal_hours_to_hms(longest[1]),
                        "status": "auspicious",
                        "is_partial": is_partial,
                        "msg_en": msg_en,
                        "msg_te": msg_te
                    }
    except Exception as ex:
        print(f"Error calculating clean Abhijit Muhurtham: {ex}")

    chandramana = {}
    try:
        vd = drik.vedic_date(jd, place, calendar_type=const.CALENDAR_TYPE.LUNAR_AMANTHA)
        chandra_month = vd[0]
        chandra_day = vd[1]
        samvatsara_idx = vd[2]
        is_adhika = bool(vd[3]) if len(vd) > 3 else False
        is_nija = bool(vd[4]) if len(vd) > 4 else False
        
        ruthu_idx = ((chandra_month - 1) // 2) + 1 if 1 <= chandra_month <= 12 else 1
        ruthu_info = RUTHU_NAMES[ruthu_idx] if 1 <= ruthu_idx < len(RUTHU_NAMES) else {"en": "Vasanta", "te": "వసంత ఋతువు"}
        
        ayanam_key = "uttarayana" if (chandra_month in [11, 12, 1, 2, 3, 4] or (chandra_month == 10 and chandra_day >= 15)) else "dakshinayana"
        ayanam_info = AYANAM_NAMES[ayanam_key]

        chandramana = {
            "month_name": LUNAR_MONTH_NAMES[chandra_month] if 1 <= chandra_month <= 12 else f"Month-{chandra_month}",
            "month_telugu": TELUGU_LUNAR_MONTH_NAMES[chandra_month] if 1 <= chandra_month <= 12 else f"మాసం-{chandra_month}",
            "month_number": chandra_month,
            "day": chandra_day,
            "samvatsara_name": utils.YEAR_LIST[samvatsara_idx % 60],
            "samvatsara_telugu": TELUGU_SAMVATSARAS[samvatsara_idx % 60],
            "is_adhika_masa": is_adhika,
            "is_nija_masa": is_nija,
            "ayanam_en": ayanam_info["en"],
            "ayanam_te": ayanam_info["te"],
            "ruthu_en": ruthu_info["en"],
            "ruthu_te": ruthu_info["te"],
            "paksha_en": paksha.capitalize() if isinstance(paksha, str) else "Shukla",
            "paksha_te": "శుక్ల పక్షం" if str(paksha).lower() == "shukla" else "కృష్ణ పక్షం",
        }
    except Exception: pass

    # Lagna Rasi
    lagna_rasi = None
    try:
        swe.set_sid_mode(swe.SIDM_LAHIRI)
        ut_hour = (hour + minute/60.0 + second/3600.0) - tz_offset
        jd_ut_mid = swe.julday(year, month, day, 0.0)
        jd_t = jd_ut_mid + ut_hour / 24.0
        cusps, ascmc = swe.houses_ex(jd_t, lat, lon, b'P', swe.FLG_SIDEREAL)
        lagna_lon = ascmc[0] % 360.0
        lagna_rasi = int(lagna_lon // 30) + 1
    except Exception: pass

    # Compute Special Yogas
    sun_nak_idx = get_sun_nakshatra_index(year, month, day, hour, minute, second, lat, lon, tz_offset)
    special_yogas = compute_special_yogas(vaara_str, tithi_num, nak_name, nak_idx, sun_nak_idx)

    # Kala Vibhajana (Daytime 5-fold division + Night special times)
    kala_vibhajana = compute_kala_vibhajana(sr_hrs, ss_hrs)

    # Panchaka Rahitam
    panchaka = compute_panchaka_rahitam(tithi_num, vaara_idx, nak_idx, lagna_rasi)

    # Lagna Schedule (All 12 Lagnas for the day)
    lagna_schedule = compute_all_12_lagnas(year, month, day, lat, lon, tz_offset, sr_hrs)

    return {
        "place": place_name,
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "time": f"{int(hour):02d}:{int(minute):02d}:{int(second):02d}",
        "vaara": vaara_str,
        "sunrise": sunrise_str,
        "sunset": sunset_str,

        "tithi": {
            "name": tithi_name,
            "number": tithi_num,
            "paksha": paksha,
            "index_raw": tithi_idx_30,
            "start_time": _decimal_hours_to_hms(tithi_start_hrs),
            "end_time": _decimal_hours_to_hms(tithi_end_hrs),
        },

        "nakshatra": {
            "name": nak_name,
            "index": nak_idx,
            "pada": nak_pada,
            "start_time": _decimal_hours_to_hms(nak_start_hrs),
            "end_time": _decimal_hours_to_hms(nak_end_hrs),
            "padas": padas_list,
            "next": next_nak,
        },

        "yoga": {
            "name": yoga_name,
            "index": yoga_idx,
            "start_time": _decimal_hours_to_hms(yoga_start_hrs),
            "end_time": _decimal_hours_to_hms(yoga_end_hrs),
        },

        "karana": {
            "name": karana_name,
            "index": karana_idx,
            "start_time": _decimal_hours_to_hms(karana_start_hrs),
            "end_time": _decimal_hours_to_hms(karana_end_hrs),
        },

        "rahu_kalam": _format_pair(rahu_kalam),
        "yamagandam": _format_pair(yamagandam),
        "gulika_kalam": _format_pair(gulika_kalam),
        "durmuhurtam": durmuhurtam_list,
        "abhijit_muhurta": abhijit,
        "abhijit_kala_muhurtham": abhijit_kala_muhurtham,
        "brahma_muhurta": brahma,
        "godhuli_muhurta": godhuli,
        "varjyam": varjyam,
        "amrit_kalam": amrit_kalam,

        "special_yogas": special_yogas,

        "chandramana": chandramana,
        "kala_vibhajana": kala_vibhajana,
        "panchaka_rahitam": panchaka,
        "lagna_schedule": lagna_schedule,
        "lagna_rasi": lagna_rasi,

        "tithi_name": tithi_name,
        "tithi_number": tithi_num,
        "tithi_index_raw": tithi_idx_30,
        "paksha": paksha,
        "nakshatra_name": nak_name,
        "nakshatra_index": nak_idx,
        "nakshatra_pada": nak_pada,
        "yoga_name": yoga_name,
        "yoga_index": yoga_idx,
        "karana_name": karana_name,
        "lagna_rasi_index": lagna_rasi if lagna_rasi else 1,
    }


def compute_chandrabalam(birth_moon_rasi_idx: int, cand_moon_rasi_idx: int) -> dict:
    """
    Computes Chandrabalam based on transit Moon's house from birth Moon Rasi (1-indexed 1..12).
    Auspicious: 1, 3, 6, 7, 10, 11 (Full strength)
    Moderate: 2, 5, 9 (Permissible)
    Inauspicious: 4, 12 (Weak)
    Chandrashtama: 8 (Severe dosha - highly avoided)
    """
    if not birth_moon_rasi_idx or not cand_moon_rasi_idx:
        return {
            "is_pass": True,
            "house": None,
            "status": "auspicious",
            "desc_en": "Moon favorably situated.",
            "desc_te": "చంద్రబలం అనుకూలంగా ఉన్నది."
        }
    
    ch_house = (cand_moon_rasi_idx - birth_moon_rasi_idx) % 12 + 1
    if ch_house in [1, 3, 6, 7, 10, 11]:
        return {
            "is_pass": True,
            "house": ch_house,
            "status": "auspicious",
            "desc_en": f"Favorable Chandrabalam ({ch_house}th house from Janma Rasi). Auspicious.",
            "desc_te": f"పూర్ణ చంద్రబలం (జన్మరాశి నుండి {ch_house}వ ఇల్లు). అత్యంత శుభప్రదం."
        }
    elif ch_house == 8:
        return {
            "is_pass": False,
            "house": 8,
            "status": "chandrashtama",
            "desc_en": "Chandrashtama (8th house Moon from Janma Rasi)! Highly inauspicious / Avoid.",
            "desc_te": "చంద్రాష్టమము (జన్మరాశి నుండి 8వ ఇంట చంద్రుడు)! అత్యంత అశుభం / వర్జ్యం."
        }
    elif ch_house in [2, 5, 9]:
        return {
            "is_pass": True,
            "house": ch_house,
            "status": "moderate",
            "desc_en": f"Moderate Chandrabalam ({ch_house}th house from Janma Rasi). Acceptable.",
            "desc_te": f"మధ్యమ చంద్రబలం (జన్మరాశి నుండి {ch_house}వ ఇల్లు). అనుమతించదగినది."
        }
    else:  # 4, 12
        return {
            "is_pass": False,
            "house": ch_house,
            "status": "inauspicious",
            "desc_en": f"Weak Chandrabalam ({ch_house}th house from Janma Rasi). Not recommended.",
            "desc_te": f"అశుభ చంద్రబలం (జన్మరాశి నుండి {ch_house}వ ఇల్లు). ఆమోదయోగ్యం కాదు."
        }

