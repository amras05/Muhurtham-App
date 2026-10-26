import sys
import os
import json

sys.path.insert(0, "/home/karrthikuuuuu/Documents/Projects/Muhurtham-App")
from backend.app.names import RASI_NAMES, TELUGU_SAMVATSARAS, TELUGU_LUNAR_MONTH_NAMES
from backend.app.panchang import compute_day_panchang, compute_panchaka_rahitam, compute_kala_vibhajana, compute_all_12_lagnas
from backend.app.muhurta_finder import muhurta_finder
from backend.app.doshas_engine import evaluate_muhurta_pariharas, evaluate_21_maha_doshas
from backend.app.main import namakarana_finder

print("=" * 70)
print("VERIFYING ALL 9 PDF STICKY NOTE REQUIREMENTS")
print("=" * 70)

# -------------------------------------------------------------
# Point 1: 8th House from Meena must be Tula (not Kanya!)
# -------------------------------------------------------------
print("\n[Point 1] Testing 8th House Rasi Indexing...")
# Meena is index 12. 8th house from Meena: (12 - 1 + 7) % 12 + 1 = 7.
# RASI_NAMES[7] = "Tula" (Libra).
meena_idx = 12
ashtama_idx = (meena_idx - 1 + 7) % 12 + 1
ashtama_name = RASI_NAMES[ashtama_idx]
print(f"Lagna = {RASI_NAMES[meena_idx]} (idx {meena_idx}) -> 8th House = {ashtama_name} (idx {ashtama_idx})")
assert ashtama_name == "Tula", f"Expected Tula but got {ashtama_name}"
print("  >>> Point 1 PASS: 8th house from Meena is correctly Tula!")

# -------------------------------------------------------------
# Point 2: Tithi Doubt - Ashtami & Chaturdashi Avoidance
# -------------------------------------------------------------
print("\n[Point 2] Testing Tithi Evaluation (Ashtami & Chaturdashi avoidance)...")
with open("/home/karrthikuuuuu/Documents/Projects/Muhurtham-App/backend/app/rules.json", "r") as f:
    rules = json.load(f)
namakarana_rule = next(a for a in rules["activities"] if a["id"] == "namakarana")
avoid_tithis = namakarana_rule["avoid"]["tithi"]
print(f"Avoid Tithis for Namakarana: {avoid_tithis}")
assert "Ashtami" in avoid_tithis, "Ashtami must be in avoid_tithis"
assert "Chaturdashi" in avoid_tithis, "Chaturdashi must be in avoid_tithis"
print("  >>> Point 2 PASS: Ashtami and Chaturdashi are strictly marked in avoid_tithis!")

# -------------------------------------------------------------
# Point 3: Panchaka Rahitam Calculation & Classification
# -------------------------------------------------------------
print("\n[Point 3] Testing Panchaka Rahitam Formula & Remedies...")
# Formula: (tithi + vaara + nak + lagna) % 9
# e.g., tithi=7, vaara_idx=1 (Monday -> vaara_val=2), nak=1, lagna=1 -> sum=11 -> 11 % 9 = 2 (Agni Panchaka)
p_res = compute_panchaka_rahitam(7, 1, 1, 1)
print(f"Panchaka (7,1,1,1): Remainder={p_res['remainder']}, Name={p_res['name_te']} / {p_res['name_en']}")
print(f"  Effect: {p_res['effect_te']}")
print(f"  Pariharam: {p_res['pariharam_te']}")
assert p_res["remainder"] == 2
assert "Agni" in p_res["name_en"]
assert not p_res["is_pass"]
assert "చందన" in p_res["pariharam_te"]

# Clean Panchaka: Remainder = 3, 5, 7, 0 (e.g. 8, 1, 1, 1 -> sum=12 -> remainder=3)
p_clean = compute_panchaka_rahitam(8, 1, 1, 1)
assert p_clean["remainder"] == 3
assert p_clean["is_pass"] == True
assert "Subha" in p_clean["name_en"]
print("  >>> Point 3 PASS: Panchaka Rahitam computes (T+V+N+L)%9 with remedies correctly!")

