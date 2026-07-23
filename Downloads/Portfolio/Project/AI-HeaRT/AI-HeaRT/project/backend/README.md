# AI-HeaRT Backend

Phone/OTP authentication, one-account-per-patient enforcement, and persistent
storage for patient profiles + symptom-check history.

## Stack

- **Node.js + Express** — HTTP API
- **SQLite** (via `better-sqlite3`) — real relational database, stored as a single
  file (`data/aiheart.db`). No separate database server to install — good for
  local development and small-scale deployment. See "Moving to Postgres" below
  for scaling up.
- **Jest + Supertest** — automated test suite (16 tests, all passing)

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev        # auto-restarts on file changes
# or: npm start
```

The server starts on `http://localhost:4000` by default (`PORT` in `.env`).

## Running the tests

```bash
npm test
```

This runs against an in-memory database (configured in `tests/setupEnv.js`), so
it never touches your real `data/aiheart.db` file.

## How the mock OTP works right now

**No real SMS is sent.** Every endpoint that issues a one-time code
(`/register`, `/login`) returns a `devCode` field in the JSON response, and
also logs the code to the server console, e.g.:

```
[MOCK SMS] -> +85512345678: Your AI-HeaRT verification code is 428988
```

This lets you build and test the entire registration/login flow end-to-end
right now, with no SMS provider account. See "Going to production" below for
what changes when you're ready to send real texts.

## API Reference

All request/response bodies are JSON. Authenticated routes require:
`Authorization: Bearer <token>`.

### `POST /api/auth/register`
Start registration for a new phone number.
```json
// Request
{ "phoneNumber": "012345678", "language": "km" }   // language optional, defaults to "en"

// Response 201
{ "phoneNumber": "+85512345678", "expiresInSeconds": 300, "devCode": "428988" }
```
Returns `409 phone_already_registered` if that number already has a verified account.

### `POST /api/auth/login`
Request a fresh OTP for an existing, verified account.
```json
// Request
{ "phoneNumber": "012345678" }

// Response 200 — same shape as /register
```
Returns `404 phone_not_registered` if there's no verified account for that number.

### `POST /api/auth/verify`
Verify the OTP for either flow.
```json
// Request
{ "phoneNumber": "012345678", "code": "428988", "purpose": "register" }  // or "login"

// Response 200
{
  "patient": { "id": 1, "phoneNumber": "+85512345678", "name": null, "age": null,
               "gender": null, "weightKg": null, "language": "en",
               "isVerified": true, "createdAt": "..." },
  "session": { "token": "...", "expiresAt": "..." }
}
```
Error codes: `no_pending_code`, `code_expired`, `incorrect_code` (401, includes
remaining-attempts count), `too_many_attempts` (429).

### `POST /api/auth/logout` *(auth required)*
Revokes the current session token. Returns `204`.

### `GET /api/auth/session` *(auth required)*
Quick check that the current token is still valid. Returns `{ patient }`.

### `GET /api/patient/me` *(auth required)*
Returns the current patient's profile.

### `PUT /api/patient/me` *(auth required)*
Update profile fields. All optional.
```json
{ "name": "Sovann", "age": 19, "gender": "male", "weightKg": 62, "language": "km" }
```

### `POST /api/patient/symptom-checks` *(auth required)*
Save a completed symptom check.
```json
{
  "symptoms": ["cough", "high_fever"],
  "results": [{ "disease": "Common Cold", "probability": 50 }],
  "triage": "green"
}
```

### `GET /api/patient/symptom-checks?limit=50` *(auth required)*
List this patient's saved checks, newest first.

## Security measures already in place

- **One account per phone number**, enforced with a `UNIQUE` constraint at the
  database level (not just an application-side check, so it can't be
  bypassed by a race condition).
- **Phone number normalization** — `012345678`, `85512345678`, and
  `+855 12 345 678` all resolve to the same account, so someone can't create
  duplicate accounts by formatting their number differently.
- OTPs and session tokens are **hashed at rest** (SHA-256 + a server-side
  pepper) — never stored in plaintext in the database.
- OTPs **expire** (5 min default) and are **single-use** (consumed on
  successful verification).
- **Per-phone rate limiting** on OTP requests (5 per hour by default) and a
  separate **per-IP rate limiter** on the request endpoints, so one phone
  number or one IP can't be used to spam OTP requests.
- **Attempt limiting** on OTP verification (5 wrong guesses locks out that
  code, forcing a fresh one).
- Patient data endpoints are **fully scoped to the authenticated patient** —
  verified in the test suite that one patient cannot see another's data.

## What's NOT done yet (needs your input before going live)

1. **Real SMS delivery.** Right now `src/utils/smsProvider.js` only logs the
   code and returns it in the API response — that's fine for development, but
   means anyone calling the API can read the OTP without ever receiving a
   text. To go live:
   - Sign up for a real provider (Twilio Verify is the easiest to integrate,
     or a Cambodia-specific SMS gateway/telco API if you want local rates).
   - Replace the body of `sendOtpSms()` in `smsProvider.js` with a real API call.
   - Remove the `devCode` field from the API responses once real SMS works —
     it exists only so you can test locally.

2. **Deployment.** This runs great locally, but "localhost:4000" isn't
   reachable from a phone on the internet. You'll need to deploy this
   somewhere (Railway, Render, Fly.io, a VPS, etc.) and point your frontend at
   the real URL. I can walk you through this when you're ready, but creating
   accounts/paying for hosting is something you'll need to do yourself.

3. **HTTPS.** In production, this must run behind HTTPS (most hosting
   platforms above provide this for free) — sending phone numbers and OTPs
   over plain HTTP is not safe.

4. **Moving to Postgres (optional, for scale).** SQLite is genuinely fine for
   a single-server app with a modest number of users — plenty for a student
   project or an early pilot. If this ever needs multiple backend servers
   running at once (horizontal scaling) or very high write volume, you'd
   migrate to Postgres. The SQL in `src/db/index.js` is close to standard SQL
   and the service-layer code (`authService.js`, `patientService.js`) is
   isolated from the schema, so this migration is a contained piece of work
   later — nothing about today's design blocks it.

5. **`HASH_PEPPER` secret.** The `.env.example` ships with a placeholder value.
   Before deploying anywhere real, generate a long random string
   (e.g. `openssl rand -hex 32`) and set it as `HASH_PEPPER` — treat it like a
   password, never commit it to git.

## Project structure

```
backend/
  src/
    app.js                  # Express app assembly (used by both server.js and tests)
    server.js               # Entry point — binds the port
    config.js                # OTP/session tuning constants
    db/index.js              # SQLite connection + schema
    services/
      authService.js         # Registration, OTP verification, sessions
      patientService.js       # Profile updates, symptom-check history
    middleware/requireAuth.js  # Bearer-token auth guard
    routes/
      auth.js                 # /api/auth/*
      patient.js               # /api/patient/*
    utils/
      phone.js                 # Phone number normalization
      crypto.js                 # OTP/token generation + hashing
      smsProvider.js             # Mock SMS sender (swap for real provider later)
  tests/
    setupEnv.js                # Test environment config
    auth.test.js                 # 16 end-to-end tests covering all flows
  .env.example
  package.json
```
