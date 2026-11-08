"""
Pydantic schemas for Declarative Muhurtham Rule Definitions (Layer 3).
Validates YAML/JSON rule files for all ~80 muhurtams.
"""
from typing import Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


class RuleSource(BaseModel):
    part: Optional[Union[int, str]] = Field(None, description="Part / Chapter in treatise (e.g. 6 or 'Part 6')")
    section: Optional[str] = Field(None, description="Section heading in Telugu or English")
    page: Optional[Union[int, str]] = Field(None, description="Page number(s) in treatise")
    notes: Optional[str] = Field(None, description="Contextual notes and textual remarks")


class RuleInputs(BaseModel):
    required: List[str] = Field(default_factory=lambda: ["location", "date_range"])
    optional: List[str] = Field(default_factory=list)


class CommonFilters(BaseModel):
    mahadoshas_21: bool = Field(True, description="Enforce 21 Mahadoshas exclusion")
    dashavidha_10: bool = Field(False, description="Enforce 10 Dashavidha doshas exclusion")
    panchaka_rahita: bool = Field(True, description="Enforce Panchaka Rahitam")
    avoid_rahu_kalam: bool = Field(True, description="Exclude Rahu Kaalam")
    avoid_yamagandam: bool = Field(True, description="Exclude Yamagandam")
    avoid_gulika: bool = Field(False, description="Exclude Gulika Kaalam")
    avoid_varjyam: bool = Field(True, description="Exclude Varjyam (Visha Ghatikas)")
    avoid_durmuhurta: bool = Field(True, description="Exclude Durmuhurtham")
    masa_shubha: bool = Field(False, description="Reject adhika masa and shunya masa (plan M1 masa_shubha); set for shubha karya")


class HouseRule(BaseModel):
    house: Union[int, List[int]] = Field(..., description="House number 1-12 (or list of houses)")
    planets: str = Field(..., description="'none' (empty), 'papa_allowed', 'shubha_preferred', 'no_malefics'")


class PlanetRule(BaseModel):
    """
    A planet (or 'benefic' / 'malefic' group) placement condition at the muhurta lagna.
    'benefic' with in_houses means at least one benefic must be there; 'malefic' with
    not_in_houses means no malefic may be there. soft_points > 0 turns the rule into a
    score bonus instead of a hard filter.
    """
    planet: str = Field(..., description="sun, moon, mars, mercury, jupiter, venus, saturn, rahu, ketu, benefic, malefic")
    in_houses: Optional[List[int]] = None
    not_in_houses: Optional[List[int]] = None
    not_in_signs: Optional[List[str]] = None
    in_nakshatras: Optional[List[str]] = None
    not_in_nakshatras: Optional[List[str]] = None
    soft_points: int = Field(0, description="0 = hard rule; >0 = bonus points when satisfied")
    note: Optional[str] = None


class AgeRule(BaseModel):
    """
    Allowed age windows counted as ordinals: month 6 = the sixth month (5 completed months),
    year 8 = the eighth year, day 11 = the eleventh day (day of birth = day 1).
    """
    reference: Literal["birth", "conception"] = "birth"
    unit: Literal["days", "months", "years"] = "months"
    allowed: Optional[List[int]] = Field(None, description="Ordinals allowed for everyone")
    boy: Optional[List[int]] = Field(None, description="Ordinals allowed for a boy")
    girl: Optional[List[int]] = Field(None, description="Ordinals allowed for a girl")
    min_ordinal: Optional[int] = Field(None, description="Allow any ordinal from this value onwards")
    note: Optional[str] = None


class DependsOn(BaseModel):
    """A dependent muhurta scheduled relative to the main event's date (e.g. ankurarpana)."""
    nights_before: List[int] = Field(default_factory=list, description="Nights before the main event, e.g. [1, 3, 5, 7]")
    days_after: List[int] = Field(default_factory=list, description="Days after the main event, e.g. [6, 8, 10]")


class MasaSunRule(BaseModel):
    masa: str = Field(..., description="Lunar month (Amanta), e.g. 'pushya'")
    sun_signs: List[str] = Field(..., description="Sun signs that make this month unfit")


