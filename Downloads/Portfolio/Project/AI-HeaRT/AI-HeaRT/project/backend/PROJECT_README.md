# AI-HeaRT

AI-HeaRT is an AI-assisted health triage app. A patient logs in with their phone number, describes their symptoms, and gets an instant triage read (home care / see a doctor soon / emergency) with a matched condition, a probability score, and next steps — either a home-care plan or a nearby-hospital finder. Every check is saved to the patient's account so they can look back at their history over time.

The project has two parts:

- **`/frontend`** — a React + Vite single-page app (the patient-facing UI)
- **`/backend`** — a Node/Express + SQLite API (phone/OTP auth, patient accounts, symptom-check history)

> ⚕️ **This is a demo/prototype, not a certified medical device.** Triage classification, disease matching, and medical content are simplified for demonstration purposes and have not been clinically validated. Don't use it to make real medical decisions.

---

## How it works, end to end

1. **Sign up / log in** — patient enters their phone number, gets a 6-digit OTP, verifies it. One account per phone number, enforced at the database level.
2. **Profile** — new patients fill in name, age, gender, weight. Returning patients skip straight to symptoms.
3. **Symptom input** — an autocomplete search over ~230 symptom terms. Patients build up a list of what they're experiencing.
4. **AI analysis** — a client-side probability engine matches the selected symptoms against a 100-disease database and returns the top 5 candidates.
5. **Triage result** — the top match determines a color-coded triage level (🟢 green / 🟡 yellow / 🔴 red), shown alongside the other possible conditions. Any condition in the list can be clicked to open a detail modal (Overview, Symptoms, Precautions, Diet, Workout, Medication tabs).
6. **Next steps**, depending on triage:
   - 🟢 **Home Care** — a care-steps/diet/activity/medication plan plus a daily recovery checklist.
   - 🟡🔴 **Medical Referral** — real-time-style hospital finder with distance, wait time, department filtering, and a "while you wait" precautions card.
7. **History** — every completed check is saved to the patient's account and viewable later.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React (single-file `App.jsx`), Vite, Tailwind CSS |
| Backend | Node.js, Express 5 |
| Database | SQLite via `better-sqlite3` (file-based, zero external services to run) |
| Auth | Phone number + OTP, bearer session tokens (hashed at rest) |
| Testing | Jest + Supertest (backend) |

---

## Project structure

```
frontend/
  src/
    App.jsx          # the entire app: data, AI engine, and every screen/component
    main.tsx          # React entry point
    index.css
  index.html
  vite.config.ts
  package.json

backend/
  src/
    app.js            # Express app setup (CORS, JSON body parsing, routes)
    server.js          # entry point — starts the HTTP server
    config.js           # tunable constants (OTP expiry, rate limits, session length)
    routes/
      auth.js            # /api/auth/*
      patient.js          # /api/patient/*
    services/            # business logic (auth, patient, OTP, sessions)
    middleware/            # requireAuth, etc.
    utils/                   # phone normalization, hashing
    db/
      index.js                 # schema + SQLite connection
  tests/
    auth.test.js
  package.json
```

---

## Getting started

### 1. Backend

```bash
cd backend
npm install
npm run dev       # starts the API on http://localhost:4000
```

