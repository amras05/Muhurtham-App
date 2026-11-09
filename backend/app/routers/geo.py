"""
Geographic locations and geocoding router.
Serves /regions, /geocode, and /geocode/suggestions.
"""
from fastapi import APIRouter, Query
from app.geo.regions import list_regions, geocode_place_name, get_geocode_suggestions, reverse_geocode

router = APIRouter(tags=["Geo"])


@router.get("/regions")
def get_regions():
    """List available region presets for the region dropdown."""
    return list_regions()


@router.get("/geocode")
def geocode(place_name: str = Query(..., description="City or place name to look up")):
    """Geocode a place name using OpenStreetMap Nominatim."""
    return geocode_place_name(place_name)


@router.get("/geocode/reverse")
def geocode_reverse(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    """Town at the browser's location (used to fill the place automatically)."""
    from fastapi import HTTPException
    try:
        return reverse_geocode(lat, lon)
    except ValueError:
        raise HTTPException(status_code=404, detail="No town found at your location. Search for the place instead.")
    except Exception:
        raise HTTPException(status_code=503, detail="Couldn't reach OpenStreetMap. Search for the place instead.")


@router.get("/geocode/suggestions")
def geocode_suggestions(q: str = Query(..., description="Query string, min 3 chars")):
    """Get geocoding suggestions."""
    return get_geocode_suggestions(q)
