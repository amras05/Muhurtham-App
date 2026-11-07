"""
Pydantic schemas for Declarative Muhurtham Rule Definitions (Layer 3).
Validates YAML/JSON rule files for all ~80 muhurtams.
"""
from typing import Dict, List, Optional, Union
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


class HouseRule(BaseModel):
    house: Union[int, List[int]] = Field(..., description="House number 1-12 (or list of houses)")
    planets: str = Field(..., description="'none' (empty), 'papa_allowed', 'shubha_preferred', 'no_malefics'")


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


class SoftScoring(BaseModel):
    vaara_weights: Dict[str, int] = Field(default_factory=dict)
    tithi_weights: Dict[str, int] = Field(default_factory=dict)
    nakshatra_weights: Dict[str, int] = Field(default_factory=dict)
    lagna_weights: Dict[str, int] = Field(default_factory=dict)
    month_weights: Dict[str, int] = Field(default_factory=dict)
    custom_weights: Dict[str, int] = Field(default_factory=dict)


class RuleDefinition(BaseModel):
    id: str = Field(..., description="Unique event identifier (e.g. 'griha_pravesha')")
    category: str = Field(..., description="Category: 'samskaras', 'vivaha', 'griha', 'travel', 'general', 'pitru'")
    title_en: str = Field(..., description="English title")
    title_te: str = Field(..., description="Telugu title")
    source: RuleSource = Field(default_factory=RuleSource)
    inputs: RuleInputs = Field(default_factory=RuleInputs)
    hard_filters: HardFilters = Field(default_factory=HardFilters)
    soft_scoring: SoftScoring = Field(default_factory=SoftScoring)
    exceptions: Dict[str, object] = Field(default_factory=dict)

