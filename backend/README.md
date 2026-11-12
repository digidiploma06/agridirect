# AgriDirect: backend and ML

FastAPI + SQLAlchemy (SQLite by default) + LightGBM. Requires Python 3.10+.

```bash
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements-ml.txt
uvicorn app.main:app --port 8000
```

- API base path: `http://localhost:8000/api/v1`
- Interactive docs (OpenAPI): `http://localhost:8000/docs`
- Tests: `python -m pytest -q` (unit tests plus the end-to-end acceptance flow; uses a temporary database).
  Set `TEST_DATABASE_URL=postgresql://...` to run the same suite on PostgreSQL.
- `requirements.txt` is the API only (what Vercel installs); `requirements-ml.txt` adds the ML pipeline and tests.

On first start the server creates `data/agridirect.db`, loads the demo
accounts, generates sample market data, trains the model and writes
predictions. Delete the `data` folder to reset everything.

## Configuration

Copy `.env.example` to `.env` to change anything. Every setting has a local default.

| Setting | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | SQLite file in `data/` | Any SQLAlchemy URL; `postgres://` and `postgresql://` URLs work as given. `POSTGRES_URL` is read too |
| `RUN_PIPELINE` | `true` (off on Vercel) | Ingest, train and refresh predictions inside the API process |
| `PHOTO_STORAGE` | `disk` (`inline` on Vercel) | Where listing photos are kept |
| `JWT_SECRET` | development value | **Must** be changed before any deployment |
| `OTP_MODE` | `demo` | `demo` shows the OTP on the login page and in this console. `sms` needs a provider in `app/sms.py` |
| `DATA_MODE` | `synthetic` | `synthetic` = generated sample data. `live` = data.gov.in + Open-Meteo + SoilGrids |
| `DATA_GOV_API_KEY` | empty | Needed for live mandi prices |
| `ENABLE_SCHEDULER` | `true` | Runs the pipeline daily at 02:00 IST while the server is up |
| `SEED_DEMO` | `true` | Loads the demo farmers, companies, listings and deals into an empty database |

## Layout

```
app/
  main.py          app, security headers, rate limiting
  config.py db.py  settings and database session
  models.py        tables (PRD section 10)
  schemas.py       request bodies
  views.py         response shapes + privacy rules (masked phones, short names, 5 km distances)
  security.py      OTP challenges, JWT access tokens, rotating refresh tokens
  deps.py          authentication, role checks, audit log, notifications
  signals.py       reads ML predictions; cold-start fallback; live platform demand
  domain/          pure rules: matching score, deal state machine, validators, advice
  routers/         auth, insights, marketplace, deals, admin
  seed.py          demo data
ml/
  synthetic.py     sample mandi + weather generator (clearly not real data)
  ingest.py        data sources, retries, pipeline_runs log, CSV import
  features.py      weekly features per crop x mandi (TRD 7.2)
  train.py         walk-forward validation, baselines, model card
  predict.py       district signals, SHAP-based drivers, drift check
  pipeline.py      daily job + command line
tests/
```

## Security implemented

- OTP: 6 random digits, stored hashed, 5-minute expiry, single use, 5 wrong
  attempts, 3 sends per 15 minutes per phone, 20 OTP requests per minute per client.
- Sessions: 15-minute access token (kept in browser memory only) and a 7-day
  httpOnly, SameSite=Strict refresh cookie that rotates on every use and is revoked on logout.
- Role checks on every endpoint; object-level checks on listings and deals;
  blocked accounts are refused on their next request.
- Phone numbers are masked until a deal is accepted; companies see "Ramesh P."
  and distances rounded to 5 km.
- Input validation on every body; HTML stripped from free text; uploaded photos
  are checked by content, size-limited and stored under random names.
- Every admin action and deal status change is written to an append-only audit log.

Before production (not done): HTTPS and `COOKIE_SECURE=true`, a real
`JWT_SECRET`, a real SMS provider, a Content-Security-Policy header, backups,
and moving rate limiting to a shared store if more than one server process runs.

## ML pipeline

```bash
python -m ml.pipeline run              # ingest all sources, refresh predictions (retrains if older than 30 days)
python -m ml.pipeline train            # retrain now
python -m ml.pipeline import-csv FILE  # load historical mandi prices
python -m ml.pipeline purge-synthetic  # delete the sample data before going live
```

- **Model**: LightGBM regression on the log price change 4, 8 and 12 weeks
  ahead (one model per horizon, pooled over crops and mandis). The app serves the 8-week horizon.
- **Validation**: 4 rolling-origin folds of 26 weeks. A training row is used
  only if its target date is before the test block starts. Compared with a
  seasonal-naive baseline (price one year earlier) and a last-value baseline.
  MAPE, RMSE and macro-F1 of the up / stable / down class are reported per
  crop, district and season.
- **Model card**: `data/models/<version>/MODEL_CARD.md` and `model_card.json`
  are written on every training run; the admin System page shows the per-crop table.
- **Demand level, trend and price direction** are derived by rule from the
  forecast price change, the arrival anomaly and live buyer requirements within 100 km.
- **Confidence** is calibrated from the validation error of the same crop and
  district. Districts without their own data fall back to the state-level
  average, are capped at 40% confidence and say so in the explanation.
- **Explanations**: arrival anomaly, forecast change, buyer demand, plus
  rainfall drivers picked from the model's SHAP contributions, rendered from
  sentence templates in English, Hindi and Marathi.
- **Drift**: each refresh compares recent 4-week returns with the training
  distribution per crop and records data staleness (`GET /api/v1/admin/system`).

### Real data

The sample data exists so the system runs offline. To use real data:

1. Get a free API key from data.gov.in and put it in `.env` as
   `DATA_GOV_API_KEY`, and set `DATA_MODE=live`.
2. `python -m ml.pipeline purge-synthetic`
3. The data.gov.in feed only carries **today's prices, with no arrival
   tonnage and no history**. The model needs about three years of weekly
   history, so load it once from a CSV exported from Agmarknet or CEDA:
   `python -m ml.pipeline import-csv history.csv`. Columns: `date`,
   `commodity` (or `crop`), `market` (or `mandi`), `modal_price`, and optionally
   `min_price`, `max_price`, `arrivals_t`. Admins can also POST the same CSV to
   `/api/v1/admin/market/upload`.
4. `python -m ml.pipeline train`

The live connectors have **not been tested against the real services**; expect
to adjust market and commodity name matching in `app/catalogue.py`
(`aliases`, `agmarknetNames`) and to check each source's terms of use
(open item 9 in the requirement document).

## Differences from the TRD

- JSON field names are camelCase (they match `frontend/lib/types.ts`), not snake_case.
- Deal transitions are sent as `{"action": "counter", ...}` rather than `{"to": "negotiation"}`.
- Matches are computed on request instead of stored in a `matches` table.
- Timestamps and dates are stored as ISO strings.
- SARIMAX / Prophet comparison is not included; baselines are seasonal-naive and last-value.
