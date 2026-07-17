"""
Thin wrapper around PyJHora's drik panchanga module.
Converts raw PyJHora output into a clean dict the rules engine and API can use.
"""
from datetime import datetime
from jhora.panchanga import drik
from jhora import utils

from .names import (
    VAARA_NAMES, tithi_to_number_and_paksha,
    CANONICAL_NAKSHATRA, CANONICAL_TITHI, CANONICAL_KARANA, CANONICAL_YOGA,
)

# Telugu panchangams (including the Nemani family tradition this book comes
# from) use the Lahiri/Chitrapaksha ayanamsa. PyJHora defaults to TRUE_PUSHYA,
# which gives a different (though close) sidereal zero-point, so tithi/
# nakshatra/lagna boundary times would drift from what the book assumes.
# This is set once at import time, module-wide, for every panchang calculation.
drik.set_ayanamsa_mode("LAHIRI")


def _lagna_rasi_at(jd, place, hour):
    """Return the ascendant rasi (1-12) at a given hour on jd's date."""
    asc = drik.ascendant(jd, place)
    # ascendant() returns [rasi_index(0-11), longitude_within_rasi, ...]
    return asc[0] + 1  # normalize to 1-12


def compute_day_panchang(year: int, month: int, day: int,
                          lat: float, lon: float, tz_offset: float,
                          place_name: str = "Location",
                          hour: int = 6, minute: int = 0, second: int = 0) -> dict:
    """
    Compute panchang for a given date/place, evaluated at `hour:minute:second`
    (default 06:00 local, i.e. shortly after typical sunrise — good enough for
    "which tithi/nakshatra governs this day" lookups; muhurta-precise queries
    should pass the specific hour being checked).
    """
    place = drik.Place(place_name, lat, lon, tz_offset)
    date_in = drik.Date(year, month, day)
    jd = drik.utils.julian_day_number(date_in, (hour, minute, second))

    sunrise_info = drik.sunrise(jd, place)
    sunset_info = drik.sunset(jd, place)

    vaara_idx = drik.vaara(jd, place)
    tithi_raw = drik.tithi(jd, place)
    nak_raw = drik.nakshatra(jd, place)
    karana_raw = drik.karana(jd, place)
    yogam_raw = drik.yogam(jd, place)
    rahu_kaalam = drik.raahu_kaalam(jd, place)
    durmuhurtam = drik.durmuhurtam(jd, place)
    varjyam = None
    try:
        varjyam = drik.varjyam(jd, place)
    except Exception:
        varjyam = None

    tithi_num_raw = tithi_raw[0]
    tithi_num, paksha = tithi_to_number_and_paksha(tithi_num_raw)

    lagna_rasi = _lagna_rasi_at(jd, place, hour)

    raw_nak = utils.NAKSHATRA_LIST[nak_raw[0] - 1]
    raw_tithi = utils.TITHI_LIST[tithi_num_raw - 1]
    raw_karana = utils.KARANA_LIST[karana_raw[0] - 1]
    raw_yoga = utils.YOGAM_LIST[yogam_raw[0] - 1]

    return {
        "date": f"{year:04d}-{month:02d}-{day:02d}",
        "place": place_name,
        "vaara_index": vaara_idx,
        "vaara": VAARA_NAMES[vaara_idx],
        "tithi_index_raw": tithi_num_raw,
        "tithi_number": tithi_num,       # 1-15
        "paksha": paksha,                 # shukla / krishna
        "tithi_name": CANONICAL_TITHI.get(raw_tithi, raw_tithi),
        "nakshatra_index": nak_raw[0],     # 1-27
        "nakshatra_name": CANONICAL_NAKSHATRA.get(raw_nak, raw_nak),
        "nakshatra_pada": nak_raw[1],
        "karana_index": karana_raw[0],     # 1-60
        "karana_name": CANONICAL_KARANA.get(raw_karana, raw_karana),
        "yoga_index": yogam_raw[0],        # 1-27
        "yoga_name": CANONICAL_YOGA.get(raw_yoga, raw_yoga),
        "lagna_rasi_index": lagna_rasi,    # 1-12, ascendant at queried hour
        "sunrise": sunrise_info[1],
        "sunset": sunset_info[1],
        "rahu_kaalam": rahu_kaalam,
        "durmuhurtam": durmuhurtam,
        "varjyam": varjyam,
    }
