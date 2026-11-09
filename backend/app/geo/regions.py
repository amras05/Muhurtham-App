"""
A small set of region presets (lat, lon, tz_offset) so the UI can offer a
dropdown instead of asking the user to type coordinates. Extend freely —
this is just enough to cover the regions this book/tradition is used in.

Also provides free-text geocoding via OpenStreetMap's Nominatim API for
any place name not in the preset list.
"""
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# Nominatim's usage policy requires a real identifying User-Agent —
# replace with your own app name/contact before any real-world/production use.
NOMINATIM_HEADERS = {"User-Agent": "MuhurtaFinderApp/1.0 (personal project)"}

REGIONS = {
    # Andhra Pradesh
    "vijayawada":   {"label": "Vijayawada, Andhra Pradesh", "lat": 16.5062, "lon": 80.6480, "tz_offset": 5.5},
    "visakhapatnam":{"label": "Visakhapatnam, Andhra Pradesh", "lat": 17.6868, "lon": 83.2185, "tz_offset": 5.5},
    "tirupati":     {"label": "Tirupati, Andhra Pradesh", "lat": 13.6288, "lon": 79.4192, "tz_offset": 5.5},
    "guntur":       {"label": "Guntur, Andhra Pradesh", "lat": 16.3067, "lon": 80.4365, "tz_offset": 5.5},
    "rajahmundry":  {"label": "Rajahmundry, Andhra Pradesh", "lat": 16.9974, "lon": 81.7806, "tz_offset": 5.5},
    "kakinada":     {"label": "Kakinada, Andhra Pradesh", "lat": 16.9891, "lon": 82.2475, "tz_offset": 5.5},
    "nellore":      {"label": "Nellore, Andhra Pradesh", "lat": 14.4426, "lon": 79.9865, "tz_offset": 5.5},
    "kurnool":      {"label": "Kurnool, Andhra Pradesh", "lat": 15.8281, "lon": 78.0373, "tz_offset": 5.5},
    "anantapur":    {"label": "Anantapur, Andhra Pradesh", "lat": 14.6819, "lon": 77.6006, "tz_offset": 5.5},
    "eluru":        {"label": "Eluru, Andhra Pradesh", "lat": 16.7107, "lon": 81.0952, "tz_offset": 5.5},
    "ongole":       {"label": "Ongole, Andhra Pradesh", "lat": 15.5057, "lon": 80.0499, "tz_offset": 5.5},
    "srikakulam":   {"label": "Srikakulam, Andhra Pradesh", "lat": 18.2949, "lon": 83.8938, "tz_offset": 5.5},
    # Telangana
    "hyderabad":    {"label": "Hyderabad, Telangana", "lat": 17.3850, "lon": 78.4867, "tz_offset": 5.5},
    "warangal":     {"label": "Warangal, Telangana", "lat": 17.9689, "lon": 79.5941, "tz_offset": 5.5},
    # Other metros
    "bengaluru":    {"label": "Bengaluru, Karnataka", "lat": 12.9716, "lon": 77.5946, "tz_offset": 5.5},
    "chennai":      {"label": "Chennai, Tamil Nadu", "lat": 13.0827, "lon": 80.2707, "tz_offset": 5.5},
    "mumbai":       {"label": "Mumbai, Maharashtra", "lat": 19.0760, "lon": 72.8777, "tz_offset": 5.5},
    "delhi":        {"label": "New Delhi", "lat": 28.6139, "lon": 77.2090, "tz_offset": 5.5},
    "pune":         {"label": "Pune, Maharashtra", "lat": 18.5204, "lon": 73.8567, "tz_offset": 5.5},
    "kolkata":      {"label": "Kolkata, West Bengal", "lat": 22.5726, "lon": 88.3639, "tz_offset": 5.5},
}


def get_region(key: str) -> dict:
    r = REGIONS.get(key.lower())
    if not r:
        raise KeyError(f"Unknown region '{key}'. Available: {', '.join(REGIONS.keys())}")
    return r


def list_regions() -> list:
    return [{"id": k, "label": v["label"], "lat": v["lat"], "lon": v["lon"], "tz_offset": v["tz_offset"]} for k, v in REGIONS.items()]


