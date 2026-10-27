"""
Pydantic schemas for Geocoding endpoints.
"""
from pydantic import BaseModel, Field


class GeocodeQuery(BaseModel):
    place_name: str = Field(..., description="Place name to geocode")


class GeocodeSuggestionQuery(BaseModel):
    q: str = Field(..., min_length=3, description="Query string, min 3 chars")
