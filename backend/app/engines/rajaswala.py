"""
Rajaswala record (book Part 4, "రజస్వల ప్రకరణము", p.106-108; added 12 Nov 2026).

This is not a muhurta search: given the moment of a girl's first period and the place, it rates that
moment by the book's good nakshatras, weekdays and lagnas (p.106-107) and its 17 bad times (p.107-108).
The moment is health data: callers must not log or store it.
"""
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from app.engines.lagna_scanner import RASI_NAMES_TE, get_planet_positions
from app.engines.limb_timeline import (ascendant_at, eclipse_status, limb_spans, limbs_at, local_to_jd,
                                       mahapata_at, varjyam_windows)
from app.engines.panchang import compute_day_panchang
from app.engines.vocab import NAKSHATRA_CANONICAL, RASI_CANONICAL

# p.106: good and bad nakshatras for the first period (1 = Ashwini).
GOOD_NAKSHATRAS = {1, 4, 5, 8, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 24, 26, 27}
BAD_NAKSHATRAS = {2, 3, 6, 7, 9, 10, 11, 18, 20, 25}
GOOD_WEEKDAYS = {1, 3, 4, 5}                          # p.107: Mon, Wed, Thu, Fri (0 = Sunday)
GOOD_LAGNAS = {2, 3, 4, 6, 7, 9, 12}                  # p.107: Vrishabha, Mithuna, Karkataka, Kanya, Tula, Dhanus, Meena
BAD_TITHIS_15 = {4, 6, 8, 9, 12, 14}                  # p.107 item 8, both pakshas
BAD_YOGAS = {1: "Vishkambha", 6: "Atiganda", 9: "Shula", 10: "Ganda", 13: "Vyaghata", 15: "Vajra"}  # item 15
VYATIPATA, VAIDHRITI, PARIGHA = 17, 27, 19
MALEFICS = {"Sun", "Mars", "Saturn", "Rahu", "Ketu"}
BENEFICS = {"Jupiter", "Venus", "Mercury"}
WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
WEEKDAYS_TE = ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"]
NAKSHATRA_TE = ["", "అశ్విని", "భరణి", "కృత్తిక", "రోహిణి", "మృగశిర", "ఆరుద్ర", "పునర్వసు", "పుష్యమి", "ఆశ్లేష",
                "మఖ", "పుబ్బ", "ఉత్తర", "హస్త", "చిత్త", "స్వాతి", "విశాఖ", "అనూరాధ", "జ్యేష్ఠ", "మూల",
                "పూర్వాషాఢ", "ఉత్తరాషాఢ", "శ్రవణం", "ధనిష్ఠ", "శతభిషం", "పూర్వాభాద్ర", "ఉత్తరాభాద్ర", "రేవతి"]
PLANET_TE = {"Sun": "రవి", "Moon": "చంద్రుడు", "Mars": "కుజుడు", "Mercury": "బుధుడు", "Jupiter": "గురుడు",
             "Venus": "శుక్రుడు", "Saturn": "శని", "Rahu": "రాహువు", "Ketu": "కేతువు"}
SANDHYA_MINUTES = 48                                  # Dr. Nemani, 13 Nov 2026: 48 minutes before and after sunrise and sunset


def _hours(hms: Optional[str], default: float) -> float:
    try:
        h, m, *s = (int(x) for x in str(hms).split(":"))
        return h + m / 60.0 + (s[0] if s else 0) / 3600.0
    except (TypeError, ValueError):
        return default


def _sun_times(day: date, lat: float, lon: float, tz: float) -> Dict[str, datetime]:
    p = compute_day_panchang(day.year, day.month, day.day, lat, lon, tz, "Location")
    base = datetime(day.year, day.month, day.day)
    return {"sunrise": base + timedelta(hours=_hours(p.get("sunrise"), 6.0)),
            "sunset": base + timedelta(hours=_hours(p.get("sunset"), 18.0))}


def _row(rid: str, status: str, en: str, te: str) -> Dict[str, Any]:
    return {"id": rid, "status": status, "en": en, "te": te}


