"""
Dosha engine: the 21 Mahadoshas (Book Part 2, "Muhurtamlo 21 Mahadoshalu") and the
10 Dashavidha doshas (Book Part 2, "Dashavidha doshalu"), implementing plan M11 / M12.

Every check returns one row:
  id, number, name_en, name_te,
  status     'pass' | 'fail' | 'not_evaluated' | 'not_applicable'
  is_pass    True (pass / not_applicable), False (fail), None (not_evaluated)
  score      10 / 0 / None
  severity   'fatal' | 'serious' | 'mild' | 'info'
  desc_en, desc_te, book_ref

A check that lacks the data it needs reports 'not_evaluated'; it never reports a pass.

Time-based checks need `context` (built by the rule interpreter for each candidate window):
  jd            UT Julian day of the window midpoint
  day           date of the muhurta
  window        (start, end) local datetimes of the candidate window
  lagna_window  (start, end) local datetimes of the whole lagna
  varjyam       [(start, end), ...] local datetimes
  durmuhurta    [(start, end), ...] local datetimes
  tz_offset     hours
  category      rule category ('vivaha', 'griha', ...)
  kartari       'none' | 'all' | 'agni' (which Surya kartari applies to the event)
  limbs_checked list of limbs the event's rule constrains ('tithi', 'vara', 'nakshatra', ...)
  participants  [{'label': str, 'janma_rasi': 1-12, 'janma_lagna': 1-12}, ...]
"""
from typing import Any, Dict, List, Optional, Tuple

from app.engines.vocab import (
    DOSHIC_YOGAS, NAKSHATRA_CANONICAL, NATURAL_MALEFICS, PLANET_NAME, PLANET_NAME_TE,
    RASI_CANONICAL, SIGN_LORD, YOGA_CANONICAL, is_benefic, lords_compatible,
)

NAK_SPAN = 360.0 / 27.0
GHATI_HOURS = 0.4

# Kept for backward compatibility with older imports.
PLANET_NAMES_MAP = {
    "0": "Sun", "1": "Moon", "2": "Mars", "3": "Mercury", "4": "Jupiter",
    "5": "Venus", "6": "Saturn", "7": "Rahu", "8": "Ketu",
    "Mnd": "Mandi", "Gk": "Gulika"
}

SEVERE_FOR_SCORING = ("fatal", "serious")


