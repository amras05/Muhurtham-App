"""
Pydantic schemas for Panchang endpoints.
"""
from pydantic import BaseModel, Field
from typing import Optional


class PanchangQuery(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    tz_offset: float = Field(..., description="Timezone offset (e.g. 5.5 for IST)")
    place_name: str = Field("Location", description="Place name")
    hour: int = Field(6, ge=0, le=23, description="Hour of day (0-23)")


class DaySummaryQuery(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    tz_offset: float = Field(..., description="Timezone offset (e.g. 5.5 for IST)")
    place_name: str = Field("Location", description="Place name")


class SimplePanchangQuery(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    region: str = Field(..., description="Region key from /regions, e.g. 'vijayawada'")
