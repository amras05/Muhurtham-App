"""
Samskaras Engine: Automated evaluation of 9 Classical Vedic Samskara Muhurtas
from Pages 8 to 16 of the Gayathri Jyothirnidhe treatise (by Dr. Vamsee Nemani).

Samskaras covered:
1. Garbhadhana (గర్భాదాన ముహూర్తము) - Page 8
2. Pumsavana (పుంసవన ముహూర్తము) - Page 9
3. Seemantha (సీమంత ముహూర్తము) - Page 10
4. Jatakarma (జాతకర్మ ముహూర్తము) - Page 11
5. Namakarana (నామకరణ ముహూర్తము) - Page 12
6. Annaprashana (అన్నప్రాశన ముహూర్తము) - Page 13
7. Choodakarana / Keshakhandana (చూడాకర్మ / కేశఖండన ముహూర్తము) - Page 14
8. Karnavedha (కర్ణవేధ ముహూర్తము) - Page 15
9. Upanayana (ఉపనయన ముహూర్తము) - Page 16
"""

from datetime import date, datetime, timedelta
from typing import Dict, List, Any, Optional
import swisseph as swe
from jhora.panchanga.drik import Place as JHoraPlace
from jhora.panchanga import drik
from jhora.horoscope.chart import charts
from jhora import utils

from .names import CANONICAL_NAKSHATRA, RASI_NAMES, VAARA_NAMES
from .panchang import (
    compute_day_panchang as compute_drik_panchang,
    compute_panchaka_rahitam,
    compute_chandrabalam
)
from .doshas_engine import (
    evaluate_21_maha_doshas,
    evaluate_10_dashavidha_doshas,
    evaluate_muhurta_pariharas
)

TARA_NAMES = {
    1: "Janma", 2: "Sampat", 3: "Vipat", 4: "Kshema", 5: "Pratyak",
    6: "Sadhana", 7: "Naidhana", 8: "Mitra", 9: "Paramamitra"
}

TARA_NAMES_TE = {
    1: "జన్మ తార (అశుభం)", 2: "సంపత్ తార (శుభం)", 3: "విపత్ తార (అశుభం)",
    4: "క్షేమ తార (శుభం)", 5: "ప్రత్యక్ తార (అశుభం)", 6: "సాధన తార (శుభం)",
    7: "నైధన తార (అశుభం)", 8: "మిత్ర తార (శుభం)", 9: "పరమమిత్ర తార (శుభం)"
}

PLANET_NAMES_MAP = {
    "0": "Sun", "1": "Moon", "2": "Mars", "3": "Mercury", "4": "Jupiter",
    "5": "Venus", "6": "Saturn", "7": "Rahu", "8": "Ketu", "Mnd": "Mandi", "Gk": "Gulika"
}

MALEFIC_IDS = ["0", "2", "6", "7", "8"]

# Pushkara Navamsha Ranges per sign
PUSHKARA_RANGES = {
    0: [(20.0, 23.3333), (26.6667, 30.0)],
    4: [(20.0, 23.3333), (26.6667, 30.0)],
    8: [(20.0, 23.3333), (26.6667, 30.0)],
    1: [(6.6667, 10.0), (13.3333, 16.6667)],
    5: [(6.6667, 10.0), (13.3333, 16.6667)],
    9: [(6.6667, 10.0), (13.3333, 16.6667)],
    2: [(16.6667, 20.0), (23.3333, 26.6667)],
    6: [(16.6667, 20.0), (23.3333, 26.6667)],
    10: [(16.6667, 20.0), (23.3333, 26.6667)],
    3: [(0.0, 3.3333), (6.6667, 10.0)],
    7: [(0.0, 3.3333), (6.6667, 10.0)],
    11: [(0.0, 3.3333), (6.6667, 10.0)],
}

PUSHKARA_BHAGA_DEGS = {
    0: 21.0, 4: 21.0, 8: 21.0,
    1: 14.0, 5: 14.0, 9: 14.0,
    2: 24.0, 6: 24.0, 10: 24.0,
    3: 7.0,  7: 7.0,  11: 7.0,
}

