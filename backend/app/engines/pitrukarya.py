"""
pitrukarya_engine.py — Antyeshti / Pitrukarya (Telugu Muhurta Shastra, treatise Part 5.3).

Two modes:
  pending  : find the next permissible windows for the Antya Samskara (daha, asthi sanchaya,
             sapindikarana) from a death date. Tithi-locked (not lagna-based).
  calendar : annual pitru karya calendar for a given Gregorian year — Ashtaka Shraddha
             (Krishna-paksha Ashtami dates), and Sankranti days of the year.
"""
from datetime import date, timedelta
from typing import Dict, List, Any
import swisseph as swe
from jhora.panchanga.drik import Place as JHoraPlace
from jhora.panchanga import drik
from jhora import utils

from app.models.names import CANONICAL_NAKSHATRA, RASI_NAMES, VAARA_NAMES

# Tithis (30-index) traditionally prohibited / avoided for pitru karya & daaha
PITRU_AVOID_TITHIS = {11, 4, 9, 14, 30}   # Ekadashi, Rikta (4,9,14), Amavasya for saptika/etc; for daaha avoid 11
DAAHA_PREFERRED_TITHIS = set(range(1, 31)) - PITRU_AVOID_TITHIS

COMBUST_THRESHOLD = 8.0


def _sun_rasi_idx(jd_ut: float) -> int:
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL
    lon = swe.calc_ut(jd_ut, swe.SUN, flags)[0][0]
    return int(lon // 30) + 1


def _is_sankranti_day(target_date: date, place: JHoraPlace) -> bool:
    jd0 = swe.julday(target_date.year, target_date.month, target_date.day, 0.0)
    jd1 = swe.julday((target_date + timedelta(days=1)).year, (target_date + timedelta(days=1)).month,
                     (target_date + timedelta(days=1)).day, 12.0)
    return _sun_rasi_idx(jd0) != _sun_rasi_idx(jd1)


def _day_panchang(target_date: date, hour: float, place: JHoraPlace) -> Dict[str, Any]:
    jd = swe.julday(target_date.year, target_date.month, target_date.day, hour)
    t = drik.tithi(jd, place)
    tithi_no = int(t[0]) if t else 1
    if tithi_no < 0:
        tithi_no += 30
    if tithi_no == 0:
        tithi_no = 30
    nak = drik.nakshatra(jd, place)
    nak_no = int(nak[0]) if nak else 1
    vaara = drik.vaara(jd, place)
    return {
        "tithi_30": int(tithi_no) if tithi_no else 1,
        "nakshatra_index": int(nak_no) if nak_no else 1,
        "nakshatra_name": CANONICAL_NAKSHATRA.get(utils.NAKSHATRA_LIST[(nak_no or 1) - 1], utils.NAKSHATRA_LIST[(nak_no or 1) - 1]),
        "vaara_index": int(vaara) + 1,
        "vaara": VAARA_NAMES[int(vaara)] if int(vaara) < len(VAARA_NAMES) else str(vaara),
    }


def find_pitrukarya(
    death_date: date,
    lat: float,
    lon: float,
    tz_offset: float,
    place_name: str,
    mode: str = "pending",
    after_death_days: int = 40,
    calendar_year: int = None,
) -> Dict[str, Any]:
    place = JHoraPlace(place_name, lat, lon, tz_offset)

    if mode == "calendar":
        return pitrukarya_calendar(calendar_year or death_date.year, place, lat, lon, tz_offset)

    # ---- pending mode: Daha & Sapindikarana windows ----
    recommendations: List[Dict[str, Any]] = []

    # Daha (cremation): prefer day of death (or first permissible day within 3 days)
    daha = None
    for offset in range(0, 3):
        d0 = death_date + timedelta(days=offset)
        p = _day_panchang(d0, 10.0, place)
        reasons = []
        ok = True
        if p["tithi_30"] == 11:  # Ekadashi — daaha avoided (shastra: తిధి నిర్ణయము)
            ok = False
            reasons.append("ఏకాదశి తిథి — దహనార్థ దినము వర్జ్యం")
        if _is_sankranti_day(d0, place):
            reasons.append("సంక్రాంతి దినము — పుణ్యకాలము; గమనిక")
        recommendations.append({
            "karya": "daha",
            "date": d0.isoformat(),
            "tithi_30": p["tithi_30"], "nakshatra": p["nakshatra_name"], "vaara": p["vaara"],
            "is_recommended": ok and offset == 0,
            "is_permissible": ok,
            "notes_te": reasons,
        })
        if ok and daha is None:
            daha = {"date": d0.isoformat(), "offset_days": offset}

    # Asthi sanchaya: day 3 or 4 after death (traditional: 3rd day collection)
    asthi = None
    for offset in (3, 4):
        d0 = death_date + timedelta(days=offset)
        p = _day_panchang(d0, 10.0, place)
        rec = {
            "karya": "asthi_sanchaya",
            "date": d0.isoformat(),
            "tithi_30": p["tithi_30"], "nakshatra": p["nakshatra_name"], "vaara": p["vaara"],
            "is_permissible": p["tithi_30"] not in {4, 9, 14},
            "notes_te": ["3వ లేదా 4వ దినమున అస్థి సంచయము (శాస్త్ర ప్రకారము 3వ దినము ముఖ్యము)"],
        }
        if asthi is None and rec["is_permissible"]:
            asthi = {"date": d0.isoformat(), "offset_days": offset}

    # Sapindikarana / Tripakshi: day 12 preferred (or yearly, or 45th/45th-day), avoid dokh tithis
    sapindi = None
    for offset in (12, 11, 13):
        d0 = death_date + timedelta(days=offset)
        p = _day_panchang(d0, 10.0, place)
        rec = {
            "karya": "sapindikarana",
            "date": d0.isoformat(),
            "tithi_30": p["tithi_30"], "nakshatra": p["nakshatra_name"], "vaara": p["vaara"],
            "is_permissible": p["tithi_30"] not in {11, 4, 9, 14, 30},
            "notes_te": ["12వ దినము ముఖ్యము; లేని చో తిథి వర్జ్యతయి పరిగణించుట"],
            }
        if sapindi is None and rec["is_permissible"]:
            sapindi = {"date": d0.isoformat(), "offset_days": offset}

    # Nitya shraddha & tilodaka / vasodaka reminder days (first 10 days — tilodaka daily)
    tilodaka = [{"date": (death_date + timedelta(days=i)).isoformat(), "karya": "tilodaka vasodaka", "notes_te": ["తిలోదక, వసోదక విధానము — దినచర్య"]} for i in range(1, 11)]

    return {
        "mode": "pending",
        "death_date": death_date.isoformat(),
        "daha": daha,
        "daha_options": [r for r in recommendations if r["karya"] == "daha"],
        "asthi_sanchaya": asthi,
        "sapindikarana": sapindi,
        "tilodaka_days": tilodaka,
        "notes_en": "Tithi-locked engine (Part 5.3 of treatise). Ekadashi daaha avoided; Sankranti day noted as punyakala. Sapindikarana on 12th day default; Tripakshi & annual shraddha in calendar mode.",
        "notes_te": "తిథి-ఆధారిత నిర్ణయము. ఏకాదశి వర్జ్యము; సంక్రాంతి పుణ్యకాలము; 12వ దినము సపిండీకరణము ముఖ్యము.",
    }


def pitrukarya_calendar(year: int, place: JHoraPlace, lat: float, lon: float, tz_offset: float) -> Dict[str, Any]:
    """Ashtaka Shraddha dates (Krishna Ashtami tithi, ~Dec–Feb window) + Sankranti days of the year."""
    ashtaka: List[Dict[str, Any]] = []
    sankranti_days: List[Dict[str, Any]] = []

    start = date(year, 11, 20)
    for i in range(90):  # Nov 20 → ~Feb 18 of next year
        d0 = start + timedelta(days=i)
        p = _day_panchang(d0, 12.0, place)
        if p["tithi_30"] == 23:  # 23rd tithi of 30 = Krishna Ashtami
            ashtaka.append({
                "date": d0.isoformat(),
                "label_en": "Ashtaka Shraddha (Krishna Ashtami)",
                "label_te": "అష్టకా శ్రాద్ధము (కృష్ణ అష్టమి)",
                "nakshatra": p["nakshatra_name"],
            })

    for m in range(1, 13):
        d0 = date(year, m, 1)
        for i in range(31):
            try:
                cur = d0 + timedelta(days=i)
            except ValueError:
                break
            if cur.month != m:
                break
            if _is_sankranti_day(cur, place):
                sankranti_days.append({"date": cur.isoformat(), "label_te": "సంక్రాంతి పుణ్యకాలము", "label_en": "Sankranti Punyakala"})

    return {"mode": "calendar", "year": year, "ashtaka_shraddha": ashtaka, "sankranti_days": sankranti_days}
