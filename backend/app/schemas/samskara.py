"""
Pydantic schemas for Samskara and Pitrukarya endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional


class SamskaraFinderQuery(BaseModel):
    type: str = Field(..., description="Samskara ID")
    dob: str = Field(..., description="Reference date YYYY-MM-DD")
    tob: str = Field("12:00", description="Reference time HH:MM")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    tz_offset: float = Field(..., description="Timezone offset")
    place_name: str = Field("Location", description="Place name")
    child_gender: Optional[str] = Field(None, description="'male' or 'female'")
    ceremony_type: Optional[str] = Field(None, description="'seemantha' or 'valaikappu_gajulu'")
    timing_mode: Optional[str] = Field(None, description="'early' or 'later'")
    age_mode: Optional[str] = Field(None, description="'months' or 'years'")
    varna: Optional[str] = Field(None, description="'brahmin', 'kshatriya', 'vaishya'")
    study_years: Optional[int] = Field(None, description="Target year offset from birth")
    husband_moon_rasi_idx: Optional[int] = Field(None, description="1-12 Janma Rasi index of husband")
    husband_nak_idx: Optional[int] = Field(None, description="1-27 Janma Nakshatra index of husband")
    bride_ritu_lagna_idx: Optional[int] = Field(None, description="1-12 First Ritu Lagna of bride")
    bride_nak_idx: Optional[int] = Field(None, description="1-27 Janma Nakshatra of bride")


class PitrukaryaQuery(BaseModel):
    death_date: str = Field(..., description="Date of death YYYY-MM-DD")
    tob: str = Field("12:00", description="Time of death HH:MM")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    tz_offset: float = Field(..., description="Timezone offset")
    place_name: str = Field("Location", description="Place name")
    mode: str = Field("pending", description="'pending' or 'calendar'")
    calendar_year: Optional[int] = Field(None, description="Gregorian year for calendar mode")