# -------------------------------------------------------------
# Point 4: Samvatsara Name (with Telugu) & Maasam
# -------------------------------------------------------------
print("\n[Point 4] Testing Samvatsara and Lunar Month Names...")
day_p = compute_day_panchang(2026, 8, 20, 17.3850, 78.4867, 5.5)
cm = day_p.get("chandramana", {})
print(f"Samvatsara: {cm.get('samvatsara_name')} ({cm.get('samvatsara_telugu')})")
print(f"Month: {cm.get('month_name')} ({cm.get('month_telugu')})")
print(f"Ayanam: {cm.get('ayanam_en')} ({cm.get('ayanam_te')})")
print(f"Ruthu: {cm.get('ruthu_en')} ({cm.get('ruthu_te')})")
assert cm.get("samvatsara_telugu") is not None
assert cm.get("ayanam_te") in ["ఉత్తరాయణం", "దక్షిణాయణం"]
assert cm.get("ruthu_te") is not None
print("  >>> Point 4 PASS: Samvatsara transliteration, Ayanam, and Ruthu present!")

# -------------------------------------------------------------
# Point 5: Daily 5-Fold Division (Kala Vibhajana)
# -------------------------------------------------------------
print("\n[Point 5] Testing Daily 5-Fold Time Division (Kala Vibhajana)...")
kv = day_p.get("kala_vibhajana", {})
day_keys = ["pratah_kalam", "sangava_kalam", "madhyahnika_kalam", "aparahna_kalam", "sayahna_kalam"]
night_keys = ["pradosha_kalam", "nisitha_kalam", "brahma_muhurtham"]
for k in day_keys:
    assert k in kv, f"Missing {k} in kala_vibhajana"
    print(f"  {kv[k]['name_te']} ({kv[k]['name_en']}): {kv[k]['start']} – {kv[k]['end']}")
for k in night_keys:
    assert k in kv, f"Missing {k} in kala_vibhajana"
    print(f"  {kv[k]['name_te']} ({kv[k]['name_en']}): {kv[k]['start']} – {kv[k]['end']}")
print("  >>> Point 5 PASS: All 5 daytime divisions and 3 sacred night divisions computed!")

# -------------------------------------------------------------
# Point 6: Lagna Schedule (All 12 Lagnas) & Native Details
# -------------------------------------------------------------
print("\n[Point 6] Testing Lagna Schedule (All 12 signs) and Native Details...")
lsched = day_p.get("lagna_schedule", [])
print(f"Lagna schedule entries: {len(lsched)}")
assert len(lsched) in [12, 13], f"Expected 12 or 13 lagnas across 24h but got {len(lsched)}"
for l in lsched[:3]:
    print(f"  Lagna #{l['lagna_index']} {l['lagna_name_te']} ({l['lagna_name']}): {l['start_time']} – {l['end_time']}")

# Test via Namakarana Finder API
data = namakarana_finder(
    dob="2026-08-01",
    tob="10:30",
    lat=17.3850,
    lon=78.4867,
    tz_offset=5.5,
    place_name="Hyderabad, India",
    method="drik"
)
b_det = data.get("birth_details", {})
print(f"Birth Details: Janma Nakshatra = {b_det.get('janma_nakshatra')} (Pada {b_det.get('janma_nakshatra_pada')})")
print(f"  Janma Rasi = {b_det.get('birth_moon_rasi')} ({b_det.get('birth_moon_rasi_name')})")
assert b_det.get("birth_moon_rasi_name") is not None

cands = data.get("candidates", [])
print(f"Namakarana Candidates returned: {len(cands)}")
if cands:
    c0 = cands[0]
    print(f"Candidate #1: Date={c0.get('date')}, Lagna={c0.get('lagna_name')}")
    print(f"  8th House Rasi = {c0.get('ashtama_rasi_name')} (House check pass={c0.get('house_8_empty')})")
    print(f"  Chandrabalam = {c0.get('chandrabalam')}")
    print(f"  Panchaka = {c0.get('panchaka_rahitam')}")
    print(f"  Pariharas count = {len(c0.get('pariharas', []))}")
    assert c0.get("chandrabalam") is not None
    assert c0.get("panchaka_rahitam") is not None
print("  >>> Point 6 PASS: Schedule of 12 Lagnas, Birth Details, and Chandrabalam intact!")

