# Muhurtham App — API Reference

Base URL (local dev): **`http://127.0.0.1:8555`**
Run: `cd backend && source ../.venv/bin/activate && PYTHONPATH="../backend:.." uvicorn app.main:app --host 127.0.0.1 --port 8555`

Interactive schema: `GET /docs` (Swagger) · `GET /redoc`

All endpoints are `GET` unless marked **POST**. All dates are `YYYY-MM-DD`, times `HH:MM` (24h).

---

## Common parameters

| Param | Type | Req | Default | Notes |
|---|---|---|---|---|
| `date` | str | ✔ | — | `YYYY-MM-DD` |
| `lat` | float | ✔ | — | Decimal degrees (North +) |
| `lon` | float | ✔ | — | Decimal degrees (East +) |
| `tz_offset` | float | ✔ | — | Hours from UTC, e.g. `5.5` for IST |
| `place_name` | str |  | `"Location"` | Display label, free text |
| `method` | str |  | `"drik"` | `"drik"` or `"chandramana"` |

---

## System

### `GET /health`
Liveness probe. → `{"status": "ok"}`

### `GET /activities`
List every activity the app has digitized rules for (used as `activity_id` in `/muhurta/*`).

---

## Panchang

### `GET /panchang`
Full drik panchang for a date/place — powers the "Date Lookup" screen.

| Param | Req | Default | Notes |
|---|---|---|---|
| `date` | ✔ | — | |
| `lat`, `lon`, `tz_offset` | ✔ | — | |
| `place_name` |  | `"Location"` | |
| `hour` |  | `6` | Hour of day to evaluate at (0–23) |
| `method` |  | `"drik"` | |

**Example:** `/panchang?date=2026-10-26&lat=16.5062&lon=80.648&tz_offset=5.5&place_name=Vijayawada`

### `GET /panchang/day-summary`
Panchang **+ verdict for every known activity** on this date in one call (favorable / avoid / mixed buckets — powers "what's good today").

Same params as `/panchang` (no `hour` param).

### `GET /panchang/simple`
Basic panchang using a region preset (no lat/lon needed).

| Param | Req | Default | Notes |
|---|---|---|---|
| `date` | ✔ | — | |
| `region` | ✔ | — | Region id from `/regions` (e.g. `vijayawada`) |
| `method` |  | `"drik"` | |

### `GET /regions`
List available region presets for the dropdown → `[{id, label, lat, lon, tz_offset}, …]`

---

## Places (OpenStreetMap / Nominatim)

### `GET /geocode`
Free-text place → coordinates. For places not in `/regions`.

| Param | Req | Notes |
|---|---|---|
| `place` | ✔ | Any place name, e.g. `Kakinada, Andhra Pradesh` |

→ `{label, lat, lon, …}` · 404 if not found · 502 on upstream error.

### `GET /geocode/suggestions`
Autocomplete suggestions while typing (used by the frontend place search).

| Param | Req | Notes |
|---|---|---|
| `q` | ✔ | Query string, min **3** chars |

→ `[{label, …}, …]` · incomplete queries return `[]`.

---

## Muhurta (single-activity)

### `GET /muhurta/check`
Is *this* date good for *this* activity? (single-date check)

| Param | Req | Default |
|---|---|---|
| `activity_id` | ✔ | — (id from `/activities`) |
| `date` | ✔ | — |
| plus common params | ✔ | `place_name="Location"`, `hour=6`, `method="drik"` |

404 for unknown `activity_id`.

### `GET /muhurta/next`
Find the **next favorable date** for an activity (core "Activity Search").

| Param | Req | Default | Notes |
|---|---|---|---|
| `activity_id` | ✔ | — | |
| `from_date` |  | today | `YYYY-MM-DD` |
| `max_days` |  | `60` | Search window cap, ≤ 180 |
| plus common params | ✔ | | |

---

## Samskaras (16 Shodasa Samskaras — treatise rules)

### `GET /muhurta/samskaras/list`
List all 16 digitized Samskaras with metadata:
`id, page_number, name_en/te, tagline_en/te, icon, rules_summary_en/te, special_checks[]`

### `GET /muhurta/samskara-finder`
Find the best classical Muhurtas for any of the 16 Samskaras.

**Required**

| Param | Notes |
|---|---|
| `type` | Samskara id — one of: `garbhadhana`, `pumsavana`, `seemantha`, `jatakarma`, `namakarana`, `annaprashana`, `choodakarana`, `karnavedha`, `upanayana`, `samavartana`, `keshanta_godana`, `aksharabhyasam`, `prajapatya_vrata`, `saumya_vrata`, `agneya_vrata`, `vaishvadeva_vrata`, `vivaha` |
| `dob` | Reference date: birth date / LMP date / target date (`YYYY-MM-DD`) |
| `lat`, `lon`, `tz_offset` | |

