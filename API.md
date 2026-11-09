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

## Muhurta Finder (YAML rule engine, one tab per category)

### `GET /muhurta/catalog`
An event with `extends` (e.g. `shop_opening` → `business_start`) reuses that event's book rules
and overrides only its own name, tab and people; its `source.notes` says so. `tabs` lists the 17 app tabs in display order (`id`, `en`, `te`, `order`, `count`, `events`), following
Dr. Nemani's category index; `sub_groups` gives headings used inside a tab (e.g. House: land,
construction, entry). `categories` still groups events by rule folder for older clients.
Each event carries `id`, `tab`, `also_in` (other tabs that list it), `sub_group`, `category` (rule folder),
`title_en`, `title_te`, `description_en/te`, `tab_inputs` (extra form groups),
`informational` (reference only, e.g. surgery) and `alternatives` (the book's second lists).

### `POST /muhurta/find`
JSON body. Required: `activity_id`, `start_date`, `lat`, `lon`, `tz_offset`. Main optional fields:

| Field | Notes |
|---|---|
| `days_to_scan` | 1–60 (ignored for dependent events such as `ankurarpana`) |
| `strictness` | `strict` (default) drops windows with a fatal mahadosha; `lenient` keeps them with a warning |
| `rule_variant` | id of an alternative list from the catalog |
| `janma_nak_idx`, `janma_moon_rasi_idx`, `birth_lagna_idx` | Tarabala, Chandrabala, Lagnashtama |
| `child_dob`, `child_gender` | Samskara age windows (`boy` / `girl`) |
| `conception_date` | Pumsavana, Seemantonnayana |
| `main_event_date` | Ankurarpana (main samskara), Nutana vadhu pravesha (wedding), Pitru rites (date of passing) |
| `father_nak_idx`, `mother_nak_idx`, `guru_nak_idx` | Upanayana tarabala |
| `groom_nak_idx`, `bride_nak_idx`, `groom_rasi_idx`, `bride_rasi_idx`, `groom_eldest`, `bride_eldest` | Vivaha tarabala, Guru bala, Trijyeshtha |
| `travel_direction`, `travel_purpose`, `travel_exemption` | Prayana shula, purpose lagnas, Venus rule exemption |
| `time_preference` | `any`, `morning` (sunrise–midday), `afternoon` (midday–sunset), `evening` (first quarter of the night), `night` |
| `participants` | People taking part (preferred over the flat fields above). Each: `role`, `name`, `gotra` (printed only), `janma_nak_idx`/`janma_pada`, `nama_nak_idx`/`nama_pada` (kept separate), `rasi_idx`, `lagna_idx`, `birth_date`, `gender`, `eldest`; with `from_birth: true` also `birth_time` or `birth_time_unknown`, and `birth_place`/`birth_lat`/`birth_lon`/`birth_tz_offset` (event place if omitted). The catalog's `participants` list gives each event's roles, `level` (L1 required, L2 optional), `primary`, `star_basis` (`janma` or `nama`) and extra `fields`. |

Each candidate also carries `detail`: `limb_times` (start/end of the running tithi, nakshatra with
`pada`, yoga and karana), `lagna` (`degree_dms` one minute into the window, navamsa, pushkara),
`people` (tarabala and chandrabala for every participant), `planet_strength` (Jupiter and Venus:
`clear`, `combust`, `bala`, `vriddha`; Moon: waxing/waning and % lit), `cut_by` (bad periods that
overlapped this lagna) and `verdict_en` / `verdict_te`. A serious dosha caps the grade at
"middling" (`percentage` ≤ 74); a fatal one, kept only in Lenient mode, at "avoid" (≤ 49).

`detailed_eval` also has `special_yogas` (good yogas formed in the window, with bonus `points`),
`yoga_doshas` (yogas unwanted for this category, e.g. Tripushkara for pitru rites) and
`extra_checks` (paksharandhra, kshaya tithi, papa drishti on lagna/7th; bandhana nakshatra and
tithi tyajya are `not_evaluated` until the author supplies the tables). Which checks apply, and how
severely, comes from `rules/shared/dosha_profiles.yaml` (default ← tab ← event); the yoga tables
are in `rules/shared/special_yogas.yaml`. A dosha row may carry `exemption` (parihara ids that
relieve it, from the profile's `exemptions`; in Lenient mode its severity drops to `info`).

### `GET /muhurta/yogas/catalog` · `POST /muhurta/yogas`
Special Yogas search without an event. Body: `start_date`, `days_to_scan` (≤ 60), `lat`, `lon`,
`tz_offset`, `place_name`, `yogas` (any of: `siddhi`, `amrita_siddhi`, `sarvartha_siddhi`,
`dvipushkara`, `tripushkara`), `conditions` (all of: `abhijit`, `pushkara_navamsa`, `panchaka_free`,
`tarabala`, `chandrabala`, `bad_times_free`, `durmuhurta_free`, `varjyam_free`), optional
`janma_nak_idx` / `janma_rasi_idx`. Returns `windows` (date, start, end, weekday, tithi, nakshatra,
lagna when a lagna condition was chosen, yogas formed) and `warnings`.

### `POST /muhurta/pitru-calendar`
Body: `mode`, `lat`, `lon`, `tz_offset`, `place_name`, plus:
- `annual` — `death_date`, `death_time` (sets the tithi; noon with a warning if omitted), `years` (1–10):
  the death tithi in the same nija Amanta month each year, on the day whose aparahna it covers most.
- `after_death` — `death_date`, `death_time`: tilodaka days 1–10, ekadashaha, sapindikarana (day 12),
  the 12 masikas and the first annual shraddha (day of death = day 1).
- `shannavati` — `year`: amavasya, sankranti, manvadi, yugadi, vyatipata, vaidhriti, mahalaya,
  ashtaka, anvashtaka and purvedyuh days (tables in `rules/shared/pitru_calendar.yaml`, author to confirm).

With an unknown birth time the lagna is never used, and a janma nakshatra or rashi that changed during the
birth day is left unset (a warning says so). The response echoes the resolved `participants` and adds
any input warnings to `warnings`. The main participant's birth date also feeds age rules (`child_dob`).

Response adds `rejection_summary` (most common reasons windows were rejected), `warnings`
(checks skipped for missing input), `strictness` and `rule_variant`. Each candidate's
`detailed_eval.maha_doshas` / `dashavidha_doshas` rows carry `status`
(`pass`, `fail`, `not_evaluated`, `not_applicable`), `severity` and `book_ref`; `is_pass` is
`null` when a check was not evaluated. `date` is the calendar date of the window start;
`panchang_day` is the sunrise-to-sunrise day it belongs to.

Errors: 400 for a missing `main_event_date` or an unknown `rule_variant`; 404 for an unknown
`activity_id`; 500 if a rule file contains an unknown name.

---

## Samskaras and Pitrukarya (retired)

The old endpoints `GET /muhurta/samskaras/list`, `/muhurta/samskara-finder`, `/muhurta/namakarana-finder` and
`/muhurta/pitrukarya-finder` were removed on 9 Nov 2026 (plan R4). Every samskara is searched with
`POST /muhurta/find` (see the catalog at `GET /muhurta/catalog`), and pitru dates with `POST /muhurta/pitru-calendar`.

## Accounts (`/auth`, `/user`, `/me`, `/admin`)

Stored in PostgreSQL (schema `app`). Existing request and response shapes are unchanged (fields
were only added).

### Sessions
Login and `/auth/verify-otp` return `token` (= `access_token`, valid 30 minutes),
`refresh_token` and `expires_in` (seconds). Each login is a session (one per device).

| Endpoint | Auth | Body | Result |
|---|---|---|---|
| `POST /auth/refresh` | — | `{refresh_token}` | New `token` and `refresh_token`; the old refresh token stops working. 401 if the session ended |
| `POST /auth/logout` | Bearer | `{everywhere: false}` | Ends this device's session, or every session with `true` |
| `GET /me/sessions` | Bearer | — | Signed-in devices: `id`, `device_label`, `ip_address`, `created_at`, `last_used_at`, `expires_at`, `current` |
| `DELETE /me/sessions/{id}` | Bearer | — | Signs that device out |

A token whose session has ended gets 401 on every endpoint.

### Password reset and changing the mobile
| Endpoint | Auth | Body | Result |
|---|---|---|---|
| `POST /auth/otp/send` | — | `{phone, purpose: "reset_password"}` | Always "If this number has an account, a code has been sent…" |
| `POST /auth/otp/send` | Bearer | `{phone: <new number>, purpose: "change_mobile"}` | Code to the new number; 400 if it already has an account |
| `POST /auth/password/reset` | — | `{phone, otp, new_password, confirm_password}` | New password; every device signed out; login lock cleared |
| `POST /me/mobile` | Bearer | `{new_phone, otp, password}` | Mobile changed (needs the current password); other devices signed out |

### Limits (HTTP 429, with `Retry-After`)
- A new code: 30 s after the last one; 3 per number in 15 minutes, 10 per day; 20 per network per hour.
- 5 wrong passwords lock that account for 15 minutes (a password reset clears it).
- 30 login attempts per network in 15 minutes.

### Sign-up
`POST /auth/signup` also accepts optional `name` (2–80 characters) and `consent_version`.
`/auth/resend-otp` only works for numbers that are not yet verified.

### Behaviour notes

- **Mobile numbers** are normalised to E.164 (`+919848012345`). Spaces, dashes, a leading 0 or
  a missing +91 are accepted; an invalid number returns 400. Responses still return `phone`
  as 10 digits for Indian numbers.
- **Sign-up** always creates a normal `user`. The first super admin is created on the server
  with `python -m app.auth.bootstrap`; signing up first no longer grants it.
- **Sign-up without a name** gets the placeholder `User 1234` (last four digits) until
  `PUT /user/profile` sets one.
- **OTP codes** are stored hashed, valid 5 minutes, used once. After 5 wrong codes
  `/auth/verify-otp` returns "Too many wrong codes. Please request a new one." Sending a new
  code cancels the previous one.
- **`/admin/logs`** now reads `app.audit_logs`; `user_name` is the account name (it used to be
  the phone number).

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