class HardFilters(BaseModel):
    common: CommonFilters = Field(default_factory=CommonFilters)
    vaara_allow: Optional[List[str]] = Field(None, description="Allowed weekdays (e.g. ['thursday', 'friday'])")
    vaara_exclude: Optional[List[str]] = Field(None, description="Forbidden weekdays")
    tithi_allow: Optional[List[str]] = Field(None, description="Allowed tithi names")
    tithi_exclude: Optional[List[str]] = Field(None, description="Forbidden tithis (e.g. ['rikta', 'amavasya'])")
    tithi_numbers_both_paksha: Optional[List[int]] = Field(None, description="Allowed tithi numbers 1-15 regardless of paksha")
    tithi_shukla_numbers: Optional[List[int]] = Field(None, description="Allowed Shukla paksha tithi numbers")
    tithi_krishna_numbers: Optional[List[int]] = Field(None, description="Allowed Krishna paksha tithi numbers")
    nakshatra_allow: Optional[List[str]] = Field(None, description="Allowed nakshatras")
    nakshatra_exclude: Optional[List[str]] = Field(None, description="Forbidden nakshatras")
    yoga_allow: Optional[List[str]] = Field(None, description="Allowed yogas")
    yoga_exclude: Optional[List[str]] = Field(None, description="Forbidden yogas")
    karana_allow: Optional[List[str]] = Field(None, description="Allowed karanas")
    karana_exclude: Optional[List[str]] = Field(None, description="Forbidden karanas (e.g. ['bhadra', 'vishti'])")
    lagna_allow: Optional[List[str]] = Field(None, description="Allowed lagna signs")
    lagna_exclude: Optional[List[str]] = Field(None, description="Forbidden lagna signs")
    lagna_types: Optional[List[str]] = Field(None, description="'chara', 'sthira', 'dvisvabhava'")
    house_rules: Optional[List[HouseRule]] = Field(None, description="Astrological house occupancy rules")
    special_checks: Optional[List[str]] = Field(None, description="Domain-specific validator keys")
    planet_rules: Optional[List[PlanetRule]] = Field(None, description="Planet placement conditions")
    exclude_janma_counts: Optional[List[int]] = Field(
        None, description="Nakshatra counts from the janma nakshatra to avoid (1 = janma), e.g. shadjanma")
    exclude_janma_nakshatra: bool = Field(False, description="Reject the person's own janma nakshatra")
    sun_sign_allow: Optional[List[str]] = Field(None, description="Allowed Sun signs (e.g. Uttarayana = makara..mithuna)")
    sun_sign_exclude: Optional[List[str]] = Field(None, description="Forbidden Sun signs")
    not_combust: Optional[List[str]] = Field(None, description="Planets that must not be combust (e.g. ['jupiter', 'venus'])")
    age_rule: Optional[AgeRule] = Field(None, description="Age or pregnancy-month window")
    time_of_day: Optional[Literal["forenoon", "daytime", "night"]] = Field(None, description="Restrict to part of the day")
    tarabala_for: Optional[List[str]] = Field(
        None, description="Participants whose tarabala must pass: groom, bride, father, mother, guru, owner, spouse")
    no_moudhya: Optional[List[str]] = Field(None, description="jupiter / venus must be clear of combustion and bala/vriddha days")
    masa_allow: Optional[List[str]] = Field(None, description="Allowed lunar months (Amanta)")
    masa_exclude: Optional[List[str]] = Field(None, description="Forbidden lunar months (Amanta)")
    masa_sun_exclude: Optional[List[MasaSunRule]] = Field(None, description="Lunar month + Sun sign combinations to avoid")
    exclude_periods: Optional[List[Literal["third_yama", "ghati_26_30", "dawn", "midnight", "pradosha"]]] = Field(
        None, description="Parts of the day to avoid")
    simha_guru: bool = Field(False, description="Reject Sun from Ardra pada 4 to Swati pada 4 with Jupiter in Simha")
    guru_bala_couple: bool = Field(False, description="Jupiter not 8/12 from the bride's rashi, nor 3/6 from the groom's")
    trijyeshtha: bool = Field(False, description="An eldest child does not marry in Jyeshtha masa")
    exclude_dagdha_tithi: bool = Field(False, description="Reject the dagdha tithi for the Sun's sign")
    monday_needs_waxing_moon: bool = Field(False, description="Monday allowed only with a waxing Moon")
    travel_checks: bool = Field(False, description="Vara/nakshatra shula, Dhanishta panchaka and Shukra sammukha for the travel direction")
    moon_free_of_malefics: bool = Field(False, description="No malefic in the Moon's sign")
    mars_saturn_not_opposed: bool = Field(False, description="Mars and Saturn not in mutual 7th")
    upanayana_strength: bool = Field(False, description="Varnesha and vedadhipati strong; Guru bala for the vatu")


