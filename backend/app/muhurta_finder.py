# pyrefly: ignore [missing-import]
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta

from .names import RASI_NAMES
from .panchang import compute_day_panchang as compute_drik_panchang
from .doshas_engine import evaluate_21_maha_doshas, evaluate_10_dashavidha_doshas
# pyrefly: ignore [missing-import]
from jhora.panchanga.drik import Place as JHoraPlace
# pyrefly: ignore [missing-import]
from jhora import utils

router = APIRouter(prefix="/muhurta", tags=["Muhurta Finder"])

PLANET_NAMES_MAP = {
    "0": "Sun", "1": "Moon", "2": "Mars", "3": "Mercury", "4": "Jupiter",
    "5": "Venus", "6": "Saturn", "7": "Rahu", "8": "Ketu"
}


@router.get("/finder")
def muhurta_finder(
    date_str: str = Query(..., alias="date", description="Start date YYYY-MM-DD"),
    lat: float = Query(...),
    lon: float = Query(...),
    tz_offset: float = Query(..., description="e.g. 5.5 for IST"),
    place_name: str = Query("Location"),
    days: int = Query(30, le=60, description="Number of days to scan (max 60)"),
    birth_dob: str = Query(None, description="Birth DOB (YYYY-MM-DD) for Tarabalam/Ashtama checks"),
    birth_tob: str = Query(None, description="Birth TOB (HH:MM) for Tarabalam/Ashtama checks"),
):
    """Find auspicious Muhurtas for 30 consecutive days from the given date."""
    # Lazy import to avoid circular dependency with main.py
    from .main import compute_pushkara_window, compute_d1_positions

    try:
        start_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "date must be YYYY-MM-DD")

    calculator = compute_drik_panchang
    birth_place_obj = JHoraPlace(place_name, lat, lon, tz_offset)

    # Optional: Parse birth details for Tarabalam & Ashtama checks
    birth_nak_idx = None
    birth_nak_name = None
    birth_nak_pada = None
    birth_lagna_idx = None
    birth_lagna_name = None
    birth_d1_positions = []

    if birth_dob and birth_tob:
        try:
            birth_date = datetime.strptime(birth_dob, "%Y-%m-%d").date()
            bh, bm = (int(x) for x in birth_tob.split(":"))
            birth_hour = bh + bm / 60.0
            birth_panchang = calculator(
                birth_date.year, birth_date.month, birth_date.day,
                lat, lon, tz_offset, place_name, hour=birth_hour
            )
            birth_nak_idx = birth_panchang["nakshatra"]["index"]
            birth_nak_name = birth_panchang["nakshatra"]["name"]
            birth_nak_pada = birth_panchang["nakshatra"]["pada"]

            birth_d1_positions, raw_birth_d1 = compute_d1_positions(birth_date, birth_hour, birth_place_obj)
            if raw_birth_d1:
                birth_lagna_idx_0 = raw_birth_d1[0][1][0]
                birth_lagna_idx = birth_lagna_idx_0 + 1
                birth_lagna_name = RASI_NAMES[birth_lagna_idx]
        except Exception as ex:
            print(f"Birth details parse error: {ex}")

    tara_names = {
        1: "Janma", 2: "Sampat", 3: "Vipat", 4: "Kshema", 5: "Pratyak",
        6: "Sadhana", 7: "Naidhana", 8: "Mitra", 9: "Paramamitra"
    }

    results = []

    for day_offset in range(days):
        cand_date = start_date + timedelta(days=day_offset)

        # 1. Get daily base panchang at 10 AM (for fallback and daily periods like sunrise/sunset/durmuhurtam)
        try:
            p_base = calculator(
                cand_date.year, cand_date.month, cand_date.day,
                lat, lon, tz_offset, place_name, hour=10
            )
        except Exception as ex:
            print(f"Panchang error for {cand_date}: {ex}")
            results.append({
                "date": cand_date.strftime("%Y-%m-%d"),
                "day_offset": day_offset + 1,
                "error": str(ex),
                "pushkara_info": None,
                "percentage": 0,
                "verdict": "error"
            })
            continue

        # 2. Compute Pushkara / auspicious Muhurta windows (full 24-hour scan)
        all_pushkara_windows = compute_pushkara_window(
            cand_date, lat, lon, tz_offset, place_name, p_base,
            birth_lagna_idx=birth_lagna_idx,
            birth_place_obj=birth_place_obj,
            return_all=True
        )

        day_results = []

        if all_pushkara_windows:
            for pushkara_info in all_pushkara_windows:
                muhurta_hour = _parse_time_str_to_h(pushkara_info.get("precise_time", "10:00 AM"))

                # Recompute panchang at precise window time
                try:
                    hh = int(muhurta_hour)
                    mm = int(round((muhurta_hour - hh) * 60))
                    if mm >= 60:
                        hh += 1
                        mm = 0
                    p_win = calculator(
                        cand_date.year, cand_date.month, cand_date.day,
                        lat, lon, tz_offset, place_name, hour=hh, minute=mm, second=0
                    )
                except Exception as ex:
                    print(f"Panchang recomputation error for {cand_date} at {muhurta_hour}: {ex}")
                    p_win = p_base

                # Compute D1 chart at the recommended muhurta time
                cand_d1_positions, cand_raw_d1 = compute_d1_positions(cand_date, muhurta_hour, birth_place_obj)

                # Extract Muhurta Lagna from D1 chart
                cand_lagna_idx = None
                for item in cand_raw_d1:
                    if item[0] == 'L':
                        cand_lagna_idx = item[1][0] + 1
                        break
                if not cand_lagna_idx:
                    if pushkara_info and "lagna_name_en" in pushkara_info:
                        try:
                            cand_lagna_idx = RASI_NAMES.index(pushkara_info["lagna_name_en"]) + 1
                        except ValueError:
                            cand_lagna_idx = p_win.get("lagna_rasi_index", 1)
                    else:
                        cand_lagna_idx = p_win.get("lagna_rasi_index", 1)

                cand_lagna_name = RASI_NAMES[cand_lagna_idx - 1]

                # Tarabalam check (only if birth details provided)
                tara_name = None
                is_tara_good = True
                if birth_nak_idx:
                    count_inc = utils.count_stars(birth_nak_idx, p_win["nakshatra"]["index"])
                    tb_rem = count_inc % 9
                    tara_idx = 9 if tb_rem == 0 else tb_rem
                    tara_name = tara_names[tara_idx]
                    is_tara_good = tara_idx not in [1, 3, 5, 7]

                # Vaara check
                is_vaara_good = p_win["vaara"] in ["Monday", "Wednesday", "Thursday", "Friday"]

                # Nakshatra check (general auspicious nakshatras)
                is_nak_good = p_win["nakshatra"]["name"] in [
                    "Ashwini", "Rohini", "Mrigashira", "Punarvasu", "Pushya", "Uttara Phalguni",
                    "Hasta", "Chitra", "Swati", "Anuradha", "Uttara Ashadha", "Shravana",
                    "Dhanishtha", "Shatabhisha", "Uttara Bhadrapada", "Revati"
                ]

                # Tithi check
                is_tithi_avoid = p_win["tithi"]["name"] in ["Chaturthi", "Navami", "Purnima", "Amavasya"]

                # Yoga & Karana checks
                is_yoga_avoid = p_win["yoga"]["name"] in ["Vaidhriti", "Ganda", "Vyatipata", "Parigha"]
                is_karana_avoid = p_win["karana"]["name"] in ["Vishti (Bhadra)", "Shakuni", "Chatushpada", "Naga", "Kimstughna"]

                # Ashtama Lagna check
                is_ashtama_lagna = False
                if birth_lagna_idx:
                    is_ashtama_lagna = (cand_lagna_idx - birth_lagna_idx) % 12 == 7

                # Ashtama Shuddhi (8th house vacant)
                ashtama_rasi_idx = (cand_lagna_idx - 1 + 7) % 12 + 1
                ashtama_rasi_name = RASI_NAMES[ashtama_rasi_idx - 1]
                planets_in_8th = []
                for item in cand_raw_d1:
                    p_id = item[0]
                    if p_id == 'L':
                        continue
                    p_rasi = item[1][0] + 1
                    if p_rasi == ashtama_rasi_idx:
                        planets_in_8th.append(PLANET_NAMES_MAP.get(str(p_id), str(p_id)))
                has_ashtama_shuddhi = len(planets_in_8th) == 0

                # Lagna Shuddhi (Lagna block must be vacant)
                planets_in_lagna = []
                for item in cand_raw_d1:
                    p_id = item[0]
                    if p_id == 'L':
                        continue
                    p_rasi = item[1][0] + 1
                    if p_rasi == cand_lagna_idx:
                        planets_in_lagna.append(PLANET_NAMES_MAP.get(str(p_id), str(p_id)))
                has_lagna_shuddhi = len(planets_in_lagna) == 0

                # STRICT FILTERING:
                # If a window violates severe blockers, filter it out completely.
                if is_tithi_avoid or (not is_tara_good and birth_nak_idx) or is_ashtama_lagna or not has_ashtama_shuddhi:
                    continue  # Disqualify and do not list this window!

                # Scoring
                base_score = 0
                if is_vaara_good: base_score += 20
                if is_nak_good: base_score += 20
                if not is_tithi_avoid: base_score += 20
                if is_tara_good: base_score += 20
                base_score += 20  # Has valid pushkara/auspicious window

                deductions = 0
                if is_yoga_avoid: deductions += 25
                if is_karana_avoid: deductions += 25
                if not has_lagna_shuddhi: deductions += 15

                total_pct = max(0, base_score - deductions)
                verdict = "highly_favorable" if total_pct >= 75 else ("favorable" if total_pct >= 50 else "unfavorable")

                # Reasons list
                reasons = []
                if is_vaara_good:
                    reasons.append(f"{p_win['vaara']} is favorable.")
                else:
                    reasons.append(f"{p_win['vaara']} is not recommended.")

                if is_nak_good:
                    reasons.append(f"Nakshatra {p_win['nakshatra']['name']} is favorable.")
                else:
                    reasons.append(f"Nakshatra {p_win['nakshatra']['name']} is not recommended.")

                reasons.append(f"Tithi {p_win['tithi']['name']} is favorable.")

                if tara_name:
                    reasons.append(f"Tarabalam is {tara_name} (favorable).")

                reasons.append("Ashtama Lagna: Clean.")
                reasons.append("Ashtama Shuddhi: Clean (8th house vacant).")
                
                if not has_lagna_shuddhi:
                    reasons.append(f"No Lagna Shuddhi ({', '.join(planets_in_lagna)} in Lagna)!")
                else:
                    reasons.append("Lagna Shuddhi is clean (Lagna block vacant).")

                if is_yoga_avoid:
                    reasons.append(f"Avoid: Unfavorable {p_win['yoga']['name']} yoga!")
                if is_karana_avoid:
                    reasons.append(f"Avoid: Unfavorable {p_win['karana']['name']} karana!")

                birth_details_dict = {"birth_lagna_idx": birth_lagna_idx} if birth_lagna_idx else None
                maha_doshas_list = evaluate_21_maha_doshas(p_win, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)
                dashavidha_doshas_list = evaluate_10_dashavidha_doshas(p_win, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)

                day_results.append({
                    "date": cand_date.strftime("%Y-%m-%d"),
                    "day_offset": day_offset + 1,
                    "percentage": total_pct,
                    "verdict": verdict,
                    "reasons": reasons,
                    "pushkara_info": pushkara_info,
                    "special_yogas": p_win.get("special_yogas", []),
                    "panchang": {
                        "vaara": p_win["vaara"],
                        "tithi": f"{p_win['tithi']['name']} ({p_win['tithi']['paksha']})",
                        "nakshatra": p_win["nakshatra"]["name"],
                        "nakshatra_pada": p_win["nakshatra"]["pada"],
                        "yoga": p_win["yoga"]["name"],
                        "karana": p_win["karana"]["name"],
                        "sunrise": p_win.get("sunrise"),
                        "sunset": p_win.get("sunset"),
                        "inauspicious_periods": {
                            "rahu_kalam": p_win.get("rahu_kalam"),
                            "yamagandam": p_win.get("yamagandam"),
                            "gulika_kalam": p_win.get("gulika_kalam"),
                            "durmuhurtam": p_win.get("durmuhurtam"),
                            "varjyam": p_win.get("varjyam")
                        }
                    },
                    "d1_chart": cand_d1_positions,
                    "detailed_eval": {
                        "vaara": {"name": p_win["vaara"], "is_pass": is_vaara_good},
                        "tithi": {"name": p_win["tithi"]["name"], "paksha": p_win["tithi"]["paksha"], "is_pass": not is_tithi_avoid},
                        "nakshatra": {"name": p_win["nakshatra"]["name"], "pada": p_win["nakshatra"]["pada"], "is_pass": is_nak_good},
                        "tara": {"name": tara_name, "is_pass": is_tara_good} if tara_name else None,
                        "ashtama_lagna": {"is_dosha": is_ashtama_lagna, "birth_lagna": birth_lagna_name, "muhurta_lagna": cand_lagna_name} if birth_lagna_idx else None,
                        "ashtama_shuddhi": {"has_shuddhi": has_ashtama_shuddhi, "planets_in_8th": planets_in_8th, "muhurta_lagna": cand_lagna_name, "ashtama_rasi": ashtama_rasi_name},
                        "lagna_shuddhi": {"has_shuddhi": has_lagna_shuddhi, "planets_in_lagna": planets_in_lagna, "muhurta_lagna": cand_lagna_name},
                        "yoga": {"name": p_win["yoga"]["name"], "is_pass": not is_yoga_avoid},
                        "karana": {"name": p_win["karana"]["name"], "is_pass": not is_karana_avoid},
                        "maha_doshas": maha_doshas_list,
                        "dashavidha_doshas": dashavidha_doshas_list
                    }
                })

        # 3. If there are no passing windows for this day, output one unfavorable day summary card
        if not day_results:
            # We calculate at 10 AM (using p_base)
            cand_d1_positions, cand_raw_d1 = compute_d1_positions(cand_date, 10.0, birth_place_obj)

            # Tarabalam check
            tara_name = None
            is_tara_good = True
            if birth_nak_idx:
                count_inc = utils.count_stars(birth_nak_idx, p_base["nakshatra"]["index"])
                tb_rem = count_inc % 9
                tara_idx = 9 if tb_rem == 0 else tb_rem
                tara_name = tara_names[tara_idx]
                is_tara_good = tara_idx not in [1, 3, 5, 7]

            is_vaara_good = p_base["vaara"] in ["Monday", "Wednesday", "Thursday", "Friday"]
            is_nak_good = p_base["nakshatra"]["name"] in [
                "Ashwini", "Rohini", "Mrigashira", "Punarvasu", "Pushya", "Uttara Phalguni",
                "Hasta", "Chitra", "Swati", "Anuradha", "Uttara Ashadha", "Shravana",
                "Dhanishtha", "Shatabhisha", "Uttara Bhadrapada", "Revati"
            ]
            is_tithi_avoid = p_base["tithi"]["name"] in ["Chaturthi", "Navami", "Purnima", "Amavasya"]
            is_yoga_avoid = p_base["yoga"]["name"] in ["Vaidhriti", "Ganda", "Vyatipata", "Parigha"]
            is_karana_avoid = p_base["karana"]["name"] in ["Vishti (Bhadra)", "Shakuni", "Chatushpada", "Naga", "Kimstughna"]

            # Standard Lagna at 10 AM
            cand_lagna_idx = p_base.get("lagna_rasi_index", 1)
            cand_lagna_name = RASI_NAMES[cand_lagna_idx - 1]

            is_ashtama_lagna = False
            if birth_lagna_idx:
                is_ashtama_lagna = (cand_lagna_idx - birth_lagna_idx) % 12 == 7

            ashtama_rasi_idx = (cand_lagna_idx - 1 + 7) % 12 + 1
            ashtama_rasi_name = RASI_NAMES[ashtama_rasi_idx - 1]
            planets_in_8th = []
            for item in cand_raw_d1:
                p_id = item[0]
                if p_id == 'L': continue
                p_rasi = item[1][0] + 1
                if p_rasi == ashtama_rasi_idx:
                    planets_in_8th.append(PLANET_NAMES_MAP.get(str(p_id), str(p_id)))
            has_ashtama_shuddhi = len(planets_in_8th) == 0

            planets_in_lagna = []
            for item in cand_raw_d1:
                p_id = item[0]
                if p_id == 'L': continue
                p_rasi = item[1][0] + 1
                if p_rasi == cand_lagna_idx:
                    planets_in_lagna.append(PLANET_NAMES_MAP.get(str(p_id), str(p_id)))
            has_lagna_shuddhi = len(planets_in_lagna) == 0

            reasons = []
            if is_vaara_good:
                reasons.append(f"{p_base['vaara']} is favorable.")
            else:
                reasons.append(f"{p_base['vaara']} is not recommended.")

            if is_nak_good:
                reasons.append(f"Nakshatra {p_base['nakshatra']['name']} is favorable.")
            else:
                reasons.append(f"Nakshatra {p_base['nakshatra']['name']} is not recommended.")

            if is_tithi_avoid:
                reasons.append(f"Tithi {p_base['tithi']['name']} must be avoided!")
            else:
                reasons.append(f"Tithi {p_base['tithi']['name']} is favorable.")

            if tara_name:
                reasons.append(f"Tarabalam is {tara_name} ({'not recommended' if not is_tara_good else 'favorable'}).")

            if is_ashtama_lagna:
                reasons.append("Ashtama Lagna Dosha (Muhurta Lagna is 8th from birth Lagna)!")
            if not has_ashtama_shuddhi:
                reasons.append(f"No Ashtama Shuddhi ({', '.join(planets_in_8th)} in 8th house)!")
            if not has_lagna_shuddhi:
                reasons.append(f"No Lagna Shuddhi ({', '.join(planets_in_lagna)} in Lagna)!")

            reasons.append("No auspicious pushkara/lagna window found or all windows were filtered out due to doshas.")

            birth_details_dict = {"birth_lagna_idx": birth_lagna_idx} if birth_lagna_idx else None
            maha_doshas_list = evaluate_21_maha_doshas(p_base, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)
            dashavidha_doshas_list = evaluate_10_dashavidha_doshas(p_base, cand_d1_positions, cand_raw_d1, cand_lagna_idx, birth_details_dict)

            results.append({
                "date": cand_date.strftime("%Y-%m-%d"),
                "day_offset": day_offset + 1,
                "percentage": 0,
                "verdict": "unfavorable",
                "reasons": reasons,
                "pushkara_info": None,
                "special_yogas": p_base.get("special_yogas", []),
                "panchang": {
                    "vaara": p_base["vaara"],
                    "tithi": f"{p_base['tithi']['name']} ({p_base['tithi']['paksha']})",
                    "nakshatra": p_base["nakshatra"]["name"],
                    "nakshatra_pada": p_base["nakshatra"]["pada"],
                    "yoga": p_base["yoga"]["name"],
                    "karana": p_base["karana"]["name"],
                    "sunrise": p_base.get("sunrise"),
                    "sunset": p_base.get("sunset"),
                    "inauspicious_periods": {
                        "rahu_kalam": p_base.get("rahu_kalam"),
                        "yamagandam": p_base.get("yamagandam"),
                        "gulika_kalam": p_base.get("gulika_kalam"),
                        "durmuhurtam": p_base.get("durmuhurtam"),
                        "varjyam": p_base.get("varjyam")
                    }
                },
                "d1_chart": cand_d1_positions,
                "detailed_eval": {
                    "vaara": {"name": p_base["vaara"], "is_pass": is_vaara_good},
                    "tithi": {"name": p_base["tithi"]["name"], "paksha": p_base["tithi"]["paksha"], "is_pass": not is_tithi_avoid},
                    "nakshatra": {"name": p_base["nakshatra"]["name"], "pada": p_base["nakshatra"]["pada"], "is_pass": is_nak_good},
                    "tara": {"name": tara_name, "is_pass": is_tara_good} if tara_name else None,
                    "ashtama_lagna": {"is_dosha": is_ashtama_lagna, "birth_lagna": birth_lagna_name, "muhurta_lagna": cand_lagna_name} if birth_lagna_idx else None,
                    "ashtama_shuddhi": {"has_shuddhi": has_ashtama_shuddhi, "planets_in_8th": planets_in_8th, "muhurta_lagna": cand_lagna_name, "ashtama_rasi": ashtama_rasi_name},
                    "lagna_shuddhi": {"has_shuddhi": has_lagna_shuddhi, "planets_in_lagna": planets_in_lagna, "muhurta_lagna": cand_lagna_name},
                    "yoga": {"name": p_base["yoga"]["name"], "is_pass": not is_yoga_avoid},
                    "karana": {"name": p_base["karana"]["name"], "is_pass": not is_karana_avoid},
                    "maha_doshas": maha_doshas_list,
                    "dashavidha_doshas": dashavidha_doshas_list
                }
            })
        else:
            results.extend(day_results)

    response = {
        "start_date": date_str,
        "days_scanned": days,
        "location": {
            "place_name": place_name,
            "lat": lat,
            "lon": lon,
            "tz_offset": tz_offset
        },
        "results": results
    }

    if birth_dob and birth_tob and birth_nak_name:
        response["birth_details"] = {
            "dob": birth_dob,
            "tob": birth_tob,
            "janma_nakshatra": birth_nak_name,
            "janma_nakshatra_pada": birth_nak_pada,
            "birth_lagna": birth_lagna_name,
            "d1_chart": birth_d1_positions
        }

    return response


def _parse_time_str_to_h(t_str):
    """Parse a time string like '10:30 AM' to decimal hours."""
    if not t_str:
        return 10.0
    try:
        parts = t_str.strip().split()
        time_part = parts[0]
        ampm = parts[1].upper() if len(parts) > 1 else "AM"
        h_m = time_part.split(":")
        hh = int(h_m[0])
        mm = int(h_m[1])
        if ampm == "PM" and hh < 12:
            hh += 12
        elif ampm == "AM" and hh == 12:
            hh = 0
        return hh + mm / 60.0
    except Exception:
        return 10.0
