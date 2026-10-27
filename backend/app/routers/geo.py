"""
Geographic locations and geocoding router.
Serves /regions, /geocode, and /geocode/suggestions.
"""
from fastapi import APIRouter, Query
from app.geo.regions import list_regions, geocode_place_name, get_geocode_suggestions

router = APIRouter(tags=["Geo"])


@router.get("/regions")
def get_regions():
    """List available region presets for the region dropdown."""
    return list_regions()


@router.get("/geocode")
def geocode(place_name: str = Query(..., description="City or place name to look up")):
    """Geocode a place name using OpenStreetMap Nominatim."""
    return geocode_place_name(place_name)


@router.get("/geocode/suggestions")
def geocode_suggestions(q: str = Query(..., description="Query string, min 3 chars")):
    """Get geocoding suggestions."""
    return get_geocode_suggestions(q)
