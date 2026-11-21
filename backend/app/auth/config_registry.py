"""
Super admin settings registry (Super Admin Control Plan, step S1, 13 Nov 2026).

Every adjustable setting is listed here once: its default, how a new value is checked, whether pages may
read it without signing in ("public"), and its Telugu and English label. Values are stored in the existing
app.app_settings table (one row per key, JSON), so adding a setting needs no database migration.

What stays in the code (plan D1): astrology rules and calculation methods, Dr. Nemani's rulings, secrets
(they stay in the environment) and safety floors (the bounds below).
"""
from typing import Any, Callable, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from app.engines.muhurta_tabs import MUHURTA_TABS
from app.geo.regions import REGIONS

PAGE_CHOICES = ["/panchang-lookup.html", "/panchang-month.html", "/home.html", "/muhurta-finder.html",
                "/admin.html", "/family.html", "/saved.html"]
ICON_CHOICES = ["sun", "lamp", "flame", "sparkle", "leaf", "moon", "star", "wheel", "landmark"]
THEME_PRESETS = ["sanctuary", "classic", "saffron"]
HEX = r"^#[0-9a-fA-F]{6}$"


# ── Value shapes (pydantic checks every save; out-of-range values are refused) ─────────────────────────
class _Strict(BaseModel):
    model_config = {"extra": "forbid"}


class Brand(_Strict):
    name_te: str = Field(..., min_length=2, max_length=60)
    name_en: str = Field(..., min_length=2, max_length=60)
    tagline_te: str = Field("", max_length=90)
    tagline_en: str = Field("", max_length=90)
    icon: str = "sun"

    @field_validator("icon")
    @classmethod
    def _icon(cls, v):
        if v not in ICON_CHOICES:
            raise ValueError(f"icon must be one of {', '.join(ICON_CHOICES)}")
        return v


THEME_COLOURS = {"sanctuary": ("#3c6600", "#d4af37"), "classic": ("#6f1725", "#c59b27"), "saffron": ("#a14a00", "#e0a526")}


def _contrast(a: str, b: str) -> float:
    def lum(h):
        c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    x, y = lum(a), lum(b)
    return (max(x, y) + 0.05) / (min(x, y) + 0.05)


class Theme(_Strict):
    preset: str = "sanctuary"
    primary: Optional[str] = Field(None, pattern=HEX)     # main colour (buttons, brand); None = the preset's
    gold: Optional[str] = Field(None, pattern=HEX)        # accent colour; None = the preset's

    @field_validator("preset")
    @classmethod
    def _preset(cls, v):
        if v not in THEME_PRESETS:
            raise ValueError(f"preset must be one of {', '.join(THEME_PRESETS)}")
        return v

    def readable(self) -> None:
        """Refuse colours that make text hard to read (WCAG 4.5:1): white on the main colour, dark on the gold."""
        p, g = THEME_COLOURS[self.preset]
        if _contrast(self.primary or p, "#ffffff") < 4.5:
            raise ValueError("white text would be hard to read on that main colour; pick a darker one")
        if _contrast(self.gold or g, "#241a00") < 4.5:
            raise ValueError("dark text would be hard to read on that accent colour; pick a lighter one")


class NavItem(_Strict):
    href: str = Field(..., pattern=r"^[a-z0-9-]+\.html(#[a-z-]+)?$")
    show: bool = True
    en: str = Field(..., min_length=1, max_length=40)
    te: str = Field(..., min_length=1, max_length=40)


class Nav(_Strict):
    items: List[NavItem]


class Landing(_Strict):
    user: str = "/panchang-lookup.html"
    admin: str = "/admin.html"
    super_admin: str = "/admin.html"

    @field_validator("user", "admin", "super_admin")
    @classmethod
    def _page(cls, v):
        if v not in PAGE_CHOICES:
            raise ValueError(f"landing page must be one of {', '.join(PAGE_CHOICES)}")
        return v


class Place(_Strict):
    id: str = Field(..., pattern=r"^[a-z0-9_-]{2,40}$")
    label: str = Field(..., min_length=2, max_length=80)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    tz_offset: float = Field(..., ge=-12, le=14)


class DefaultPlace(_Strict):
    name: str = Field(..., min_length=2, max_length=80)
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    tz: float = Field(..., ge=-12, le=14)


