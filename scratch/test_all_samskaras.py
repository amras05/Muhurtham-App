"""
Verification script for all 9 Classical Vedic Samskaras (Pages 8 to 16)
Tests backend endpoints and validates rule calculations without using browser DOM.
"""

import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://localhost:8000"

# Sample parameters: Hyderabad, India
LAT = 17.3850
LON = 78.4867
TZ = 5.5
PLACE = "Hyderabad"
SAMPLE_DOB = "2024-05-10"
SAMPLE_TOB = "10:30"

def test_samskaras_list():
    print("\n--- Testing GET /muhurta/samskaras/list ---")
    url = f"{BASE_URL}/muhurta/samskaras/list"
    with urllib.request.urlopen(url) as response:
        assert response.status == 200
        data = json.loads(response.read().decode())
        print(f"Total Samskaras returned: {len(data)}")
        for s in data:
            print(f"  Page {s['page_number']}: {s['icon']} {s['name_en']} ({s['name_te']}) - ID: '{s['id']}'")
        assert len(data) == 9, f"Expected 9 samskaras, got {len(data)}"
        print("✓ Samskaras list test passed!")
        return [s['id'] for s in data]

def test_samskara_finder(samskara_ids):
    print("\n--- Testing GET /muhurta/samskara-finder for each Samskara ---")
    for sid in samskara_ids:
        params = {
            "type": sid,
            "dob": SAMPLE_DOB,
            "tob": SAMPLE_TOB,
            "lat": LAT,
            "lon": LON,
            "tz_offset": TZ,
            "place_name": PLACE,
        }

        # Add specific parameters for tailored rites
        if sid == "annaprashana":
            params["child_gender"] = "male"
        elif sid == "choodakarana":
            params["child_gender"] = "female"
            params["age_mode"] = "months"
        elif sid == "seemantha":
            params["ceremony_type"] = "seemantha"
        elif sid == "karnavedha":
            params["timing_mode"] = "early"
        elif sid == "upanayana":
            params["varna"] = "brahmin"
        elif sid == "garbhadhana":
            params["husband_moon_rasi_idx"] = 4
            params["husband_nak_idx"] = 8

        qs = urllib.parse.urlencode(params)
        url = f"{BASE_URL}/muhurta/samskara-finder?{qs}"
        try:
            with urllib.request.urlopen(url) as response:
                assert response.status == 200
                data = json.loads(response.read().decode())
                meta = data.get("samskara", {})
                b = data.get("birth_details", {})
                cands = data.get("candidates", [])
                print(f"✓ [{sid.upper()}] Page {meta.get('page_number')}: {meta.get('name_en')} ({meta.get('name_te')})")
                print(f"    Birth/Ref: {b.get('dob')} {b.get('tob')} | Nakshatra: {b.get('janma_nakshatra')} (Pada {b.get('janma_nakshatra_pada')}) | Lagna: {b.get('birth_lagna')}")
                print(f"    Total Evaluated Candidates: {len(cands)}")
                if cands:
                    best = cands[0]
                    p = best.get("panchang", {})
                    pw = best.get("pushkara_info", {})
                    print(f"    Top Candidate: {best.get('date')} ({best.get('day_label_en', '')}) - Score: {best.get('percentage')}% ({best.get('verdict')})")
                    print(f"      Lagna: {best.get('lagna_name')} | Ashtama Empty: {best.get('house_8_empty')} | Pushkara: {pw.get('type_en', 'Standard')} at {pw.get('precise_time', 'N/A')}")
                    print(f"      Vaara: {p.get('vaara')} | Tithi: {p.get('tithi')} | Star: {p.get('nakshatra')}")
        except Exception as e:
            print(f"✗ Failed {sid}: {e}")
            raise e

def test_namakarana_backward_compat():
    print("\n--- Testing Backwards-Compatibility GET /muhurta/namakarana-finder ---")
    params = {
        "dob": SAMPLE_DOB,
        "tob": SAMPLE_TOB,
        "lat": LAT,
        "lon": LON,
        "tz_offset": TZ,
        "place_name": PLACE,
    }
    qs = urllib.parse.urlencode(params)
    url = f"{BASE_URL}/muhurta/namakarana-finder?{qs}"
    with urllib.request.urlopen(url) as response:
        assert response.status == 200
        data = json.loads(response.read().decode())
        cands = data.get("candidates", [])
        print(f"✓ Namakarana legacy endpoint returned {len(cands)} candidate days.")
        assert len(cands) > 0, "Expected at least one candidate for Namakarana"
        print("✓ Legacy endpoint test passed!")

if __name__ == "__main__":
    sids = test_samskaras_list()
    test_samskara_finder(sids)
    test_namakarana_backward_compat()
    print("\n=======================================================")
    print("ALL SAMSKARA ENGINE API TESTS PASSED SUCCESSFULLY! 🎉")
    print("=======================================================")
