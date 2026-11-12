# AgriDirect AI

AI crop demand prediction plus a direct farmer-to-company marketplace for
Maharashtra: all 36 districts, 20 crops, one main mandi per district.

Crops, districts and mandis live in one place, `tools/build_catalogue.py`.
Edit it and run `python tools/build_catalogue.py` to regenerate the data files
for the backend and frontend. Its agronomy values (how well each crop suits
each agro-climatic zone, water need, soil preference) are indicative rules of
thumb and should be reviewed by an agronomist before real use.

This repository now contains the working MVP: the Next.js frontend, a FastAPI
backend with a SQLite database, and the ML pipeline (ingestion, training,
validation, prediction).

## Run it on Windows

You need **Python 3.10 or newer** (tick "Add python.exe to PATH" when
installing) and **Node.js 20 or newer**.

1. Double-click **`setup.bat`** (once). It installs the backend and frontend packages.
2. Double-click **`start.bat`**. Two windows open: the API (port 8000) and the web app (port 3000).
3. Open <http://localhost:3000>.

The first start takes about a minute: the backend creates the database, loads
the demo accounts, generates sample market data and trains the price model.

Manual start (any OS), in two terminals:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

```bash
cd frontend
npm install
npm run dev                        # http://localhost:3000
```

## Logging in

Type a phone number and press **Send OTP**. In demo mode no SMS is sent: the
6-digit code is shown on the login page (and printed in the API window).

| Number | Account |
|---|---|
| 9800000001 | Ramesh Patil, farmer, Rahuri (has an offer waiting) |
| 9800000002 | Sunita Jadhav, farmer, Junnar (one accepted deal) |
| 9800000101 | Sneha Kulkarni, Pune Valley Feeds (verified buyer) |
| 9800000102 | Rahul Deshmukh, Krishna Agro Processing (verified buyer) |
| 9800000103 | Prakash Bhosale, Bhima Oil Extracts (awaiting verification) |
| 9800000900 | Operations admin |
| any other valid number | New user, goes through sign-up |

Walkthrough (PRD acceptance flow):

1. New number → sign up as a farmer → **Advice** → *Get advice*.
2. **Listings → New listing**: maize, 10 t, grade A → the listing shows the market outlook and matched buyers.
3. Log out → 9800000101 → **Post need**: maize, 6 t → the new listing appears as a match → *Make offer*.
4. Log out → log in as the farmer → offer waiting on the home page → *Accept*.
5. The deal shows **Accepted**, phone numbers are revealed, and the listing stays active with **4 t left of 10 t**.
6. 9800000900 → **System**: pipeline runs, model metrics, audit log. **Verify**: approve or reject pending companies.

Data is stored in `backend/data/agridirect.db`. To start again from scratch,
stop the API and delete the `backend/data` folder.

## What is in the box

```
frontend/   Next.js 14 + Tailwind + next-intl (en / hi / mr), installable PWA
backend/
  app/      FastAPI: auth, profiles, listings, requirements, matching, deals, admin
  ml/       ingestion, features, training + validation, prediction, daily pipeline
  tests/    unit tests + end-to-end API tests (PRD section 14 acceptance flow)
*.pdf       requirement, PRD, TRD, security and research documents
```

More detail: [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).
API documentation (OpenAPI) is served at <http://localhost:8000/docs> while the API runs.

## Important: the market data is synthetic

Out of the box the mandi prices, arrivals and weather are **generated sample
data**, not real Agmarknet or weather data. The model, the validation report
and every prediction you see are computed from that sample data. They prove
the pipeline works end to end; **they say nothing about accuracy on real
markets and must not be shown to farmers as real advice.**

To move to real data see "Real data" in [backend/README.md](backend/README.md).
The live connectors (data.gov.in, Open-Meteo, SoilGrids) are written but have
**not been run against the real services yet**.

## Requirement coverage

| ID | Requirement | State |
|---|---|---|
| FR-01 | OTP registration and login, role selection | Done. Demo OTP; SMS provider hook in `backend/app/sms.py` |
| FR-02 / 03 | Farmer and company profiles | Done (create at sign-up; update through the API, no edit screen yet) |
| FR-04 | Admin verifies or rejects companies; only verified companies post | Done |
| FR-05 / 06 | Crop advice with demand, trend, price direction and explanation | Done (model on sample data) |
| FR-07 | Produce listings with optional price and photos | Done |
| FR-08 | AI insight on each listing | Done |
| FR-09 | Company requirements | Done |
| FR-10 | Matching engine, both sides see matches | Done (rule-based score, TRD 7.5) |
| FR-11 | Search and filter produce, contact or offer | Done |
| FR-12 | Deal workflow with full history | Done |
| FR-13 | Notifications | In-app done. SMS / WhatsApp not connected |
| FR-14 | English, Hindi, Marathi | Farmer screens in all three; company and admin screens fall back to English. Translations need a native-speaker review |
| FR-15 | Market dashboard | Done |
| FR-16 | Voice input / read-aloud | Not built |
| FR-17 | Ratings after completion | Done |
| FR-18 | Admin dashboard | Overview, verification, moderation, deal monitor, pipeline and model health done. User list / block is API-only |
| FR-19 | Report a listing, admin review | Done |
| FR-20 | Export | CSV endpoints done (`/api/v1/export/deals.csv`, `/listings.csv`), no buttons in the UI; PDF not built |

Not done yet (PRD sections 9, 12-14): production deployment, HTTPS, backups,
monitoring/Sentry, Docker, CI, PostgreSQL + PostGIS (SQLite and Python distance
maths are used; the code runs on PostgreSQL by changing `DATABASE_URL`), Redis
(an in-process cache and scheduler are used), a Content-Security-Policy header,
device testing on Android phones, and the open client items in section 15 of
the requirement document (pilot district, business model, legal position,
branding, data licensing).
