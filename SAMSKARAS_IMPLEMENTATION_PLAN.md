# Implementation Plan — Completing the Shodasa Samskaras (16/16)

**Source:** `main.docx` — Dr. Vamsee Nemani's Muhurta Shastra treatise (Part 3 – షోడశ సంస్కారములు; Part 4 – దోష మార్జనములు; Part 5 – ఉపనయనం / వివాహం / అంత్యేష్ఠి / ప్రయాణం)
**Target:** backend/app/samskaras_engine.py — `SAMSKARA_REGISTRY` currently holds **9 of 16** samskaras.
**Baseline status:** garbhadhana, pumsavana, seemantha, jatakarma, namakarana, annaprashana, choodakarana, karnavedha, upanayana are live (pages 8–16).

---

## 1. Current architecture (what we extend, not rewrite)

```
SAMSKARA_REGISTRY  ──per-samskara rule dict (vaara/tithi/lagna/nakshatra/yoga/karana/tara lists + special_checks)
generate_candidate_dates(samskara_id, base_date, **kwargs)   ── shastra-based candidate days
find_samskara_muhurtas(...)        ── evaluates each candidate day: pans 24h, applies rule lists,
                                      special checks, Tarabalam, Pushkara window, dosha engine
GET /muhurta/samskara-finder       ── endpoint with per-samskara query params
GET /muhurta/samskaras/list        ── registry listing for the UI
```

Promoting a new samskara therefore requires exactly:

1. A new entry in `SAMSKARA_REGISTRY` (rules from the treatise + `page_number`).
2. A new branch in `generate_candidate_dates()`.
3. Any new `special_checks` implemented in the evaluator + reusable helper functions.
4. New query parameters in `/muhurta/samskara-finder` (only where needed).
5. Telugu/English strings already localize via the registry itself.
6. UI: `panchang-lookup.html` samskara picker + mobile app auto-pick up new ids from `/muhurta/samskaras/list`.

---

## 2. The 7 missing samskaras — batch breakdown

### Sprint A — Low-effort batch (fits existing evaluator; no new check types)

#### A1. `samavartana` (స్నాతకవ్రతం / సమావర్తనం) — treatise Part 5.1
- **Timing rule:** after godana (keshanta), before vivaha; usually the year following upanayana completion of Veda study — engine candidate generator: "Nth year (user-input), Uttarayana months Feb–May", mirroring the `upanayana` branch with year = configurable (default: upanayana year + study duration input).
- **Registry rules:** good_vaaras [2,4,5,6]; shubha lagnas [2,3,4,6,9,12]; avoid rikta tithis [4,9,14,30]; avoid_taras [1,3,5,7].
- **special_checks:** `ashtama_shuddhi`, `lagna_shuddhi`, `uttarayana_only`, `daytime_only`.
- **New query param:** `study_years` (int, optional).

#### A2. `keshanta_godana` (గోదానవ్రతము — కేశాంతం) — treatise Part 3 & 5.1
- **Timing rule:** 16th year (classical), Uttarayana, before samavartana. Threads on Choodakarana pattern (gender/age modes) with `age_mode="years"`.
- **Registry rules:** reuse choodakarana ban list, add good lagnas [2,3,4,6,9,12].
- **special_checks:** `uttarayana_only`, `ashtama_shuddhi`, `daytime_only`.

#### A3. `aksharabhyasam` (అక్షరాభ్యాసం / విద్యారంభం) — treatise Part 5.1
- **Timing rule:** doc specifies Vasanta/Sharad ritu months; candidates on Basant Panchami/Sri Rama Navami/Vijayadashami + generic scan, ages 3–5 (mode selectable).
- **special_checks:** `anadhyaya_check` (NEW — see §3.5), `daytime_only`, `ashtama_shuddhi`.
- **Note:** the doc lists "నిత్యము వచ్చే అనధ్యాయములు / నైమిత్తిక అనధ్యాయములు" — this requires an `ANADHYAYA_TABLE` (see §3.5).

#### A4–A7. The four vratas (treatise Part 3, items 9–12) — `prajapatya_vrata`, `saumya_vrata`, `agneya_vrata`, `vaishvadeva_vrata`
- Doc groups them as one family: post-upanayana, daytime, shubha lagna, ashtama-shuddhi; timing differences are only in candidate windows (e.g., Prajapatya = one year after upanayana, in Uttarayana).
- **Drive from data:** registry entries with `family: "post_upanayana_vrata"` shared rules + per-samskara month offsets in `generate_candidate_dates` so four ids ship in one PR from a single shared candidate-generator branch.