PANCHANG_SECTIONS = ["live", "timeline", "times", "yogas_panchaka", "chandrabalam", "lagnas", "dos", "shloka", "cta", "more"]


class Panchang(_Strict):
    sections: Dict[str, bool]
    refresh_seconds: int = Field(30, ge=15, le=300)
    default_place: DefaultPlace

    @field_validator("sections")
    @classmethod
    def _sections(cls, v):
        bad = [k for k in v if k not in PANCHANG_SECTIONS]
        if bad:
            raise ValueError(f"unknown sections: {', '.join(bad)}")
        return {k: bool(v.get(k, True)) for k in PANCHANG_SECTIONS}


class Places(_Strict):
    items: List[Place] = Field(..., min_length=1, max_length=200)

    @field_validator("items")
    @classmethod
    def _unique(cls, v):
        ids = [p.id for p in v]
        if len(ids) != len(set(ids)):
            raise ValueError("each place needs its own id")
        return v


class Finder(_Strict):
    search_days: int = Field(366, ge=60, le=730)     # how far a person search looks ahead
    chunk_days: int = Field(60, ge=15, le=120)       # how many days load at a time
    # Moved off the Finder form into Settings (21 Nov 2026); the server applies it to every search.
    strictness: Literal["lenient", "strict"] = "lenient"


SWITCH = Literal["inherit", "on", "off"]
# Categories that hold events (the "yogas" tab is a list of special yogas, not an event category).
DOSHA_TABS = [t for t in MUHURTA_TABS if t["id"] != "yogas"]


class DoshaSwitch(_Strict):
    """Whether the 21 mahadoshas / 10 dashavidha doshas get their own score (they are always listed). "inherit" = for a category,
    follow each event's rule file; for an event, follow its category."""
    mahadoshas: SWITCH = "inherit"
    dashavidha: SWITCH = "inherit"


class DoshaScoring(_Strict):
    # Unused since the three-score change (21 Nov 2026); kept so saved values still load.
    main_weight: int = Field(70, ge=0, le=100)
    dasha_weight: int = Field(70, ge=0, le=100)
    dasha_cap: int = Field(49, ge=5, le=98)
    # A8 (21 Nov 2026): % = panchanga shuddhi + mahadoshas (+ dashavidha, marriage only); mahadoshas get the rest.
    panchanga_weight: int = Field(30, ge=0, le=100)
    dashavidha_weight: int = Field(10, ge=0, le=100)
    tabs: Dict[str, DoshaSwitch] = Field(default_factory=dict)
    events: Dict[str, DoshaSwitch] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _weights_fit(self):
        if self.panchanga_weight + self.dashavidha_weight > 100:
            raise ValueError("panchanga and dashavidha shares together must be 100% or less")
        return self

    @field_validator("tabs")
    @classmethod
    def _known_tabs(cls, v):
        bad = [k for k in v if k not in {t["id"] for t in DOSHA_TABS}]
        if bad:
            raise ValueError(f"unknown categories: {', '.join(bad)}")
        return v

    @field_validator("events")
    @classmethod
    def _known_events(cls, v):
        from app.engines.rule_interpreter import list_all_rules   # lazy: avoids an import cycle
        known = {r["id"] for r in list_all_rules()}
        bad = [k for k in v if k not in known]
        if bad:
            raise ValueError(f"unknown events: {', '.join(bad[:5])}")
        return v


class Sharing(_Strict):
    pdf: bool = False
    image: bool = True
    text: bool = True


class Godavari(_Strict):
    enabled: bool = True
    km: float = Field(30.0, ge=10, le=100)


class TextPair(_Strict):
    en: str = Field("", max_length=400)
    te: str = Field("", max_length=400)


class Security(_Strict):
    session_days: int = Field(30, ge=1, le=90)
    login_fails_before_lock: int = Field(5, ge=3, le=10)
    lock_minutes: int = Field(15, ge=5, le=1440)
    otp_attempts: int = Field(5, ge=3, le=10)


