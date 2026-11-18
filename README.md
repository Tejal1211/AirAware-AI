# AirAware AI – GenAI-Powered Urban Air Quality Assistant

**Challenge 6 vertical:** helping families and communities navigate winter smog and urban air pollution through personalised daily routines, indoor-air guidance, sustainable alternatives and explainable environmental impact.

AirAware AI combines **real air-quality data** (Open-Meteo), a **deterministic, explainable decision engine**, **Google Gemini** for natural-language answers, and **OpenCV** for a photo haze check. If Gemini is unavailable, the app still answers using the same rules, and says so.

## What it does

| Feature | Where | How it works |
|---|---|---|
| Personalised onboarding | *Set up your household* | Location search (Open-Meteo geocoding) or browser location; household, commute, lifestyle, indoor conditions. Stored only in the browser. |
| Real-time AQI dashboard | *Air today* | US AQI, PM2.5, PM10, O₃, NO₂, SO₂, CO, WHO-guideline multiples, 24 h history + 48 h forecast chart with table alternative, trend. |
| GenAI assistant | *Ask AI* | Gemini answers using only a JSON of facts computed by the engine. Falls back to rule-based answers; the UI labels which one answered. |
| Smart daily planner | *Daily planner* | Cleanest/worst 2-hour slots, per time-of-day status, travel / exercise / school / work advice. |
| Indoor air advisor | *Indoor air* | Ventilation timing, cooking smoke, dust, filtration, using outdoor AQI plus the home profile. |
| OpenCV haze analyzer | *Photo haze check* | Contrast, edge sharpness, dark-channel haze cue, saturation → 0–100 clarity score. **Never claims to measure AQI or PM2.5.** |
| Sustainable alternatives | *Travel and impact* | Transit, carpool, active travel, idling. |
| Impact calculator | *Travel and impact* | Shows **emission reduction (kg CO₂e)** and **personal exposure reduction** separately; exposure steps are explicitly 0 kg emissions. |
| Community reports and awareness | *Community* | Anonymous, validated, rate-limited reports; community actions. |
| Smart alerts | *Air today* | Peak-AQI alerts for the next 24 h and a rising-trend alert, each with *why* and *what to do*. |

Every recommendation shows **what to do, why, the expected effect, the effect type** (lowers your exposure / cuts emissions / both / awareness) and **its basis** (public-health guidance, your forecast, or general good practice).

## Architecture

```
frontend/ (React + Vite + Tailwind)            backend/ (Flask)
  App.jsx ── tabs, a11y focus handling           app/__init__.py      app factory, security headers, CORS allow-list
  context/AppContext  profile + plan state       app/routes/api.py    thin HTTP layer
  api/client.js       all fetch calls            app/validation.py    all input validation + sanitising
  components/         one file per feature       app/errors.py        ApiError + JSON error handlers
                                                 app/services/
        /api  ──────────────────────────►          air_quality.py     Open-Meteo client + TTL cache
        (Vite proxy in dev)                        sample_data.py     clearly-labelled sample series
                                                   aqi.py             AQI categories, PM2.5→AQI, WHO values
                                                   decision_engine.py rules → recommendations, alerts, planner
                                                   assistant.py       Gemini prompt + rule-based fallback
                                                   gemini_client.py   minimal REST client (key in header)
                                                   haze_analyzer.py   OpenCV analysis
                                                   impact.py          emissions vs exposure calculator
                                                   reports.py         in-memory anonymous reports
                                                   rate_limit.py      sliding-window limiter
```

**Request flow:** the browser sends the profile to `POST /api/plan`. The server validates it, fetches (cached) air data, runs the decision engine and returns one complete plan. All tabs read from that single response, so the app makes one air-data request per refresh.

## Approach and working logic

1. **Sensitivity rule.** Households with children, adults 65+, or someone with a heart/lung condition are treated one level more cautiously in the *Moderate* band (an assumed, conservative rule of thumb, not a clinical threshold).
2. **Levels.** US AQI maps to good / moderate / caution (USG) / avoid (unhealthy) / stay in (very unhealthy and above).
3. **Best windows.** Over the next 24 forecast hours, the engine finds the contiguous 2-hour slot (06:00–21:00) with the lowest (and highest) mean AQI.
4. **Rules.** Each area (commute, exercise, school, work, ventilation, cooking, dust, filtration, alternatives, community) has explicit rules over level, forecast, commute mode, cooking fuel, window tightness, purifier ownership, road proximity and children/elders. Example: an exposed commuter (walk, bicycle, two-wheeler) at *caution* or above gets a "reduce exposure" action with a cleaner-hour suggestion taken from the forecast.
5. **Alerts.** Peak AQI in the next 24 h (sensitivity-adjusted) and a rising trend (next 6 h vs previous 6 h, ≥ 15 points).
6. **Gemini.** The engine's facts are serialised to JSON; Gemini is instructed to use only those facts, treat the question as untrusted, avoid health claims, and explain *why* and *effect*. Any failure (no key, network, blocked or empty response) falls back to `rules_answer()` and the response says `source: "rules"` with a reason.
7. **Impact.** Emissions = (old factor − new factor) × km. Exposure = an illustrative 24 h PM2.5 index (µg/m³ × h) with assumed indoor/outdoor ratios. The two are reported in separate panels, and assumptions are returned by the API and shown in the UI.

## Data honesty

