"""
People taking part in a muhurta (Input Data Master, sections 1-25).

Each event has a list of participants (groom, bride, vatu, owner...). For each person the user
may give, separately, a janma nakshatra and a nama nakshatra (section 24: never one field), or
birth date/time/place from which janma nakshatra, pada, rashi and lagna are worked out. An
unknown birth time never yields a lagna, and a nakshatra or rashi that changed during the birth
day is left unset rather than guessed (rules 3-4).

resolve_participants() turns the request's participants into the flat keys the rule engine
already reads (groom_nak_idx, owner_nama_nak_idx, birth_details["janma_nak_idx"] ...).
"""
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from jhora.panchanga import drik

from app.core.logging import logger
from app.engines.limb_timeline import limbs_at, local_to_jd
from app.services.muhurta_service import compute_d1_positions

# role -> labels and the engine keys it fills.
#   nak: activity_params key for the nakshatra used in tarabala
#   rasi: activity_params key for the janma rashi
#   primary_ok: may feed birth_details (the main person's tarabala / chandrabala / lagnashtama)
ROLES: Dict[str, Dict[str, Any]] = {
    "person":    {"en": "Person",            "te": "వ్యక్తి"},
    "groom":     {"en": "Groom",             "te": "వరుడు",          "nak": "groom_nak_idx",  "rasi": "groom_rasi_idx",  "eldest": "groom_eldest"},
    "bride":     {"en": "Bride",             "te": "వధువు",          "nak": "bride_nak_idx",  "rasi": "bride_rasi_idx",  "eldest": "bride_eldest"},
    "vatu":      {"en": "Vatu",              "te": "వటువు",           "rasi": "vatu_rasi_idx"},
    "father":    {"en": "Father",            "te": "తండ్రి",          "nak": "father_nak_idx"},
    "mother":    {"en": "Mother",            "te": "తల్లి",           "nak": "mother_nak_idx"},
    "guru":      {"en": "Guru (Acharya)",    "te": "గురువు (ఆచార్యులు)", "nak": "guru_nak_idx"},
    "student":   {"en": "Student",           "te": "విద్యార్థి"},
    "wife":      {"en": "Wife",              "te": "భార్య"},
    "husband":   {"en": "Husband",           "te": "భర్త"},
    "child":     {"en": "Child",             "te": "శిశువు"},
    "owner":     {"en": "Owner",             "te": "యజమాని",         "nak": "owner_nama_nak_idx"},
    "spouse":    {"en": "Owner's wife",      "te": "యజమానురాలు",      "nak": "spouse_nama_nak_idx"},
    "partner":   {"en": "Partner",           "te": "భాగస్వామి",        "nak": "partner_nama_nak_idx"},
    "traveller": {"en": "Traveller",         "te": "ప్రయాణించే వ్యక్తి"},
    "patient":   {"en": "Patient",           "te": "రోగి"},
    "yajamana":  {"en": "Yajamana",          "te": "యజమాని (కర్త)"},
    "karta":     {"en": "Karta",             "te": "కర్త"},
    "farmer":    {"en": "Farmer",            "te": "రైతు"},
    "buyer":     {"en": "Buyer",             "te": "కొనుగోలుదారు"},
}

# Default participants per tab (rule files may override with `participants:`).
#   level L1 = always asked; L1o = recommended: shown open but optional (11 Nov 2026, e.g. the
#   father at upanayana); L2 = optional, folded ("personal strength")
#   star_basis: janma (tarabala from the birth star) or nama (house/business rules use the name star)
#   fields: extra fields on the card besides the star widget
def _p(role, level="L2", primary=False, star_basis="janma", fields=None):
    return {"role": role, "level": level, "primary": primary, "star_basis": star_basis, "fields": fields or []}


TAB_PARTICIPANTS: Dict[str, List[Dict[str, Any]]] = {
    "vivaha":      [_p("groom", "L1", True, fields=["eldest"]), _p("bride", "L1", fields=["eldest"])],
    "upanayana":   [_p("vatu", "L1", True, fields=["birth_date"]), _p("father", "L1o"), _p("mother"), _p("guru")],
    "vidya":       [_p("student", "L1", True)],
    "griha":       [_p("owner", "L1", True, "nama"), _p("spouse", "L2", False, "nama")],
    "garbha":      [_p("wife", "L1", True), _p("husband")],
    "shishu":      [_p("child", "L1", True, fields=["birth_date", "gender"])],
    "career":      [_p("person", "L1", True)],
    "business":    [_p("owner", "L1", True, "nama"), _p("partner", "L2", False, "nama")],
    "travel":      [_p("traveller", "L1", True)],
    "health":      [_p("patient", "L1", True)],
    "spiritual":   [_p("yajamana", "L1", True)],
    "pitru":       [_p("karta", "L1", True)],
    "finance":     [_p("buyer", "L1", True, "nama")],
    "agriculture": [_p("farmer", "L1", True)],
    "personal":    [_p("person", "L1", True)],
    "general":     [_p("person", "L1", True)],
}