USER_POWERS = {   # power -> the permission it grants the user role
    # Today's Panchangam
    "panchang_view": "panchang.view",
    "panchang_change_place": "panchang.change_place",
    "panchang_change_date": "panchang.change_date",
    "panchang_share": "panchang.share",
    "panchang_pdf": "panchang.export_pdf",
    "panchang_month": "panchang.month",
    "panchang_find_muhurtha": "panchang.find_muhurtha",
    "panchang_live_cards": "panchang.live_cards",
    "panchang_angas": "panchang.angas",
    "panchang_timeline": "panchang.timeline",
    "panchang_timings": "panchang.timings",
    "panchang_ashta_kaalas": "panchang.ashta_kaalas",
    "panchang_hora_choghadiya": "panchang.hora_choghadiya",
    "panchang_chandrabalam": "panchang.chandrabalam",
    "panchang_lagnas": "panchang.lagnas",
    "panchang_shloka": "panchang.shloka",

    # Monthly Panchangam
    "month_view": "panchang_month.view",
    "month_navigate": "panchang_month.navigate",
    "month_day_details": "panchang_month.day_details",
    "month_pdf": "panchang_month.export_pdf",
    "month_festivals": "panchang_month.festivals",

    # Muhurtha Darshini / Finder
    "muhurta_search": "muhurta.search",
    "muhurta_select_activity": "muhurta.select_activity",
    "muhurta_date_range": "muhurta.date_range",
    "muhurta_time_filters": "muhurta.time_filters",
    "muhurta_participants": "muhurta.participants",
    "muhurta_audit": "muhurta.audit",
    "muhurta_save": "muhurta.save",
    "muhurta_delete": "muhurta.delete",
    "muhurta_export": "muhurta.export",

    # All Muhurtas Catalog
    "catalog_view": "catalog.view",
    "catalog_browse": "catalog.browse",
    "catalog_search": "catalog.search",
    "catalog_rules": "catalog.rules",

    # Family Vault
    "family_view": "family.view",
    "family_add": "family.add",
    "family_view_details": "family.view_details",
    "family_edit": "family.edit",
    "family_delete": "family.delete",
    "family_events": "family.events",
    "family_export": "family.export",

    # My Saved Muhurtas
    "saved_view": "saved.view",
    "saved_favourite": "saved.favourite",
    "saved_edit_label": "saved.edit_label",
    "saved_delete": "saved.delete",
    "saved_export": "saved.export",

    # Account & Profile
    "self_edit": "self.edit",
    "self_edit_name": "self.edit_name",
    "self_edit_language": "self.edit_language",
    "self_edit_home_place": "self.edit_home_place",
    "self_sessions": "self.sessions",
    "self_delete_account": "self.delete_account",
}


class UserPowers(BaseModel):
    model_config = {"extra": "ignore"}
    # Today's Panchangam
    panchang_view: bool = True
    panchang_change_place: bool = True
    panchang_change_date: bool = True
    panchang_share: bool = True
    panchang_pdf: bool = True
    panchang_month: bool = True
    panchang_find_muhurtha: bool = True
    panchang_live_cards: bool = True
    panchang_angas: bool = True
    panchang_timeline: bool = True
    panchang_timings: bool = True
    panchang_ashta_kaalas: bool = True
    panchang_hora_choghadiya: bool = True
    panchang_chandrabalam: bool = True
    panchang_lagnas: bool = True
    panchang_shloka: bool = True

    # Monthly Panchangam
    month_view: bool = True
    month_navigate: bool = True
    month_day_details: bool = True
    month_pdf: bool = True
    month_festivals: bool = True

    # Muhurtha Darshini / Finder
    muhurta_search: bool = True
    muhurta_select_activity: bool = True
    muhurta_date_range: bool = True
    muhurta_time_filters: bool = True
    muhurta_participants: bool = True
    muhurta_audit: bool = True
    muhurta_save: bool = True
    muhurta_delete: bool = True
    muhurta_export: bool = True

    # All Muhurtas Catalog
    catalog_view: bool = True
    catalog_browse: bool = True
    catalog_search: bool = True
    catalog_rules: bool = True

    # Family Vault
    family_view: bool = True
    family_add: bool = True
    family_view_details: bool = True
    family_edit: bool = True
    family_delete: bool = True
    family_events: bool = True
    family_export: bool = True

    # My Saved Muhurtas
    saved_view: bool = True
    saved_favourite: bool = True
    saved_edit_label: bool = True
    saved_delete: bool = True
    saved_export: bool = True

    # Account & Profile
    self_edit: bool = True
    self_edit_name: bool = True
    self_edit_language: bool = True
    self_edit_home_place: bool = True
    self_sessions: bool = True
    self_delete_account: bool = True