No `.env` file is required to get started — every setting has a sensible default for local development (see [Configuration](#backend-configuration) below). A SQLite file is created automatically at `backend/data/aiheart.db` on first run.

**OTP delivery runs in mock mode by default** — no SMS provider is wired up, so instead of sending a real text message, the backend logs the OTP code to its console *and* returns it directly in the API response (`devCode`). The frontend surfaces this in a "🧪 Dev mode" banner on the OTP screen, so the whole signup/login flow is fully testable without any SMS account. To use a real provider in production, implement it behind the same interface used in `services/` and set `SMS_PROVIDER=twilio` (or your provider) in `.env`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server, prints a local URL (defaults to :5173, or :8443 under Figma Make)
```

Open the printed URL in your browser. The frontend talks to the backend at `http://localhost:4000` by default — this is a single constant, `API_BASE_URL`, at the top of `src/App.jsx`. Change it there if you deploy the backend somewhere else.

Because OTPs are mocked, you can register a test account with any phone-number-shaped string and complete the whole flow using the code shown on screen — no real phone required.

---

## Backend configuration

All of these are optional; copy into a `backend/.env` file to override.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port the API listens on |
| `DATA_DIR` | `backend/data` | Where the SQLite file lives |
| `DB_PATH` | `<DATA_DIR>/aiheart.db` | Full DB file path (set to `:memory:` for ephemeral/test runs) |
| `HASH_PEPPER` | *(insecure dev default)* | Secret pepper mixed into OTP/session hashing — **set a real random value before deploying** |
| `SMS_PROVIDER` | *(unset → mock mode)* | Set to `twilio` (once implemented) to send real SMS instead of mock/dev codes |
| `OTP_EXPIRY_MINUTES` | `5` | How long a generated OTP stays valid |
| `OTP_MAX_ATTEMPTS` | `5` | Wrong-code attempts allowed before an OTP is locked out |
| `OTP_RATE_LIMIT_WINDOW_MINUTES` | `60` | Window for the per-phone-number OTP request rate limit |
| `OTP_RATE_LIMIT_MAX` | `5` | Max OTP requests per phone number within that window |
| `OTP_IP_RATE_LIMIT_MAX` | `20` | Max OTP requests per IP address (abuse guard) |
| `SESSION_EXPIRY_DAYS` | `30` | How long a login session stays valid |

---

## Data model — what's saved per account

| Table | Fields | Notes |
|---|---|---|
| **patients** | phone number (unique), name, age, gender, weight (kg), language preference, verified flag, timestamps | One row per phone number — enforced by a `UNIQUE` constraint, not just app logic. |
| **otp_codes** | phone number, hashed code, purpose (register/login), expiry, attempt count | Codes are **hashed at rest**, never stored in plaintext. |
| **sessions** | patient id, hashed session token, expiry, revoked-at | Bearer token the frontend sends as `Authorization: Bearer <token>` on every authenticated request. |
| **symptom_checks** | patient id, symptoms (JSON array), results (JSON array of matched diseases + probabilities), triage color, timestamp | Full detail is kept (not just a summary) — every symptom and every matched disease from that check. |

**Deliberately not stored:** raw/plaintext OTP codes, plaintext session tokens, payment information (not applicable), or any medication dosing the patient claims to have taken.

---

## API reference

Base URL: `http://localhost:4000` (or wherever you deploy it)

### Auth — `/api/auth`

| Method & Path | Body | Purpose |
|---|---|---|
| `POST /register` | `{ phoneNumber, language? }` | Create a new account + send an OTP. Fails with `phone_already_registered` if the number exists. |
| `POST /login` | `{ phoneNumber }` | Send a login OTP to an existing account. Fails with `phone_not_registered` if it doesn't exist. |
| `POST /verify` | `{ phoneNumber, code, purpose }` | Verify the OTP. Returns `{ patient, session: { token, expiresAt } }` on success. |
| `POST /logout` | *(auth required)* | Revokes the current session token server-side. |

### Patient — `/api/patient` (all require `Authorization: Bearer <token>`)

| Method & Path | Body | Purpose |
|---|---|---|
| `GET /me` | — | Fetch the logged-in patient's profile. |
| `PUT /me` | `{ name, age, gender, weightKg }` | Update profile fields. |
| `POST /symptom-checks` | `{ symptoms, results, triage }` | Save a completed symptom check to history. |
| `GET /symptom-checks?limit=50` | — | Fetch the patient's check history, most recent first. |

Errors are returned as `{ "error": { "code": "...", "message": "..." } }` — the frontend reads `error.code` to branch behavior (e.g. auto-switching between login/register).

---

## The AI matching engine (frontend)

The disease database (`DISEASE_DB` in `App.jsx`) covers **100 conditions**, each with:

- a real, data-derived symptom profile (extracted from a 96k-row symptom dataset by per-disease frequency analysis, not hand-guessed),
- a clinical description, department, and triage color,
- real precaution, diet, workout, and medication reference data sourced from companion CSVs (not fabricated placeholder text).

**Matching formula:** for each candidate disease,

```
match % = (number of user-selected symptoms present in that disease's symptom list
           / total symptoms defined for that disease) × 100
```

This is intentionally *not* normalized across candidates — a disease with only 1 defining symptom can hit 100% off a single match, while a disease with 11 defining symptoms needs proportionally more matches to score as high. The top 5 candidates by this score are shown, and the highest-scoring one determines the overall triage color.

**Triage & department classification** for all 100 diseases were assigned by clinical judgement for this app (the source dataset doesn't include an urgency field) — treat this as a reasonable demo default, not validated medical triage.

---

## Known limitations / not yet implemented

Being upfront about where the current build stops:

- **Language:** the data model already has a `language` field per patient, but the UI is English-only right now — a full English/Khmer translation pass (UI text + all disease content) is planned but not yet built.
- **Responsive layout:** the UI is optimized for desktop/landscape. A dedicated mobile-portrait layout (in the style of the Claude/Gemini apps) is planned but not yet built.
- **Disease coverage:** 100 conditions, not "every disease" — there's no realistic dataset of literally every disease, so scope was intentionally capped for data quality.
- **SMS delivery:** mock/dev mode only (codes shown on-screen); no real SMS provider is wired up yet.
- **Hospital data:** the hospital finder (distance, wait time, doctor availability) uses illustrative mock data, not a live hospital API.
- **Ministry of Health sync / commission ledger:** referenced in the UI copy as a real-world monetization concept, but not backed by an actual government integration or payment system.
