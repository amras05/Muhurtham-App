"""
Matches a computed panchang (from panchang.py) against an activity's rule set
(from rules.json) and returns a verdict with human-readable reasons.

Scoring approach (intentionally simple and transparent, not a black box):
  - Each matched "good" condition = +1 point, with a reason logged.
  - Each matched "avoid" condition = -2 points (avoid conditions are weighted
    higher, matching how the book treats them: a single dosha can outweigh
    several favorable points), with a reason logged.
  - verdict: "favorable" if score > 0 and no avoid conditions matched,
             "avoid" if any avoid condition matched and score <= 0,
             "mixed" if both good and avoid conditions matched (score > 0),
             "neutral" if the activity has no matching rule for this day at all.
"""
import json
import os

RULES_PATH = os.path.join(os.path.dirname(__file__), "rules.json")

with open(RULES_PATH, encoding="utf-8") as f:
    RULES = json.load(f)

RASI_NAMES = RULES["_meta"]["rasi_names"]


def get_activity(activity_id: str) -> dict:
    for a in RULES["activities"]:
        if a["id"] == activity_id:
            return a
    return None


def list_activities() -> list:
    return [{"id": a["id"], "name_en": a["name_en"], "name_te": a["name_te"]}
             for a in RULES["activities"]]


def _tithi_number_in_paksha(panchang: dict, numbers: list) -> bool:
    return panchang["tithi_number"] in numbers


def evaluate(activity_id: str, panchang: dict) -> dict:
    activity = get_activity(activity_id)
    if not activity:
        return {"error": f"Unknown activity '{activity_id}'"}

    score = 0
    reasons_good = []
    reasons_avoid = []
    lagna_rasi_name = RASI_NAMES[panchang["lagna_rasi_index"] - 1]

    good = activity.get("good", {})
    avoid = activity.get("avoid", {})

    # --- GOOD conditions ---
    if "vaara" in good and panchang["vaara"] in good["vaara"]:
        score += 1
        reasons_good.append(f"{panchang['vaara']} is a favorable weekday for this activity")

    if "nakshatra" in good and panchang["nakshatra_name"] in good["nakshatra"]:
        score += 1
        reasons_good.append(f"{panchang['nakshatra_name']} nakshatra is favorable")

    if "tithi" in good and panchang["tithi_name"] in good["tithi"]:
        score += 1
        reasons_good.append(f"{panchang['tithi_name']} tithi is favorable")

    if "tithi_numbers_both_paksha" in good and _tithi_number_in_paksha(panchang, good["tithi_numbers_both_paksha"]):
        score += 1
        reasons_good.append(f"Tithi #{panchang['tithi_number']} ({panchang['paksha']} paksha) is favorable")

    if "tithi_shukla_numbers" in good and panchang["paksha"] == "shukla" and _tithi_number_in_paksha(panchang, good["tithi_shukla_numbers"]):
        score += 1
        reasons_good.append(f"Shukla paksha tithi #{panchang['tithi_number']} is favorable")

    if "tithi_krishna_numbers" in good and panchang["paksha"] == "krishna" and _tithi_number_in_paksha(panchang, good["tithi_krishna_numbers"]):
        score += 1
        reasons_good.append(f"Krishna paksha tithi #{panchang['tithi_number']} is favorable")

    if "lagna_rasi" in good and lagna_rasi_name in good["lagna_rasi"]:
        score += 1
        reasons_good.append(f"{lagna_rasi_name} lagna is favorable")

    if "vaara_avoid" in good and panchang["vaara"] not in good["vaara_avoid"]:
        score += 1
        reasons_good.append(f"{panchang['vaara']} is not in the excluded weekday list")

    # --- AVOID conditions ---
    if "vaara" in avoid and panchang["vaara"] in avoid["vaara"]:
        score -= 2
        reasons_avoid.append(f"{panchang['vaara']} should be avoided for this activity")

    if "tithi" in avoid and panchang["tithi_name"] in avoid["tithi"]:
        score -= 2
        reasons_avoid.append(f"{panchang['tithi_name']} tithi should be avoided")

    if "nakshatra" in avoid and panchang["nakshatra_name"] in avoid["nakshatra"]:
        score -= 2
        reasons_avoid.append(f"{panchang['nakshatra_name']} nakshatra should be avoided")

    if "karana" in avoid and panchang["karana_name"] in avoid["karana"]:
        score -= 2
        reasons_avoid.append(f"{panchang['karana_name']} karana should be avoided")

    if "yoga" in avoid and panchang["yoga_name"] in avoid["yoga"]:
        score -= 2
        reasons_avoid.append(f"{panchang['yoga_name']} yoga should be avoided")

    if "vaara_caution" in avoid and panchang["vaara"] in avoid["vaara_caution"]:
        score -= 1
        reasons_avoid.append(f"{panchang['vaara']} needs caution per the text")

    matched_any = bool(reasons_good or reasons_avoid)

    if not matched_any:
        verdict = "neutral"
    elif reasons_avoid and score <= 0:
        verdict = "avoid"
    elif reasons_avoid and score > 0:
        verdict = "mixed"
    else:
        verdict = "favorable"

    return {
        "activity_id": activity_id,
        "activity_name_en": activity["name_en"],
        "activity_name_te": activity["name_te"],
        "date": panchang["date"],
        "verdict": verdict,
        "score": score,
        "reasons_favorable": reasons_good,
        "reasons_avoid": reasons_avoid,
        "notes_from_book": activity.get("notes", ""),
        "panchang_snapshot": {
            "vaara": panchang["vaara"],
            "tithi": f"{panchang['tithi_name']} ({panchang['paksha']} paksha, #{panchang['tithi_number']})",
            "nakshatra": f"{panchang['nakshatra_name']} pada {panchang['nakshatra_pada']}",
            "yoga": panchang["yoga_name"],
            "karana": panchang["karana_name"],
            "lagna_at_query_time": lagna_rasi_name,
        },
    }


def find_next_favorable(activity_id: str, start_year, start_month, start_day,
                         lat, lon, tz_offset, place_name, max_days=60, hour=6, method="drik"):
    """Walk forward day by day (evaluated at `hour` local time) until a
    favorable (or mixed, as fallback) day is found for the activity."""
    from datetime import date, timedelta
    from .panchang import compute_day_panchang as compute_drik_panchang
    # from .panchang_chandramana import compute_day_panchang as compute_chandramana_panchang

    # calculator = compute_chandramana_panchang if method == "chandramana" else compute_drik_panchang
    calculator = compute_drik_panchang

    d = date(start_year, start_month, start_day)
    best_mixed = None
    for i in range(max_days):
        cur = d + timedelta(days=i)
        panchang = calculator(cur.year, cur.month, cur.day, lat, lon, tz_offset, place_name, hour=hour)
        result = evaluate(activity_id, panchang)
        if result["verdict"] == "favorable":
            result["days_from_today"] = i
            return result
        if result["verdict"] == "mixed" and best_mixed is None:
            best_mixed = dict(result)
            best_mixed["days_from_today"] = i
    if best_mixed:
        best_mixed["note"] = f"No purely favorable day found in {max_days} days; showing the best mixed-verdict day instead."
        return best_mixed
    return {"verdict": "none_found", "note": f"No favorable or mixed day found within {max_days} days."}

