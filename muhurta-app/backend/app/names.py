"""
Canonical name mappings (Sanskrit/Telugu transliteration used in the book)
mapped to PyJHora's index system, so rules.json can be written in familiar
terms while the engine matches against PyJHora's numeric output.
"""

# PyJHora nakshatra index (1-27) -> standard name used in the book
NAKSHATRA_NAMES = [
    None, "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula",
    "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]

# PyJHora vaara index: drik.vaara() returns 0=Sunday, 1=Monday, ..., 6=Saturday
VAARA_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# Tithi index 1-30 (1-15 Shukla, 16-30 Krishna). We normalize to 1-15 + paksha.
TITHI_NAMES = [
    None, "Prathama", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashti",
    "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
    "Trayodashi", "Chaturdashi", "Purnima/Amavasya"
]

RASI_NAMES = [
    None, "Mesha", "Vrishabha", "Mithuna", "Karkataka", "Simha", "Kanya",
    "Tula", "Vrishchika", "Dhanus", "Makara", "Kumbha", "Meena"
]

KARANA_NAMES = [
    None, "Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti (Bhadra)",
    "Shakuni", "Chatushpada", "Naga", "Kimstughna"
]

# PyJHora spells names in Tamil-inflected transliteration (Karthigai, Chathurthi,
# Egadhasi, Soola...). rules.json is written using the standard Sanskrit/Telugu
# spellings used in the book (Krittika, Chaturthi, Ekadashi, Vyatipata...).
# This map normalizes PyJHora's raw strings -> canonical spelling so both sides
# of the rules engine compare on the same vocabulary.
CANONICAL_NAKSHATRA = {
    "Aswini": "Ashwini", "Bharani": "Bharani", "Karthigai": "Krittika",
    "Rohini": "Rohini", "Mrigasheesham": "Mrigashira", "Thiruvaathirai": "Ardra",
    "Punarpoosam": "Punarvasu", "Poosam": "Pushya", "Aayilyam": "Ashlesha",
    "Makam": "Magha", "Pooram": "Purva Phalguni", "Uthiram": "Uttara Phalguni",
    "Hastham": "Hasta", "Chithirai": "Chitra", "Swaathi": "Swati",
    "Visaakam": "Vishakha", "Anusham": "Anuradha", "Kaettai": "Jyeshtha",
    "Moolam": "Mula", "Pooraadam": "Purva Ashadha", "Uthiraadam": "Uttara Ashadha",
    "Thiruvonam": "Shravana", "Avittam": "Dhanishtha", "Sadhayam": "Shatabhisha",
    "Poorattathi": "Purva Bhadrapada", "Uthirattathi": "Uttara Bhadrapada",
    "Revathi": "Revati", " Abhijith": "Abhijit", "Abhijith": "Abhijit",
}

CANONICAL_TITHI = {
    "Prathamai": "Prathama", "Pirathamai": "Prathama",
    "Thuthiyai": "Dwitiya", "Thiruthiyai": "Tritiya",
    "Chathurthi": "Chaturthi", "Panchami": "Panchami",
    "Shasti": "Shashti", "Sapthami": "Saptami",
    "Astami": "Ashtami", "Ashtami": "Ashtami", "Navami": "Navami",
    "Dhasami": "Dashami", "Egadhasi": "Ekadashi",
    "Dhuvadhasi": "Dwadashi", "Thirayodasi": "Trayodashi",
    "Sathuradasi": "Chaturdashi", "Pournami": "Purnima", "Amavasai": "Amavasya",
}

CANONICAL_KARANA = {
    "Kimstugna": "Kimstughna", "Bava": "Bava", "Baalava": "Balava",
    "kaulava": "Kaulava", "Taitila": "Taitila", "Gara": "Gara",
    "Vanija": "Vanija", "Vishti (Bhadra)": "Vishti (Bhadra)",
    "Vishti(Bhadra)": "Vishti (Bhadra)", "Sakuna": "Shakuni",
    "Chatushpada": "Chatushpada", "Naga": "Naga",
}

CANONICAL_YOGA = {
    "Vishkambha": "Vishkambha", "Priti": "Priti", "Ayushman": "Ayushman",
    "Soubhagya": "Saubhagya", "Sobhana": "Shobhana", "Atiganda": "Atiganda",
    "Sukarma": "Sukarma", "Dhrithi": "Dhriti", "Soola": "Shula",
    "Ganda": "Ganda", "Vriddhi": "Vriddhi", "Dhruva": "Dhruva",
    "Vyaghata": "Vyaghata", "Harshana": "Harshana", "Vajra": "Vajra",
    "Siddhi": "Siddhi", "Vyatipata": "Vyatipata", "Vriyana": "Variyana",
    "Parigha": "Parigha", "Siva": "Shiva", "Siddha": "Siddha",
    "Sadhya": "Sadhya", "Subha": "Shubha", "Sukla": "Shukla",
    "Brahma": "Brahma", "Indra": "Indra", "Vaidhrithi": "Vaidhriti",
}

CANONICAL_VAARA = {  # PyJHora already uses plain English weekday names
    "Sunday": "Sunday", "Monday": "Monday", "Tuesday": "Tuesday",
    "Wednesday": "Wednesday", "Thursday": "Thursday", "Friday": "Friday",
    "Saturday": "Saturday",
}

def tithi_to_number_and_paksha(tithi_index: int):
    """PyJHora tithi index is 1-30. Returns (1-15 tithi number, 'shukla'/'krishna')."""
    if tithi_index <= 15:
        return tithi_index, "shukla"
    return tithi_index - 15, "krishna"


# Chandramana (lunar) month names, 1-12, per PyJHora's vedic_date() convention
# (month index 1 = Chaitra ... 12 = Phalguna). These are the standard
# Sanskrit/Telugu names used in panchangams, not PyJHora's Tamil MONTH_LIST.
LUNAR_MONTH_NAMES = [
    None, "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana",
    "Bhadrapada", "Ashwina", "Kartika", "Margashira", "Pushya", "Magha", "Phalguna"
]

TELUGU_LUNAR_MONTH_NAMES = [
    None, "చైత్ర మాసం", "వైశాఖ మాసం", "జ్యేష్ఠ మాసం", "ఆషాఢ మాసం", "శ్రావణ మాసం",
    "భాద్రపద మాసం", "ఆశ్వయుజ మాసం", "కార్తీక మాసం", "మార్గశిర మాసం", "పుష్య మాసం", "మాఘ మాసం", "ఫాల్గుణ మాసం"
]

TELUGU_SAMVATSARAS = [
    "ప్రభవ", "విభవ", "శుక్ల", "ప్రమోదూత", "ప్రజోత్పత్తి", "ఆంగీరస", "శ్రీముఖ", "భావ", "యువ", "ధాత",
    "ఈశ్వర", "బహుధాన్య", "ప్రమాథి", "విక్రమ", "వృష", "చిత్రభాను", "స్వభాను", "తారణ", "పార్థివ", "వ్యయ",
    "సర్వజిత్", "సర్వధారి", "విరోధి", "వికృతి", "ఖర", "నందన", "విజయ", "జయ", "మన్మథ", "దుర్ముఖి",
    "హేవిలంబి", "విలంబి", "వికారి", "శార్వరి", "ప్లవ", "శుభకృత్", "శోభకృత్", "క్రోధి", "విశ్వావసు", "పరాభవ",
    "ప్లవంగ", "కీలక", "సౌమ్య", "సాధారణ", "విరోధికృత్", "పరిధావి", "ప్రమాదీచ", "ఆనంద", "రాక్షస", "నల",
    "పింగళ", "కాలయుక్త", "సిద్ధార్థి", "రౌద్రి", "దుర్మతి", "దుందుభి", "రుధిరోద్గారి", "రక్తాక్షి", "క్రోధన", "క్షయ"
]

RUTHU_NAMES = [
    None,
    {"en": "Vasanta Ruthu", "te": "వసంత ఋతువు"},
    {"en": "Greeshma Ruthu", "te": "గ్రీష్మ ఋతువు"},
    {"en": "Varsha Ruthu", "te": "వర్ష ఋతువు"},
    {"en": "Sharad Ruthu", "te": "శరత్ ఋతువు"},
    {"en": "Hemanta Ruthu", "te": "హేమంత ఋతువు"},
    {"en": "Shishira Ruthu", "te": "శిశిర ఋతువు"}
]

AYANAM_NAMES = {
    "uttarayana": {"en": "Uttarayana", "te": "ఉత్తరాయణం"},
    "dakshinayana": {"en": "Dakshinayana", "te": "దక్షిణాయణం"}
}

PANCHAKA_CLASSIFICATIONS = {
    1: {
        "name_en": "Mrityu Panchakam",
        "name_te": "మృత్యు పంచకం",
        "is_pass": False,
        "effect_en": "Danger of death / severe obstacle. Avoid for marriage and life ceremonies.",
        "effect_te": "మృత్యు భయము, అత్యంత కీడు. వివాహాది శుభకార్యములకు వర్జ్యం.",
        "pariharam_en": "Avoid especially during dusk/dawn sandhyas. If unavoidable, perform Mrityunjaya Japa / Til Danam.",
        "pariharam_te": "సాయం-ప్రాతః సంధ్యా సమయాల్లో పూర్తిగా విడువవలెను. అత్యవసరమైతే మృత్యుంజయ జపం, తిల దానం చేయవలెను."
    },
    2: {
        "name_en": "Agni Panchakam",
        "name_te": "అగ్ని పంచకం",
        "is_pass": False,
        "effect_en": "Danger of fire / destruction. Avoid for house construction, entry, or factory openings.",
        "effect_te": "అగ్ని భయము, నష్టము. గృహారంభం, గృహప్రవేశం, అగ్ని సంబంధిత పనులకు వర్జ్యం.",
        "pariharam_en": "Avoid on Tuesdays. If unavoidable, offer ghee to Agni or donate sandalwood.",
        "pariharam_te": "మంగళవారం నాడు విశేషంగా విడువవలెను. చందన దానం లేదా నెయ్యి దీపారాధన పరిహారం."
    },
    4: {
        "name_en": "Raja Panchakam",
        "name_te": "రాజ పంచకం",
        "is_pass": False,
        "effect_en": "Obstacles from authorities / legal issues. Avoid for political or government ventures.",
        "effect_te": "రాజభయము, అధికార సమస్యలు, ప్రభుత్వ పనులలో ఆటంకం.",
        "pariharam_en": "Panchaka Shastra notes: Daytime cancels Raja Panchaka (no dosha in daylight hours). Avoid on Saturdays.",
        "pariharam_te": "పగటి పూట రాజపంచకమునకు దోషము లేదు (శాస్త్ర పరిహారం). శనివారం నాడు విడువవలెను."
    },
    6: {
        "name_en": "Chora Panchakam",
        "name_te": "చోర పంచకం",
        "is_pass": False,
        "effect_en": "Danger of theft / financial loss. Avoid for travel, buying assets, or business start.",
        "effect_te": "దొంగల భయము, ధన నష్టము. యాత్రలు, వ్యాపారం, ఒప్పందములకు వర్జ్యం.",
        "pariharam_en": "Avoid on Tuesdays. If unavoidable, donate copper or offer prayers to Lord Kartikeya.",
        "pariharam_te": "మంగళవారం విడువవలెను. సుబ్రహ్మణ్య స్వామి పూజ, రాగి పాత్ర దానం పరిహారం."
    },
    8: {
        "name_en": "Roga Panchakam",
        "name_te": "రోగ పంచకం",
        "is_pass": False,
        "effect_en": "Danger of disease / physical affliction. Avoid for surgery or health-sensitive undertakings.",
        "effect_te": "రోగ భయము, అనారోగ్య బాధలు. శస్త్రచికిత్సలు, ఆరోగ్యంపై ప్రభావం చూపే పనులకు వర్జ్యం.",
        "pariharam_en": "Panchaka Shastra notes: Night hours cancel Roga Panchaka (no dosha after sunset). Avoid on Sundays.",
        "pariharam_te": "రాత్రి యందు రోగపంచకమునకు దోషము లేదు (శాస్త్ర పరిహారం). ఆదివారం నాడు విడువవలెను."
    },
    0: {
        "name_en": "Panchaka Rahitam (Subha Panchakam)",
        "name_te": "పంచకరహితం (శుభ పంచకం)",
        "is_pass": True,
        "effect_en": "Auspicious & Clean! Free from all five afflictions.",
        "effect_te": "పంచక రహితం! సర్వ కార్యములకు అత్యంత శ్రేష్ఠమైనది.",
        "pariharam_en": "No dosha present. Naturally protected and favorable.",
        "pariharam_te": "ఎలాంటి దోషం లేదు. పరిపూర్ణ శుభప్రదం."
    },
    3: {
        "name_en": "Panchaka Rahitam (Subha Panchakam)",
        "name_te": "పంచకరహితం (శుభ పంచకం)",
        "is_pass": True,
        "effect_en": "Auspicious & Clean! Free from all five afflictions.",
        "effect_te": "పంచక రహితం! సర్వ కార్యములకు అత్యంత శ్రేష్ఠమైనది.",
        "pariharam_en": "No dosha present. Naturally protected and favorable.",
        "pariharam_te": "ఎలాంటి దోషం లేదు. పరిపూర్ణ శుభప్రదం."
    },
    5: {
        "name_en": "Panchaka Rahitam (Subha Panchakam)",
        "name_te": "పంచకరహితం (శుభ పంచకం)",
        "is_pass": True,
        "effect_en": "Auspicious & Clean! Free from all five afflictions.",
        "effect_te": "పంచక రహితం! సర్వ కార్యములకు అత్యంత శ్రేష్ఠమైనది.",
        "pariharam_en": "No dosha present. Naturally protected and favorable.",
        "pariharam_te": "ఎలాంటి దోషం లేదు. పరిపూర్ణ శుభప్రదం."
    },
    7: {
        "name_en": "Panchaka Rahitam (Subha Panchakam)",
        "name_te": "పంచకరహితం (శుభ పంచకం)",
        "is_pass": True,
        "effect_en": "Auspicious & Clean! Free from all five afflictions.",
        "effect_te": "పంచక రహితం! సర్వ కార్యములకు అత్యంత శ్రేష్ఠమైనది.",
        "pariharam_en": "No dosha present. Naturally protected and favorable.",
        "pariharam_te": "ఎలాంటి దోషం లేదు. పరిపూర్ణ శుభప్రదం."
    }
}