def rate_first_period(moment: datetime, lat: float, lon: float, tz: float,
                      janma_nak_idx: Optional[int] = None, husband_rasi_idx: Optional[int] = None) -> Dict[str, Any]:
    jd = local_to_jd(moment, tz)
    L = limbs_at(jd)
    today = _sun_times(moment.date(), lat, lon, tz)
    vedic_day = moment.date() if moment >= today["sunrise"] else moment.date() - timedelta(days=1)
    sun_today = today if vedic_day == moment.date() else _sun_times(vedic_day, lat, lon, tz)
    sun_next = _sun_times(vedic_day + timedelta(days=1), lat, lon, tz)
    sr_jd, next_sr_jd = local_to_jd(sun_today["sunrise"], tz), local_to_jd(sun_next["sunrise"], tz)
    wd = (vedic_day.weekday() + 1) % 7                    # 0 = Sunday

    asc = ascendant_at(jd, lat, lon)
    lagna = int(asc // 30) + 1
    planets = get_planet_positions(jd)
    house = {p.name_en: (p.rasi_idx - lagna) % 12 + 1 for p in planets}
    moon_nak = L.nakshatra

    good: List[Dict[str, Any]] = []
    bad: List[Dict[str, Any]] = []
    unknown: List[Dict[str, Any]] = []

    # ── Good signs (p.106-107) ──
    nak_en, rasi_en = NAKSHATRA_CANONICAL[moon_nak], RASI_CANONICAL[lagna]
    nak_te, rasi_te = NAKSHATRA_TE[moon_nak], RASI_NAMES_TE[lagna]
    te_list = lambda names: ", ".join(PLANET_TE.get(n, n) for n in sorted(names))
    if moon_nak in GOOD_NAKSHATRAS:
        good.append(_row("nakshatra", "good", f"{nak_en} is one of the 17 good nakshatras", f"{nak_te} 17 శుభ నక్షత్రాలలో ఒకటి"))
    elif moon_nak in BAD_NAKSHATRAS:
        bad.append(_row("nakshatra", "bad", f"{nak_en} is one of the 10 bad nakshatras", f"{nak_te} 10 అశుభ నక్షత్రాలలో ఒకటి"))
    (good if wd in GOOD_WEEKDAYS else bad).append(_row(
        "weekday", "good" if wd in GOOD_WEEKDAYS else "bad",
        f"{WEEKDAYS_EN[wd]} " + ("is a good weekday" if wd in GOOD_WEEKDAYS else "is not among the good weekdays (Mon, Wed, Thu, Fri)"),
        f"{WEEKDAYS_TE[wd]} " + ("శుభ వారం" if wd in GOOD_WEEKDAYS else "శుభ వారాలలో (సోమ, బుధ, గురు, శుక్ర) లేదు")))
    (good if lagna in GOOD_LAGNAS else bad).append(_row(
        "lagna", "good" if lagna in GOOD_LAGNAS else "bad",
        f"{rasi_en} lagna " + ("is a good lagna" if lagna in GOOD_LAGNAS else "is not among the good lagnas"),
        f"{rasi_te} లగ్నం " + ("శుభ లగ్నం" if lagna in GOOD_LAGNAS else "శుభ లగ్నాలలో లేదు")))
    first_half = (asc % 30) < 15
    moon_hora = (lagna % 2 == 1 and not first_half) or (lagna % 2 == 0 and first_half)
    if moon_hora:
        good.append(_row("hora", "good", "Chandra hora (the Moon's half of the lagna)", "చంద్రహోర"))
    ben = [n for n in BENEFICS if house.get(n) in (1, 2, 4, 5, 7, 9, 10, 11)]
    if L.moon_waxing and house.get("Moon") in (1, 2, 4, 5, 7, 9, 10, 11):
        ben.append("Moon")
    if ben:
        good.append(_row("benefics", "good", f"Benefics in good houses: {', '.join(sorted(ben))}",
                         f"శుభగ్రహాలు శుభ స్థానాలలో: {te_list(ben)}"))
    mal_good = [n for n in MALEFICS if house.get(n) in (3, 6, 11)]
    if mal_good:
        good.append(_row("malefics_upachaya", "good", f"Malefics in 3, 6 or 11: {', '.join(sorted(mal_good))}",
                         f"పాపగ్రహాలు 3, 6, 11 స్థానాలలో: {te_list(mal_good)}"))

    # ── The 17 bad times (p.107-108) ──
    def flag(rid, en, te):
        bad.append(_row(rid, "bad", en, te))

    for k, t in (("sunrise", "సూర్యోదయ"), ("sunset", "సూర్యాస్తమయ")):
        if abs((moment - today[k]).total_seconds()) <= SANDHYA_MINUTES * 60:   # this calendar day's, so before sunrise works
            flag("sandhya", f"Within {SANDHYA_MINUTES} minutes before or after {k} (1)",
                 f"{t}నికి ముందు లేదా తర్వాత {SANDHYA_MINUTES} నిమిషాలలో (1)")
    ecl = eclipse_status(jd, moon_nak)
    if ecl.get("blocked") and ecl.get("reason") == "window" and abs(ecl.get("days", 9)) <= 1:
        flag("eclipse", f"A {ecl['kind']} eclipse on this day (2)", "గ్రహణ సమయం (2)")
    t15 = L.tithi_number
    if L.tithi in (15, 30, 23, 29):
        flag("parva_tithi", f"{L.tithi_name} ({L.paksha}) is a forbidden tithi (3)", "అమావాస్య / పూర్ణిమ / కృష్ణాష్టమి / కృష్ణ చతుర్దశి (3)")
    elif t15 in BAD_TITHIS_15:
        flag("tithi", f"{L.tithi_name} is a forbidden tithi (8)", f"{L.tithi_name} నిషిద్ధ తిథి (8)")
    if limbs_at(sr_jd).sun_rasi != limbs_at(next_sr_jd).sun_rasi:
        flag("sankranti", "A sankranti day: the Sun changes sign today (4)", "సంక్రమణ దినం (4)")
    if L.yoga in (VYATIPATA, VAIDHRITI):
        flag("vyatipata_vaidhriti", f"{L.yoga_name} yoga (5)", f"{L.yoga_name} యోగం (5)")
    if L.yoga == PARIGHA:
        y0, y1 = limb_spans(jd)["yoga"]
        if jd < (y0 + y1) / 2:
            flag("parigha", "The first half of Parigha yoga (7)", "పరిఘ యోగ పూర్వార్ధం (7)")
    if L.karana == 7:
        flag("bhadra", "Bhadra (Vishti) karana (9)", "భద్ర కరణం (9)")
    day_end = sun_next["sunrise"]
    if any(w["start"] <= moment < w["end"] for w in varjyam_windows(sun_today["sunrise"], day_end, tz)):
        flag("varjyam", "Varjyam (tyajya ghatikas) (9)", "వర్జ్యం / త్యాజ్య ఘటికలు (9)")
    if (limbs_at(next_sr_jd).tithi - limbs_at(sr_jd).tithi) % 30 >= 2:
        flag("avama", "Avama day: three tithis touch this day (10)", "అవమ తిథి: ఒకే రోజు మూడు తిథులు (10)")
    t0, t1 = limb_spans(jd)["tithi"]
    sunrises = [sr_jd + k for k in (-2, -1, 0, 1, 2)]
    if sum(1 for s in sunrises if t0 <= s <= t1) >= 3:
        flag("tridyusprik", "Tridyusprik: this tithi touches three sunrises (11)", "త్రిద్యుస్పృక్ తిథి (11)")
    if husband_rasi_idx:
        if (L.moon_rasi - int(husband_rasi_idx)) % 12 + 1 == 8:
            flag("chandrashtama", "The Moon is 8th from the husband's janma rashi (13)", "భర్త జన్మరాశికి అష్టమ చంద్రుడు (13)")
    else:
        unknown.append(_row("chandrashtama", "not_evaluated", "Husband's janma rashi not given (13)", "భర్త జన్మరాశి ఇవ్వలేదు (13)"))
    if janma_nak_idx:
        tara = (moon_nak - int(janma_nak_idx)) % 27 % 9 + 1
        if tara == 7:
            flag("nidhana_tara", "Nidhana (7th) tara from her janma nakshatra (14)", "జన్మ నక్షత్రానికి నైధన తార (14)")
    else:
        unknown.append(_row("nidhana_tara", "not_evaluated", "Her janma nakshatra not given (14)", "జన్మ నక్షత్రం ఇవ్వలేదు (14)"))
    if L.yoga in BAD_YOGAS:
        flag("bad_yoga", f"{BAD_YOGAS[L.yoga]} yoga (15)", f"{L.yoga_name} యోగం (15)")
    afflict = [p.name_en for p in planets if p.name_en in MALEFICS and int(p.longitude // (360 / 27)) + 1 == moon_nak]
    if afflict:
        flag("afflicted_nakshatra", f"{nak_en} is occupied by {', '.join(afflict)} (12, 16)", f"{nak_te} పాపగ్రహ పీడితం: {te_list(afflict)} (12, 16)")
    mal7 = [n for n in MALEFICS if house.get(n) == 7]
    if mal7:
        flag("malefic_7th", f"Malefics in the 7th from the lagna: {', '.join(mal7)} (17)", f"లగ్నానికి సప్తమంలో పాపగ్రహాలు: {te_list(mal7)} (17)")
    mp = mahapata_at(jd)
    if mp["in_mahapata"]:
        flag("mahapata", f"Mahapata ({mp['kind']}): the Sun and Moon have the same declination (6)", "మహాపాతం: సూర్య చంద్రుల క్రాంతి సమానం (6)")
    # Item 12 ("the Sun in Krittika and the other bad nakshatras") is item 16: nakshatras afflicted by the
    # Sun, Mars, Saturn, Rahu or Ketu (Dr. Nemani, 13 Nov 2026).

    return {
        "verdict": "bad" if bad else "good",
        "moment": {"weekday_en": WEEKDAYS_EN[wd], "weekday_te": WEEKDAYS_TE[wd], "tithi": f"{L.tithi_name} ({L.paksha})",
                   "nakshatra": f"{nak_en} {L.pada}", "nakshatra_te": f"{nak_te} {L.pada}", "yoga": L.yoga_name,
                   "karana": L.karana_name, "lagna": rasi_en, "lagna_te": rasi_te,
                   "hora": "Chandra" if moon_hora else "Surya"},
        "good": good, "bad": bad, "not_evaluated": unknown,
        "notes": ["Book Part 4, p.106-108. A traditional reading only; it is not medical advice.",
                  "Numbers in brackets are the book's list of 17 bad times."],
    }