# ─────────────────────────────────────────────────────────────────────────────
# Chart helpers
# ─────────────────────────────────────────────────────────────────────────────
class _Chart:
    """Planet longitudes (sidereal) from the PyJHora D1 list [(pid, (rasi0, deg)), ...]."""

    def __init__(self, raw_d1: List[Any], muhurta_lagna_idx: int, retro_ids: Optional[set] = None):
        self.lon: Dict[int, float] = {}
        self.lagna_lon: Optional[float] = None
        for item in raw_d1 or []:
            try:
                pid, (r0, deg) = item[0], item[1]
            except (TypeError, ValueError):
                continue
            lon = (int(r0) * 30.0 + float(deg)) % 360.0
            if str(pid) == "L":
                self.lagna_lon = lon
                continue
            try:
                self.lon[int(pid)] = lon
            except (TypeError, ValueError):
                continue  # Mandi / Gulika markers
        self.lagna = int(muhurta_lagna_idx)
        self.retro = set(retro_ids or set()) | {7, 8}  # nodes always retrograde
        s, m = self.lon.get(0), self.lon.get(1)
        self.moon_waxing = bool(s is not None and m is not None and (m - s) % 360.0 < 180.0)

    def has(self, *pids: int) -> bool:
        return all(p in self.lon for p in pids)

    def sign(self, pid: int) -> int:
        return int(self.lon[pid] // 30.0) + 1

    def nak(self, pid: int) -> int:
        return int(self.lon[pid] // NAK_SPAN) + 1

    def house(self, pid: int) -> int:
        return (self.sign(pid) - self.lagna) % 12 + 1

    def in_house(self, h: int) -> List[int]:
        return [p for p in self.lon if self.house(p) == h]

    def in_sign(self, sign: int) -> List[int]:
        return [p for p in self.lon if self.sign(p) == sign]

    def benefic(self, pid: int) -> bool:
        return is_benefic(pid, self.moon_waxing)

    def aspects_sign(self, pid: int, sign: int) -> bool:
        """Full (Parashari) aspects: all planets 7th; Mars 4/8; Jupiter 5/9; Saturn 3/10."""
        dist = (sign - self.sign(pid)) % 12 + 1
        special = {2: {4, 8}, 4: {5, 9}, 6: {3, 10}}.get(pid, set())
        return dist == 7 or dist in special


def _names(pids) -> Tuple[str, str]:
    pids = list(pids)
    return ", ".join(PLANET_NAME[p] for p in pids), ", ".join(PLANET_NAME_TE[p] for p in pids)


def _overlaps(a: Tuple[Any, Any], spans: List[Tuple[Any, Any]]) -> Optional[Tuple[Any, Any]]:
    for s in spans or []:
        if a[0] < s[1] and a[1] > s[0]:
            return s
    return None


def _row(num: int, did: str, name_en: str, name_te: str, status: str, severity: str,
         desc_en: str, desc_te: str, ref: str) -> Dict[str, Any]:
    return {
        "id": did,
        "number": num,
        "name_en": f"{num}. {name_en}",
        "name_te": f"{num}. {name_te}",
        "status": status,
        "is_pass": {"pass": True, "not_applicable": True, "fail": False}.get(status),
        "score": {"pass": 10, "not_applicable": 10, "fail": 0}.get(status),
        "severity": severity,
        "desc_en": desc_en,
        "desc_te": desc_te,
        "book_ref": ref,
    }


_NE_EN = "Not evaluated: the data this check needs was not supplied."
_NE_TE = "పరిశీలించబడలేదు: ఈ పరీక్షకు అవసరమైన వివరాలు ఇవ్వబడలేదు."


def _limbs_from_chart(ch: _Chart):
    from app.engines.limb_timeline import limbs_from_longitudes
    if not ch.has(0, 1):
        return None
    return limbs_from_longitudes(ch.lon[0], ch.lon[1])


def _nak28(lon: float) -> int:
    """Nakshatra index 1-28 counting Abhijit (Makara 6°40' to 10°53'20")."""
    ab_s, ab_e = 276.0 + 40.0 / 60.0, 280.0 + 53.0 / 60.0 + 20.0 / 3600.0
    n27 = int(lon // NAK_SPAN) + 1
    if ab_s <= lon < ab_e:
        return 22
    return n27 if n27 <= 21 else n27 + 1


# ─────────────────────────────────────────────────────────────────────────────
# 21 Mahadoshas
# ─────────────────────────────────────────────────────────────────────────────
def evaluate_21_maha_doshas(
    panchang: Dict[str, Any],
    d1_positions: List[Dict[str, Any]],
    raw_d1: List[Any],
    muhurta_lagna_idx: int,
    birth_details: Optional[Dict[str, Any]] = None,
    context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    ctx = context or {}
    retro = {int(p["planet"]) for p in (d1_positions or [])
             if p.get("is_retro") and str(p.get("planet", "")).isdigit()}
    ch = _Chart(raw_d1, muhurta_lagna_idx, retro)
    lb = ctx.get("limbs") or _limbs_from_chart(ch)
    category = ctx.get("category") or ""
    is_vivaha = category == "vivaha"
    participants = ctx.get("participants") or _participants_from_birth(birth_details)
    ref = "Part 2, 21 Mahadoshas"
    out: List[Dict[str, Any]] = []

    # 1. Panchanga shuddhi-hina
    checked = ctx.get("limbs_checked")
    if checked is None:
        out.append(_row(1, "panchanga_shuddhi_heenamu", "Panchanga Shuddhi-hina", "పంచాంగ శుద్ధిహీనము",
                        "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #1"))
    else:
        lst = ", ".join(checked) if checked else "none"
        out.append(_row(1, "panchanga_shuddhi_heenamu", "Panchanga Shuddhi-hina", "పంచాంగ శుద్ధిహీనము",
                        "pass", "serious",
                        f"The window satisfies every limb this event's rule specifies ({lst}).",
                        f"ఈ కార్యానికి నిర్దేశించిన పంచాంగ అంగాలు ({lst}) అన్నీ సరిపోయాయి.", f"{ref} #1"))

    # 2. Sankranti ahas
    if ctx.get("jd") is None:
        out.append(_row(2, "sankranti_ahassu", "Sankranti Ahas", "సంక్రాంతి అహస్సు",
                        "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #2"))
    else:
        from app.engines.limb_timeline import sankranti_proximity
        sp = sankranti_proximity(ctx["jd"])
        if sp["in_window"]:
            sign = RASI_CANONICAL[sp["sign"]]
            rel = "before" if sp["relation"] == "before" else "after"
            rel_te = "ముందు" if rel == "before" else "తరువాత"
            out.append(_row(2, "sankranti_ahassu", "Sankranti Ahas", "సంక్రాంతి అహస్సు", "fail", "serious",
                            f"Within {sp['limit_ghatis']:.0f} ghatis {rel} the Sun's entry into {sign} ({sp['hours']:.1f} h).",
                            f"{sign} సంక్రమణానికి {sp['limit_ghatis']:.0f} ఘటికల లోపు ({rel_te}) ఉంది.", f"{ref} #2"))
        else:
            out.append(_row(2, "sankranti_ahassu", "Sankranti Ahas", "సంక్రాంతి అహస్సు", "pass", "serious",
                            "Clear of the sankranti window.", "సంక్రమణ దోషం లేదు.", f"{ref} #2"))

    # 3. Papa shadvarga
    out.append(_papa_shadvarga(ch, ref))

    # 4. Kunavamsa (marriage lagna)
    if not is_vivaha:
        out.append(_row(4, "kunavamshamu", "Kunavamsa", "కునవాంశము", "not_applicable", "serious",
                        "Applies to the marriage lagna only.", "వివాహ లగ్నానికి మాత్రమే వర్తిస్తుంది.", f"{ref} #4"))
    elif ch.lagna_lon is None:
        out.append(_row(4, "kunavamshamu", "Kunavamsa", "కునవాంశము", "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #4"))
    else:
        nav = int(ch.lagna_lon * 9.0 / 30.0) % 12 + 1
        bad = SIGN_LORD[nav] in (0, 2, 6) or nav == 4
        out.append(_row(4, "kunavamshamu", "Kunavamsa", "కునవాంశము", "fail" if bad else "pass", "serious",
                        f"Lagna navamsa {RASI_CANONICAL[nav]} " + ("belongs to a malefic or is Karkataka." if bad else "is a benefic navamsa."),
                        f"లగ్న నవాంశ {RASI_CANONICAL[nav]} " + ("పాప/కర్కాటక నవాంశ." if bad else "శుభ నవాంశ."), f"{ref} #4"))

    # 5. Kujashtama
    out.append(_house_check(ch, 5, "kujashtamamu", "Kujashtama", "కుజాష్టమము", 2, 8,
                            "Mars", "కుజుడు", ref))
    # 6. Bhrigu shashta
    out.append(_house_check(ch, 6, "bhrigu_shashtamu", "Bhrigu Shashta", "భృగుషష్టము", 5, 6,
                            "Venus", "శుక్రుడు", ref))

    # 7. Kartari
    out.append(_kartari(ch, ctx, ref))

    # 8. Lagnashtama
    out.append(_lagnashtama(ch, participants, ref))

    # 9. Chandrashtama (Moon from janma Moon)
    rasis = [(p["label"], p["janma_rasi"]) for p in participants if p.get("janma_rasi")]
    if not rasis or not ch.has(1):
        out.append(_row(9, "ashtama_chandrudu", "Chandrashtama", "చంద్రాష్టమము", "not_evaluated", "serious",
                        "Not evaluated: needs the janma rashi.", "జన్మ రాశి ఇవ్వనందున పరిశీలించబడలేదు.", f"{ref} #9"))
    else:
        hits = [lbl for lbl, r in rasis if (ch.sign(1) - r) % 12 + 1 == 8]
        out.append(_row(9, "ashtama_chandrudu", "Chandrashtama", "చంద్రాష్టమము", "fail" if hits else "pass", "serious",
                        (f"Transit Moon is 8th from the janma rashi of {', '.join(hits)}." if hits
                         else "Transit Moon is not 8th from any janma rashi."),
                        (f"{', '.join(hits)} జన్మ రాశికి గోచర చంద్రుడు 8వ స్థానంలో ఉన్నాడు." if hits
                         else "చంద్రాష్టమ దోషం లేదు."), f"{ref} #9"))

    # 10. Shashtashtarishpha chandra
    if not ch.has(1):
        out.append(_row(10, "shashtashta_rihpha_chandra", "Shashtashtarishpha Chandra", "షష్టాష్టరిఃఫ చంద్రుడు",
                        "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #10"))
    else:
        h = ch.house(1)
        bad = h in (6, 8, 12)
        out.append(_row(10, "shashtashta_rihpha_chandra", "Shashtashtarishpha Chandra", "షష్టాష్టరిఃఫ చంద్రుడు",
                        "fail" if bad else "pass", "serious",
                        f"Moon is in house {h} from the muhurta lagna.",
                        f"ముహూర్త లగ్నం నుండి చంద్రుడు {h}వ స్థానంలో ఉన్నాడు.", f"{ref} #10"))

    # 11. Sagraha chandra
    out.append(_sagraha_chandra(ch, is_vivaha, 11, "sagraha_chandrudu", ref))

    # 12. Vara-janita durmuhurta touching the lagna
    lw = ctx.get("lagna_window")
    if lw is None or ctx.get("durmuhurta") is None:
        out.append(_row(12, "vaara_durmuhurtam", "Vara-janita Durmuhurta", "వారజనిత దుర్ముహూర్తము",
                        "not_evaluated", "fatal", _NE_EN, _NE_TE, f"{ref} #12"))
    else:
        hit = _overlaps(lw, ctx["durmuhurta"])
        out.append(_row(12, "vaara_durmuhurtam", "Vara-janita Durmuhurta", "వారజనిత దుర్ముహూర్తము",
                        "fail" if hit else "pass", "fatal",
                        (f"Durmuhurta {hit[0]:%H:%M}–{hit[1]:%H:%M} touches this lagna." if hit
                         else "No durmuhurta touches this lagna."),
                        (f"దుర్ముహూర్తం {hit[0]:%H:%M}–{hit[1]:%H:%M} ఈ లగ్నాన్ని తాకుతోంది." if hit
                         else "ఈ లగ్నాన్ని ఏ దుర్ముహూర్తం తాకడం లేదు."), f"{ref} #12"))

    # 13. Kharjurika / Ekargala (Method A)
    out.append(_ekargala(ch, lb, 13, "kharjurika_ekargala", "Kharjurika (Ekargala)", "ఖార్జూరిక (ఏకార్గళ)", ref))

    # 14. Grahana
    if ctx.get("jd") is None or lb is None:
        out.append(_row(14, "grahanamulu", "Grahana", "గ్రహణములు", "not_evaluated", "fatal", _NE_EN, _NE_TE, f"{ref} #14"))
    else:
        from app.engines.limb_timeline import eclipse_status
        es = eclipse_status(ctx["jd"], lb.nakshatra)
        if es["blocked"]:
            kind = "Total" if es["total"] else "Partial"
            kind_te = "సంపూర్ణ" if es["total"] else "పాక్షిక"
            ek = "solar" if es["kind"] == "solar" else "lunar"
            ek_te = "సూర్య" if ek == "solar" else "చంద్ర"
            if es["reason"] == "window":
                en = f"{kind} {ek} eclipse {abs(es['days'])} days {'ago' if es['days'] >= 0 else 'ahead'}; inside the eclipse block."
                te = f"{kind_te} {ek_te} గ్రహణ నిషిద్ధ కాలంలో ఉంది."
            else:
                en = f"Moon is in {es['nakshatra']}, the nakshatra of the {ek} eclipse {es['days']} days ago (unfit for 6 months)."
                te = f"{es['nakshatra']} గ్రహణ నక్షత్రం (6 నెలలు నిషిద్ధం)."
            out.append(_row(14, "grahanamulu", "Grahana", "గ్రహణములు", "fail", "fatal", en, te, f"{ref} #14"))
        else:
            out.append(_row(14, "grahanamulu", "Grahana", "గ్రహణములు", "pass", "fatal",
                            "No eclipse block and not an eclipse nakshatra.", "గ్రహణ దోషం లేదు.", f"{ref} #14"))

    # 15. Utpata (manual calendar)
    if ctx.get("day") is None:
        out.append(_row(15, "utpatamulu", "Utpata", "ఉత్పాతములు", "not_evaluated", "fatal", _NE_EN, _NE_TE, f"{ref} #15"))
    else:
        from app.engines.limb_timeline import utpata_on
        u = utpata_on(ctx["day"])
        out.append(_row(15, "utpatamulu", "Utpata", "ఉత్పాతములు", "fail" if u else "pass", "fatal",
                        (f"Utpata recorded for this date: {u.get('note_en', '')}" if u
                         else "No utpata recorded for this date."),
                        (f"ఈ తేదీకి ఉత్పాతం నమోదైంది: {u.get('note_te', '')}" if u
                         else "ఈ తేదీకి ఉత్పాతం నమోదు కాలేదు."), f"{ref} #15"))

    # 16. Krura yugdhishnya
    out.append(_krura_viddha(ch, ref))

    # 17. Ashubha viddha (vedha) — chakra not in the book
    out.append(_row(17, "ashubha_vedha", "Ashubha Viddha (Vedha)", "అశుభవిద్ధము", "not_evaluated", "serious",
                    "Not evaluated: the book does not give the shalaka (vedha) chakra; awaiting the author.",
                    "శలాకా వేధ చక్రం గ్రంథంలో లేదు; రచయిత నుండి రావలసి ఉంది.", f"{ref} #17"))

    # 18. Vishayuta lagna (varjyam touches the lagna)
    if lw is None or ctx.get("varjyam") is None:
        out.append(_row(18, "vishayuta_lagnamu", "Vishayuta Lagna", "విషయుత లగ్నము", "not_evaluated", "fatal",
                        _NE_EN, _NE_TE, f"{ref} #18"))
    else:
        hit = _overlaps(lw, ctx["varjyam"])
        out.append(_row(18, "vishayuta_lagnamu", "Vishayuta Lagna", "విషయుత లగ్నము", "fail" if hit else "pass", "fatal",
                        (f"Varjyam {hit[0]:%H:%M}–{hit[1]:%H:%M} touches this lagna. No concession, even in pushkaramsa." if hit
                         else "No varjyam touches this lagna."),
                        (f"వర్జ్యం {hit[0]:%H:%M}–{hit[1]:%H:%M} ఈ లగ్నాన్ని తాకుతోంది (పుష్కరాంశలో కూడా మినహాయింపు లేదు)." if hit
                         else "ఈ లగ్నాన్ని వర్జ్యం తాకడం లేదు."), f"{ref} #18"))

    # 19. Lagnasta (astamsa) — marriage lagna
    out.append(_lagnasta(ch, is_vivaha, ref))

    # 20. Gandanta
    out.append(_gandanta(ch, ctx, lb, ref))

    # 21. Vyatipata / Vaidhriti (+ the other seven for marriage and samskaras)
    if lb is None:
        out.append(_row(21, "vyatipata_vaidhriti", "Vyatipata and Vaidhriti", "వ్యతీపాత వైధృతి యోగములు",
                        "not_evaluated", "fatal", _NE_EN, _NE_TE, f"{ref} #21"))
    else:
        y = lb.yoga
        strict_set = DOSHIC_YOGAS if category in ("vivaha", "samskaras") else {17, 27}
        bad = y in strict_set
        out.append(_row(21, "vyatipata_vaidhriti", "Vyatipata and Vaidhriti", "వ్యతీపాత వైధృతి యోగములు",
                        "fail" if bad else "pass", "fatal",
                        (f"{YOGA_CANONICAL[y]} yoga is running at this time." if bad
                         else f"{YOGA_CANONICAL[y]} yoga is acceptable."),
                        (f"ఈ సమయంలో {YOGA_CANONICAL[y]} యోగం నడుస్తోంది (నిషిద్ధం)." if bad
                         else f"{YOGA_CANONICAL[y]} యోగం దోషరహితం."), f"{ref} #21"))
    return out


def _participants_from_birth(bd: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not bd:
        return []
    p = {"label": bd.get("person_name") or "the person"}
    if bd.get("janma_moon_rasi_idx"):
        p["janma_rasi"] = int(bd["janma_moon_rasi_idx"])
    if bd.get("birth_lagna_idx"):
        p["janma_lagna"] = int(bd["birth_lagna_idx"])
    return [p] if len(p) > 1 else []


def _house_check(ch, num, did, en, te, pid, house, pen, pte, ref):
    if not ch.has(pid):
        return _row(num, did, en, te, "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #{num}")
    bad = ch.house(pid) == house
    return _row(num, did, en, te, "fail" if bad else "pass", "serious",
                f"{pen} is in house {ch.house(pid)} from the lagna.",
                f"లగ్నం నుండి {pte} {ch.house(pid)}వ స్థానంలో ఉన్నాడు.", f"{ref} #{num}")


def _varga_lords(lagna_lon: float) -> List[Tuple[str, int]]:
    s = int(lagna_lon // 30.0) + 1
    d = lagna_lon % 30.0
    odd = s % 2 == 1
    hora = (0 if d < 15 else 1) if odd else (1 if d < 15 else 0)
    drek = (s - 1 + 4 * int(d // 10.0)) % 12 + 1
    nav = int(lagna_lon * 9.0 / 30.0) % 12 + 1
    dwad = (s - 1 + int(d // 2.5)) % 12 + 1
    if odd:
        trim = 2 if d < 5 else 6 if d < 10 else 4 if d < 18 else 3 if d < 25 else 5
    else:
        trim = 5 if d < 5 else 3 if d < 12 else 4 if d < 20 else 6 if d < 25 else 2
    return [("lagna", SIGN_LORD[s]), ("hora", hora), ("drekkana", SIGN_LORD[drek]),
            ("navamsa", SIGN_LORD[nav]), ("dwadashamsa", SIGN_LORD[dwad]), ("trimshamsa", trim)]


def _papa_shadvarga(ch: _Chart, ref: str) -> Dict[str, Any]:
    num, did, en, te = 3, "papa_shadvargamu", "Papa Shadvarga", "పాప షడ్వర్గము"
    if ch.lagna_lon is None or len(ch.lon) < 7:
        return _row(num, did, en, te, "not_evaluated", "mild", _NE_EN, _NE_TE, f"{ref} #3")
    weak = []
    for varga, lord in _varga_lords(ch.lagna_lon):
        if lord not in ch.lon:
            continue
        ok = (ch.benefic(lord)
              or is_benefic(SIGN_LORD[ch.sign(lord)], ch.moon_waxing)
              or any(ch.benefic(p) for p in ch.in_sign(ch.sign(lord)) if p != lord))
        if not ok:
            weak.append(f"{varga} ({PLANET_NAME[lord]})")
    bad = bool(weak)
    return _row(num, did, en, te, "fail" if bad else "pass", "mild",
                (f"Shadvarga lords neither benefic, in a benefic sign, nor with a benefic: {', '.join(weak)}." if bad
                 else "All six varga lords of the lagna are benefic, in benefic signs, or with benefics."),
                ("లగ్న షడ్వర్గాధిపతులలో కొందరు శుభ సంబంధం లేకుండా ఉన్నారు: " + ", ".join(weak) if bad
                 else "లగ్న షడ్వర్గాధిపతులు అందరూ శుభ సంబంధంతో ఉన్నారు."),
                f"{ref} #3 (interpretation pending author review)")


def _kartari(ch: _Chart, ctx: Dict[str, Any], ref: str) -> Dict[str, Any]:
    num, did, en, te = 7, "kartari_dosham", "Kartari", "కర్తరి దోషము"
    if not ch.lon:
        return _row(num, did, en, te, "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #7")
    reasons_en, reasons_te = [], []
    m12 = [p for p in ch.in_house(12) if p in NATURAL_MALEFICS and p in ch.retro]
    m2 = [p for p in ch.in_house(2) if p in NATURAL_MALEFICS and p not in ch.retro]
    if m12 and m2:
        reasons_en.append(f"Gala kartari: retrograde {_names(m12)[0]} in the 12th and direct {_names(m2)[0]} in the 2nd.")
        reasons_te.append(f"గళ కర్తరి: 12వ స్థానంలో వక్ర {_names(m12)[1]}, 2వ స్థానంలో {_names(m2)[1]}.")
    mode = ctx.get("kartari", "none")
    if mode in ("all", "agni") and ch.has(0):
        s = ch.lon[0]
        agni = 26.0 + 40.0 / 60.0 <= s < 40.0
        chinna = 20.0 <= s < 26.0 + 40.0 / 60.0 or 40.0 <= s < 43.0 + 20.0 / 60.0
        if agni or (mode == "all" and chinna):
            kind = "Agni kartari (Sun in Krittika)" if agni else "Surya kartari (Sun in Bharani 3–4 or Rohini 1)"
            reasons_en.append(f"{kind} applies to this event.")
            reasons_te.append("సూర్య కర్తరి (అగ్ని కర్తరి) ఈ కార్యానికి వర్తిస్తుంది." if agni
                              else "సూర్య కర్తరి (ఛిన్న కర్తరి) ఈ కార్యానికి వర్తిస్తుంది.")
    bad = bool(reasons_en)
    return _row(num, did, en, te, "fail" if bad else "pass", "serious",
                " ".join(reasons_en) if bad else "No gala kartari; Surya kartari does not apply or is not active.",
                " ".join(reasons_te) if bad else "కర్తరి దోషం లేదు.", f"{ref} #7; Part 1 Kartari")


def _lagnashtama(ch: _Chart, participants, ref: str) -> Dict[str, Any]:
    num, did, en, te = 8, "lagnashtamamu", "Lagnashtama", "లగ్నాష్టమము"
    refs = []
    for p in participants:
        for key, word in (("janma_lagna", "janma lagna"), ("janma_rasi", "janma rashi")):
            if p.get(key):
                refs.append((p["label"], word, int(p[key])))
    if not refs:
        return _row(num, did, en, te, "not_evaluated", "serious",
                    "Not evaluated: needs the janma lagna or janma rashi.", "జన్మ లగ్నం/రాశి ఇవ్వనందున పరిశీలించబడలేదు.",
                    f"{ref} #8")
    hits, exempt = [], []
    for label, word, sign in refs:
        if (ch.lagna - sign) % 12 + 1 == 8:
            (exempt if lords_compatible(sign, ch.lagna) else hits).append(f"{label} ({word} {RASI_CANONICAL[sign]})")
    if hits:
        return _row(num, did, en, te, "fail", "serious",
                    f"Muhurta lagna {RASI_CANONICAL[ch.lagna]} is 8th from: {', '.join(hits)}.",
                    f"ముహూర్త లగ్నం {RASI_CANONICAL[ch.lagna]} 8వ స్థానం: {', '.join(hits)}.", f"{ref} #8")
    if exempt:
        return _row(num, did, en, te, "pass", "serious",
                    f"8th from {', '.join(exempt)}, but the lords are the same or friendly, so no dosha.",
                    "అష్టమ లగ్నమైనా అధిపతుల మైత్రి వల్ల దోషం లేదు.", f"{ref} #8")
    return _row(num, did, en, te, "pass", "serious", "Muhurta lagna is not 8th from any janma lagna or rashi.",
                "లగ్నాష్టమ దోషం లేదు.", f"{ref} #8")


_COMPANION_EFFECT = {0: "poverty", 2: "danger", 3: "childlessness", 4: "misfortune",
                     5: "co-wife", 6: "renunciation", 7: "quarrel", 8: "sorrow"}


def _sagraha_chandra(ch: _Chart, is_vivaha: bool, num: int, did: str, ref: str) -> Dict[str, Any]:
    en, te = "Sagraha Chandra", "సగ్రహ చంద్రుడు"
    if not ch.has(1):
        return _row(num, did, en, te, "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #11")
    comp = [p for p in ch.in_sign(ch.sign(1)) if p != 1]
    seventh = is_vivaha and ch.house(1) == 7
    if comp or seventh:
        parts_en, parts_te = [], []
        if comp:
            eff = "; ".join(f"{PLANET_NAME[p]}: {_COMPANION_EFFECT.get(p, '')}" for p in comp)
            parts_en.append(f"Moon shares its sign with {_names(comp)[0]} (traditional effects — {eff}).")
            parts_te.append(f"చంద్రునితో {_names(comp)[1]} కలిసి ఉన్నారు.")
        if seventh:
            parts_en.append("For marriage the Moon must not be in the 7th.")
            parts_te.append("వివాహానికి చంద్రుడు 7వ స్థానంలో ఉండరాదు.")
        return _row(num, did, en, te, "fail", "serious", " ".join(parts_en), " ".join(parts_te), f"{ref} #11")
    return _row(num, did, en, te, "pass", "serious", "Moon is alone in its sign.", "చంద్రుడు ఒంటరిగా ఉన్నాడు.", f"{ref} #11")


def _ekargala(ch: _Chart, lb, num: int, did: str, en: str, te: str, ref: str) -> Dict[str, Any]:
    if lb is None or not ch.has(0, 1):
        return _row(num, did, en, te, "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #13")
    if lb.yoga not in DOSHIC_YOGAS:
        return _row(num, did, en, te, "pass", "serious",
                    f"{YOGA_CANONICAL[lb.yoga]} is not one of the nine doshic yogas, so ekargala cannot form.",
                    "దోష యోగం లేనందున ఏకార్గళ దోషం లేదు.", f"{ref} #13")
    count = (_nak28(ch.lon[1]) - _nak28(ch.lon[0])) % 28 + 1
    bad = count % 2 == 1
    return _row(num, did, en, te, "fail" if bad else "pass", "serious",
                f"{YOGA_CANONICAL[lb.yoga]} is running; count from the Sun's nakshatra to the Moon's (with Abhijit) is {count}"
                + (" (odd: dosha)." if bad else " (even: clean)."),
                f"{YOGA_CANONICAL[lb.yoga]} యోగం; సూర్య నక్షత్రం నుండి చంద్ర నక్షత్రం వరకు లెక్క {count}"
                + (" (బేసి: దోషం)." if bad else " (సరి: దోషం లేదు)."),
                f"{ref} #13 (Method A; Method B figure awaited from the author)")


def _krura_viddha(ch: _Chart, ref: str) -> Dict[str, Any]:
    num, did, en, te = 16, "krura_yurdhishnyamu", "Krura Yugdhishnya", "క్రూర యుగ్ధిష్ణ్యము"
    if not ch.has(1):
        return _row(num, did, en, te, "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #16")
    n = ch.nak(1)
    benefic_with = any(ch.benefic(p) for p in ch.lon if p != 1 and ch.nak(p) == n)
    jwalita, other = [], []
    for p in ch.lon:
        if p not in NATURAL_MALEFICS:
            continue
        pn = ch.nak(p)
        step = -1 if p in (7, 8) else 1  # nodes move backwards through the nakshatras
        nxt, prev = (pn - 1 + step) % 27 + 1, (pn - 1 - step) % 27 + 1
        if pn == n:
            jwalita.append(PLANET_NAME[p])
        elif n == nxt:
            other.append(f"dhumita by {PLANET_NAME[p]}")
        elif n == prev:
            other.append(f"bhasmita by {PLANET_NAME[p]}")
    nak = NAKSHATRA_CANONICAL[n]
    if jwalita:
        return _row(num, did, en, te, "fail", "serious",
                    f"{nak} is jwalita: occupied by {', '.join(jwalita)}.",
                    f"{nak} జ్వలిత నక్షత్రం (పాపగ్రహ స్థితి).", f"{ref} #16")
    if other and not benefic_with:
        return _row(num, did, en, te, "fail", "serious",
                    f"{nak} is {', '.join(other)}, with no benefic in it.",
                    f"{nak} ధూమిత/భస్మిత నక్షత్రం, శుభగ్రహ సహాయం లేదు.", f"{ref} #16")
    note = f" ({', '.join(other)}, relieved by a benefic)" if other else ""
    return _row(num, did, en, te, "pass", "serious", f"{nak} is not afflicted by a malefic{note}.",
                f"{nak} క్రూర వేధ రహితం.", f"{ref} #16")


def _lagnasta(ch: _Chart, is_vivaha: bool, ref: str) -> Dict[str, Any]:
    num, did, en, te = 19, "lagnastra_dosham", "Lagnasta (Astamsa)", "లగ్నాస్త దోషము"
    if not is_vivaha:
        return _row(num, did, en, te, "not_applicable", "serious", "Applies to the marriage lagna only.",
                    "వివాహ లగ్నానికి మాత్రమే వర్తిస్తుంది.", f"{ref} #19")
    if ch.lagna_lon is None or not ch.lon:
        return _row(num, did, en, te, "not_evaluated", "serious", _NE_EN, _NE_TE, f"{ref} #19")
    nav = int(ch.lagna_lon * 9.0 / 30.0) % 12 + 1
    ast = (nav + 5) % 12 + 1
    mal = [p for p in ch.lon if p in NATURAL_MALEFICS and (ch.sign(p) == ast or ch.aspects_sign(p, ast))]
    lord = SIGN_LORD[ch.lagna]
    lord_ok = lord in ch.lon and (ch.sign(lord) == nav or ch.aspects_sign(lord, nav))
    note = " The lagna lord joins or aspects the lagna navamsa." if lord_ok else " The lagna lord does not join or aspect the lagna navamsa."
    if mal:
        return _row(num, did, en, te, "fail", "serious",
                    f"Astamsa {RASI_CANONICAL[ast]} (7th from navamsa {RASI_CANONICAL[nav]}) has malefic influence: {_names(mal)[0]}.{note}",
                    f"అస్తాంశ {RASI_CANONICAL[ast]} పై పాపగ్రహ ప్రభావం: {_names(mal)[1]}.", f"{ref} #19")
    return _row(num, did, en, te, "pass", "serious",
                f"Astamsa {RASI_CANONICAL[ast]} is free of malefic influence.{note}",
                f"అస్తాంశ {RASI_CANONICAL[ast]} పాపగ్రహ రహితం.", f"{ref} #19")


def _gandanta(ch: _Chart, ctx: Dict[str, Any], lb, ref: str) -> Dict[str, Any]:
    num, did, en, te = 20, "gandantam", "Gandanta", "గండాంతము"
    jd, win, lw = ctx.get("jd"), ctx.get("window"), ctx.get("lagna_window")
    if jd is None or win is None or lw is None or lb is None:
        return _row(num, did, en, te, "not_evaluated", "fatal", _NE_EN, _NE_TE, f"{ref} #20")
    from datetime import timedelta
    from app.engines.limb_timeline import jd_to_local, nakshatra_bounds, tithi_bounds
    tz = ctx["tz_offset"]
    hits_en, hits_te = [], []
    g4 = timedelta(hours=4 * GHATI_HOURS)

    # Nakshatra gandanta: last 4 ghatis of Ashlesha/Jyeshtha/Revati, first 4 of Magha/Mula/Ashwini
    ns, ne = (jd_to_local(x, tz) for x in nakshatra_bounds(jd))
    if lb.nakshatra in (9, 18, 27) and _overlaps(win, [(ne - g4, ne)]):
        hits_en.append(f"last 4 ghatis of {lb.nakshatra_name}")
        hits_te.append(f"{lb.nakshatra_name} చివరి 4 ఘటికలు")
    if lb.nakshatra in (10, 19, 1) and _overlaps(win, [(ns, ns + g4)]):
        hits_en.append(f"first 4 ghatis of {lb.nakshatra_name}")
        hits_te.append(f"{lb.nakshatra_name} మొదటి 4 ఘటికలు")

    # Rashi (lagna) gandanta: last half-ghati of Karkataka/Vrischika/Meena, first of Simha/Dhanus/Mesha
    half = timedelta(hours=0.5 * GHATI_HOURS)
    if ch.lagna in (4, 8, 12) and _overlaps(win, [(lw[1] - half, lw[1])]):
        hits_en.append(f"last half-ghati of {RASI_CANONICAL[ch.lagna]} lagna")
        hits_te.append(f"{RASI_CANONICAL[ch.lagna]} లగ్న చివరి అర ఘటిక")
    if ch.lagna in (5, 9, 1) and _overlaps(win, [(lw[0], lw[0] + half)]):
        hits_en.append(f"first half-ghati of {RASI_CANONICAL[ch.lagna]} lagna")
        hits_te.append(f"{RASI_CANONICAL[ch.lagna]} లగ్న మొదటి అర ఘటిక")

    # Tithi gandanta: last 2 ghatis of Purna tithis, first 2 of Nanda tithis
    g2 = timedelta(hours=2 * GHATI_HOURS)
    ts, te_ = (jd_to_local(x, tz) for x in tithi_bounds(jd))
    if lb.tithi_number in (5, 10, 15) and _overlaps(win, [(te_ - g2, te_)]):
        hits_en.append(f"last 2 ghatis of {lb.tithi_name}")
        hits_te.append(f"{lb.tithi_name} చివరి 2 ఘటికలు")
    if lb.tithi_number in (1, 6, 11) and _overlaps(win, [(ts, ts + g2)]):
        hits_en.append(f"first 2 ghatis of {lb.tithi_name}")
        hits_te.append(f"{lb.tithi_name} మొదటి 2 ఘటికలు")

    if hits_en:
        return _row(num, did, en, te, "fail", "fatal", "Gandanta: " + "; ".join(hits_en) + ".",
                    "గండాంతం: " + "; ".join(hits_te) + ".", f"{ref} #20; Part 1 Gandanta")
    return _row(num, did, en, te, "pass", "fatal", "Clear of nakshatra, lagna and tithi gandanta.",
                "నక్షత్ర, లగ్న, తిథి గండాంత రహితం.", f"{ref} #20; Part 1 Gandanta")


# ─────────────────────────────────────────────────────────────────────────────
# 10 Dashavidha doshas (marriage-focused; informational for other events)
# ─────────────────────────────────────────────────────────────────────────────
_KRANTI_PAIRS = {frozenset(p) for p in ((1, 5), (2, 10), (3, 9), (4, 8), (6, 12), (7, 11))}
_DAGDHA_BY_SUN_SIGN = {9: 2, 12: 2, 2: 4, 11: 4, 1: 6, 4: 6, 3: 8, 6: 8, 5: 10, 8: 10, 7: 12, 10: 12}
_UPAGRAHA_COUNTS = {5, 7, 8, 10, 14, 15, 18, 19, 21, 22, 23, 24, 25}
# Latta: (planet, offset counted inclusively; +ahead / -behind)
_LATTA = ((0, 12), (2, 3), (4, 6), (6, 8), (3, -7), (5, -5), (7, -9))
_PATA_TARGETS = (9, 10, 17, 14, 22, 27)  # Ashlesha, Magha, Anuradha, Chitra, Shravana, Revati


def evaluate_10_dashavidha_doshas(
    panchang: Dict[str, Any],
    d1_positions: List[Dict[str, Any]],
    raw_d1: List[Any],
    muhurta_lagna_idx: int,
    birth_details: Optional[Dict[str, Any]] = None,
    context: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    ctx = context or {}
    ch = _Chart(raw_d1, muhurta_lagna_idx)
    lb = ctx.get("limbs") or _limbs_from_chart(ch)
    is_vivaha = (ctx.get("category") or "") == "vivaha"
    sev = "serious" if is_vivaha else "info"
    ref = "Part 2, Dashavidha doshas"
    out: List[Dict[str, Any]] = []

    def row(num, did, en, te, status, desc_en, desc_te, severity=None):
        r = _row(num, did, en, te, status, severity or sev, desc_en, desc_te, ref)
        return r

    if not ch.has(0, 1) or lb is None:
        for num, did, en, te in ((1, "latta_dosham", "Latta", "లత్తా"), (2, "pata_dosham", "Pata", "పాత"),
                                 (3, "yuti_dosham", "Yuti", "యుతి"), (4, "vedha_dosham", "Vedha", "వేధ"),
                                 (5, "jamitra_dosham", "Jamitra", "జామిత్ర"),
                                 (6, "mritya_panchaka_dosham", "Mrita Panchaka", "మృత పంచకం"),
                                 (7, "ekargala_dosham", "Ekargala", "ఏకార్గళ"), (8, "upagraha_dosham", "Upagraha", "ఉపగ్రహ"),
                                 (9, "kranti_samya_dosham", "Kranti Samya", "క్రాంతి సామ్యం"),
                                 (10, "dagdha_tithi_dosham", "Dagdha Tithi", "దగ్ధ తిథి")):
            out.append(row(num, did, en, te, "not_evaluated", _NE_EN, _NE_TE))
        return out

    moon_nak, sun_nak = ch.nak(1), ch.nak(0)

    # 1. Latta
    kicks = []
    for pid, off in _LATTA:
        if pid not in ch.lon:
            continue
        pn = ch.nak(pid)
        target = (pn - 1 + (off - 1 if off > 0 else off + 1)) % 27 + 1
        if target == moon_nak:
            kicks.append(PLANET_NAME[pid])
    out.append(row(1, "latta_dosham", "Latta", "లత్తా దోషము", "fail" if kicks else "pass",
                   f"{NAKSHATRA_CANONICAL[moon_nak]} is kicked by {', '.join(kicks)}." if kicks
                   else "The Moon's nakshatra is not kicked by any planet. (Purna-chandra latta awaits the author.)",
                   f"{NAKSHATRA_CANONICAL[moon_nak]} పై లత్తా: {', '.join(kicks)}." if kicks else "లత్తా దోషం లేదు."))

    # 2. Pata (Narada / Vasishtha method)
    afflicted = {((t - sun_nak) % 27 + 1) for t in _PATA_TARGETS}
    bad = moon_nak in afflicted
    out.append(row(2, "pata_dosham", "Pata (Chandayudha)", "పాత దోషము", "fail" if bad else "pass",
                   f"{NAKSHATRA_CANONICAL[moon_nak]} is a pata-afflicted nakshatra for the Sun in {NAKSHATRA_CANONICAL[sun_nak]}." if bad
                   else "The Moon's nakshatra is not pata-afflicted.",
                   "పాత దోషం ఉంది." if bad else "పాత దోషం లేదు."))

    # 3. Yuti (= Sagraha chandra, Mahadosha #11)
    y = _sagraha_chandra(ch, is_vivaha, 3, "yuti_dosham", ref)
    y["severity"] = sev
    y["name_en"], y["name_te"] = "3. Yuti", "3. యుతి దోషము"
    out.append(y)

    # 4. Vedha (= Mahadosha #17)
    out.append(row(4, "vedha_dosham", "Vedha", "వేధ దోషము", "not_evaluated",
                   "Not evaluated: the shalaka (vedha) chakra is awaited from the author.",
                   "శలాకా వేధ చక్రం రచయిత నుండి రావలసి ఉంది."))

    # 5. Jamitra: any planet in the 7th from the lagna or from the Moon
    from_lagna = [p for p in ch.in_house(7)]
    from_moon = [p for p in ch.lon if p != 1 and (ch.sign(p) - ch.sign(1)) % 12 + 1 == 7]
    jam = sorted(set(from_lagna) | set(from_moon))
    out.append(row(5, "jamitra_dosham", "Jamitra", "జామిత్ర దోషము", "fail" if jam else "pass",
                   f"Planets in the 7th from the lagna or Moon: {_names(jam)[0]}." if jam else "The 7th from the lagna and the Moon is empty.",
                   f"లగ్నం/చంద్రుని నుండి 7వ స్థానంలో: {_names(jam)[1]}." if jam else "7వ స్థానం శుద్ధం."))

    # 6. Mrita panchaka: Sun at the 1st, 10th, 19th or 28th degree of a sign
    sdeg = int(ch.lon[0] % 30.0) + 1
    bad = sdeg in (1, 10, 19, 28)
    out.append(row(6, "mritya_panchaka_dosham", "Mrita Panchaka", "మృత పంచక దోషము", "fail" if bad else "pass",
                   f"The Sun is in the {sdeg}th degree of {RASI_CANONICAL[ch.sign(0)]}.",
                   f"సూర్యుడు {RASI_CANONICAL[ch.sign(0)]} {sdeg}వ భాగంలో ఉన్నాడు."))

    # 7. Ekargala (= Mahadosha #13)
    e = _ekargala(ch, lb, 7, "ekargala_dosham", "Ekargala", "ఏకార్గళ దోషము", ref)
    e["severity"] = sev
    out.append(e)

    # 8. Upagraha
    cnt = (moon_nak - sun_nak) % 27 + 1
    bad = cnt in _UPAGRAHA_COUNTS
    out.append(row(8, "upagraha_dosham", "Upagraha", "ఉపగ్రహ దోషము", "fail" if bad else "pass",
                   f"The Moon's nakshatra is {cnt} from the Sun's" + (" (upagraha)." if bad else "."),
                   f"సూర్య నక్షత్రం నుండి చంద్ర నక్షత్రం {cnt}వది" + (" (ఉపగ్రహ దోషం)." if bad else ".")))

    # 9. Kranti samya
    bad = frozenset((ch.sign(0), ch.sign(1))) in _KRANTI_PAIRS
    out.append(row(9, "kranti_samya_dosham", "Kranti Samya", "క్రాంతి సామ్య దోషము", "fail" if bad else "pass",
                   f"Sun in {RASI_CANONICAL[ch.sign(0)]} and Moon in {RASI_CANONICAL[ch.sign(1)]}" + (" form a kranti-samya pair." if bad else "."),
                   "క్రాంతి సామ్య దోషం ఉంది." if bad else "క్రాంతి సామ్య దోషం లేదు.",
                   severity="fatal" if is_vivaha else "info"))

    # 10. Dagdha tithi by the Sun's sign
    dg = _DAGDHA_BY_SUN_SIGN[ch.sign(0)]
    bad = lb.tithi_number == dg
    out.append(row(10, "dagdha_tithi_dosham", "Dagdha Tithi", "దగ్ధ తిథి దోషము", "fail" if bad else "pass",
                   f"With the Sun in {RASI_CANONICAL[ch.sign(0)]} the dagdha tithi is {_tname(dg)}; current tithi is {lb.tithi_name}.",
                   f"సూర్యుడు {RASI_CANONICAL[ch.sign(0)]}లో ఉన్నప్పుడు దగ్ధ తిథి {_tname(dg)}; ప్రస్తుత తిథి {lb.tithi_name}."))
    return out


def _tname(n: int) -> str:
    from app.engines.vocab import TITHI_NAMES_EN
    return TITHI_NAMES_EN[n]


# ─────────────────────────────────────────────────────────────────────────────
# Pariharas (remedies) — shown alongside; they never hide a failed dosha
# ─────────────────────────────────────────────────────────────────────────────
def evaluate_muhurta_pariharas(
    panchang: Dict[str, Any],
    raw_d1: List[Any],
    muhurta_lagna_idx: int,
    birth_details: Optional[Dict[str, Any]] = None,
    pushkara_info: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    ch = _Chart(raw_d1, muhurta_lagna_idx)
    pariharas: List[Dict[str, Any]] = []

    # 1. Benefic in a kendra removes faults (Part 1 lagna lakshana: Mercury 500, Venus 5,000, Jupiter 1,00,000)
    weights = {3: "500", 5: "5,000", 4: "1,00,000"}
    for pid in (4, 5, 3):
        if pid in ch.lon and ch.house(pid) in (1, 4, 7, 10):
            pariharas.append({
                "id": f"kendra_{PLANET_NAME[pid].lower()}",
                "name_en": f"{PLANET_NAME[pid]} in a kendra",
                "name_te": f"కేంద్రంలో {PLANET_NAME_TE[pid]}",
                "status": "Active",
                "shloka": "ఏకోహి దేవదేవేశః కేంద్రస్థో వా బలీ గురుః | హంతి దోషసహస్రాణి సూర్యస్తమ ఇవోదితః ||" if pid == 4 else "",
                "desc_en": f"{PLANET_NAME[pid]} in house {ch.house(pid)} removes {weights[pid]} faults (the book's figure).",
                "desc_te": f"{PLANET_NAME_TE[pid]} {ch.house(pid)}వ స్థానంలో ఉండి {weights[pid]} దోషాలను నివారిస్తాడు.",
            })

    # 2. Jupiter aspecting the lagna (5th, 7th, 9th from Jupiter)
    if 4 in ch.lon and ch.house(4) not in (1, 4, 7, 10) and (ch.lagna - ch.sign(4)) % 12 + 1 in (5, 7, 9):
        pariharas.append({
            "id": "guru_drishti",
            "name_en": "Jupiter aspects the lagna",
            "name_te": "లగ్నంపై గురు దృష్టి",
            "status": "Active",
            "shloka": "",
            "desc_en": "Jupiter's aspect on the lagna strengthens the muhurta.",
            "desc_te": "లగ్నంపై గురు దృష్టి ముహూర్తానికి బలాన్నిస్తుంది.",
        })

    # 3. Sun in the 11th
    if 0 in ch.lon and ch.house(0) == 11:
        pariharas.append({
            "id": "surya_labha",
            "name_en": "Sun in the 11th",
            "name_te": "లాభస్థానంలో సూర్యుడు",
            "status": "Active",
            "shloka": "",
            "desc_en": "The book counts the Sun in the 11th as good for the muhurta lagna.",
            "desc_te": "లాభస్థానంలో సూర్యుడు శుభప్రదం.",
        })

    # 4. Pushkara navamsa / bhaga
    if pushkara_info and (pushkara_info.get("has_pushkara") or pushkara_info.get("is_pushkara")):
        pariharas.append({
            "id": "pushkara_pariharam",
            "name_en": "Pushkara navamsa / bhaga",
            "name_te": "పుష్కరాంశ / పుష్కర భాగ",
            "status": "Active",
            "shloka": "",
            "desc_en": "The lagna is in a pushkara portion. This does not cancel Vishayuta lagna (Mahadosha #18).",
            "desc_te": "లగ్నం పుష్కర భాగంలో ఉంది. విషయుత లగ్నాన్ని ఇది రద్దు చేయదు.",
        })

    # 5. Lagnashtama exemption by lord friendship
    if birth_details and birth_details.get("birth_lagna_idx"):
        b = int(birth_details["birth_lagna_idx"])
        if (ch.lagna - b) % 12 + 1 == 8 and lords_compatible(b, ch.lagna):
            pariharas.append({
                "id": "ashtama_lagna_pariharam",
                "name_en": "Lagnashtama relieved by lord friendship",
                "name_te": "అష్టమ లగ్న మైత్రీ పరిహారం",
                "status": "Active",
                "shloka": "",
                "desc_en": "The janma lagna lord and the muhurta lagna lord are the same or friendly.",
                "desc_te": "జన్మ లగ్నాధిపతి, ముహూర్త లగ్నాధిపతి ఒకరే లేదా మిత్రులు.",
            })

    # 6. Panchaka remedy text (from the day panchang)
    panchaka = (panchang or {}).get("panchaka_rahitam")
    if panchaka and panchaka.get("remainder") not in (0, 3, 5, 7, None):
        pariharas.append({
            "id": "panchaka_shastra_pariharam",
            "name_en": f"Panchaka remedy ({panchaka.get('name_en')})",
            "name_te": f"పంచక పరిహారం ({panchaka.get('name_te')})",
            "status": "Remedy prescribed",
            "shloka": "రాత్రౌ రోగం దివా రాజం సంధ్యయోశ్చ మృతౌ త్యజేత్",
            "desc_en": panchaka.get("pariharam_en", ""),
            "desc_te": panchaka.get("pariharam_te", ""),
        })
    return pariharas
