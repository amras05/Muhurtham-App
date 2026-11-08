# Muhurta Finder

A mobile app that answers two questions from Dr. Vamsee Nemani's Muhurta
Shastra book, using live panchang data instead of a printed table:

1. **Activity Search** — "When's the next good time to do X?"
2. **Date Lookup** — "What's today's panchang, and what's good/bad to do today?"

## How it works

```
webapp/ (HTML/JS, served by FastAPI)  →  backend/ (FastAPI)  →  PyJHora (panchang engine)
                                               ↓
                     backend/app/rules/**/*.yaml (one rule file per muhurtam)
```

- `backend/app/engines/panchang.py` — wraps PyJHora's `drik` module to compute vaara,
  tithi, nakshatra, yoga, karana, lagna, sunrise/sunset, rahu kaalam,
  durmuhurtam, varjyam for any date/place.
- `backend/app/models/names.py` — maps PyJHora's Tamil-inflected spellings
  (e.g. "Karthigai") to the standard spelling the rules use ("Krittika").
- `backend/app/engines/rule_interpreter.py` + `backend/app/rules/` — the
  declarative YAML rule engine (catalog, hard filters, mahadoshas, soft scoring).
- `backend/app/engines/rules.py` + `rules.json` — legacy flat rules, still used
  only for the per-activity verdicts in `/panchang/day-summary`.
- `backend/app/engines/samskaras.py` — samskara finder used by the samskara page.
- See `API.md` for the full endpoint list.

## Running the backend

```bash
cd backend
pip install -r requirements.txt
bash install_ephemeris.sh   # IMPORTANT — see note below
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Database (accounts)

Accounts live in PostgreSQL: one shared Supabase project for development, native PostgreSQL
on the server in production. Settings come from `backend/.env` (git-ignored; copy
`backend/.env.example`). Once per database:

```bash
cd backend
python3 scripts/pg_roles.py        # paste the output into the Supabase SQL editor
alembic upgrade head               # creates the tables (migration owner only)
python -m app.auth.bootstrap --mobile +91XXXXXXXXXX --name "Your Name"   # first super admin
```

Optional, one time: `python -m app.db.import_sqlite muhurtham.db` (dry run) then `--apply`
copies accounts from the old SQLite file.

### ⚠️ Important: install the real ephemeris data files

PyJHora's PyPI package does **not** include its Swiss Ephemeris `.se1` data
files (a known limitation since v3.6.6, due to package size). Without them,
most calculations silently fall back to a lower-precision approximation
(Moshier's method) instead of erroring — so the app *looks* like it's
working, but some values (we found Varjyam's exact window shift by ~10
minutes in testing) are less precise than they should be, and a few features
(like the Souramana/solar calendar type) fail outright with a missing-file
error.

Run `bash install_ephemeris.sh` once after installing requirements — it
downloads the real ~104MB of ephemeris data from PyJHora's GitHub repo and
installs it into the right place automatically. Safe to re-run; it detects
if the files are already there and skips.

Test it:
```bash
curl "http://localhost:8000/panchang/day-summary?date=2026-11-08&lat=16.5062&lon=80.648&tz_offset=5.5&place_name=Vijayawada"
```

## What's already verified working

I ran the panchang computation and rule engine end-to-end during scaffolding
(not just written blind):
- PyJHora's `drik` module correctly computes vaara/tithi/nakshatra/yoga/karana/lagna for a given date+lat/lon+tz.
- The name-normalization layer correctly maps PyJHora's spelling to canonical spelling.
- `evaluate()` correctly returns "neutral" when no rule matches, "favorable" when good conditions are met.
- The FastAPI endpoints were tested via `TestClient` and return correct JSON.

## Known gaps / next steps

1. **Birth nakshatra (janma nakshatra) rules aren't modeled yet.** Several
   activities in the book (medicine, lending money, haircut, etc.) reference
   the person's *own* janma nakshatra as something to avoid — this requires
   per-user birth details, which the app doesn't collect yet. Add a user
   profile (birth date/time/place) to unlock these.
2. **Only ~15 of the book's activities are digitized.** The rest of Part 7
   (and any activities in parts 2–6 you want surfaced) need to be transcribed
   into `rules.json` in the same format.
3. **Tara-bala, chandrashtama, gulika/yamaganda kaalam** are computed by
   PyJHora (`drik.thaaraabalam`, `drik.chandrashtama`, `drik.gulikai_kaalam`,
   `drik.yamaganda_kaalam`) but not yet wired into the rules engine — several
   activities reference these.
4. **Location input** currently defaults to device GPS or falls back to
   Vijayawada — no manual place-search/autocomplete yet.
5. **App icon, splash screen, and native builds** (EAS Build for standalone
   APK/IPA) aren't set up — this is a bare Expo scaffold.

## Tithi/Nakshatra accuracy investigation (important, read before trusting exact times)

Testing against a printed Telugu panchangam surfaced small but real gaps
between our calculated tithi/nakshatra boundary times and the printed
reference (13-52 minutes, depending on the field). We investigated this
properly rather than hand-waving it:

- **`app/precise_panchang.py`** independently recomputes tithi and nakshatra
  directly from Sun/Moon sidereal longitude (the book's own formula: Tithi =
  (Moon − Sun) / 12°), using topocentric (observer-location-corrected)
  positions via `pyswisseph` directly, with bisection root-finding for exact
  boundary-crossing times — bypassing PyJHora's higher-level functions
  entirely for these two values.
- **Finding**: topocentric correction, done correctly and verified, does
  **not** track the printed reference any better than PyJHora's plain
  geocentric calculation — if anything, slightly worse for the one date we
  tested. This means the working hypothesis ("use lat/lon for more accurate
  topocentric tithi/nakshatra") didn't hold up under an actual test. Most
  published panchangams are likely computed geocentrically, so matching a
  printed source is not the same problem as being "more physically correct."
- **What the app does now**: `/panchang/simple` (and `panchang-lookup.html`)
  show **both** values side by side — PyJHora's geocentric tithi/nakshatra,
  and the independently-computed topocentric ones — so you can compare
  against whatever reference you're checking against, rather than the app
  silently picking one.
- **Still unresolved**: the remaining 13-52 minute gaps from the printed
  reference are most likely from Ayanamsa-precision differences between
  calculation methods (there are several "Lahiri" sub-variants with slightly
  different precession models) — this is a known, accepted level of
  disagreement between different reputable panchang sources, not
  necessarily an error in either calculation.

## Free-text place lookup (OpenStreetMap)

`GET /geocode?place=<any place name>` geocodes via OpenStreetMap's Nominatim
API, with timezone (including DST) resolved via `timezonefinder`. This
could not be live-tested in the development sandbox (no network access to
nominatim.openstreetmap.org there) — please verify it works before relying
on it, and consider replacing the placeholder `User-Agent` in
`app/geo/regions.py` with your own app name/contact per Nominatim's usage policy.