def geocode_place_name(place_name: str, for_date=None) -> dict:
    """
    Free-text geocoding for any place not in the REGIONS preset list, using
    OpenStreetMap's Nominatim (place name -> lat/lon) plus timezonefinder
    (lat/lon -> IANA timezone -> exact UTC offset for the given date, so
    DST is handled correctly for places that observe it).

    NOTE: this function could not be live-tested in the development sandbox
    (nominatim.openstreetmap.org isn't reachable from there) — verify it
    works in your actual environment before relying on it.

    Raises ValueError if the place can't be found.
    """
    from datetime import date as date_cls
    from timezonefinder import TimezoneFinder
    from zoneinfo import ZoneInfo
    import datetime as dt

    resp = requests.get(
        NOMINATIM_URL,
        params={"q": place_name, "format": "json", "limit": 1},
        headers=NOMINATIM_HEADERS,
        timeout=10,
    )
    resp.raise_for_status()
    results = resp.json()
    if not results:
        raise ValueError(f"Could not geocode place '{place_name}' via OpenStreetMap")

    lat = float(results[0]["lat"])
    lon = float(results[0]["lon"])
    display_name = results[0].get("display_name", place_name)

    tf = TimezoneFinder()
    tz_name = tf.timezone_at(lat=lat, lng=lon)
    if not tz_name:
        raise ValueError(f"Could not determine timezone for coordinates ({lat}, {lon})")

    ref_date = for_date or date_cls.today()
    ref_dt = dt.datetime(ref_date.year, ref_date.month, ref_date.day, 12, 0, tzinfo=ZoneInfo(tz_name))
    tz_offset = ref_dt.utcoffset().total_seconds() / 3600.0

    return {
        "label": display_name,
        "lat": lat,
        "lon": lon,
        "tz_offset": tz_offset,
        "tz_name": tz_name,
    }


# ── OpenStreetMap search and "my current town" (plan: location from OSM, 9 Nov 2026) ────────────
import functools
import logging

_log = logging.getLogger("muhurtham.geo")
NOMINATIM_REVERSE_URL = NOMINATIM_URL.replace("/search", "/reverse")


def _tz_for(lat: float, lon: float) -> dict:
    """IANA zone and today's UTC offset for a point (daylight saving included)."""
    import datetime as dt
    from timezonefinder import TimezoneFinder
    from zoneinfo import ZoneInfo
    name = TimezoneFinder().timezone_at(lat=lat, lng=lon) or "UTC"
    off = dt.datetime.now(ZoneInfo(name)).utcoffset().total_seconds() / 3600.0
    return {"tz_name": name, "tz_offset": off}


def _short_label(item: dict) -> str:
    """'Gajuwaka, Visakhapatnam, Andhra Pradesh' instead of the full OSM display name."""
    a = item.get("address") or {}
    clean = lambda v: (v or "").replace(" District", "").replace(" Mandal", "").strip() or None   # noqa: E731
    local = clean(a.get("suburb") or a.get("town") or a.get("village") or a.get("city") or a.get("hamlet"))
    area = clean(a.get("state_district") or a.get("city") or a.get("county"))
    abroad = a.get("country_code") not in (None, "in")
    parts = []
    for p in (local, area, a.get("state"), a.get("country") if abroad else None):
        if p and p not in parts:
            parts.append(p)
    return ", ".join(parts) or item.get("display_name", "")


@functools.lru_cache(maxsize=512)
def _search_cached(query: str) -> tuple:
    resp = requests.get(NOMINATIM_URL, params={"q": query, "format": "json", "limit": 10, "addressdetails": 1},
                        headers=NOMINATIM_HEADERS, timeout=6)
    resp.raise_for_status()
    # Only real places (towns, cities, suburbs, districts), most important first: a shop or a
    # university with the same words in its name is not an event location.
    places = [i for i in resp.json() if i.get("class") in ("place", "boundary")]
    places.sort(key=lambda i: -float(i.get("importance") or 0))
    out, seen = [], set()
    for item in places[:8]:
        lat, lon = float(item["lat"]), float(item["lon"])
        label = _short_label(item)
        if label in seen:
            continue
        seen.add(label)
        out.append({"label": label, "full_label": item.get("display_name", ""), "lat": lat, "lon": lon, **_tz_for(lat, lon)})
    return tuple(out[:6])


def get_geocode_suggestions(query: str) -> list:
    """OpenStreetMap places matching the text, each with its time zone. Empty list if OSM can't be reached."""
    q = (query or "").strip()
    if len(q) < 3:
        return []
    try:
        return list(_search_cached(q.lower()))
    except Exception as ex:
        _log.warning("Place search failed (%s): OpenStreetMap unreachable or refused", type(ex).__name__)
        return []


@functools.lru_cache(maxsize=1024)
def _reverse_cached(lat: float, lon: float) -> dict:
    resp = requests.get(NOMINATIM_REVERSE_URL, params={"lat": lat, "lon": lon, "format": "json", "zoom": 14, "addressdetails": 1},
                        headers=NOMINATIM_HEADERS, timeout=6)
    resp.raise_for_status()
    item = resp.json()
    if not item or "error" in item:
        raise ValueError("No place found at these coordinates")
    return {"label": _short_label(item), "full_label": item.get("display_name", ""), "lat": lat, "lon": lon, **_tz_for(lat, lon)}


def reverse_geocode(lat: float, lon: float) -> dict:
    """The town or suburb at a point (e.g. Gajuwaka). Coordinates are rounded to about 1 km first,
    so the exact position is never sent to OpenStreetMap or kept."""
    return _reverse_cached(round(lat, 2), round(lon, 2))