**Common optional**

| Param | Default | Notes |
|---|---|---|
| `tob` | `12:00` | Birth/reference time |
| `place_name` | `"Location"` | |
| `method` | `"drik"` | |

**Samskara-specific optional params**

| Param | Values | Used by |
|---|---|---|
| `child_gender` | `male` / `female` | Annaprashana, Choodakarana |
| `ceremony_type` | `seemantha` / `valaikappu_gajulu` | Seemantha |
| `timing_mode` | `early` (12/16 days) / `later` (6/7/8 months) | Karnavedha |
| `age_mode` | `months` / `years` | Choodakarana |
| `varna` | `brahmin` (8th yr) / `kshatriya` (11th) / `vaishya` (12th) | Upanayana |
| `study_years` | int | Samavartana, Keshanta/Godana (def. 16), Aksharabhyasam (def. 5), post-Upanayana vratas |
| `husband_moon_rasi_idx` | 1–12 | Garbhadhana (Chandrashtama check) |
| `husband_nak_idx` | 1–27 | Husband janma nakshatra |
| `bride_ritu_lagna_idx` | 1–12 | Garbhadhana |
| `bride_nak_idx` | 1–27 | **Vivaha** (Tarabala / Trijashta star checks) |

**Response shape (per candidate):**
`date, day_label_en/te, percentage, verdict, lagna_name, tara, reasons[], pushkara_info{}, panchang{vaara, tithi{name,paksha}, yoga{name,start_time,end_time}, karana{…}, …}, chandrabalam, panchaka_rahitam, detailed_eval{maha_doshas[], dashavidha_doshas[]}`

> 📿 **Treatise scope note:** the 21 Maha Doshas, 10 Dashavidha Doshas, and the Rikta-tithi (4, 9, 14) + Amavasya varjyam rules are evaluated **only for `type=vivaha`**. Other samskaras get their own tithi/nakshatra restrictions instead.

**Example:**
`/muhurta/samskara-finder?type=namakarana&dob=2025-06-15&tob=08:30&lat=17.385&lon=78.4867&tz_offset=5.5&place_name=Vijayawada`

**Example (Vivaha):**
`/muhurta/samskara-finder?type=vivaha&dob=1995-03-10&tob=10:15&bride_nak_idx=14&lat=17.385&lon=78.4867&tz_offset=5.5`

**Upanayana participant Tarabala (treatise addendum — "తల్లి తండ్రి వటువు అవకాశం ఉంటే గురువుగారి నక్షత్రం కూడా చూడాలి"):**
optional `mother_nak_idx`, `father_nak_idx`, `guru_nak_idx` (1–27). Each known participant's Tara is computed from their janma nakshatra to the candidate star; adverse Taras (1/3/5/7) deduct 8 points each (soft dosha, not strict rejection). Response candidates carry `participant_tarabala: [{who: mother|father|guru, tara, tara_idx, is_pass, …}]`.

### `GET /muhurta/namakarana-finder`
Backwards-compatible shortcut = `samskara-finder` with `type=namakarana`.
Params: `dob` (req), `tob`, `lat`, `lon`, `tz_offset`, `place_name`, `method`.
Namakarana windows: **11th, 12th, 16th, 20th, 22nd day** from birth.

---

## Antyeshti / Pitrukarya (treatise Part 5.3)

### `GET /muhurta/pitrukarya-finder`
Tithi-locked karya windows (not lagna-based).

| Param | Req | Default | Notes |
|---|---|---|---|
| `death_date` | ✔ | — | `YYYY-MM-DD` |
| `lat`, `lon`, `tz_offset` | ✔ | — | |
| `place_name` |  | `"Location"` | |
| `mode` |  | `pending` | `pending` = next permissible days after death · `calendar` = annual Ashtaka/Sankranti calendar |
| `calendar_year` |  | — | Gregorian year (calendar mode only) |

---

## Dev utilities

### `POST /dev/save-pdf`
Persist a client-generated (pdfmake) PDF to the project root, served via `/files/`.

**Body (JSON):**
```json
{ "b64": "<base64 of the PDF>", "name": "MY_FILE_suffix.pdf" }
```
> ⚠️ The key is **`b64`** — sending any other key silently saves a 0-byte file.

→ `{"saved": "<abs path>", "bytes": <n>}`

**Static mounts (dev only):**
- `GET /files/<name>` — serves the project root (generated PDFs, HTML pages)
- `GET /static/<name>` — serves `backend/app/static/` (fonts, assets)

---

## Error codes

| Code | Meaning |
|---|---|
| `400` | Bad/missing parameter (malformed date, rejected samskara options) |
| `404` | Unknown `activity_id` / region / place not found |
| `500` | Engine calculation failure |
| `502` | Upstream geocoding (Nominatim) failure |
