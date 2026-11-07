"""
Helper script to populate declarative YAML rule definitions from verified book data.
"""
from pathlib import Path
import yaml

RULES_DIR = Path(__file__).resolve().parent.parent / "app" / "rules"

RULES_DATA = [
    # --- GENERAL ACTIVITIES (Part 7) ---
    {
        "id": "medicine",
        "category": "general",
        "title_en": "Taking Medicine & Treatment",
        "title_te": "ఔషధ సేవన (చికిత్సారంభము)",
        "source": {"part": 7, "section": "ఔషధ సేవనకు ముహూర్తములు", "page": "Part 7, Sec 1"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday", "friday", "sunday"],
            "tithi_exclude": ["rikta", "amavasya"],
            "nakshatra_allow": ["mrigashira", "punarvasu", "pushya", "ashlesha", "hasta", "chitta", "swati", "anuradha", "mula", "shravana", "dhanishta", "shatabhisha", "revati"],
            "lagna_types": ["dvisvabhava"],
            "house_rules": [{"house": [7, 8, 12], "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 3, "wednesday": 3, "monday": 2}}
    },
    {
        "id": "first_bath_after_illness",
        "category": "general",
        "title_en": "First Bath After Illness",
        "title_te": "వ్యాధి తగ్గిన తరువాత మొదటి స్నానము",
        "source": {"part": 7, "section": "స్నాన కాల నిర్ణయము", "page": "Part 7, Sec 1"},
        "hard_filters": {
            "vaara_allow": ["tuesday", "wednesday", "thursday", "saturday", "sunday"],
            "tithi_allow": ["chaturthi", "navami", "chaturdashi"], # Rikta tithis are acceptable for washing away disease
            "nakshatra_allow": ["ashwini", "bharani", "krittika", "mrigashira", "ardra", "punarvasu", "pushya", "purva_phalguni", "hasta", "chitta", "vishakha", "mula", "purva_ashadha", "shravana", "dhanishta", "shatabhisha", "purva_bhadrapada"],
            "lagna_types": ["sthira", "dvisvabhava"]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 3, "wednesday": 3}}
    },
    {
        "id": "mantra_siddhi",
        "category": "general",
        "title_en": "Mantra Initiation & Practice",
        "title_te": "మంత్రోపదేశము / మంత్రసిద్ధి",
        "source": {"part": 7, "section": "మంత్రసిద్ధి ప్రకరణము", "page": "Part 7, Sec 2"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday", "friday"],
            "tithi_numbers_both_paksha": [2, 3, 5, 7, 10, 13, 15],
            "nakshatra_allow": ["mrigashira", "ashlesha", "uttara_phalguni", "hasta", "vishakha", "shravana"],
            "lagna_types": ["dvisvabhava"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "wednesday": 3}}
    },
    {
        "id": "idol_consecration",
        "category": "general",
        "title_en": "Idol Consecration (Vigraha Pratishtha)",
        "title_te": "విగ్రహ ప్రతిష్ఠ",
        "source": {"part": 7, "section": "దేవతా ప్రతిష్ఠా కాలము", "page": "Part 7, Sec 2"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday", "friday"],
            "tithi_shukla_numbers": [1, 2, 5, 10, 11, 13, 15],
            "tithi_krishna_numbers": [1, 2, 5],
            "nakshatra_allow": ["rohini", "mrigashira", "punarvasu", "pushya", "ashlesha", "uttara_phalguni", "hasta", "uttara_ashadha", "shravana", "uttara_bhadrapada", "revati"],
            "lagna_types": ["sthira"],
            "house_rules": [{"house": 8, "planets": "none"}, {"house": [3, 6, 11], "planets": "papa_allowed"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "friday": 4}}
    },
    {
        "id": "new_clothes_jewelry",
        "category": "general",
        "title_en": "Wearing New Clothes & Jewelry",
        "title_te": "నూతన వస్త్ర / ఆభరణ ధారణము",
        "source": {"part": 7, "section": "నూతన వస్త్రాలంకారములు", "page": "Part 7, Sec 3"},
        "hard_filters": {
            "vaara_allow": ["sunday", "monday", "thursday", "friday"],
            "tithi_exclude": ["amavasya"],
            "karana_exclude": ["vishti", "bhadra"],
            "nakshatra_allow": ["ashwini", "rohini", "punarvasu", "pushya", "hasta", "chitta", "swati", "vishakha", "dhanishta", "revati"]
        },
        "soft_scoring": {"vaara_weights": {"friday": 4, "thursday": 3, "sunday": 2}}
    },
    {
        "id": "contracts_agreements",
        "category": "general",
        "title_en": "Contracts & Agreements Signing",
        "title_te": "ఒప్పందములు / దస్తావేజులు",
        "source": {"part": 7, "section": "దస్తావేజుల రచన", "page": "Part 7, Sec 4"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday"],
            "vaara_exclude": ["tuesday", "friday"],
            "tithi_shukla_numbers": [2, 3, 5, 7, 10, 11, 13],
            "lagna_allow": ["vrishabha", "tula", "dhanus", "meena"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "wednesday": 3}}
    },
    {
        "id": "inheritance_division",
        "category": "general",
        "title_en": "Division of Inherited Property",
        "title_te": "వారసత్వ ఆస్తుల పంపకము",
        "source": {"part": 7, "section": "భాగ పరిష్కారము", "page": "Part 7, Sec 4"},
        "hard_filters": {
            "vaara_exclude": ["tuesday", "saturday"],
            "tithi_numbers_both_paksha": [2, 3, 5, 7, 10, 11, 13],
            "nakshatra_allow": ["ashwini", "rohini", "mrigashira", "punarvasu", "pushya", "uttara_phalguni", "hasta", "chitta", "swati", "uttara_ashadha", "shravana", "dhanishta", "shatabhisha", "uttara_bhadrapada", "revati"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 3, "friday": 3}}
    },
    {
        "id": "adoption",
        "category": "general",
        "title_en": "Child Adoption",
        "title_te": "దత్తత స్వీకారము",
        "source": {"part": 7, "section": "దత్తపుత్ర స్వీకారము", "page": "Part 7, Sec 4"},
        "hard_filters": {
            "vaara_allow": ["sunday", "thursday", "friday"],
            "tithi_numbers_both_paksha": [1, 2, 3, 5, 7, 10, 11, 13],
            "nakshatra_allow": ["ashwini", "pushya", "hasta", "chitta", "swati", "vishakha", "anuradha", "dhanishta"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "friday": 3}}
    },
    {
        "id": "haircut",
        "category": "general",
        "title_en": "Haircut & Shaving (Kshaura Karma)",
        "title_te": "క్షురకర్మ / కేశఖండనము",
        "source": {"part": 7, "section": "క్షురకర్మ నిషేధములు", "page": "Part 7, Sec 5"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday"],
            "vaara_exclude": ["tuesday", "friday", "saturday"],
            "tithi_exclude": ["amavasya", "purnima", "rikta"],
            "nakshatra_allow": ["ashwini", "mrigashira", "punarvasu", "pushya", "hasta", "chitta", "swati", "jyeshtha", "shravana", "dhanishta", "shatabhisha", "revati"]
        },
        "soft_scoring": {"vaara_weights": {"wednesday": 4, "monday": 3}}
    },
    {
        "id": "lending_money",
        "category": "general",
        "title_en": "Lending Money",
        "title_te": "రుణం ఇచ్చుట",
        "source": {"part": 7, "section": "ఋణదాన కాలము", "page": "Part 7, Sec 5"},
        "hard_filters": {
            "vaara_exclude": ["tuesday", "friday"],
            "tithi_exclude": ["amavasya"],
            "nakshatra_exclude": ["krittika", "punarvasu", "magha", "mula", "shatabhisha", "uttara_phalguni"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 3, "wednesday": 3}}
    },
    {
        "id": "borrowing_money",
        "category": "general",
        "title_en": "Borrowing Money / Taking Loans",
        "title_te": "రుణం గ్రహించుట (అప్పు చేయుట)",
        "source": {"part": 7, "section": "ఋణ స్వీకార నియమములు", "page": "Part 7, Sec 5"},
        "hard_filters": {
            "vaara_exclude": ["saturday", "tuesday"],
            "nakshatra_exclude": ["krittika", "punarvasu", "mula", "dhanishta"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "monday": 2}}
    },
    {
        "id": "buying_vehicles",
        "category": "general",
        "title_en": "Buying Vehicles (Vahana Kraya)",
        "title_te": "నూతన వాహన కొనుగోలు",
        "source": {"part": 7, "section": "వాహన కొనుగోలు కాలము", "page": "Part 7, Sec 6"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday", "friday", "sunday"],
            "vaara_exclude": ["tuesday", "saturday"],
            "tithi_exclude": ["amavasya", "rikta"],
            "nakshatra_allow": ["ashwini", "mrigashira", "punarvasu", "pushya", "hasta", "chitta", "swati", "anuradha", "shravana", "dhanishta", "shatabhisha", "revati"],
            "lagna_types": ["chara"], # Chara (movable) lagna is best for vehicles
            "house_rules": [{"house": 4, "planets": "no_malefics"}, {"house": 8, "planets": "none"}] # 4th house is Vahana Sthana
        },
        "soft_scoring": {"vaara_weights": {"friday": 4, "thursday": 3}}
    },
    {
        "id": "will_writing",
        "category": "general",
        "title_en": "Writing a Legal Will",
        "title_te": "వీలునామా రచన",
        "source": {"part": 7, "section": "వీలునామా నియమములు", "page": "Part 7, Sec 6"},
        "hard_filters": {
            "vaara_exclude": ["tuesday", "friday"],
            "tithi_numbers_both_paksha": [2, 3, 5, 7, 10, 11, 13],
            "nakshatra_allow": ["pushya", "purva_phalguni", "anuradha"],
            "lagna_types": ["sthira"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 3, "wednesday": 3}}
    },
    {
        "id": "sowing_seeds",
        "category": "general",
        "title_en": "Sowing Seeds & Agriculture",
        "title_te": "విత్తనములు జల్లుట / వ్యవసాయారంభము",
        "source": {"part": 7, "section": "బీజవాపన కాలము", "page": "Part 7, Sec 7"},
        "hard_filters": {
            "tithi_exclude": ["rikta"],
            "nakshatra_allow": ["ashwini", "hasta", "pushya", "chitta", "revati", "mrigashira", "anuradha", "rohini", "uttara_phalguni", "uttara_ashadha", "uttara_bhadrapada", "swati", "mula", "magha", "shravana", "dhanishta", "shatabhisha"],
            "lagna_allow": ["vrishabha", "karkataka", "kanya", "vrischika", "dhanus", "meena"]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 3, "friday": 3}}
    },
    # --- GRIHA / VASTU (Part 6) ---
    {
        "id": "rented_entry",
        "category": "griha",
        "title_en": "Entering a Rented House",
        "title_te": "అద్దె ఇల్లు ప్రవేశము",
        "source": {"part": 6, "section": "అద్దె ఇండ్ల ప్రవేశము", "page": "Part 6, Sec 3"},
        "hard_filters": {
            "vaara_exclude": ["tuesday", "sunday"],
            "tithi_exclude": ["amavasya", "rikta"],
            "nakshatra_allow": ["ashwini", "rohini", "mrigashira", "punarvasu", "pushya", "uttara_phalguni", "hasta", "chitta", "swati", "anuradha", "uttara_ashadha", "shravana", "dhanishta", "shatabhisha", "uttara_bhadrapada", "revati"],
            "lagna_types": ["chara", "dvisvabhava"]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 3, "friday": 3, "monday": 2}}
    },
    {
        "id": "door_placement",
        "category": "griha",
        "title_en": "Main Door Frame Installation (Dwara Sthapana)",
        "title_te": "సింహద్వార బంధ స్థాపన",
        "source": {"part": 6, "section": "ద్వారబంధ స్థాపన", "page": "Part 6, Sec 4"},
        "hard_filters": {
            "vaara_exclude": ["tuesday", "sunday"],
            "tithi_exclude": ["amavasya", "rikta"],
            "nakshatra_allow": ["rohini", "mrigashira", "uttara_phalguni", "chitta", "anuradha", "uttara_ashadha", "uttara_bhadrapada", "revati"],
            "lagna_types": ["sthira"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "friday": 3}}
    },
    # --- SAMSKARAS (Part 3-5) ---
    {
        "id": "namakarana",
        "category": "samskaras",
        "title_en": "Namakarana (Naming Ceremony)",
        "title_te": "నామకరణ మహోత్సవము",
        "source": {"part": 3, "section": "నామకరణ సంస్కారము", "page": "Part 3, Sec 2"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday", "friday"],
            "tithi_exclude": ["chaturthi", "ashtami", "navami", "chaturdashi", "amavasya"],
            "nakshatra_allow": ["ashwini", "rohini", "mrigashira", "punarvasu", "pushya", "uttara_phalguni", "hasta", "chitta", "swati", "anuradha", "uttara_ashadha", "shravana", "dhanishta", "shatabhisha", "uttara_bhadrapada", "revati"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "friday": 4, "monday": 3}}
    },
    {
        "id": "annaprashana",
        "category": "samskaras",
        "title_en": "Annaprashana (First Feeding)",
        "title_te": "అన్నప్రాశన సంస్కారము",
        "source": {"part": 3, "section": "అన్నప్రాశన నిర్ణయము", "page": "Part 3, Sec 3"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday", "friday"],
            "tithi_exclude": ["rikta", "amavasya", "nanda"],
            "nakshatra_allow": ["ashwini", "rohini", "mrigashira", "punarvasu", "pushya", "uttara_phalguni", "hasta", "chitta", "swati", "anuradha", "shravana", "dhanishta", "shatabhisha", "uttara_bhadrapada", "revati"],
            "house_rules": [{"house": 8, "planets": "none"}, {"house": 1, "planets": "no_malefics"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "friday": 4}}
    },
    {
        "id": "aksharabhyasa",
        "category": "samskaras",
        "title_en": "Aksharabhyasa (Vidyarambha)",
        "title_te": "అక్షరాభ్యాసము (విద్యారంభము)",
        "source": {"part": 5, "section": "విద్యారంభ కాల నిర్ణయము", "page": "Part 5, Sec 1"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday", "friday"],
            "tithi_numbers_both_paksha": [2, 3, 5, 7, 10, 11, 13],
            "nakshatra_allow": ["ashwini", "punarvasu", "pushya", "hasta", "chitta", "swati", "shravana", "dhanishta", "shatabhisha", "revati"],
            "lagna_types": ["chara", "dvisvabhava"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 5, "wednesday": 4}}
    },
    # --- VIVAHA CLUSTER ---
    {
        "id": "invitation_printing",
        "category": "vivaha",
        "title_en": "Lagna Patrika & Invitation Printing",
        "title_te": "లగ్నపత్రిక రచన / శుభలేఖల ముద్రణ",
        "source": {"part": 5, "section": "లగ్నపత్రికా రచన", "page": "Part 5, Sec 2"},
        "hard_filters": {
            "vaara_allow": ["monday", "wednesday", "thursday", "friday"],
            "tithi_exclude": ["rikta", "amavasya"],
            "nakshatra_allow": ["ashwini", "rohini", "mrigashira", "pushya", "uttara_phalguni", "hasta", "chitta", "swati", "anuradha", "uttara_ashadha", "shravana", "dhanishta", "uttara_bhadrapada", "revati"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "friday": 4}}
    },
    {
        "id": "nutana_vadhu_pravesha",
        "category": "vivaha",
        "title_en": "Nutana Vadhu Griha Pravesha",
        "title_te": "నూతన వధూ గృహప్రవేశము",
        "source": {"part": 5, "section": "వధూ ప్రవేశము", "page": "Part 5, Sec 2"},
        "hard_filters": {
            "vaara_exclude": ["tuesday", "sunday"],
            "tithi_exclude": ["amavasya", "rikta"],
            "nakshatra_allow": ["rohini", "mrigashira", "magha", "uttara_phalguni", "hasta", "chitta", "swati", "anuradha", "mula", "uttara_ashadha", "shravana", "dhanishta", "uttara_bhadrapada", "revati"],
            "lagna_types": ["sthira"],
            "house_rules": [{"house": 8, "planets": "none"}]
        },
        "soft_scoring": {"vaara_weights": {"thursday": 4, "friday": 4, "monday": 3}}
    }
]

def main():
    for item in RULES_DATA:
        cat = item["category"]
        eid = item["id"]
        cat_dir = RULES_DIR / cat
        cat_dir.mkdir(parents=True, exist_ok=True)
        file_path = cat_dir / f"{eid}.yaml"
        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(item, f, allow_unicode=True, sort_keys=False)
        print(f"Generated: {cat}/{eid}.yaml")

if __name__ == "__main__":
    main()