def participants_for(rule_participants: Optional[List[Dict[str, Any]]], tab: str,
                     tab_inputs: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    The participant list for an event, with role labels, for the catalog. Events with an
    age rule (tab_inputs: samskara_child) ask for the main person's birth date and gender.
    """
    plist = rule_participants if rule_participants else TAB_PARTICIPANTS.get(tab, [_p("person", "L1", True)])
    needs_age = "samskara_child" in (tab_inputs or [])
    out = []
    for p in plist:
        role = ROLES.get(p["role"], {"en": p["role"].title(), "te": p["role"]})
        row = {**_p(p["role"]), **p, "label_en": role["en"], "label_te": role["te"]}
        if needs_age and row.get("primary"):
            row["fields"] = list(dict.fromkeys(list(row.get("fields") or []) + ["birth_date", "gender"]))
        out.append(row)
    return out


# ── Birth details → janma nakshatra / pada / rashi / lagna ─────────────────────

def _parse_time(s: Optional[str]) -> Optional[Tuple[int, int]]:
    if not s:
        return None
    try:
        h, m = (int(x) for x in s.split(":")[:2])
        if 0 <= h < 24 and 0 <= m < 60:
            return h, m
    except ValueError:
        pass
    return None


def birth_chart_points(birth_date: date, birth_time: Optional[str], lat: float, lon: float,
                       tz_offset: float, place_name: str = "Birth place") -> Dict[str, Any]:
    """
    Janma nakshatra, pada, rashi and (with a known time) lagna.
    Without a time, the Moon is checked at the start and end of the birth day; if its
    nakshatra or rashi changed that day, the value is left out and a warning says why.
    """
    out: Dict[str, Any] = {"warnings": []}
    hm = _parse_time(birth_time)
    if hm:
        dt = datetime(birth_date.year, birth_date.month, birth_date.day, hm[0], hm[1])
        lb = limbs_at(local_to_jd(dt, tz_offset))
        out.update(janma_nak_idx=lb.nakshatra, janma_pada=lb.pada, janma_rasi_idx=lb.moon_rasi)
        try:
            _, raw_d1 = compute_d1_positions(birth_date, hm[0] + hm[1] / 60.0,
                                             drik.Place(place_name, lat, lon, tz_offset))
            if raw_d1:
                out["birth_lagna_idx"] = int(raw_d1[0][1][0]) + 1
        except (IndexError, TypeError, ValueError) as ex:
            logger.error(f"Birth lagna could not be computed: {ex}")
            out["warnings"].append("Birth lagna could not be worked out")
        return out

    start = datetime(birth_date.year, birth_date.month, birth_date.day)
    a = limbs_at(local_to_jd(start, tz_offset))
    b = limbs_at(local_to_jd(start + timedelta(hours=23, minutes=59), tz_offset))
    if a.nakshatra == b.nakshatra:
        out["janma_nak_idx"] = a.nakshatra
        if a.pada == b.pada:
            out["janma_pada"] = a.pada
    else:
        out["warnings"].append(
            f"Birth time unknown and the Moon moved from {a.nakshatra_name} to {b.nakshatra_name} that day: "
            "pick the janma nakshatra directly")
    if a.moon_rasi == b.moon_rasi:
        out["janma_rasi_idx"] = a.moon_rasi
    else:
        out["warnings"].append("Birth time unknown and the Moon changed rashi that day: pick the janma rashi directly")
    out["warnings"].append("Birth time unknown: birth lagna not used")
    return out


def _int(v) -> Optional[int]:
    try:
        return int(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def resolve_person(p: Dict[str, Any], event_place: Dict[str, Any]) -> Dict[str, Any]:
    """Fill janma details from birth data where the user didn't pick them directly."""
    out = dict(p)
    warnings: List[str] = []
    bdate = None
    if p.get("birth_date"):
        try:
            bdate = datetime.strptime(p["birth_date"], "%Y-%m-%d").date()
        except ValueError:
            warnings.append(f"Birth date '{p['birth_date']}' is not a valid date")
    # A birth date given only for an age rule is not used to guess the star.
    if bdate and p.get("from_birth") and not (p.get("janma_nak_idx") and p.get("rasi_idx")):
        lat, lon, tz = p.get("birth_lat"), p.get("birth_lon"), p.get("birth_tz_offset")
        place = p.get("birth_place") or "Birth place"
        if lat is None or lon is None or tz is None:
            lat, lon, tz, place = event_place["lat"], event_place["lon"], event_place["tz_offset"], event_place["name"]
            warnings.append("Birth place not given: used the event location")
        time = None if p.get("birth_time_unknown") else p.get("birth_time")
        if not time and not p.get("birth_time_unknown"):
            warnings.append("Birth time not given: treated as unknown")
        pts = birth_chart_points(bdate, time, lat, lon, tz, place)
        warnings += pts.pop("warnings")
        out.setdefault("computed", {}).update(pts)
        if not p.get("janma_nak_idx") and pts.get("janma_nak_idx"):
            out["janma_nak_idx"] = pts["janma_nak_idx"]
            out["janma_pada"] = pts.get("janma_pada")
        if not p.get("rasi_idx") and pts.get("janma_rasi_idx"):
            out["rasi_idx"] = pts["janma_rasi_idx"]
        if not p.get("lagna_idx") and pts.get("birth_lagna_idx"):
            out["lagna_idx"] = pts["birth_lagna_idx"]
    out["warnings"] = warnings
    return out


def _star_for(p: Dict[str, Any], basis: str) -> Tuple[Optional[int], str]:
    """The nakshatra a rule should use for this person, and which one it was."""
    janma, nama = _int(p.get("janma_nak_idx")), _int(p.get("nama_nak_idx"))
    if basis == "nama":
        return (nama, "nama") if nama else ((janma, "janma") if janma else (None, ""))
    return (janma, "janma") if janma else ((nama, "nama") if nama else (None, ""))


def resolve_participants(
    specs: List[Dict[str, Any]],
    given: List[Dict[str, Any]],
    event_place: Dict[str, Any],
    activity_params: Dict[str, Any],
    birth_details: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Resolve each given participant and write the engine keys. Returns the resolved list
    (for the response) and warnings. Keys already set by the older flat fields are kept.
    """
    spec_by_role = {s["role"]: s for s in specs}
    resolved: List[Dict[str, Any]] = []
    warnings: List[str] = []
    for g in given:
        role = g.get("role") or "person"
        spec = spec_by_role.get(role, _p(role))
        r = resolve_person(g, event_place)
        label = ROLES.get(role, {}).get("en", role)
        warnings += [f"{label}: {w}" for w in r.pop("warnings", [])]
        star, basis_used = _star_for(r, spec.get("star_basis", "janma"))
        if star and basis_used != spec.get("star_basis", "janma"):
            warnings.append(f"{label}: {spec.get('star_basis')} nakshatra not given, used the {basis_used} nakshatra")
        r["star_used"] = star
        r["star_basis_used"] = basis_used
        meta = ROLES.get(role, {})
        if meta.get("nak") and star and not activity_params.get(meta["nak"]):
            activity_params[meta["nak"]] = star
        if meta.get("rasi") and r.get("rasi_idx") and not activity_params.get(meta["rasi"]):
            activity_params[meta["rasi"]] = _int(r["rasi_idx"])
        if meta.get("eldest") and g.get("eldest"):
            activity_params[meta["eldest"]] = True
        if spec.get("primary"):
            # Age rules (samskaras, upanayana, aksharabhyasa) count from the main person's birth.
            if g.get("birth_date") and not activity_params.get("child_dob"):
                activity_params["child_dob"] = g["birth_date"]
            if g.get("gender") and not activity_params.get("child_gender"):
                activity_params["child_gender"] = g["gender"]
            if star and not birth_details.get("janma_nak_idx"):
                birth_details["janma_nak_idx"] = star
            if r.get("rasi_idx") and not birth_details.get("janma_moon_rasi_idx"):
                birth_details["janma_moon_rasi_idx"] = _int(r["rasi_idx"])
            if r.get("lagna_idx") and not birth_details.get("birth_lagna_idx"):
                birth_details["birth_lagna_idx"] = _int(r["lagna_idx"])
            if g.get("name") and not birth_details.get("person_name"):
                birth_details["person_name"] = g["name"]
            if g.get("gotra") and not birth_details.get("gotra"):
                birth_details["gotra"] = g["gotra"]
        resolved.append({k: v for k, v in r.items() if k not in ("birth_lat", "birth_lon", "birth_tz_offset")})
    return resolved, warnings
