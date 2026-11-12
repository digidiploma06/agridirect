# AgriDirect: frontend

Every MVP screen (PRD v1.1 section 8), talking to the FastAPI backend in `../backend`.

## Run it

Requires Node 20+ and the backend running on port 8000 (see the top-level README).

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

The browser calls `/api/v1/...` on this origin and Next.js forwards it to the
backend (`next.config.mjs`), so there is no CORS setup. If the backend runs
somewhere else, copy `.env.example` to `.env.local` and set `API_URL`.

Other scripts:

| Command | What it does |
|---|---|
| `npm run build && npm start` | Production build (also enables the PWA service worker). Needs internet once to download the fonts |
| `npm test` | Unit tests (matching, deal state machine, validators, advice rules) |
| `npm run test:coverage` | Same, failing under 70% coverage on core modules (TRD section 9.1) |
| `npm run lint` / `npm run typecheck` | ESLint (no `any`) and strict TypeScript |

Login accounts and the walkthrough are in the top-level README. In demo mode
the OTP is shown on the login page.

### Offline demo without the backend

Set `NEXT_PUBLIC_API_MODE=mock` in `.env.local` to run the original Phase 0
prototype: seeded data in the browser tab, nothing stored, any 6-digit OTP accepted.

## Layout

```
app/                 routes, one folder per PRD §8 screen
  farmer/ company/ admin/   role layouts (AppShell gates by role)
  deals/[id]  market/       shared farmer + company screens
components/          UI kit (ui/) and feature components
lib/
  api.ts             THE data-access layer — the only file screens import data from
  api-http.ts        real implementation: typed fetch calls to /api/v1, token refresh
  api-mock.ts        offline implementation backed by mock/
  mock/              catalogue (shared master data), seed data, mock server
  matching.ts        TRD §7.5 matching score
  deals.ts           PRD §7.4 deal state machine + partial fulfilment
  advice.ts          demand classification + crop ranking (TRD §7.3 rules)
  validation.ts      PRD §9 field rules (phone, GSTIN checksum, qty, dates, photos)
messages/            en.json (complete), mr.json, hi.json
public/              manifest, icons, service worker
```

## Current limits

- Market prices, model metrics and predictions come from the backend, which by
  default uses generated sample data, not live Agmarknet data.
- Hindi and Marathi cover all farmer-facing screens; company and admin screens
  fall back to English. All translations need native-speaker review (PRD section 4.2).
- Map tiles come from the public OpenStreetMap server, which needs internet
  access and is fine for testing only; production needs its own tile provider.
- No CSP header yet (needs nonce-based scripts); basic security headers are set.
- No screens yet for editing a profile, the admin user list, or CSV export; the
  backend endpoints exist.