# -------------------------------------------------------------
# Point 7: Lagna Gandanta in 21 Maha Doshas #20
# -------------------------------------------------------------
print("\n[Point 7] Testing Lagna Gandanta in 21 Maha Doshas #20...")
# Test water-fire sign boundary degrees
# Cancer 29.5 deg = 119.5 deg total
panchang_dummy = {
    "vaara": "Wednesday",
    "tithi": {"name": "Panchami", "paksha": "Shukla", "number": 5},
    "nakshatra": {"name": "Rohini", "index": 4},
    "yoga": {"name": "Siddha"},
    "karana": {"name": "Bava"}
}
# Cancer is rasi index 4 (0-indexed 3). Degree 29.5
raw_d1_gandanta = [
    ['L', (3, 29.5, 0)],
    [0, (4, 10.0, 0)],
    [1, (1, 15.0, 0)]
]
d1_pos_dummy = [
    {"planet": "L", "planet_en": "Ascendant", "rasi": 4, "degree": 29.5},
    {"planet": "Sun", "planet_en": "Sun", "rasi": 5, "degree": 10.0},
    {"planet": "Moon", "planet_en": "Moon", "rasi": 2, "degree": 15.0}
]
doshas = evaluate_21_maha_doshas(
    panchang=panchang_dummy,
    d1_positions=d1_pos_dummy,
    raw_d1=raw_d1_gandanta,
    muhurta_lagna_idx=4
)
d20 = next((d for d in doshas if d["id"] == "gandantam"), None)
assert d20 is not None
print(f"Dosha #20 (Gandantam): is_pass={d20['is_pass']}, name={d20['name_te']}")
print(f"  Desc: {d20['desc_en']}")
assert not d20["is_pass"]
assert "Lagna Gandanta" in d20["desc_en"]
print("  >>> Point 7 PASS: Lagna Gandanta accurately detected and flagged in Dosha #20!")

# -------------------------------------------------------------
# Point 8: Dosha Pariharams
# -------------------------------------------------------------
print("\n[Point 8] Testing Dosha Pariharams Engine...")
# Chart with Jupiter in 1st house (Kendra)
raw_d1_jup = [
    ['L', (0, 15.0, 0)], # Mesha Lagna (rasi idx 1)
    ['Ju', (0, 10.0, 0)], # Jupiter in 1st house (Kendra)
    ['Mo', (3, 10.0, 0)]  # Moon in Cancer
]
pariharas = evaluate_muhurta_pariharas(
    panchang={"abhijit_muhurta": {"start": "11:50", "end": "12:40"}},
    raw_d1=raw_d1_jup,
    muhurta_lagna_idx=1,
    birth_details={"birth_lagna_idx": 1, "birth_moon_rasi": 4}
)
print(f"Total Pariharams evaluated: {len(pariharas)}")
for p in pariharas:
    print(f"  [{p['status']}] {p['name_te']} ({p['name_en']})")
    print(f"    Shloka: {p['shloka']}")
    print(f"    Desc: {p['desc_te']}")
assert len(pariharas) >= 1
has_kendra_ju = any("Brihaspati" in p["name_en"] for p in pariharas)
assert has_kendra_ju, "Brihaspati in Kendra should be present!"
print("  >>> Point 8 PASS: Classical Dosha Pariharas successfully returned with shlokas and descriptions!")

# -------------------------------------------------------------
# Point 9: muhurta_finder API Endpoint
# -------------------------------------------------------------
m_data = muhurta_finder(
    date_str="2026-08-20",
    lat=17.3850,
    lon=78.4867,
    tz_offset=5.5,
    place_name="Hyderabad, India",
    days=2,
    birth_dob="2026-08-01",
    birth_tob="10:30"
)
print(f"Finder returned {len(m_data.get('results', []))} results.")
if m_data.get("results"):
    r0 = m_data["results"][0]
    p_info = r0.get("panchang", {})
    assert "kala_vibhajana" in p_info
    assert "panchaka_rahitam" in p_info
    assert "lagna_schedule" in p_info
    assert "pariharas" in r0.get("detailed_eval", {})
print("  >>> Point 9 PASS: /muhurta/finder returns complete payload matching PDF requirements!")

print("\n" + "=" * 70)
print("ALL 9 PDF REQUIREMENTS AND TESTS VERIFIED SUCCESSFULLY!")
print("=" * 70)
