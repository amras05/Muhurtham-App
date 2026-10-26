import sys
import os
sys.path.insert(0, "/home/karrthikuuuuu/Documents/Projects/Muhurtham-App")
from backend.app.muhurta_finder import muhurta_finder

res = muhurta_finder(
    date_str="2026-08-20",
    lat=17.3850,
    lon=78.4867,
    tz_offset=5.5,
    place_name="Hyderabad, India",
    days=2,
    birth_dob="2026-08-01",
    birth_tob="10:30"
)

results = res.get("results", [])
print(f"Total results returned: {len(results)}")
for i, cand in enumerate(results):
    p = cand.get("panchang", {})
    de = cand.get("detailed_eval", {})
    print(f"\n--- Candidate #{i+1} on {cand.get('date')} (verdict: {cand.get('verdict')}) ---")
    print("Muhurta Lagna:", de.get("ashtama_shuddhi", {}).get("muhurta_lagna"))
    print("8th house rasi (ashtama_rasi):", de.get("ashtama_shuddhi", {}).get("ashtama_rasi"))
    print("Tithi eval:", de.get("tithi"))
    print("Chandrabalam:", de.get("chandrabalam"))
    print("Panchaka:", de.get("panchaka"))
    print("Chandramana:", p.get("chandramana"))
    print("Kala Vibhajana:", p.get("kala_vibhajana"))
    print("Lagna Schedule count:", len(p.get("lagna_schedule", [])))
    print("Pariharas count:", len(de.get("pariharas", [])))
    for pr in de.get("pariharas", []):
        print(f"  Parihara: {pr.get('name_en')} ({pr.get('name_te')}) | Status: {pr.get('status')}")
    for d in de.get("maha_doshas", []):
        if d.get("id") == 20:
            print("Dosha #20 (Gandantam):", d.get("status"), "-", d.get("name_te"), "|", d.get("desc_en"))