class SoftScoring(BaseModel):
    vaara_weights: Dict[str, int] = Field(default_factory=dict)
    tithi_weights: Dict[str, int] = Field(default_factory=dict)
    nakshatra_weights: Dict[str, int] = Field(default_factory=dict)
    lagna_weights: Dict[str, int] = Field(default_factory=dict)
    month_weights: Dict[str, int] = Field(default_factory=dict)
    custom_weights: Dict[str, int] = Field(default_factory=dict)


class ParticipantSpec(BaseModel):
    """A person the event asks about (Input Data Master). Overrides the tab's default list."""
    role: str = Field(..., description="Role id from engines/participants.py ROLES")
    level: Literal["L1", "L2"] = Field("L2", description="L1 always asked; L2 optional personal-strength details")
    primary: bool = Field(False, description="Feeds the main tarabala / chandrabala / lagnashtama checks")
    star_basis: Literal["janma", "nama"] = Field("janma", description="Which nakshatra the rules use for this person")
    fields: List[str] = Field(default_factory=list, description="Extra card fields: birth_date, gender, eldest")


class RuleAlternative(BaseModel):
    """A second list from the book for the same event (plan M21 'alternatives')."""
    title_en: str
    title_te: str = ""
    hard_filters: HardFilters


class RuleDefinition(BaseModel):
    id: str = Field(..., description="Unique event identifier (e.g. 'griha_pravesha')")
    category: str = Field(..., description="Category: 'samskaras', 'vivaha', 'griha', 'travel', 'general', 'pitru'")
    extends: Optional[str] = Field(None, description="Reuse another event's rules; this file overrides only what differs")
    tab: Optional[str] = Field(None, description="App tab id (engines/muhurta_tabs.py); defaults to the folder name")
    also_in: List[str] = Field(default_factory=list, description="Other tabs that also list this event")
    sub_group: Optional[str] = Field(None, description="Heading inside the tab, e.g. 'land', 'construction', 'entry'")
    title_en: str = Field(..., description="English title")
    title_te: str = Field(..., description="Telugu title")
    source: RuleSource = Field(default_factory=RuleSource)
    inputs: RuleInputs = Field(default_factory=RuleInputs)
    hard_filters: HardFilters = Field(default_factory=HardFilters)
    soft_scoring: SoftScoring = Field(default_factory=SoftScoring)
    exceptions: Dict[str, object] = Field(default_factory=dict)
    kartari: Literal["none", "all", "agni"] = Field(
        "none", description="Which Surya kartari applies (plan M7): 'all' (Bharani 3-4, Krittika, Rohini 1), "
                            "'agni' (Krittika only, e.g. griha nirmana), 'none' (e.g. marriage, griha pravesha)")
    informational: bool = Field(False, description="Shown for reference only (e.g. surgery); not advice")
    tab_inputs: List[str] = Field(default_factory=list, description="Extra form fields the app shows for this event")
    description_en: str = Field("", description="One-line description shown in the event list")
    description_te: str = Field("", description="Telugu one-line description")
    depends_on: Optional[DependsOn] = Field(None, description="Scheduled relative to a main event date")
    participants: Optional[List[ParticipantSpec]] = Field(None, description="People asked for; defaults to the tab's list")
    alternatives: Dict[str, RuleAlternative] = Field(default_factory=dict,
                                                     description="Named alternate hard-filter lists from the book")