### Sprint B — High-effort, high-value

#### B1. `vivaha` (వివాహం) — treatise Part 5.2 — **Top priority, user-facing**
Rule set to digitize (from the doc):
- **Marriage-eligible years** (వివాహము చేయదగిన సంవత్సరములు) — year rules vs. birth star.
- **Shubha / ashubha marriage months** — e.g. Magha, Phalguna, Vaishakha, Jyeshta favourable; Ashadha, Shravana, Bhadrapada, Pushya, Margasira prohibited (digitize exact table).
- **Nishiddha kalam** — prohibits, incl. Adhika masa, shunya masa handling (see §3.6).
- **Vaara + nakshatra suitability matrix** (వివాహానికి అనుకూల/అననుకూల వార-నక్షత్రములు).
- **Guru / Shukra / Chandra avasthas** (గురు శుక్ర చంద్రుల అవస్థలు) — Jupiter not combust/neutralized; Venus visibility; Moon strength at muhurta.
- **Trijashta** (త్రిజేష్ఠ) — avoid the 18 nakshatra positions rule.
- **Vivaha Guru-phala** & **sahodara vivaha kala** rules.
- **Yogya/ayogya sambandhamulu** — 7/5 clusters star compatibility between bride & groom.
- 🆕 special_checks to implement:
  - `vivaha_month_shuddhi` (good/avoid month table + adhika handling)
  - `tri Jasht star` `trijashta_star`
  - `guru_shukra_avastha` (retro/combust state of Jupiter & Venus at muhurta — swisseph already returns retro; combust needs elongation check)
  - `moon_strength` (Moon in kendra/paksha bala)
  - `sambandha_star_check` (bride/groom 7-5 star matrix)
