"""
Verification script for UI delivery and all 9 Classical Samskara APIs.
Per user instructions: Tests purely via HTTP API responses, no DOM automation.
"""

import urllib.request
import urllib.parse
import json
import re
import sys

BASE_URL = "http://localhost:8000"

def test_html_delivery():
    print("\n--- 1. Testing panchang-lookup.html delivery & UI markup ---")
    url = f"{BASE_URL}/panchang-lookup.html"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        assert response.status == 200, f"Expected 200, got {response.status}"
        html = response.read().decode('utf-8')
        print(f"✓ panchang-lookup.html fetched successfully ({len(html)} bytes)")

        # Verify all 9 Samskara tabs exist in markup
        samskaras_tabs = [
            "tabPanchangBtn",
            "tabGarbhadhanaBtn",
            "tabPumsavanaBtn",
            "tabSeemanthaBtn",
            "tabJatakarmaBtn",
            "tabNamakaranaBtn",
            "tabAnnaprashanaBtn",
            "tabChoodakaranaBtn",
            "tabKarnavedhaBtn",
            "tabUpanayanaBtn"
        ]
        for t in samskaras_tabs:
            assert t in html, f"Tab '{t}' not found in HTML!"
            print(f"  ✓ Tab element: '{t}' present in HTML")

        # Verify Shastra Rule Banner and Contextual Fields
        expected_elements = [
            "samskaraRuleBanner",
            "samskaraBannerIcon",
            "samskaraBannerTitle",
            "samskaraPageBadge",
            "samskaraBannerRules",
            "fieldChildGender",
            "fieldCeremonyType",
            "fieldAgeMode",
            "fieldTimingMode",
            "fieldVarna",
            "fieldHusbandDetails",
            "samskaraResultsHeaderTitle"
        ]
        for elem in expected_elements:
            assert elem in html, f"Element '{elem}' not found in HTML!"
            print(f"  ✓ UI element: '{elem}' present in HTML")

        # Verify Javascript configuration and functions
        expected_js_tokens = [
            "SAMSKARAS_CONFIG",
            "garbhadhana",
            "pumsavana",
            "seemantha",
            "jatakarma",
            "namakarana",
            "annaprashana",
            "choodakarana",
            "karnavedha",
            "upanayana",
            "setupSamskaraView",
            "findSamskaraMuhurtas",
            "openMuhurtaModal"
        ]
        for token in expected_js_tokens:
            assert token in html, f"JS token '{token}' missing from script!"
            print(f"  ✓ JS logic token: '{token}' present")

        print("✓ HTML & Frontend verification passed successfully!")

def test_samskara_api_endpoints():
    print("\n--- 2. Testing API Responses for all 9 Samskaras ---")
    samskara_test_cases = [
        {
            "id": "garbhadhana",
            "name": "Garbhadhana",
            "page": 8,
            "params": {
                "type": "garbhadhana",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad",
                "husband_moon_rasi_idx": 4,
                "husband_nak_idx": 8,
                "bride_ritu_lagna_idx": 4
            }
        },
        {
            "id": "pumsavana",
            "name": "Pumsavana",
            "page": 9,
            "params": {
                "type": "pumsavana",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad"
            }
        },
        {
            "id": "seemantha",
            "name": "Seemantha",
            "page": 10,
            "params": {
                "type": "seemantha",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad",
                "ceremony_type": "seemantha"
            }
        },
        {
            "id": "jatakarma",
            "name": "Jatakarma",
            "page": 11,
            "params": {
                "type": "jatakarma",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad"
            }
        },
        {
            "id": "namakarana",
            "name": "Namakarana",
            "page": 12,
            "params": {
                "type": "namakarana",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad"
            }
        },
        {
            "id": "annaprashana",
            "name": "Annaprashana",
            "page": 13,
            "params": {
                "type": "annaprashana",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad",
                "child_gender": "male"
            }
        },
        {
            "id": "choodakarana",
            "name": "Choodakarana",
            "page": 14,
            "params": {
                "type": "choodakarana",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad",
                "child_gender": "female",
                "age_mode": "months"
            }
        },
        {
            "id": "karnavedha",
            "name": "Karnavedha",
            "page": 15,
            "params": {
                "type": "karnavedha",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad",
                "timing_mode": "early"
            }
        },
        {
            "id": "upanayana",
            "name": "Upanayana",
            "page": 16,
            "params": {
                "type": "upanayana",
                "dob": "2024-05-10",
                "tob": "10:30",
                "lat": 17.3850,
                "lon": 78.4867,
                "tz_offset": 5.5,
                "place_name": "Hyderabad",
                "varna": "brahmin"
            }
        }
    ]

    for tc in samskara_test_cases:
        qs = urllib.parse.urlencode(tc["params"])
        url = f"{BASE_URL}/muhurta/samskara-finder?{qs}"
        with urllib.request.urlopen(url) as response:
            assert response.status == 200, f"Failed {tc['id']}: status {response.status}"
            data = json.loads(response.read().decode('utf-8'))
            samskara_info = data.get("samskara", {})
            b = data.get("birth_details", {})
            candidates = data.get("candidates", [])

            assert samskara_info.get("page_number") == tc["page"], f"Expected page {tc['page']}, got {samskara_info.get('page_number')}"
            assert len(candidates) > 0, f"No candidates returned for {tc['id']}!"

            cand0 = candidates[0]
            assert "percentage" in cand0
            assert "verdict" in cand0
            assert "lagna_name" in cand0
            assert "house_8_empty" in cand0
            assert "pushkara_info" in cand0
            assert "panchang" in cand0
            assert "d1_chart" in cand0
            assert "detailed_eval" in cand0

            de = cand0["detailed_eval"]
            assert "ashtama_shuddhi" in de
            assert "maha_doshas" in de
            assert "dashavidha_doshas" in de
            assert "pariharas" in de

            # Verify specialized checks per page
            if tc["id"] == "seemantha":
                assert "navama_shuddhi" in de, "Navama Shuddhi missing from Seemantha detailed eval!"
            elif tc["id"] == "annaprashana":
                assert "dashama_shuddhi" in de, "Dashama Shuddhi missing from Annaprashana detailed eval!"
            elif tc["id"] == "upanayana":
                assert "guru_strength" in de, "Guru Strength missing from Upanayana detailed eval!"

            print(f"✓ [{tc['id'].upper()}] Page {tc['page']}: {samskara_info.get('name_en')} ({samskara_info.get('name_te')})")
            print(f"    Evaluated {len(candidates)} dates | Top: {cand0.get('date')} ({cand0.get('day_label_en')}) - Score: {cand0.get('percentage')}% ({cand0.get('verdict')})")
            print(f"    Lagna: {cand0.get('lagna_name')} | Ashtama Empty: {cand0.get('house_8_empty')}")

    print("✓ All 9 Samskara API Endpoints verified successfully!")

if __name__ == "__main__":
    test_html_delivery()
    test_samskara_api_endpoints()
    print("\n=======================================================")
    print("ALL API AND UI VERIFICATION TESTS PASSED! 🚀")
    print("=======================================================")
