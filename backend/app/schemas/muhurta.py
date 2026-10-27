"""
Pydantic schemas for Muhurta endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional


class MuhurtaCheckQuery(BaseModel):
    activity_id: str = Field(..., description="Target activity ID")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    tz_offset: float = Field(..., description="Timezone offset (e.g. 5.5 for IST)")
    place_name: str = Field("Location", description="Place name")
    hour: int = Field(6, ge=0, le=23, description="Hour of day (0-23)")
    method: str = Field("drik", description="'drik' or 'chandramana'")


class MuhurtaNextQuery(BaseModel):
    activity_id: str = Field(..., description="Target activity ID")
    from_date: Optional[str] = Field(None, description="Starting date in YYYY-MM-DD format, defaults to today")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    tz_offset: float = Field(..., description="Timezone offset")
    place_name: str = Field("Location", description="Place name")
    max_days: int = Field(60, le=180, description="Max days to scan (up to 180)")
    method: str = Field("drik", description="'drik' or 'chandramana'")


class FinderQuery(BaseModel):
    date: str = Field(..., description="Start date YYYY-MM-DD")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    tz_offset: float = Field(..., description="Timezone offset")
    place_name: str = Field("Location", description="Place name")
    days: int = Field(30, le=60, description="Number of days to scan (max 60)")
    birth_dob: Optional[str] = Field(None, description="Birth date YYYY-MM-DD")
    birth_tob: Optional[str] = Field(None, description="Birth time HH:MM")