SAMSKARA_REGISTRY = {
    "garbhadhana": {
        "id": "garbhadhana",
        "page_number": 8,
        "name_en": "Garbhadhana Muhurtham",
        "name_te": "గర్భాదాన ముహూర్తము",
        "tagline_en": "Conception & Consummation Rite",
        "tagline_te": "సంతాన ప్రాప్తి కొరకు పవిత్ర గర్భాదాన కాల నిర్ణయము",
        "icon": "🤰",
        "rules_summary_en": "Mon, Wed, Thu, Fri favorable. Avoid Sun, Tue, Sat. Moon in 8th from bride/groom prohibited (Chandrashtama). Muhurta Lagna cannot be 6th or 8th from bride's Ritu Lagna. Avoid 7th star from Janma Nakshatra. Taras 1, 3, 5, 7 avoided.",
        "rules_summary_te": "సోమ, బుధ, గురు, శుక్రవారములు శ్రేష్టం. ఆది, మంగళ, శనివారములు నిషిద్ధం (1, 3, 7). వధూవరుల జన్మరాశికి 8వ ఇంట చంద్రుడు ఉండకూడదు. వధువు ప్రథమ రజస్వల లగ్నానికి ముహూర్త లగ్నం 6, 8 అవ్వకూడదు. 7వ నక్షత్రం పనికిరాదు. జన్మ, 3, 5, 7 తారలు నిషిద్ధం.",
        "good_vaaras": [2, 4, 5, 6],
        "avoid_vaaras": [1, 3, 7],
        "good_tithis": [1, 2, 3, 5, 7, 8, 9, 10, 12, 13, 16, 17, 18, 20, 21, 22, 24, 25, 26, 27, 28],
        "avoid_tithis": [4, 6, 11, 14, 15, 19, 29, 30],
        "good_nakshatras": [3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 26],
        "avoid_yogas": [1, 18, 20],
        "avoid_karanas": [8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["chandrashtama_both", "ritu_lagna_6_8", "star_7_prohibited", "ashtama_shuddhi", "lagna_shuddhi"]
    },
    "pumsavana": {
        "id": "pumsavana",
        "page_number": 9,
        "name_en": "Pumsavana Muhurtham",
        "name_te": "పుంసవన ముహూర్తము",
        "tagline_en": "Fetus Protection & Male Child Rite (3rd Month)",
        "tagline_te": "తొలి గర్భవతికి 3వ మాసమందు భర్తచే చేయబడు సంస్కారము",
        "icon": "🌿",
        "rules_summary_en": "Mon, Wed, Thu, Fri favorable. Avoid Sun, Tue, Sat. Avoid Rikta tithis (4, 9, 14) and Amavasya (30). Avoid Leo (5) & Scorpio (8) Lagnas. Taras 1, 3, 5, 7 avoided. Performed in 3rd month of pregnancy.",
        "rules_summary_te": "సోమ, బుధ, గురు, శుక్రవారములు శ్రేష్టం. 1, 3, 7 వారములు నిషిద్ధం. 4, 9, 14, 30 తిథులు నిషిద్ధం. సింహ (5), వృశ్చిక (8) లగ్నములు వర్జ్యం. తొలి గర్భము కలిగిన వనితకు 3వ మాసమందు భర్త చేయవలెను.",
        "good_vaaras": [2, 4, 5, 6],
        "avoid_vaaras": [1, 3, 7],
        "good_tithis": [],  # Any except avoid_tithis
        "avoid_tithis": [4, 9, 14, 30],
        "good_lagnas": [1, 2, 3, 4, 6, 7, 9, 10, 11, 12],
        "avoid_lagnas": [5, 8],
        "good_nakshatras": [1, 4, 5, 7, 8, 12, 13, 14, 15, 17, 19, 21, 22, 23, 24, 26, 27],
        "avoid_yogas": [1, 18, 20],
        "avoid_karanas": [8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["ashtama_shuddhi", "lagna_shuddhi", "month_3_pregnancy"]
    },
    "seemantha": {
        "id": "seemantha",
        "page_number": 10,
        "name_en": "Seemantha Muhurtham",
        "name_te": "సీమంత ముహూర్తము",
        "tagline_en": "Mother & Child Blessing / Baby Shower Ceremony",
        "tagline_te": "గర్భిణీ స్త్రీకి సీమంతం (4, 6, 8 మాసాలు) మరియు గాజులు (5, 7 మాసాలు)",
        "icon": "🪔",
        "rules_summary_en": "Mon, Wed, Thu, Fri favorable. Avoid Sun, Tue, Sat. Avoid Rikta tithis (4, 9, 14) and Amavasya (30). Avoid Leo & Scorpio Lagnas. Mandatory Lagna Shuddhi and Navama Shuddhi (9th house must be clean). 4, 6, 8 months for Seemantha; 5, 7 months for Bangles.",
        "rules_summary_te": "సోమ, బుధ, గురు, శుక్రవారములు శ్రేష్టం. 4, 9, 14, 30 తిథులు నిషిద్ధం. సింహ, వృశ్చిక లగ్నాలు వర్జ్యం. లగ్న శుద్ధి మరియు నవమ శుద్ధి (9వ ఇల్లు పాపగ్రహ రహితం) తప్పనిసరి. సీమంతమునకు 4, 6, 8 మాసములు, గాజులు పెట్టుటకు 5, 7 మాసములు శ్రేష్టము.",
        "good_vaaras": [2, 4, 5, 6],
        "avoid_vaaras": [1, 3, 7],
        "good_tithis": [],
        "avoid_tithis": [4, 9, 14, 30],
        "good_lagnas": [1, 2, 3, 4, 6, 7, 9, 10, 11, 12],
        "avoid_lagnas": [5, 8],
        "good_nakshatras": [1, 4, 5, 7, 8, 12, 13, 14, 15, 17, 19, 21, 22, 23, 24, 26, 27],
        "avoid_yogas": [1, 18, 20],
        "avoid_karanas": [8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["navama_shuddhi", "ashtama_shuddhi", "lagna_shuddhi"]
    },
    "jatakarma": {
        "id": "jatakarma",
        "page_number": 11,
        "name_en": "Jatakarma Muhurtham",
        "name_te": "జాతకర్మ ముహూర్తము",
        "tagline_en": "Newborn Birth Ceremony & Honey/Ghee Feeding",
        "tagline_te": "శిశువు పుట్టిన దినము, 10వ రోజు లేదా 11వ రోజు చేయు సంస్కారము",
        "icon": "🌟",
        "rules_summary_en": "Mon, Wed, Thu, Fri favorable. Avoid tithis 4, 9, 15 (Purnima), 19, 24, 30 (Amavasya). Muhurta Lagna must NOT be 8th house from Janma Lagna. Taras 1, 3, 5, 7 avoided. Performed on day of birth, 10th day, or 11th day during daytime.",
        "rules_summary_te": "సోమ, బుధ, గురు, శుక్రవారములు శుభం (2, 4, 5, 6). 4, 9, 15, 19, 24, 30 తిథులు నిషిద్ధం. జన్మలగ్నం నుండి ముహూర్త లగ్నం 8వ లగ్నం కారాదు. జన్మ, 3, 5, 7 తారలు నిషిద్ధం. పుట్టినరోజు నాడు కానీ 10వ రోజు కానీ 11వ రోజు కానీ చేయవలెను.",
        "good_vaaras": [2, 4, 5, 6],
        "avoid_vaaras": [1, 3, 7],
        "good_tithis": [],
        "avoid_tithis": [4, 9, 15, 19, 24, 30],
        "good_nakshatras": [1, 4, 7, 8, 12, 14, 15, 17, 21, 22, 23, 24, 26],
        "avoid_yogas": [1, 11, 18, 20],
        "avoid_karanas": [7, 8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["ashtama_lagna", "ashtama_shuddhi", "daytime_only"]
    },
    "namakarana": {
        "id": "namakarana",
        "page_number": 12,
        "name_en": "Namakarana Muhurtham",
        "name_te": "నామకరణ ముహూర్తము",
        "tagline_en": "Baby Naming Ceremony",
        "tagline_te": "శిశువుకు నామకరణం చేయుటకు ఉత్తమ ముహూర్త నిర్ణయము",
        "icon": "👶",
        "rules_summary_en": "Mon, Wed, Thu, Fri favorable. Avoid tithis 4, 9, 15, 19, 24, 30. Muhurta Lagna cannot be 8th house from Janma Lagna. Taras 1, 3, 5, 7 avoided. Primary day: 11th day from birth; alternate days: 12th, 16th, 20th, 22nd day.",
        "rules_summary_te": "సోమ, బుధ, గురు, శుక్రవారములు శుభం (2, 4, 5, 6). 4, 9, 15, 19, 24, 30 తిథులు నిషిద్ధం. జన్మలగ్నం నుండి ముహూర్త లగ్నం 8వ లగ్నం కారాదు. జన్మ, 3, 5, 7 తారలు వర్జ్యం. 11వ రోజు ముఖ్యము; లేదా 12, 16, 20, 22 వ రోజులలో చేయవలెను.",
        "good_vaaras": [2, 4, 5, 6],
        "avoid_vaaras": [1, 3, 7],
        "good_tithis": [],
        "avoid_tithis": [4, 9, 15, 19, 24, 30],
        "good_nakshatras": [1, 4, 7, 8, 12, 14, 15, 17, 21, 22, 23, 24, 26],
        "avoid_yogas": [1, 11, 18, 20],
        "avoid_karanas": [7, 8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["ashtama_lagna", "ashtama_shuddhi", "daytime_only"]
    },
    "annaprashana": {
        "id": "annaprashana",
        "page_number": 13,
        "name_en": "Annaprashana Muhurtham",
        "name_te": "అన్నప్రాశన ముహూర్తము",
        "tagline_en": "First Solid Food Feeding Ceremony",
        "tagline_te": "బాలురకు సరి మాసములు (6, 8, 10), బాలికలకు బేసి మాసములు (5, 7, 9)",
        "icon": "🥣",
        "rules_summary_en": "Mon, Wed, Thu, Fri favorable. Good Lagnas: 2 (Vrishabha), 3 (Mithuna), 4 (Karka), 6 (Kanya), 9 (Dhanu), 12 (Meena). Avoid listed tithis (1, 4, 6, 8, 9, 11, 12, 15, 16, 19, 21, 23, 24, 26, 27, 30). Dashama Shuddhi mandatory (10th house from Lagna must be vacant). Boys: 6, 8, 10 months; Girls: 5, 7, 9 months.",
        "rules_summary_te": "సోమ, బుధ, గురు, శుక్రవారములు శుభం. లగ్నములు: 2, 3, 4, 6, 9, 12 శ్రేష్టం. 1, 4, 6, 8, 9, 11, 12, 15, 16, 19, 21, 23, 24, 26, 27, 30 తిథులు నిషిద్ధం. దశమ శుద్ధి (లగ్నము నుండి 10వ ఇల్లు ఖాళీగా ఉండాలి) తప్పనిసరి. పురుషులకు 6, 8, 10 మాసములలో, స్త్రీకి 5, 7, 9 మాసములలో చేయవలెను.",
        "good_vaaras": [2, 4, 5, 6],
        "avoid_vaaras": [1, 3, 7],
        "good_lagnas": [2, 3, 4, 6, 9, 12],
        "avoid_tithis": [1, 4, 6, 8, 9, 11, 12, 15, 16, 19, 21, 23, 24, 26, 27, 30],
        "good_nakshatras": [1, 4, 5, 7, 8, 9, 12, 13, 14, 15, 17, 21, 22, 23, 24, 26, 27],
        "avoid_yogas": [1, 2, 11, 18],
        "avoid_karanas": [7, 8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["dashama_shuddhi", "ashtama_shuddhi", "gender_parity"]
    },
    "choodakarana": {
        "id": "choodakarana",
        "page_number": 14,
        "name_en": "Choodakarana / Tonsure Muhurtham",
        "name_te": "చూడాకర్మ / కేశఖండన ముహూర్తము",
        "tagline_en": "First Haircut / Tonsure Ceremony (Keshakhandana)",
        "tagline_te": "బాలురకు 2, 4, 6 మాసాలు లేదా 3, 5వ ఏట; బాలికలకు 3, 5, 7 మాసాలు",
        "icon": "✂️",
        "rules_summary_en": "Mon, Wed, Thu, Fri favorable. Shubha Lagnas (2, 3, 4, 6, 9, 12) with Ashtama Shuddhi. Avoid tithis 2, 8, 13, 30 (and Rikta 4, 9, 14). Taras 1, 3, 5, 7 avoided. Boys: 2, 4, 6 months or 3rd/5th year; Girls: 3, 5, 7 months. Uttarayana preferred.",
        "rules_summary_te": "సోమ, బుధ, గురు, శుక్రవారములు శుభం (2, 4, 5, 6). శుభలగ్నములు శ్రేష్టం. 2, 8, 13, 30 తిథులు నిషిద్ధం. జన్మ, 3, 5, 7 తారలు నిషిద్ధం. పుత్రులకు 2, 4, 6 మాసములలో లేదా 3, 5వ సంవత్సరమున; పుత్రికకు 3, 5, 7 మాసములలో చేయవలెను. ఉత్తరాయణము అనుకూలము.",
        "good_vaaras": [2, 4, 5, 6],
        "avoid_vaaras": [1, 3, 7],
        "good_lagnas": [2, 3, 4, 6, 9, 12],
        "avoid_tithis": [2, 4, 8, 9, 13, 14, 30],
        "good_nakshatras": [1, 5, 7, 8, 13, 14, 15, 22, 23, 24, 27],
        "avoid_yogas": [1, 2, 11, 18],
        "avoid_karanas": [7, 8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["ashtama_shuddhi", "gender_parity", "daytime_only"]
    },
    "karnavedha": {
        "id": "karnavedha",
        "page_number": 15,
        "name_en": "Karnavedha Muhurtham",
        "name_te": "కర్ణవేధ ముహూర్తము",
        "tagline_en": "Ear Piercing Ceremony",
        "tagline_te": "12, 16వ రోజులలో లేదా 6, 7, 8 మాసముల యందు పగటివేళ చేయు సంస్కారము",
        "icon": "👂",
        "rules_summary_en": "Mon, Wed, Thu, Fri favorable. Good Lagnas: 2, 3, 4, 6, 9, 12 with Ashtama Shuddhi. Avoid tithis 4, 9, 14, 15, 16, 23, 29, 30. Taras 1, 3, 5, 7 avoided. Performed on 12th or 16th day from birth, or in 6th, 7th, 8th month during daylight hours.",
        "rules_summary_te": "సోమ, బుధ, గురు, శుక్రవారములు శుభం (2, 4, 5, 6). 2, 3, 4, 6, 9, 12 లగ్నములు శ్రేష్టం. 4, 9, 14, 15, 16, 23, 29, 30 తిథులు నిషిద్ధం. జన్మ, 3, 5, 7 తారలు నిషిద్ధం. పుట్టిన 12, 16 రోజులలో లేదా 6, 7, 8 మాసముల యందు పగటివేళ చేయవలెను.",
        "good_vaaras": [2, 4, 5, 6],
        "avoid_vaaras": [1, 3, 7],
        "good_lagnas": [2, 3, 4, 6, 9, 12],
        "avoid_tithis": [4, 9, 14, 15, 16, 23, 29, 30],
        "good_nakshatras": [5, 6, 7, 8, 12, 13, 14, 21, 22, 23, 26, 27],
        "avoid_yogas": [1, 2, 11, 18],
        "avoid_karanas": [7, 8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["ashtama_shuddhi", "daytime_only"]
    },
    "upanayana": {
        "id": "upanayana",
        "page_number": 16,
        "name_en": "Upanayana Muhurtham",
        "name_te": "ఉపనయన ముహూర్తము",
        "tagline_en": "Sacred Thread Ceremony (Janeu / Yagnopavita)",
        "tagline_te": "ఉత్తరాయణము నందే చేయదగిన మహోన్నత వేదారంభ సంస్కారము",
        "icon": "📿",
        "rules_summary_en": "Wed, Thu, Fri best; Sun, Mon acceptable. Avoid Tue, Sat. Uttarayana strictly mandatory! Benefic signs (2, 3, 4, 6, 9, 12) with Ashtama Shuddhi. Guru (Jupiter) strength required in Kendra/Kona. Kendras must be free of malefics. 16 auspicious stars.",
        "rules_summary_te": "బుధ, గురు, శుక్రవారములు అత్యుత్తమం; భాను, సోమవారములు మధ్యమం; కుజ, శనివారములు నిషిద్ధం. ఉత్తరాయణము తప్పనిసరి! శుక్లపక్షం శ్రేష్టం. బృహస్పతి (గురుడు) కేంద్ర త్రికోణములలో బలముగా ఉండాలి. అష్టమ శుద్ధి తప్పనిసరి. కేంద్రములలో పాపగ్రహములు ఉండకూడదు. 16 ఉపనయన నక్షత్రములు.",
        "good_vaaras": [4, 5, 6],
        "moderate_vaaras": [1, 2],
        "avoid_vaaras": [3, 7],
        "good_lagnas": [2, 3, 4, 6, 9, 12],
        "good_tithis": [2, 3, 5, 7, 10, 11, 12, 13],
        "avoid_tithis": [4, 9, 14, 30],
        "good_nakshatras": [17, 27, 1, 5, 12, 21, 26, 7, 8, 22, 23, 24, 13, 14, 15, 4],
        "avoid_yogas": [1, 11, 18, 20],
        "avoid_karanas": [7, 8, 9, 10, 11],
        "avoid_taras": [1, 3, 5, 7],
        "special_checks": ["uttarayana_only", "guru_strength", "kendras_clean", "ashtama_shuddhi"]
    }
}


def parse_time_to_hours(t_str: str) -> Optional[float]:
    if not t_str: return None
    offset = 0
    if "(-1)" in t_str:
        offset = -24
    elif "(+1)" in t_str:
        offset = 24
    clean = t_str.split()[0]
    parts = clean.split(":")
    return offset + float(parts[0]) + float(parts[1])/60.0 + float(parts[2])/3600.0


def is_colliding_time(h: float, time_dict_or_list: Any, buffer_mins: float = 10.0) -> bool:
    if not time_dict_or_list: return False
    buffer_h = buffer_mins / 60.0
    if isinstance(time_dict_or_list, dict):
        s = parse_time_to_hours(time_dict_or_list.get("start"))
        e = parse_time_to_hours(time_dict_or_list.get("end"))
        if s is None or e is None: return False
        if s <= 0 and e <= 0: return False
        if s >= 24 and e >= 24: return False
        s_buf = s - buffer_h
        e_buf = e + buffer_h
        if s_buf <= e_buf:
            return s_buf <= h <= e_buf
        else:
            return h >= s_buf or h <= e_buf
    elif isinstance(time_dict_or_list, list):
        for item in time_dict_or_list:
            if is_colliding_time(h, item, buffer_mins): return True
    return False


def parse_time_str_to_h(t_str: str) -> float:
    if not t_str: return 10.0
    try:
        parts = t_str.strip().split()
        time_part = parts[0]
        ampm = parts[1].upper() if len(parts) > 1 else "AM"
        h_m = time_part.split(":")
        hh = int(h_m[0])
        mm = int(h_m[1])
        if ampm == "PM" and hh < 12:
            hh += 12
        elif ampm == "AM" and hh == 12:
            hh = 0
        return hh + mm / 60.0
    except Exception:
        return 10.0


RASI_NAMES_TE = ["మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య", "తులా", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"]

def format_hms(h):
    norm_h = h % 24.0
    hh = int(norm_h)
    mm = int(round((norm_h - hh) * 60))
    if mm >= 60:
        hh += 1
        mm = 0
        if hh >= 24: hh = 0
    ampm = "AM" if hh < 12 else "PM"
    display_h = hh if hh <= 12 else hh - 12
    if display_h == 0: display_h = 12
    return f"{display_h:02d}:{mm:02d} {ampm}"

def get_time_period_str(h):
    norm_h = h % 24.0
    hh = int(norm_h)
    if 4 <= hh < 12: return "ఉదయం", "Morning"
    elif 12 <= hh < 16: return "మధ్యాహ్నం", "Afternoon"
    elif 16 <= hh < 20: return "సాయంత్రం", "Evening"
    else: return "రాత్రి", "Night"


def compute_d1_positions(target_date: date, eval_hour: float, birth_place_obj: JHoraPlace):
    """Computes full D1 planetary chart positions at exact date and time."""
    try:
        jd = swe.julday(target_date.year, target_date.month, target_date.day, eval_hour)
        raw_d1 = charts.divisional_chart(jd, birth_place_obj, divisional_chart_factor=1)
        retro_ids = charts.planets_in_retrograde(raw_d1)
        combust_ids = charts.planets_in_combustion(raw_d1)

        positions = []
        swe.set_sid_mode(swe.SIDM_LAHIRI)
        flags_speed = swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED

        for item in raw_d1:
            p_id = item[0]
            rasi_idx = item[1][0]
            deg = item[1][1]
            tot_long = rasi_idx * 30.0 + deg

            nak_no, pada, _ = drik.nakshatra_pada(tot_long)
            raw_nak = utils.NAKSHATRA_LIST[nak_no - 1]
            canon_nak = CANONICAL_NAKSHATRA.get(raw_nak, raw_nak)

            is_retro = False
            is_combust = False

            p_str = str(p_id)
            if p_str in ["7", "8"]:
                is_retro = True
            elif p_str not in ["0", "1", "L", "Mnd", "Gk"]:
                try:
                    p_int = int(p_str)
                    swe_map = {2: swe.MARS, 3: swe.MERCURY, 4: swe.JUPITER, 5: swe.VENUS, 6: swe.SATURN}
                    if p_int in swe_map:
                        res = swe.calc_ut(jd, swe_map[p_int], flags_speed)[0]
                        speed = res[3]
                        is_retro = speed < 0
                    is_combust = p_int in combust_ids
                except (ValueError, TypeError):
                    pass

            positions.append({
                "planet": str(p_id),
                "rasi_index": int(rasi_idx),
                "is_retro": is_retro,
                "is_combust": is_combust,
                "nakshatra": canon_nak,
                "pada": int(pada)
            })

        return positions, raw_d1
    except Exception as ex:
        print(f"D1 computation error: {ex}")
        return [], []


def compute_pushkara_window(
    cand_date: date,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str,
    p: dict,
    birth_lagna_idx: Optional[int] = None,
    birth_place_obj: Optional[JHoraPlace] = None,
    return_all: bool = False,
    daytime_only: bool = False
):
    """Finds Pushkara Bhaga & Pushkara Navamsha auspicious windows, filtering out inauspicious periods."""
    sr_h = parse_time_to_hours(p.get("sunrise")) or 6.0
    ss_h = parse_time_to_hours(p.get("sunset")) or 18.0

    rahu = p.get("rahu_kalam")
    yama = p.get("yamagandam")
    gulika = p.get("gulika_kalam")
    dur_list = p.get("durmuhurtam")
    varjyam = p.get("varjyam")

    swe.set_sid_mode(swe.SIDM_LAHIRI)
    jd_ut_mid = swe.julday(cand_date.year, cand_date.month, cand_date.day, 0.0)
    RASI_NAMES_TE = ["మేషం", "వృషభం", "మిథునం", "కర్కాటకం", "సింహం", "కన్య", "తులా", "వృశ్చికం", "ధనుస్సు", "మకరం", "కుంభం", "మీనం"]

    # 1. Map all 12 Lagnas
    lagnas = []
    curr_h = sr_h
    last_rasi = None
    lagna_start = sr_h

    scan_end_h = ss_h if daytime_only else (sr_h + 24.0 + (1.0 / 60.0))

    while curr_h <= scan_end_h:
        ut_hour = curr_h - tz_offset
        jd_t = jd_ut_mid + ut_hour / 24.0
        cusps, ascmc = swe.houses_ex(jd_t, lat, lon, b'P', swe.FLG_SIDEREAL)
        l_lon = ascmc[0] % 360.0
        r_idx = int(l_lon // 30)

        if last_rasi is not None and r_idx != last_rasi:
            lagnas.append({
                "rasi_index": last_rasi,
                "rasi_en": RASI_NAMES[last_rasi + 1],
                "rasi_te": RASI_NAMES_TE[last_rasi],
                "start_h": lagna_start,
                "end_h": curr_h
            })
            lagna_start = curr_h
        last_rasi = r_idx
        curr_h += (1.0 / 60.0)

    if not lagnas and last_rasi is not None:
        lagnas.append({
            "rasi_index": last_rasi,
            "rasi_en": RASI_NAMES[last_rasi + 1],
            "rasi_te": RASI_NAMES_TE[last_rasi],
            "start_h": lagna_start,
            "end_h": curr_h
        })

    candidate_lagnas = []
    for lg in lagnas:
        has_major_inauspicious_overlap = False
        check_step = lg["start_h"]
        while check_step <= lg["end_h"]:
            if (
                is_colliding_time(check_step, dur_list, buffer_mins=0.0) or
                is_colliding_time(check_step, rahu, buffer_mins=0.0) or
                is_colliding_time(check_step, yama, buffer_mins=0.0) or
                is_colliding_time(check_step, gulika, buffer_mins=0.0)
            ):
                has_major_inauspicious_overlap = True
                break
            check_step += (2.0 / 60.0)

        if has_major_inauspicious_overlap:
            continue

        clean_minutes = []
        pushkara_bhaga_mins = []
        pushkara_nav_mins = []
        step_h = lg["start_h"]
        step_end = lg["end_h"]

        while step_h <= step_end:
            coll = is_colliding_time(step_h, varjyam, buffer_mins=5.0)
            if not coll:
                clean_minutes.append(step_h)
                ut_hour = step_h - tz_offset
                jd_t = jd_ut_mid + ut_hour / 24.0
                cusps, ascmc = swe.houses_ex(jd_t, lat, lon, b'P', swe.FLG_SIDEREAL)
                l_lon = ascmc[0] % 360.0
                deg_in_rasi = l_lon % 30.0

                target_deg = PUSHKARA_BHAGA_DEGS.get(lg["rasi_index"], 15.0)
                if abs(deg_in_rasi - target_deg) <= 1.5:
                    pushkara_bhaga_mins.append(step_h)

                ranges = PUSHKARA_RANGES.get(lg["rasi_index"], [])
                for r_s, r_e in ranges:
                    if r_s <= deg_in_rasi <= r_e:
                        pushkara_nav_mins.append(step_h)
                        break
            step_h += (1.0 / 60.0)

        if len(clean_minutes) >= 15:
            candidate_lagnas.append({
                "lagna": lg,
                "clean_mins": clean_minutes,
                "bhaga_mins": pushkara_bhaga_mins,
                "nav_mins": pushkara_nav_mins
            })

    def format_hms(h):
        norm_h = h % 24.0
        hh = int(norm_h)
        mm = int(round((norm_h - hh) * 60))
        if mm >= 60:
            hh += 1
            mm = 0
            if hh >= 24: hh = 0
        ampm = "AM" if hh < 12 else "PM"
        display_h = hh if hh <= 12 else hh - 12
        if display_h == 0: display_h = 12
        return f"{display_h:02d}:{mm:02d} {ampm}"

    def get_time_period_str(h):
        norm_h = h % 24.0
        hh = int(norm_h)
        if 4 <= hh < 12: return "ఉదయం", "Morning"
        elif 12 <= hh < 16: return "మధ్యాహ్నం", "Afternoon"
        elif 16 <= hh < 20: return "సాయంత్రం", "Evening"
        else: return "రాత్రి", "Night"

    def get_colliding_names(check_h, buffer_m=5.0):
        names_te = []
        names_en = []
        if is_colliding_time(check_h, rahu, buffer_mins=buffer_m):
            names_te.append("రాహు కాలం")
            names_en.append("Rahu Kalam")
        if is_colliding_time(check_h, yama, buffer_mins=buffer_m):
            names_te.append("యమగండం")
            names_en.append("Yamagandam")
        if is_colliding_time(check_h, gulika, buffer_mins=buffer_m):
            names_te.append("గుళిక కాలం")
            names_en.append("Gulika Kalam")
        if is_colliding_time(check_h, dur_list, buffer_mins=buffer_m):
            names_te.append("దుర్ముహూర్తం")
            names_en.append("Durmuhurtam")
        if is_colliding_time(check_h, varjyam, buffer_mins=buffer_m):
            names_te.append("వర్జ్యం")
            names_en.append("Varjyam")
        return names_te, names_en

    if not candidate_lagnas:
        return [] if return_all else None

    processed_windows = []
    for cand_item in candidate_lagnas:
        lg = cand_item["lagna"]
        cand_lagna_idx = lg["rasi_index"] + 1

        if birth_lagna_idx and ((cand_lagna_idx - birth_lagna_idx) % 12 == 7):
            continue

        clean_mins = cand_item["clean_mins"]
        bhaga_mins = cand_item["bhaga_mins"]
        nav_mins = cand_item["nav_mins"]

        match_kind = "clean"
        best_h = clean_mins[len(clean_mins)//2]
        if bhaga_mins:
            match_kind = "bhaga"
            best_h = bhaga_mins[len(bhaga_mins)//2]
        elif nav_mins:
            match_kind = "navamsha"
            best_h = nav_mins[len(nav_mins)//2]

        win_start = max(lg["start_h"], best_h - 15.0/60.0)
        win_end = min(lg["end_h"], best_h + 15.0/60.0)

        # Ensure window does not cross into inauspicious time
        safe_start = win_start
        while safe_start < best_h:
            coll_te, _ = get_colliding_names(safe_start, buffer_m=5.0)
            if not coll_te:
                break
            safe_start += (1.0 / 60.0)

        safe_end = win_end
        while safe_end > best_h:
            coll_te, _ = get_colliding_names(safe_end, buffer_m=5.0)
            if not coll_te:
                break
            safe_end -= (1.0 / 60.0)

        is_squeezed = (safe_start > win_start or safe_end < win_end)
        win_start = safe_start
        win_end = safe_end

        if win_end - win_start < (5.0 / 60.0):
            win_start = best_h - 2.5/60.0
            win_end = best_h + 2.5/60.0

        p_te, p_en = get_time_period_str(best_h)
        avoid_te = "రాహు, యమగండ, గుళిక, దుర్ముహూర్తము మరియు వర్జ్యములకు దూరంగా ఉంది."
        avoid_en = "Filtered away from Rahu Kalam, Yamagandam, Gulika, Durmuhurtam, and Varjyam."

        if match_kind == "bhaga":
            t_te = "పుష్కర భాగ ముహూర్తం"
            t_en = "Pushkara Bhaga Muhurtha"
            stmt_te = f"ఈ లగ్నములో అత్యంత పవిత్రమైన పుష్కర భాగ డిగ్రీలు కలవు ({p_te} {format_hms(best_h)})."
            stmt_en = f"This Lagna features highly auspicious Pushkara Bhaga degrees at {format_hms(best_h)} ({p_en})."
        elif match_kind == "navamsha":
            t_te = "పుష్కర నవాంశ ముహూర్తం"
            t_en = "Pushkara Navamsha Muhurtha"
            stmt_te = f"ఈ లగ్నములో శుభప్రదమైన పుష్కర నవాంశ వ్యవధి కలదు ({p_te} {format_hms(best_h)})."
            stmt_en = f"This Lagna features auspicious Pushkara Navamsha degrees at {format_hms(best_h)} ({p_en})."
        else:
            t_te = "శుద్ధ ముహూర్త లగ్నం"
            t_en = "Pure Auspicious Lagna Window"
            stmt_te = f"ఈ లగ్నము దోష రహితముగా, అనుకూల సమయములో కలదు ({p_te} {format_hms(best_h)})."
            stmt_en = f"This Lagna is clear of all dosha periods ({p_en} {format_hms(best_h)})."

        processed_windows.append({
            "type_te": t_te,
            "type_en": t_en,
            "statement_te": stmt_te,
            "statement_en": stmt_en,
            "avoid_note_te": avoid_te,
            "avoid_note_en": avoid_en,
            "time_window": f"{format_hms(win_start)} – {format_hms(win_end)}",
            "precise_time": format_hms(best_h),
            "time_period_te": p_te,
            "time_period_en": p_en,
            "lagna_name": lg["rasi_te"],
            "lagna_name_en": lg["rasi_en"],
            "lagna_full_window": f"{format_hms(lg['start_h'])} – {format_hms(lg['end_h'])}",
            "is_morning": (best_h < 12.0),
            "match_kind": match_kind,
            "is_squeezed": is_squeezed,
            "pushkara_bhaga": {
                "is_available": (match_kind == "bhaga"),
                "precise_time": format_hms(best_h),
                "time_window": f"{format_hms(win_start)} – {format_hms(win_end)}"
            },
            "pushkara_navamsha": {
                "is_available": (match_kind in ["bhaga", "navamsha"]),
                "precise_time": format_hms(best_h),
                "time_window": f"{format_hms(win_start)} – {format_hms(win_end)}"
            }
        })

    if not processed_windows:
        return [] if return_all else None

    processed_windows.sort(key=lambda x: (
        0 if x["is_morning"] else (1 if parse_time_str_to_h(x["precise_time"]) < 17.0 else 2),
        0 if not x["is_squeezed"] else 1,
        0 if x["match_kind"] == "bhaga" else (1 if x["match_kind"] == "navamsha" else 2)
    ))

    if return_all:
        return processed_windows

    primary = processed_windows[0]
    primary["additional_windows"] = processed_windows[1:] if len(processed_windows) > 1 else []
    return primary


def generate_candidate_dates(samskara_id: str, base_date: date, **kwargs) -> List[Dict[str, Any]]:
    """
    Generates classical candidate dates based on the shastra rules for the specific Samskara.
    """
    sid = samskara_id.lower()
    dates_info = []

    if sid == "jatakarma":
        # Day of birth (Day 1), Day 10, Day 11
        offsets = [(1, 0), (10, 9), (11, 10)]
        for day_num, offset in offsets:
            c_date = base_date + timedelta(days=offset)
            dates_info.append({"date": c_date, "day_label": f"Day {day_num} from Birth", "day_label_te": f"జన్మదినం నుండి {day_num}వ రోజు", "day_number": day_num})

    elif sid == "namakarana":
        # 11th, 12th, 16th, 20th, 22nd day
        offsets = [(11, 10), (12, 11), (16, 15), (20, 19), (22, 21)]
        for day_num, offset in offsets:
            c_date = base_date + timedelta(days=offset)
            dates_info.append({"date": c_date, "day_label": f"Day {day_num} from Birth", "day_label_te": f"జన్మదినం నుండి {day_num}వ రోజు", "day_number": day_num})

    elif sid == "karnavedha":
        # Options: early (12th, 16th day) or later (6th, 7th, 8th month)
        timing_mode = kwargs.get("timing_mode", "early")
        if timing_mode == "early":
            offsets = [(12, 11), (16, 15)]
            for day_num, offset in offsets:
                c_date = base_date + timedelta(days=offset)
                dates_info.append({"date": c_date, "day_label": f"Day {day_num} from Birth", "day_label_te": f"జన్మదినం నుండి {day_num}వ రోజు", "day_number": day_num})
        else:
            # Months 6, 7, 8: sample 2 auspicious candidate dates per month
            for m in [6, 7, 8]:
                start_d = base_date + timedelta(days=int(m * 30.4375) - 15)
                for day_off in range(0, 30, 5):
                    c_date = start_d + timedelta(days=day_off)
                    dates_info.append({"date": c_date, "day_label": f"Month {m} (Approx {c_date.strftime('%b %d')})", "day_label_te": f"{m}వ మాసము ({c_date.strftime('%d-%m-%Y')})", "day_number": m})

    elif sid == "pumsavana":
        # 3rd month of pregnancy (approx days 61 to 90 from conception/LMP)
        start_d = base_date + timedelta(days=61)
        for day_off in range(0, 30, 3):
            c_date = start_d + timedelta(days=day_off)
            dates_info.append({"date": c_date, "day_label": f"3rd Month ({c_date.strftime('%b %d')})", "day_label_te": f"3వ గర్భ మాసము ({c_date.strftime('%d-%m-%Y')})", "day_number": 3})

    elif sid == "seemantha":
        # Seemantha: 4th, 6th, 8th month; Bangle: 5th, 7th month
        ceremony_type = kwargs.get("ceremony_type", "seemantha")
        months = [4, 6, 8] if ceremony_type == "seemantha" else [5, 7]
        for m in months:
            start_d = base_date + timedelta(days=int(m * 30.4375) - 15)
            for day_off in range(0, 28, 6):
                c_date = start_d + timedelta(days=day_off)
                dates_info.append({"date": c_date, "day_label": f"{m}th Month ({c_date.strftime('%b %d')})", "day_label_te": f"{m}వ మాసము ({c_date.strftime('%d-%m-%Y')})", "day_number": m})

    elif sid == "annaprashana":
        # Boys: even months (6, 8, 10); Girls: odd months (5, 7, 9)
        gender = kwargs.get("child_gender", "male").lower()
        months = [6, 8, 10] if gender == "male" else [5, 7, 9]
        for m in months:
            start_d = base_date + timedelta(days=int(m * 30.4375) - 10)
            for day_off in range(0, 25, 5):
                c_date = start_d + timedelta(days=day_off)
                dates_info.append({"date": c_date, "day_label": f"Month {m} ({gender.capitalize()})", "day_label_te": f"{m}వ మాసము ({'బాలుడు' if gender == 'male' else 'బాలిక'})", "day_number": m})

    elif sid == "choodakarana":
        # Boys: 2, 4, 6 months or 3rd/5th year; Girls: 3, 5, 7 months
        gender = kwargs.get("child_gender", "male").lower()
        age_mode = kwargs.get("age_mode", "months")
        if age_mode == "years":
            target_year = 3 if gender == "male" else 3
            start_d = date(base_date.year + target_year, 1, 15)  # Start of Uttarayana
            for day_off in range(0, 90, 8):
                c_date = start_d + timedelta(days=day_off)
                dates_info.append({"date": c_date, "day_label": f"Year {target_year} (Uttarayana)", "day_label_te": f"{target_year}వ సంవత్సరము (ఉత్తరాయణం)", "day_number": target_year})
        else:
            months = [2, 4, 6] if gender == "male" else [3, 5, 7]
            for m in months:
                start_d = base_date + timedelta(days=int(m * 30.4375) - 10)
                for day_off in range(0, 25, 5):
                    c_date = start_d + timedelta(days=day_off)
                    dates_info.append({"date": c_date, "day_label": f"Month {m} ({gender.capitalize()})", "day_label_te": f"{m}వ మాసము ({'బాలుడు' if gender == 'male' else 'బాలిక'})", "day_number": m})

    elif sid == "garbhadhana":
        # Scanning 14 to 30 days from fertile period start / target date
        for day_off in range(0, 28, 2):
            c_date = base_date + timedelta(days=day_off)
            dates_info.append({"date": c_date, "day_label": f"Date {c_date.strftime('%b %d')}", "day_label_te": f"తేదీ {c_date.strftime('%d-%m-%Y')}", "day_number": day_off + 1})

    elif sid == "upanayana":
        # Uttarayana only (approx Jan 15 to Jul 15) in target year (default: 8th year for Brahmin)
        varna = kwargs.get("varna", "brahmin").lower()
        varna_years = {"brahmin": 8, "kshatriya": 11, "vaishya": 12}
        target_years = varna_years.get(varna, 8)
        target_year_val = base_date.year + target_years

        # Scan Uttarayana months: Feb, Mar, Apr, May
        for month_idx in [2, 3, 4, 5]:
            month_start = date(target_year_val, month_idx, 5)
            for day_off in [0, 5, 10, 15, 20]:
                c_date = month_start + timedelta(days=day_off)
                dates_info.append({"date": c_date, "day_label": f"Year {target_years} · {c_date.strftime('%B %d')}", "day_label_te": f"{target_years}వ సంవత్సరం · {c_date.strftime('%d-%m-%Y')}", "day_number": target_years})

    return dates_info


def find_samskara_muhurtas(
    samskara_id: str,
    base_date: date,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str,
    birth_time_str: str = "12:00",
    calculator_fn = compute_drik_panchang,
    **kwargs
) -> Dict[str, Any]:
    """
    Master evaluator for any of the 9 Classical Samskaras from pages 8 to 16.
    """
    sid = samskara_id.lower()
    if sid not in SAMSKARA_REGISTRY:
        raise ValueError(f"Unknown Samskara ID '{samskara_id}'. Available: {list(SAMSKARA_REGISTRY.keys())}")

    rule = SAMSKARA_REGISTRY[sid]

    # Birth / Reference time calculations
    try:
        h, m = (int(x) for x in birth_time_str.split(":"))
    except ValueError:
        h, m = 12, 0
    local_hour = h + m / 60.0

    birth_place_obj = JHoraPlace(place_name, lat, lon, tz_offset)

    birth_panchang = calculator_fn(base_date.year, base_date.month, base_date.day,
                                  lat, lon, tz_offset, place_name, hour=local_hour)
    birth_nak_idx = birth_panchang["nakshatra"]["index"]
    birth_nak_name = birth_panchang["nakshatra"]["name"]
    birth_nak_pada = birth_panchang["nakshatra"]["pada"]

    d1_positions, raw_d1 = compute_d1_positions(base_date, local_hour, birth_place_obj)

    birth_lagna_idx_0 = raw_d1[0][1][0] if raw_d1 else 0
    birth_lagna_idx = birth_lagna_idx_0 + 1
    birth_lagna_name = RASI_NAMES[birth_lagna_idx]

    birth_moon_rasi_idx = None
    for item in raw_d1:
        if str(item[0]) in ['1', 'Mo', 'Moon']:
            birth_moon_rasi_idx = item[1][0] + 1
            break
    birth_moon_rasi_name = RASI_NAMES[birth_moon_rasi_idx] if birth_moon_rasi_idx else None

    # Groom / Husband details for Garbhadhana
    husband_moon_rasi_idx = kwargs.get("husband_moon_rasi_idx")
    husband_nak_idx = kwargs.get("husband_nak_idx")
    bride_ritu_lagna_idx = kwargs.get("bride_ritu_lagna_idx")

    # Generate Candidate Dates
    candidate_dates = generate_candidate_dates(sid, base_date, **kwargs)
    all_evaluated_candidates = []

    daytime_only = "daytime_only" in rule.get("special_checks", [])

    for cand_meta in candidate_dates:
        cand_date = cand_meta["date"]
        p_base = calculator_fn(cand_date.year, cand_date.month, cand_date.day,
                               lat, lon, tz_offset, place_name, hour=10)

        # 1. Compute Pushkara / Auspicious Windows for this date
        windows = compute_pushkara_window(
            cand_date, lat, lon, tz_offset, place_name, p_base,
            birth_lagna_idx=birth_lagna_idx,
            birth_place_obj=birth_place_obj,
            return_all=True,
            daytime_only=daytime_only
        )

        day_results = []
        best_fallback_for_day = None

        if not windows:
            schedule = p_base.get("lagna_schedule") or []
            day_lagnas = [lg for lg in schedule if 6.0 <= lg.get("start_h", 0) <= 18.0]
            if day_lagnas:
                def_lg = day_lagnas[len(day_lagnas) // 2]
                def_h = (def_lg["start_h"] + def_lg["end_h"]) / 2.0
                def_lg_te = def_lg.get("rasi_te", "")
                def_lg_en = def_lg.get("rasi_en", "")
                def_win = f"{format_hms(def_lg['start_h'])} – {format_hms(def_lg['end_h'])}"
            else:
                def_h = 10.0
                lg_idx = p_base.get("lagna_rasi_index", 1)
                def_lg_te = RASI_NAMES_TE[lg_idx - 1] if 1 <= lg_idx <= 12 else ""
                def_lg_en = RASI_NAMES[lg_idx] if 1 <= lg_idx <= 12 else ""
                def_win = "10:00 AM – 12:00 PM"

            p_te, p_en = get_time_period_str(def_h)
            windows = [{
                "type_te": "ముహూర్త లగ్నం",
                "type_en": "Muhurta Lagna Window",
                "statement_te": f"ఈ లగ్న కాలం: {p_te} {format_hms(def_h)}.",
                "statement_en": f"Lagna window at {format_hms(def_h)} ({p_en}).",
                "avoid_note_te": "",
                "avoid_note_en": "",
                "time_window": def_win,
                "precise_time": format_hms(def_h),
                "time_period_te": p_te,
                "time_period_en": p_en,
                "lagna_name": def_lg_te,
                "lagna_name_en": def_lg_en,
                "lagna_full_window": def_win,
                "is_morning": (def_h < 12.0),
                "match_kind": "clean",
                "is_squeezed": False,
                "pushkara_bhaga": {"is_available": False},
                "pushkara_navamsha": {"is_available": False}
            }]

        if windows:
            for win in windows:
                muhurta_h = parse_time_str_to_h(win.get("precise_time", "10:00 AM"))
                hh = int(muhurta_h)
                mm = int(round((muhurta_h - hh) * 60))
                if mm >= 60:
                    hh += 1
                    mm = 0

                try:
                    p_win = calculator_fn(
                        cand_date.year, cand_date.month, cand_date.day,
                        lat, lon, tz_offset, place_name, hour=hh, minute=mm, second=0
                    )
                except Exception:
                    p_win = p_base

                cand_d1_positions, cand_raw_d1 = compute_d1_positions(cand_date, muhurta_h, birth_place_obj)

                cand_lagna_idx = None
                for item in cand_raw_d1:
                    if item[0] == 'L':
                        cand_lagna_idx = item[1][0] + 1
                        break
                if not cand_lagna_idx:
                    cand_lagna_idx = p_win["lagna_rasi_index"]
                cand_lagna_name = RASI_NAMES[cand_lagna_idx]

                # --- Evaluation against Sastra Rules ---

                # 1. Vaara Check
                vaara_idx = VAARA_NAMES.index(p_win["vaara"]) + 1 if p_win["vaara"] in VAARA_NAMES else 1
                is_vaara_good = vaara_idx in rule.get("good_vaaras", [])
                is_vaara_avoid = vaara_idx in rule.get("avoid_vaaras", [])

                # 2. Tithi Check
                tithi_30 = p_win["tithi"].get("index_raw") or p_win["tithi"].get("number", 1)
                tithi_num_15 = p_win["tithi"].get("number", 1)
                is_tithi_avoid = (tithi_30 in rule.get("avoid_tithis", [])) or (tithi_num_15 in rule.get("avoid_tithis", []))
                is_tithi_good = (tithi_30 in rule.get("good_tithis", [])) if rule.get("good_tithis") else (not is_tithi_avoid)

                # 3. Nakshatra Check
                nak_idx = p_win["nakshatra"]["index"]
                is_nak_good = nak_idx in rule.get("good_nakshatras", [])

                # 4. Lagna Check
                is_lagna_good = (cand_lagna_idx in rule.get("good_lagnas", [])) if rule.get("good_lagnas") else True
                is_lagna_avoid = (cand_lagna_idx in rule.get("avoid_lagnas", [])) if rule.get("avoid_lagnas") else False

                # 5. Tarabalam Check
                count_inc = utils.count_stars(birth_nak_idx, nak_idx)
                tb_rem = count_inc % 9
                tara_idx = 9 if tb_rem == 0 else tb_rem
                tara_name = TARA_NAMES[tara_idx]
                is_tara_avoid = tara_idx in rule.get("avoid_taras", [1, 3, 5, 7])

                # 6. Chandrabalam & Chandrashtama Check
                cand_moon_rasi_idx = None
                for item in cand_raw_d1:
                    if str(item[0]) in ['1', 'Mo', 'Moon']:
                        cand_moon_rasi_idx = item[1][0] + 1
                        break

                chandrabalam_info = {"is_pass": True, "house": 1, "desc_en": "Moon favorably placed.", "desc_te": "చంద్రబలం అనుకూలంగా ఉన్నది."}
                is_chandrashtama = False
                if birth_moon_rasi_idx and cand_moon_rasi_idx:
                    ch_house = (cand_moon_rasi_idx - birth_moon_rasi_idx) % 12 + 1
                    if ch_house == 8:
                        is_chandrashtama = True
                        chandrabalam_info = {"is_pass": False, "house": 8, "desc_en": "Chandrashtama (8th house Moon)! Strictly avoid.", "desc_te": "చంద్రాష్టమము (8వ ఇంట చంద్రుడు)! అత్యంత వర్జ్యం."}
                    elif ch_house in [1, 3, 6, 7, 10, 11]:
                        chandrabalam_info = {"is_pass": True, "house": ch_house, "desc_en": f"Strong Chandrabalam ({ch_house}th house).", "desc_te": f"పూర్ణ చంద్రబలం ({ch_house}వ ఇల్లు)."}
                    elif ch_house in [2, 5, 9]:
                        chandrabalam_info = {"is_pass": True, "house": ch_house, "desc_en": f"Moderate Chandrabalam ({ch_house}th house).", "desc_te": f"మధ్యమ చంద్రబలం ({ch_house}వ ఇల్లు)."}
                    else:
                        chandrabalam_info = {"is_pass": False, "house": ch_house, "desc_en": f"Weak Chandrabalam ({ch_house}th house).", "desc_te": f"దుర్బల చంద్రబలం ({ch_house}వ ఇల్లు)."}

                # Check groom Chandrashtama for Garbhadhana
                if sid == "garbhadhana" and husband_moon_rasi_idx and cand_moon_rasi_idx:
                    h_house = (cand_moon_rasi_idx - husband_moon_rasi_idx) % 12 + 1
                    if h_house == 8:
                        is_chandrashtama = True
                        chandrabalam_info = {"is_pass": False, "house": 8, "desc_en": "Husband Chandrashtama! Strictly avoid for Garbhadhana.", "desc_te": "భర్తకు చంద్రాష్టమము! గర్భాదానమునకు నిషిద్ధం."}

                # 7. Ashtama Lagna Check
                is_ashtama_lagna = False
                if "ashtama_lagna" in rule.get("special_checks", []):
                    is_ashtama_lagna = ((cand_lagna_idx - birth_lagna_idx) % 12 == 7)

                # 8. Ashtama Shuddhi Check (8th house vacant)
                ashtama_rasi_idx = (cand_lagna_idx - 1 + 7) % 12 + 1
                ashtama_rasi_name = RASI_NAMES[ashtama_rasi_idx]
                planets_in_8th = []
                for item in cand_raw_d1:
                    p_id = item[0]
                    if p_id == 'L': continue
                    p_rasi = item[1][0] + 1
                    if p_rasi == ashtama_rasi_idx:
                        planets_in_8th.append(PLANET_NAMES_MAP.get(str(p_id), str(p_id)))
                has_ashtama_shuddhi = len(planets_in_8th) == 0

                # 9. Lagna Shuddhi Check (Lagna vacant of malefics)
                planets_in_lagna = []
                malefics_in_lagna = []
                for item in cand_raw_d1:
                    p_id = item[0]
                    if p_id == 'L': continue
                    p_rasi = item[1][0] + 1
                    if p_rasi == cand_lagna_idx:
                        p_name = PLANET_NAMES_MAP.get(str(p_id), str(p_id))
                        planets_in_lagna.append(p_name)
                        if str(p_id) in MALEFIC_IDS:
                            malefics_in_lagna.append(p_name)
                has_lagna_shuddhi = len(malefics_in_lagna) == 0

                # 10. Navama Shuddhi Check (Page 10: Seemantha)
                has_navama_shuddhi = True
                planets_in_9th = []
                if "navama_shuddhi" in rule.get("special_checks", []):
                    navama_rasi_idx = (cand_lagna_idx - 1 + 8) % 12 + 1
                    for item in cand_raw_d1:
                        p_id = item[0]
                        if p_id == 'L': continue
                        if (item[1][0] + 1) == navama_rasi_idx:
                            p_name = PLANET_NAMES_MAP.get(str(p_id), str(p_id))
                            planets_in_9th.append(p_name)
                    has_navama_shuddhi = len(planets_in_9th) == 0

                # 11. Dashama Shuddhi Check (Page 13: Annaprashana)
                has_dashama_shuddhi = True
                planets_in_10th = []
                if "dashama_shuddhi" in rule.get("special_checks", []):
                    dashama_rasi_idx = (cand_lagna_idx - 1 + 9) % 12 + 1
                    for item in cand_raw_d1:
                        p_id = item[0]
                        if p_id == 'L': continue
                        if (item[1][0] + 1) == dashama_rasi_idx:
                            planets_in_10th.append(PLANET_NAMES_MAP.get(str(p_id), str(p_id)))
                    has_dashama_shuddhi = len(planets_in_10th) == 0

                # 12. Guru Strength & Kendras Check (Page 16: Upanayana)
                is_guru_strong = True
                guru_pos_desc = "Jupiter well placed."
                if "guru_strength" in rule.get("special_checks", []):
                    guru_rasi = None
                    for item in cand_raw_d1:
                        if str(item[0]) in ['4', 'Ju', 'Jupiter']:
                            guru_rasi = item[1][0] + 1
                            break
                    if guru_rasi:
                        house_from_lagna = (guru_rasi - cand_lagna_idx) % 12 + 1
                        # Kendra (1, 4, 7, 10) or Kona (5, 9)
                        if house_from_lagna not in [1, 4, 5, 7, 9, 10] or guru_rasi == 10:  # Makara = debilitation
                            is_guru_strong = False
                            guru_pos_desc = f"Jupiter weak ({house_from_lagna}th house / Makara)."

                # 13. Ritu Lagna 6/8 check (Page 8: Garbhadhana)
                is_ritu_lagna_dosha = False
                if bride_ritu_lagna_idx and "ritu_lagna_6_8" in rule.get("special_checks", []):
                    r_diff = (cand_lagna_idx - bride_ritu_lagna_idx) % 12 + 1
                    if r_diff in [6, 8]:
                        is_ritu_lagna_dosha = True

                # 14. 7th Star Prohibited Check (Page 8: Garbhadhana)
                is_7th_star_dosha = False
                if "star_7_prohibited" in rule.get("special_checks", []):
                    if count_inc == 7 or (count_inc % 9 == 7):
                        is_7th_star_dosha = True

                # 15. Yoga & Karana Checks
                yoga_num = p_win["yoga"].get("index", 1)
                is_yoga_avoid = yoga_num in rule.get("avoid_yogas", [])
                karana_num = p_win["karana"].get("index", 1)
                is_karana_avoid = karana_num in rule.get("avoid_karanas", [])

                # 16. Uttarayana Check (Page 16: Upanayana)
                is_uttarayana = True
                if "uttarayana_only" in rule.get("special_checks", []):
                    # Sun in Makara (10), Kumbha (11), Meena (12), Mesha (1), Vrishabha (2), Mithuna (3)
                    sun_rasi = p_win.get("sun_rasi_index", 1)
                    is_uttarayana = sun_rasi in [10, 11, 12, 1, 2, 3]

                # 17. Panchaka Rahitam
                tithi_num_for_panchaka = p_win["tithi"].get("number", 1)
                panchaka_info = compute_panchaka_rahitam(tithi_num_for_panchaka, vaara_idx - 1, nak_idx, cand_lagna_idx)

                # Strict Invalidation Check
                has_strict_dosha = (
                    is_tithi_avoid or is_vaara_avoid or is_tara_avoid or is_chandrashtama or
                    is_ashtama_lagna or is_lagna_avoid or not has_ashtama_shuddhi or
                    not has_navama_shuddhi or not has_dashama_shuddhi or is_ritu_lagna_dosha or
                    is_7th_star_dosha or not is_uttarayana
                )

                # Scoring calculation
                base_score = 0
                if is_vaara_good: base_score += 20
                if is_nak_good: base_score += 20
                if is_tithi_good: base_score += 20
                if not is_tara_avoid: base_score += 20
                if chandrabalam_info["is_pass"]: base_score += 20

                deductions = 0
                if is_yoga_avoid: deductions += 30
                if is_karana_avoid: deductions += 30
                if not has_lagna_shuddhi: deductions += 15
                if not panchaka_info["is_pass"]: deductions += 10
                if not is_guru_strong: deductions += 20

                # Additional deductions for strict dosha items
                if has_strict_dosha:
                    if is_tithi_avoid: deductions += 15
                    if is_vaara_avoid: deductions += 15
                    if is_tara_avoid: deductions += 10
                    if is_chandrashtama: deductions += 20
                    if is_ashtama_lagna: deductions += 15
                    if is_lagna_avoid: deductions += 10
                    if not has_ashtama_shuddhi: deductions += 15
                    if not has_navama_shuddhi: deductions += 10
                    if not has_dashama_shuddhi: deductions += 10
                    if is_ritu_lagna_dosha: deductions += 15
                    if is_7th_star_dosha: deductions += 15
                    if not is_uttarayana: deductions += 20

                total_pct = max(5, min(100, base_score - deductions))
                if has_strict_dosha:
                    verdict = "unfavorable"
                else:
                    verdict = "highly_favorable" if total_pct >= 75 else ("favorable" if total_pct >= 50 else "unfavorable")

                # Reasons list — show both positives and doshas
                reasons = []
                if is_vaara_good: reasons.append(f"{p_win['vaara']} is favorable.")
                elif is_vaara_avoid: reasons.append(f"Vaara Dosha: Inauspicious weekday ({p_win['vaara']}).")
                if is_nak_good: reasons.append(f"Nakshatra {p_win['nakshatra']['name']} is favorable.")
                if is_tithi_good: reasons.append(f"Tithi {p_win['tithi']['name']} is favorable.")
                elif is_tithi_avoid: reasons.append(f"Tithi Dosha: Inauspicious Tithi ({p_win['tithi']['name']}).")
                if not is_tara_avoid:
                    reasons.append(f"Tarabalam is {tara_name} (favorable).")
                else:
                    reasons.append(f"Tara Dosha: Inauspicious Tara ({tara_name}).")
                reasons.append(f"Chandrabalam: {chandrabalam_info['desc_en']}")
                if is_ashtama_lagna:
                    reasons.append(f"Ashtama Lagna Dosha: Muhurta Lagna ({cand_lagna_name}) is 8th from Birth Lagna.")
                if has_ashtama_shuddhi:
                    reasons.append(f"Muhurta Lagna: {cand_lagna_name} (Ashtama Shuddhi clean).")
                else:
                    reasons.append(f"No Ashtama Shuddhi: Planets ({', '.join(planets_in_8th)}) in 8th house ({ashtama_rasi_name}).")
                if "navama_shuddhi" in rule.get("special_checks", []):
                    if has_navama_shuddhi:
                        reasons.append("Navama Shuddhi: Clean (9th house is vacant).")
                    else:
                        reasons.append(f"Navama Dosha: 9th house has {', '.join(planets_in_9th)}.")
                if "dashama_shuddhi" in rule.get("special_checks", []):
                    if has_dashama_shuddhi:
                        reasons.append("Dashama Shuddhi: Clean (10th house is vacant).")
                    else:
                        reasons.append(f"Dashama Dosha: 10th house has {', '.join(planets_in_10th)}.")
                if "guru_strength" in rule.get("special_checks", []):
                    reasons.append(f"Guru Bala: {guru_pos_desc}")
                if panchaka_info["is_pass"]:
                    reasons.append(f"Panchaka Rahitam: Clean ({panchaka_info['name_en']}).")
                if is_ritu_lagna_dosha:
                    reasons.append("Ritu Lagna Dosha: Muhurta Lagna is 6th/8th from Bride's Ritu Lagna.")
                if is_7th_star_dosha:
                    reasons.append("7th Star (Vipat) Dosha: Current star is the 7th from Janma Nakshatra.")
                if not is_uttarayana and "uttarayana_only" in rule.get("special_checks", []):
                    reasons.append("Dakshinayana: This Samskara requires Uttarayana period.")

                birth_details_dict = {"birth_lagna_idx": birth_lagna_idx, "birth_moon_rasi": birth_moon_rasi_idx}
                maha_doshas_list = evaluate_21_maha_doshas(p_win, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)
                dashavidha_doshas_list = evaluate_10_dashavidha_doshas(p_win, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)
                pariharas_list = evaluate_muhurta_pariharas(p_win, cand_raw_d1, cand_lagna_idx, birth_details=birth_details_dict, pushkara_info=win)

                result_card = {
                    "samskara_id": sid,
                    "samskara_name_en": rule["name_en"],
                    "samskara_name_te": rule["name_te"],
                    "day_number": cand_meta["day_number"],
                    "day_label_en": cand_meta["day_label"],
                    "day_label_te": cand_meta["day_label_te"],
                    "date": cand_date.strftime("%Y-%m-%d"),
                    "percentage": total_pct,
                    "verdict": verdict,
                    "lagna_name": cand_lagna_name,
                    "ashtama_rasi_name": ashtama_rasi_name,
                    "house_8_empty": has_ashtama_shuddhi,
                    "chandrabalam": chandrabalam_info,
                    "panchaka_rahitam": panchaka_info,
                    "pariharas": pariharas_list,
                    "tara": tara_name,
                    "reasons": reasons,
                    "pushkara_info": win,
                    "special_yogas": p_win.get("special_yogas", []),
                    "panchang": {
                        "vaara": p_win["vaara"],
                        "tithi": f"{p_win['tithi']['name']} ({p_win['tithi']['paksha']})",
                        "tithi_name": p_win["tithi"]["name"],
                        "tithi_number": p_win["tithi"]["number"],
                        "tithi_paksha": p_win["tithi"]["paksha"],
                        "nakshatra": p_win["nakshatra"]["name"],
                        "nakshatra_pada": p_win["nakshatra"]["pada"],
                        "yoga": p_win["yoga"]["name"],
                        "karana": p_win["karana"]["name"],
                        "sunrise": p_win.get("sunrise"),
                        "sunset": p_win.get("sunset"),
                        "abhijit_muhurta": p_win.get("abhijit_muhurta"),
                        "abhijit_kala_muhurtham": p_win.get("abhijit_kala_muhurtham"),
                        "chandramana": p_win.get("chandramana") or p_base.get("chandramana"),
                        "kala_vibhajana": p_win.get("kala_vibhajana") or p_base.get("kala_vibhajana"),
                        "panchaka_rahitam": panchaka_info,
                        "lagna_schedule": p_win.get("lagna_schedule") or p_base.get("lagna_schedule"),
                        "chandrabalam": chandrabalam_info,
                        "inauspicious_periods": {
                            "rahu_kalam": p_win.get("rahu_kalam"),
                            "yamagandam": p_win.get("yamagandam"),
                            "gulika_kalam": p_win.get("gulika_kalam"),
                            "durmuhurtam": p_win.get("durmuhurtam"),
                            "varjyam": p_win.get("varjyam")
                        }
                    },
                    "d1_chart": cand_d1_positions,
                    "detailed_eval": {
                        "vaara": {"name": p_win["vaara"], "is_pass": is_vaara_good},
                        "tithi": {"name": p_win["tithi"]["name"], "paksha": p_win["tithi"]["paksha"], "is_pass": is_tithi_good},
                        "nakshatra": {"name": p_win["nakshatra"]["name"], "pada": p_win["nakshatra"]["pada"], "is_pass": is_nak_good},
                        "tara": {"name": tara_name, "is_pass": not is_tara_avoid},
                        "chandrabalam": chandrabalam_info,
                        "panchaka": panchaka_info,
                        "ashtama_lagna": {"is_dosha": is_ashtama_lagna, "birth_lagna": birth_lagna_name, "muhurta_lagna": cand_lagna_name},
                        "ashtama_shuddhi": {"has_shuddhi": has_ashtama_shuddhi, "planets_in_8th": planets_in_8th, "muhurta_lagna": cand_lagna_name, "ashtama_rasi": ashtama_rasi_name},
                        "lagna_shuddhi": {"has_shuddhi": has_lagna_shuddhi, "planets_in_lagna": planets_in_lagna, "muhurta_lagna": cand_lagna_name},
                        "navama_shuddhi": {"has_shuddhi": has_navama_shuddhi, "planets_in_9th": planets_in_9th},
                        "dashama_shuddhi": {"has_shuddhi": has_dashama_shuddhi, "planets_in_10th": planets_in_10th},
                        "guru_strength": {"is_strong": is_guru_strong, "desc": guru_pos_desc},
                        "yoga": {"name": p_win["yoga"]["name"], "is_pass": not is_yoga_avoid},
                        "karana": {"name": p_win["karana"]["name"], "is_pass": not is_karana_avoid},
                        "maha_doshas": maha_doshas_list,
                        "dashavidha_doshas": dashavidha_doshas_list,
                        "pariharas": pariharas_list
                    }
                }

                if not has_strict_dosha:
                    day_results.append(result_card)
                else:
                    # Track the best-scoring fallback for this day
                    if not best_fallback_for_day or total_pct > best_fallback_for_day["percentage"]:
                        best_fallback_for_day = result_card

        # If clean windows found, add all clean windows; otherwise add the best-scoring fallback window
        if day_results:
            all_evaluated_candidates.extend(day_results)
        elif best_fallback_for_day:
            all_evaluated_candidates.append(best_fallback_for_day)

    # Sort candidates by percentage descending, then date ascending
    all_evaluated_candidates.sort(key=lambda c: (-c["percentage"], c["date"]))

    return {
        "samskara": {
            "id": sid,
            "page_number": rule["page_number"],
            "name_en": rule["name_en"],
            "name_te": rule["name_te"],
            "tagline_en": rule["tagline_en"],
            "tagline_te": rule["tagline_te"],
            "icon": rule["icon"],
            "rules_summary_en": rule["rules_summary_en"],
            "rules_summary_te": rule["rules_summary_te"]
        },
        "birth_details": {
            "dob": base_date.strftime("%Y-%m-%d"),
            "tob": birth_time_str,
            "place": place_name,
            "janma_nakshatra": birth_nak_name,
            "janma_nakshatra_pada": birth_nak_pada,
            "birth_lagna": birth_lagna_name,
            "janma_lagna": birth_lagna_name,
            "birth_moon_rasi": birth_moon_rasi_name,
            "birth_moon_rasi_name": birth_moon_rasi_name,
            "birth_moon_rasi_idx": birth_moon_rasi_idx,
            "d1_chart": d1_positions
        },
        "candidates": all_evaluated_candidates
    }
