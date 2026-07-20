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