ADMIN_POWERS = {   # power -> the permission it grants the admin role
    # Users Management
    "users_view": "users.view",
    "users_view_mobile": "users.view_mobile",
    "users_disable": "users.disable",
    "invite_users": "users.create",
    "edit_user_profile": "users.edit",
    "delete_user": "users.delete",
    "reset_user_sessions": "users.reset_sessions",
    "export_users": "users.export",
    "set_user_permissions": "users.set_perms",
    "set_user_passwords": "users.set_password",     # users only; admins' passwords are the super admin's (21 Nov 2026)

    # Content & App Settings
    "content_edit": "content.edit",
    "content_announcements": "content.announcements",
    "content_utpata": "content.utpata",
    "content_texts": "content.texts",
    "content_rules": "content.rules",

    # Activity Audit & System
    "audit_view_users": "audit.view_users",
    "stats_view": "system.view",
    "audit_export": "audit.export",
}


class AdminPowers(BaseModel):
    model_config = {"extra": "ignore"}
    # Users Management
    users_view: bool = True
    users_view_mobile: bool = True
    users_disable: bool = True
    invite_users: bool = True          # add users (with a password); on by default since 21 Nov 2026
    edit_user_profile: bool = False
    delete_user: bool = False
    reset_user_sessions: bool = True
    export_users: bool = False
    set_user_permissions: bool = False
    set_user_passwords: bool = True    # set a user's password (21 Nov 2026)

    # Content & App Settings
    content_edit: bool = True
    content_announcements: bool = True
    content_utpata: bool = True
    content_texts: bool = True
    content_rules: bool = True

    # Activity Audit & System
    audit_view_users: bool = True
    stats_view: bool = False
    audit_export: bool = False


class AdminDashboard(_Strict):
    stats: bool = True
    attention: bool = True
    activity: bool = True
    tools: bool = True


# ── Defaults ─────────────────────────────────────────────────────────────────────────────────────────
DEFAULT_NAV = [   # the Stitch design's five items first (19 Nov 2026); the rest hidden until shown here
    {"href": "panchang-lookup.html", "show": True, "en": "Today's Panchang", "te": "నేటి పంచాంగం"},
    {"href": "muhurta-finder.html", "show": True, "en": "Muhurta Darshini", "te": "ముహూర్త దర్శిని"},
    {"href": "muhurtas.html", "show": True, "en": "All muhurtas", "te": "అన్ని ముహూర్తాలు"},
    {"href": "muhurta-finder.html#parishilana", "show": True, "en": "Muhurta Parishilana", "te": "ముహూర్త పరిశీలన"},
    {"href": "family.html", "show": True, "en": "Family vault & settings", "te": "కుటుంబ ఖజానా & సెట్టింగ్స్"},
    {"href": "admin.html", "show": True, "en": "Dashboard", "te": "డాష్‌బోర్డ్"},
    {"href": "panchang-month.html", "show": False, "en": "Monthly Panchang", "te": "మాస పంచాంగం"},
    {"href": "home.html", "show": False, "en": "Home", "te": "హోమ్"},
    {"href": "saved.html", "show": False, "en": "My muhurtas", "te": "నా ముహూర్తాలు"},
    {"href": "admin-users.html", "show": True, "en": "Users", "te": "వినియోగదారులు"},
    {"href": "admin-content.html", "show": True, "en": "Content", "te": "విషయాలు"},
    {"href": "admin-muhurtas.html", "show": True, "en": "Muhurtas", "te": "ముహూర్తాలు"},
    {"href": "admin-stats.html", "show": True, "en": "Statistics", "te": "గణాంకాలు"},
    {"href": "admin-settings.html", "show": True, "en": "Settings", "te": "సెట్టింగులు"},
]

TEXT_KEYS = {   # the set list of editable texts (plan D8); empty means "use the page's own wording"
    "today_cta_title": "Today's Panchang: banner title",
    "today_cta_text": "Today's Panchang: banner line",
    "month_title": "Monthly Panchang: page title",
    "login_title": "Sign-in: title",
    "login_lede": "Sign-in: line under the title",
    "dash_admin_lede": "Admin dashboard: line under the title",
    "dash_super_lede": "Super admin dashboard: line under the title",
    "site_footer": "Footer line on every page",
}


