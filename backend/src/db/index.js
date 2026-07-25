const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "aiheart.db");

// In-memory DB for tests (":memory:") — otherwise a real file on disk.
const isMemory = DB_PATH === ":memory:";
if (!isMemory && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS patients (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number      TEXT NOT NULL UNIQUE,   -- enforces "one account per phone number" at the DB level
  name              TEXT,
  age               INTEGER,
  gender            TEXT,
  weight_kg         REAL,
  language          TEXT NOT NULL DEFAULT 'en',  -- 'en' | 'km' — used later by the Khmer translation pass
  is_verified       INTEGER NOT NULL DEFAULT 0,   -- 0/1, set to 1 after first successful OTP verification
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One-time-passcodes for phone verification (both registration and login use this table).
CREATE TABLE IF NOT EXISTS otp_codes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number      TEXT NOT NULL,
  code_hash         TEXT NOT NULL,     -- OTP is hashed at rest, never stored in plaintext
  purpose           TEXT NOT NULL,     -- 'register' | 'login'
  expires_at        TEXT NOT NULL,
  consumed_at       TEXT,
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 5,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone_number);

-- Login sessions. A bearer token the frontend sends back on every authenticated request.
CREATE TABLE IF NOT EXISTS sessions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id        INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  token_hash        TEXT NOT NULL UNIQUE,  -- session token is hashed at rest, like a password would be
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at        TEXT NOT NULL,
  revoked_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);

-- Each symptom-check a patient runs, tied to their account so it persists across devices/logins.
CREATE TABLE IF NOT EXISTS symptom_checks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id        INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  symptoms_json     TEXT NOT NULL,   -- JSON array of symptom slugs the patient selected
  results_json      TEXT NOT NULL,   -- JSON array of the top matched diseases + percentages
  triage            TEXT,            -- 'green' | 'yellow' | 'red' snapshot at time of check
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_checks_patient ON symptom_checks(patient_id);
`;

db.exec(SCHEMA);

module.exports = db;