- Live data comes from the **Open-Meteo Air Quality API**: modelled (CAMS) estimates on a coarse grid, **not** readings from a nearby sensor.
- Values are **US AQI**, which differs from India's CPCB AQI.
- **Sample data** is only used when the user clicks *Preview with labelled sample data* (or *Use labelled sample data instead* after an outage). It is flagged in the API (`source.is_sample`) and shown with banners. There is no hard-coded "live" AQI anywhere.
- Unavailable pollutants show "Not available for this location".

## Setup

Requirements: Python 3.10+, Node.js 18+.

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env                                  # optional: add GEMINI_API_KEY
python run.py                                            # http://127.0.0.1:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                                              # http://localhost:5173 (proxies /api to :5000)
```

**Single-process alternative:** `cd frontend && npm run build`, then run the backend. Flask serves `frontend/dist` at `http://127.0.0.1:5000`.

**Gemini key:** create one at <https://aistudio.google.com/apikey> and put it in `backend/.env` as `GEMINI_API_KEY=...`. It is read only on the server and sent in a request header. `.env` is git-ignored. Without a key the app works with the rule-based fallback.

## Testing

### Backend tests (87 tests, 100% pass)
```bash
cd backend
python -m pytest -q
```
The backend suite covers: API routes and status codes, input validation and sanitising, the decision engine and recommendations (sensitivity, children, biomass cooking, purifier, ventilation, commute modes, alerts, missing data), AQI conversion, Open-Meteo client (mocked: normalisation, nulls, caching, upstream failure), Gemini client and fallback (mocked), OpenCV analyser (clear vs hazy synthetic images, resizing, dark/blurry notes, corrupt/tiny/non-image files), upload limits and file-type checks, impact maths, community reports, rate limiting, security headers and CORS. No test needs network access or an API key.

### Frontend tests (100% pass)
```bash
cd frontend
npm test
```
Validates time formatting, number formatting with safe null fallbacks, tone mapping, and AQI category breakpoints.

## Evaluation criteria map

**Code quality:** routes → validation → services layering; one file per UI feature; shared UI primitives; docstrings in services; one error type with consistent JSON errors.

**Security:** secrets only in environment variables; `.env.example` and `.gitignore` included; server-side validation of every input (types, ranges, enums, NaN/bool rejection, text sanitising); coordinates rounded to ~1 km; uploads limited to JPG/PNG/WebP, 5 MB, magic-byte check, pixel cap, processed in memory and never written to disk; anonymous reports (no IP or identifiers stored); CORS allow-list; `nosniff`, `no-referrer`, CSP, `Cache-Control: no-store` on API; per-client rate limits on reports, uploads and the assistant; prompt-injection hardening for Gemini (facts-only prompt, untrusted question).

**Efficiency:** 6 small Python dependencies and a handful of front-end tools (no UI library, no charting library, no ML model, no datasets); 10-minute air-data cache keyed by ~1 km grid; one plan request feeds all tabs; images downscaled to ≤ 640 px; Gemini via plain REST; built JS ≈ 59 KB gzipped.

**Testing:** see above.

**Accessibility:** responsive layout with a horizontally scrollable tab bar on phones; skip link; focus moves to the page heading on navigation; visible focus rings; every input has a label; 44 px minimum targets; status never relies on colour alone (text labels on every status); AQI chart has an `aria-label` summary and a data table; `aria-live` regions for results and errors; reduced-motion respected; plain-language error messages.

**Problem alignment:** every feature targets urban air pollution; advice is driven by real data plus household context; every action has *why* and *expected effect*; sample/unavailable data is labelled; Gemini has a deterministic fallback.

## Assumptions

- Emission factors (g CO₂e per passenger-km): petrol car 170, diesel car 165, two-wheeler 90, bus 80, metro 35, walk/cycle 0. Indicative values; your vehicle may differ.
- Indoor PM2.5 ≈ 60% of outdoor in a normally ventilated home, ≈ 30% with a purifier running. Illustrative only.
- Daytime for activity planning is 06:00–21:00 local time; blocks are commute 07–10, midday 10–16, evening 16–20.

## Limitations

- Open-Meteo values are modelled and coarse; they can differ from a street-level sensor and from CPCB readings.
- The impact calculator estimates CO₂e only. PM2.5/NOx savings and real health outcomes are **not** quantified.
- The haze score is a visual heuristic; fog, night, indoor scenes, blur and filters affect it. It cannot indicate pollution level.
- Community reports live in server memory (cleared on restart, unverified, max 200).
- Guidance is general and not medical advice. Respirator guidance is generic; fit matters.
- Gemini output is generated text; it is grounded on provided facts but should still be read critically.

## Verification status

- Backend: `python -m pytest` → **87 passed (100%)**.
- Frontend: `npm test` → **4 passed (100%)**.
- Frontend build: `npm run build` → **succeeded (bundle ~59 KB gzipped)**.
- Gemini integration: Tested live with `gemini-3.8-flash` using user configuration.
- Single-process server: Flask serves `/api` and `frontend/dist` SPA directly at `http://127.0.0.1:5000`.

## Submission checklist (public GitHub, one branch, < 10 MB)

```bash
git init -b main
git add . && git status          # confirm no .env, node_modules, dist or caches are staged
git commit -m "AirAware AI: urban air quality assistant"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main          # keep ONLY the main branch
git branch -a                    # should list just: main
```

## API summary

`GET /api/health` · `GET /api/geocode?q=` · `GET /api/air-quality?lat=&lon=[&demo=1]` · `POST /api/plan` · `POST /api/assistant` · `POST /api/haze/analyze` (multipart `image`) · `POST /api/impact` · `GET|POST /api/reports`