def _setting(default, model: Optional[type], label_en: str, label_te: str, group: str, public: bool,
             wrap: Optional[str] = None) -> Dict[str, Any]:
    return {"default": default, "model": model, "label_en": label_en, "label_te": label_te,
            "group": group, "public": public, "wrap": wrap}


REGISTRY: Dict[str, Dict[str, Any]] = {
    "brand": _setting({"name_te": "గాయత్రి జ్యోతిర్నిధి", "name_en": "Gayatri Jyotirnidhi",
                       "tagline_te": "వేద ముహూర్త & దృక్సిద్ధాంత దర్శిని", "tagline_en": "Vedic muhurta & Drik panchang",
                       "icon": "sun"}, Brand, "Name and tagline", "పేరు, ఉపశీర్షిక", "brand", True),
    "theme": _setting({"preset": "sanctuary", "primary": None, "gold": None}, Theme,
                      "Theme and colours", "థీమ్, రంగులు", "brand", True),
    "nav": _setting({"items": DEFAULT_NAV}, Nav, "Menu items", "మెనూ అంశాలు", "menu", True),
    "landing": _setting({"user": "/panchang-lookup.html", "admin": "/admin.html", "super_admin": "/admin.html"},
                        Landing, "Landing page after sign-in", "లాగిన్ తర్వాత మొదటి పేజీ", "menu", False),
    "panchang": _setting({"sections": {k: True for k in PANCHANG_SECTIONS}, "refresh_seconds": 30,
                          "default_place": {"name": "Hyderabad, Telangana", "lat": 17.385, "lon": 78.4867, "tz": 5.5}},
                         Panchang, "Panchang pages", "పంచాంగ పేజీలు", "panchang", True),
    "places": _setting({"items": [{"id": k, **v} for k, v in REGIONS.items()]}, Places,
                       "Places list", "ప్రదేశాల జాబితా", "places", True),
    "finder": _setting({"search_days": 366, "chunk_days": 60, "strictness": "lenient"}, Finder,
                       "Muhurta Finder", "ముహూర్త శోధన", "finder", True),
    "sharing": _setting({"pdf": False, "image": True, "text": True}, Sharing,
                        "PDF, image and text sharing", "PDF, చిత్రం, పాఠ్యం పంచుకోవడం", "finder", True),
    "godavari": _setting({"enabled": True, "km": 30.0}, Godavari,
                         "Godavari Pushkaralu", "గోదావరి పుష్కరాలు", "finder", False),
    "dosha_scoring": _setting({"main_weight": 70, "dasha_weight": 70, "dasha_cap": 49,
                               "panchanga_weight": 30, "dashavidha_weight": 10,
                               "tabs": {t["id"]: {"mahadoshas": "inherit", "dashavidha": "inherit"} for t in DOSHA_TABS},
                               "events": {}},
                              DoshaScoring, "Dosha scores", "దోష శాతాలు", "finder", False),
    "texts": _setting({k: {"en": "", "te": ""} for k in TEXT_KEYS}, None, "Texts", "పాఠ్యాలు", "texts", True),
    "security": _setting({"session_days": 30, "login_fails_before_lock": 5, "lock_minutes": 15, "otp_attempts": 5},
                         Security, "Accounts and security", "ఖాతాలు, భద్రత", "security", False),
    "admin_powers": _setting({k: v for k, v in AdminPowers().model_dump().items()}, AdminPowers,
                             "What admins may do", "నిర్వాహకులు చేయగలిగేవి", "admins", False),
    "user_powers": _setting({k: v for k, v in UserPowers().model_dump().items()}, UserPowers,
                            "What users may do", "వినియోగదారులు చేయగలిగేవి", "admins", False),
    "admin_dashboard": _setting(AdminDashboard().model_dump(), AdminDashboard,
                                "Admin dashboard", "నిర్వాహక డాష్‌బోర్డ్", "admins", True),
}