- **Candidate generator:** scan the whole year (Mar–May + Nov–Jan windows per the doc's month table), rank by score.
- **Query params:** `groom_dob`, `groom_tob`, `bride_dob`, `bride_tob` (both janma nakshatra/rasi → tarabala, sambandha, chandrashtama both sides), `bride_month_mode`.

#### B2. `antyeshti` / `pitrukarya` (అంత్యేష్టి / పితృక్రియ) — treatise Part 5.3
Not a lagna-based samskara (urgency + fixed schedule), so implement a **dedicated engine** `pitrukarya_engine.py` + separate endpoint rather than forcing it into `SAMSKARA_REGISTRY`:
- **Tithi nirnaya** — which tithi/day the ceremony should be done (daaha/sapindikarana day rules).
- **Sannavati shraddha**, **Ashtaka shraddha**, **Gaya shraddha** schedule builder (annual calendar, not muhurta search).
- **Nitya shraddha nirnaya**, **ekadasha-ahavividdhi**.
- **Asti-sanchaya kalam**, **sapindi karana**, **tripakshi shraddha** windows.
- **Sankranti punyakala nirnaya** (reuse panchang's sankranti computation).
- **Akhanda tithi-nakshatra** determination.
- **Tilodaka/Vasodaka** application dates + their nishiddha kalam.
- **Abhyangana nishetha kalam** (reuse varjyam/durmuhurta validators).
- **Mode:** `pending` (find next permissible window after death date) and `calendar` (annual Ashtaka/tilodaka dates for a gregorian year).
- **Query params:** `death_date`, `death_tob`, `gotra`/`relation` optional, `mode`.

### Sprint C — treatise-coverage extras

#### C1. `upanayana` upgrades (Part 5.1 in doc beyond current registry)
- `auakshantara` year calculation → refine `varna_years` with `_month_offset` precision (get month precision instead of strict years 8/11/12).
- `varunesha` checks, `vedadhipati` determination, `shajjanma` nakshatra warnings → new special_checks.

#### C2. Travel muhurtas (`prayana`) — treatise Part 5.4
- Varashula nakshatras, gatra-bheda, Abhijit/Dhanishta-panchaka travel restrictions, shubha/ashubha lakshanamulu.
- Likely better in `rules_engine` + a new `prayana_engine.py` endpoint.

---

## 3. New shared special-checks (engine work)

| Check | Used by | Implementation |
|---|---|---|
| 3.1 `uttarayana_only` | upanayana (exist), samavartana, keshanta | exists; just enable for new families |
| 3.2 `guru_shukra_avastha` | vivaha | swisseph retro flag + combust (Sun-planet elongation < threshold) |
| 3.3 `sambandha_star` | vivaha | 7/5 star cluster matrix table |
| 3.4 `trijashta_star` | vivaha | 18-position nakshatra table |
| 3.5 `anadhyaya_check` | aksharabhyasam | new `ANADHYAYA_TABLE` — recurring (massidge/naadha-dependent) + nimittika categories |
| 3.6 `masa_shuddhi` | vivaha, samavartana, keshanta | month tables incl. Adhika/Shunya masa detection (reuse chandramana module or nama-samvatsara logic) |
| 3.7 `tithi_urgency` | antyeshti | time-locked tithi computation (doc: తిధి నిర్ణయము rules) |
| 3.8 `sankranti_punyakala` | antyeshti (calendar) | expose sankranti moments from panchang calculator |

Common engine additions:
- `muhurta_pariharas` (already in doshas_engine.py) — wire vivaha/antyeshti results into the same parihara evaluation so they benefit from guru-drishti/pushkara/abhijit overrides automatically.
- Persist: update `scratch/test_all_samskaras.py` to iterate all 16 ids and verify verdict consistency.

---

## 4. API surface after completion

```
GET /muhurta/samskaras/list               → 16 entries (was 9)
GET /muhurta/samskara-finder              → adds: samavartana, keshanta_godana,
                                            aksharabhyasam, 4 vratas, vivaha
GET /muhurta/pitrukarya/finder            → mode=pending|calendar   (new file)
GET /muhurta/pitrukarya/calendar          → annual Ashtaka/tilodaka/sankranti dates (new)
GET /muhurta/vivaha/compatibility         → bride/groom star sambandha pre-check (new, optional)
```

`/muhurta/samskara-finder` new optional params:
`study_years`, `age_mode` (already exists), `groom_dob`, `groom_tob`, `bride_dob`, `bride_tob`, `purpose_year`.

---

## 5. Data-extraction worklist (main.docx → constants)

Each missing samskara needs doc tables transcribed to the registry — assign as independent tasks so calc-code W can run in parallel with digitization W:

| Doc section (Telugu) | Feeds |
|---|---|
| షోడశ సంస్కారములు ప్రయోజనములు | taglines/descriptions for all new entries |
| ఉపనయనమునకు ఔక్షాంతరము | C1 upanayana year precision |
| వివాహము చేయదగిన సంవత్సరములు | vivaha year table |
| వివాహ విషయమై శుభ/అశుభ మాసములు | vivaha masa table |
| వివాహ నిషిద్ధ కాలము | vivaha nishiddha guard |
| త్రిజేష్ఠ వివరణ | TRIJASHTA table |
| వివాహమునకు యోగ్య/అయోగ్య సంబంధములు | SAMBANDHA matrix |
| అంత్యేష్ఠి: తిధి నిర్ణయము / షణ్ణవతి శ్రాద్ధ / అష్టకా / గయా | pitrukarya tables |
| అనధ్యాయములు (నిత్య + నైమిత్తిక) | ANADHYAYA_TABLE |
| అభ్యంగన నిషేధ కాలము | antyeshti abhyangana guard |

---

## 6. Milestones & effort estimate

| Milestone | Contents | Est. |
|---|---|---|
| M1 | Sprint A: 7 low-effort samskaras + shared vrata branch + doc-constants | 1 week |
| M2 | Shared checks §3.3–3.6 + `ANADHYAYA_TABLE` | 1 week |
| M3 | Vivaha engine (B1) full rule set + compatibility endpoint | 2 weeks |
| M4 | Pitrukarya engine (B2) + calendar endpoints | 1.5 weeks |
| M5 | Upanayana upgrades + Travel + scratch test expansion for 16/16 + UI/mobile parity | 1 week |

---

## 7. Acceptance criteria

- [ ] `/muhurta/samskaras/list` returns exactly 16 samskaras (or 15 + separate pitrukarya module).
- [ ] Every new samskara produces scored candidate windows with Telugu + English rule summaries traced back to a doc page number in the registry entry.
- [ ] All common checks (tarabala, panchaka, pushkara, mahadoshas, pariharas) run automatically for the new ids via the existing evaluator path.
- [ ] Vivaha: bride/groom both validated (chandrashtama both sides, sambandha, avasthas, trijashta).
- [ ] Antyeshti: tithi-locked outputs for `pending` mode; a full calendar year of Ashtaka/sapindi/sankranti dates in `calendar` mode.
- [ ] `scratch/` tests pass for all 16 ids against the live API.
