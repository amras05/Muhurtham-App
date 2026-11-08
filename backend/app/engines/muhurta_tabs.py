"""
App tabs for the Muhurta Finder, in the order of Dr. Nemani's category index (17 categories).

Each rule file names its tab with `tab:` (and optionally `also_in:` for events the index lists
in two places). The rule folders are only storage; the tab decides where an event is shown.
"""
from typing import Dict, List

MUHURTA_TABS: List[Dict[str, str]] = [
    {"id": "vivaha",      "en": "Marriage",            "te": "వివాహ ముహూర్తాలు"},
    {"id": "upanayana",   "en": "Upanayana",           "te": "ఉపనయన ముహూర్తాలు"},
    {"id": "vidya",       "en": "Education",           "te": "విద్యా ముహూర్తాలు"},
    {"id": "griha",       "en": "House & Vastu",       "te": "గృహ ముహూర్తాలు"},
    {"id": "garbha",      "en": "Pregnancy",           "te": "గర్భ సంస్కారాలు"},
    {"id": "shishu",      "en": "Child samskaras",     "te": "శిశు సంస్కారాలు"},
    {"id": "career",      "en": "Career",              "te": "ఉద్యోగ ముహూర్తాలు"},
    {"id": "business",    "en": "Business",            "te": "వ్యాపార ముహూర్తాలు"},
    {"id": "travel",      "en": "Travel",              "te": "ప్రయాణ ముహూర్తాలు"},
    {"id": "health",      "en": "Health",              "te": "ఆరోగ్య ముహూర్తాలు"},
    {"id": "spiritual",   "en": "Spiritual",           "te": "దేవతా కార్యాలు"},
    {"id": "pitru",       "en": "Pitru karma",         "te": "పితృకర్మ"},
    {"id": "finance",     "en": "Purchase & finance",  "te": "కొనుగోలు · ఆర్థిక"},
    {"id": "agriculture", "en": "Agriculture",         "te": "వ్యవసాయ ముహూర్తాలు"},
    {"id": "personal",    "en": "Personal",            "te": "వ్యక్తిగత ముహూర్తాలు"},
    {"id": "general",     "en": "General",             "te": "సాధారణ ముహూర్తాలు"},
    {"id": "yogas",       "en": "Special yogas",       "te": "ప్రత్యేక ముహూర్తాలు"},
]

TAB_IDS = {t["id"] for t in MUHURTA_TABS}

# Sub-group headings inside a tab (shown as option groups in the event list).
SUB_GROUPS: Dict[str, Dict[str, str]] = {
    "land":         {"en": "Land & site",          "te": "భూమి · స్థలం"},
    "construction": {"en": "Construction",         "te": "నిర్మాణం"},
    "entry":        {"en": "House entry",          "te": "గృహప్రవేశం"},
}


def tabs_with_events(catalog: List[Dict]) -> List[Dict]:
    """Tab list with the ids of events shown in each (primary tab first, then also_in)."""
    out = []
    for order, t in enumerate(MUHURTA_TABS, start=1):
        primary = [r["id"] for r in catalog if r.get("tab") == t["id"]]
        extra = [r["id"] for r in catalog if t["id"] in (r.get("also_in") or []) and r["id"] not in primary]
        out.append({**t, "order": order, "events": primary + extra, "count": len(primary) + len(extra)})
    return out
