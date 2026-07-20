# Muhurta Finder

A mobile app that answers two questions from Dr. Vamsee Nemani's Muhurta
Shastra book, using live panchang data instead of a printed table:

1. **Activity Search** — "When's the next good time to do X?"
2. **Date Lookup** — "What's today's panchang, and what's good/bad to do today?"

## How it works

```
mobile/ (React Native / Expo)  →  backend/ (FastAPI)  →  PyJHora (panchang engine)
                                        ↓
                                   rules.json (digitized book rules)
```

- `backend/app/panchang.py` — wraps PyJHora's `drik` module to compute vaara,
  tithi, nakshatra, yoga, karana, lagna, sunrise/sunset, rahu kaalam,
  durmuhurtam, varjyam for any date/place.
- `backend/app/names.py` — PyJHora spells names in Tamil-inflected
  transliteration (e.g. "Karthigai", "Chathurthi"). This maps them to the
  standard spelling the book/rules use ("Krittika", "Chaturthi").
- `backend/app/rules.json` — the book's rules, digitized per activity as
  favorable/avoid conditions on vaara, tithi, nakshatra, yoga, karana, lagna.
  **This currently covers ~15 activities** (medicine, surgery, idol
  consecration, contracts, adoption, haircut, lending money, sowing seeds,
  etc.) — extend this file as you transcribe more of the book.
- `backend/app/rules_engine.py` — matches a computed panchang against an
  activity's rules and scores it favorable / mixed / avoid / neutral, with
  the specific reasons shown (never a black-box verdict).
- `backend/app/main.py` — FastAPI endpoints:
  - `GET /activities` — list of digitized activities
  - `GET /panchang` — raw panchang for a date/place
  - `GET /panchang/day-summary` — panchang + verdict for every activity that day
  - `GET /muhurta/check` — is `date` good for `activity_id`?
  - `GET /muhurta/next` — next favorable date for `activity_id` (walks forward day by day)

## Running the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Test it:
```bash
curl "http://localhost:8000/muhurta/next?activity_id=haircut&lat=16.5062&lon=80.648&tz_offset=5.5&place_name=Vijayawada"
```

## Running the mobile app

```bash
cd mobile
npm install
```

Before running, edit `mobile/api/client.js` and set `API_BASE_URL` to your
machine's LAN IP (not `localhost` — a phone/emulator can't reach your
laptop's localhost), e.g. `http://192.168.1.20:8000`.

```bash
npx expo start
```
Scan the QR code with Expo Go (Android/iOS) or press `a`/`i` for an emulator.

## What's already verified working

I ran the panchang computation and rule engine end-to-end during scaffolding
(not just written blind):
- PyJHora's `drik` module correctly computes vaara/tithi/nakshatra/yoga/karana/lagna for a given date+lat/lon+tz.
- The name-normalization layer correctly maps PyJHora's spelling to canonical spelling.
- `evaluate()` correctly returns "neutral" when no rule matches, "favorable" when good conditions are met, and walks forward correctly in `find_next_favorable()` (e.g. haircut correctly skipped Sat/Fri per the avoid rule and landed on Monday+Mrigashira).
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