def validate(key: str, value: Any) -> Any:
    """The checked value to store for `key`, or ValueError with a readable reason."""
    spec = REGISTRY.get(key)
    if spec is None:
        raise ValueError(f"'{key}' is not an adjustable setting")
    if key == "texts":
        if not isinstance(value, dict):
            raise ValueError("texts must be a set of {en, te} pairs")
        bad = [k for k in value if k not in TEXT_KEYS]
        if bad:
            raise ValueError(f"unknown texts: {', '.join(bad)}")
        try:
            return {k: TextPair(**(value.get(k) or {})).model_dump() for k in TEXT_KEYS}
        except ValidationError as e:
            raise ValueError(_readable(e))
    try:
        obj = spec["model"](**value) if isinstance(value, dict) else None
    except ValidationError as e:
        raise ValueError(_readable(e))
    if obj is not None and hasattr(obj, "readable"):
        obj.readable()
    checked = obj.model_dump() if obj is not None else None
    if checked is None:
        raise ValueError(f"{key} must be an object")
    if key == "nav":   # every page of the default menu stays listed (hidden is fine), and Settings stays shown
        hrefs = {i["href"] for i in checked["items"]}
        missing = [i["href"] for i in DEFAULT_NAV if i["href"] not in hrefs]
        unknown = [h for h in hrefs if h not in {i["href"] for i in DEFAULT_NAV}]
        if missing or unknown:
            raise ValueError("the menu must list exactly the app's pages (hide a page instead of removing it)")
        if not next(i for i in checked["items"] if i["href"] == "admin-settings.html")["show"]:
            raise ValueError("the Settings link can't be hidden, or the super admin could be locked out")
    return checked


def _readable(e: ValidationError) -> str:
    parts = []
    for err in e.errors()[:4]:
        where = ".".join(str(x) for x in err.get("loc", ()))
        parts.append(f"{where}: {err.get('msg')}" if where else str(err.get("msg")))
    return "; ".join(parts)


def merged(key: str, stored: Any) -> Any:
    """A stored value laid over the default, so settings added later get their defaults."""
    default = REGISTRY[key]["default"]
    if key == "nav" and isinstance(stored, dict) and isinstance(stored.get("items"), list):
        known = {i["href"] for i in DEFAULT_NAV}
        kept = [i for i in stored["items"] if isinstance(i, dict) and i.get("href") in known]
        have = {i["href"] for i in kept}
        return {"items": kept + [dict(i) for i in DEFAULT_NAV if i["href"] not in have]}
    if isinstance(default, dict) and isinstance(stored, dict):
        out = dict(default)
        for k, v in stored.items():
            out[k] = {**default[k], **v} if isinstance(default.get(k), dict) and isinstance(v, dict) and k != "items" else v
        return out
    return stored if stored is not None else default


def public_view(values: Dict[str, Any]) -> Dict[str, Any]:
    """What any page may read: no security, landing, admin powers or rule settings."""
    return {k: values[k] for k, spec in REGISTRY.items() if spec["public"] and k in values}


def _dosha_events() -> List[Dict[str, Any]]:
    """Events for the "Doshas in the score" overrides, with what their rule file says today."""
    from app.engines.rule_interpreter import default_dosha_sets, list_all_rules, load_rule   # lazy: avoids an import cycle
    out = []
    for r in list_all_rules():
        try:
            load_rule(r["id"])                       # still refuse to list an unreadable rule's defaults
            maha, dasha = default_dosha_sets(r["id"])   # the A1/A2 ruling, not the rule file (21 Nov 2026)
        except Exception:   # an unreadable rule file still gets listed; the finder reports its own error
            maha = dasha = None
        out.append({"id": r["id"], "tab": r.get("tab"), "en": r.get("title_en") or r["id"],
                    "te": r.get("title_te") or "", "file_mahadoshas": maha, "file_dashavidha": dasha})
    return out


def meta() -> Dict[str, Any]:
    """Labels and groups for the Settings page."""
    return {k: {"label_en": s["label_en"], "label_te": s["label_te"], "group": s["group"], "public": s["public"],
                "default": s["default"]} for k, s in REGISTRY.items()} | {
        "_choices": {"pages": PAGE_CHOICES, "icons": ICON_CHOICES, "themes": THEME_PRESETS,
                     "panchang_sections": PANCHANG_SECTIONS, "texts": TEXT_KEYS, "admin_powers": list(ADMIN_POWERS),
                     "dosha_tabs": DOSHA_TABS, "dosha_events": _dosha_events(),
                     "user_powers": list(USER_POWERS)}}
