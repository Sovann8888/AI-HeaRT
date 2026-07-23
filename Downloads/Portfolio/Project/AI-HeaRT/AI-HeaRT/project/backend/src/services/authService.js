const db = require("../db");
const { normalizePhone } = require("../utils/phone");
const { sha256, generateOtp, generateToken, safeEqual } = require("../utils/crypto");
const { sendOtpSms } = require("../utils/smsProvider");
const {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_LIMIT_WINDOW_MINUTES,
  OTP_RATE_LIMIT_MAX,
  SESSION_EXPIRY_DAYS,
} = require("../config");

class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function minutesFromNow(mins) {
  return new Date(Date.now() + mins * 60_000).toISOString();
}
function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

function findPatientByPhone(phoneNumber) {
  return db.prepare("SELECT * FROM patients WHERE phone_number = ?").get(phoneNumber);
}

function findPatientById(id) {
  return db.prepare("SELECT * FROM patients WHERE id = ?").get(id);
}

function assertPhoneNotRateLimited(phoneNumber) {
  const windowStart = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = db
    .prepare("SELECT COUNT(*) as count FROM otp_codes WHERE phone_number = ? AND created_at > ?")
    .get(phoneNumber, windowStart);

  if (count >= OTP_RATE_LIMIT_MAX) {
    throw new AuthError(
      429,
      "otp_rate_limited",
      `Too many verification codes requested for this number. Please wait ${OTP_RATE_LIMIT_WINDOW_MINUTES} minutes and try again.`
    );
  }
}

/**
 * Creates (or reuses an unverified) patient row and sends a registration OTP.
 * Enforces one account per phone number: if a VERIFIED account already
 * exists for this number, registration is rejected — the caller should
 * use requestLoginOtp() instead.
 */
async function requestRegistrationOtp(rawPhone, language = "en") {
  const phoneNumber = normalizePhone(rawPhone);
  if (!phoneNumber) {
    throw new AuthError(400, "invalid_phone", "Please provide a valid Cambodian phone number.");
  }

  assertPhoneNotRateLimited(phoneNumber);

  const existing = findPatientByPhone(phoneNumber);
  if (existing && existing.is_verified) {
    throw new AuthError(
      409,
      "phone_already_registered",
      "This phone number already has an account. Please log in instead."
    );
  }

  if (!existing) {
    db.prepare(
      `INSERT INTO patients (phone_number, language, is_verified) VALUES (?, ?, 0)`
    ).run(phoneNumber, language === "km" ? "km" : "en");
  }

  return issueOtp(phoneNumber, "register");
}

/**
 * Sends a login OTP for an existing, verified account.
 */
async function requestLoginOtp(rawPhone) {
  const phoneNumber = normalizePhone(rawPhone);
  if (!phoneNumber) {
    throw new AuthError(400, "invalid_phone", "Please provide a valid Cambodian phone number.");
  }

  assertPhoneNotRateLimited(phoneNumber);

  const existing = findPatientByPhone(phoneNumber);
  if (!existing || !existing.is_verified) {
    throw new AuthError(
      404,
      "phone_not_registered",
      "No account found for this phone number. Please register first."
    );
  }

  return issueOtp(phoneNumber, "login");
}

async function issueOtp(phoneNumber, purpose) {
  const code = generateOtp();
  const codeHash = sha256(code);
  const expiresAt = minutesFromNow(OTP_EXPIRY_MINUTES);

  db.prepare(
    `INSERT INTO otp_codes (phone_number, code_hash, purpose, expires_at, max_attempts)
     VALUES (?, ?, ?, ?, ?)`
  ).run(phoneNumber, codeHash, purpose, expiresAt, OTP_MAX_ATTEMPTS);

  const smsResult = await sendOtpSms(phoneNumber, code);

  return {
    phoneNumber,
    expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
    // devCode is ONLY included because we're using the mock SMS provider.
    // Remove this field entirely once a real SMS provider is wired up.
    devCode: smsResult.mock ? code : undefined,
  };
}

/**
 * Verifies an OTP for a given phone number + purpose. On success:
 *  - purpose "register": marks the patient verified, creates a session.
 *  - purpose "login": creates a session for the existing patient.
 */
function verifyOtp(rawPhone, code, purpose) {
  const phoneNumber = normalizePhone(rawPhone);
  if (!phoneNumber) {
    throw new AuthError(400, "invalid_phone", "Please provide a valid Cambodian phone number.");
  }
  if (!code || typeof code !== "string") {
    throw new AuthError(400, "invalid_code", "Verification code is required.");
  }

  const otpRow = db
    .prepare(
      `SELECT * FROM otp_codes
       WHERE phone_number = ? AND purpose = ? AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(phoneNumber, purpose);

  if (!otpRow) {
    throw new AuthError(400, "no_pending_code", "No pending verification code. Please request a new one.");
  }

  if (new Date(otpRow.expires_at).getTime() < Date.now()) {
    db.prepare("UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?").run(otpRow.id);
    throw new AuthError(400, "code_expired", "This code has expired. Please request a new one.");
  }

  if (otpRow.attempts >= otpRow.max_attempts) {
    db.prepare("UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?").run(otpRow.id);
    throw new AuthError(429, "too_many_attempts", "Too many incorrect attempts. Please request a new code.");
  }

  const isMatch = safeEqual(sha256(code), otpRow.code_hash);

  if (!isMatch) {
    db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?").run(otpRow.id);
    const remaining = otpRow.max_attempts - (otpRow.attempts + 1);
    throw new AuthError(
      401,
      "incorrect_code",
      remaining > 0
        ? `Incorrect code. ${remaining} attempt(s) remaining.`
        : "Incorrect code. Please request a new one."
    );
  }

  // Success — consume the OTP so it can't be replayed.
  db.prepare("UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?").run(otpRow.id);

  let patient = findPatientByPhone(phoneNumber);

  if (purpose === "register") {
    if (!patient) {
      // Shouldn't happen (row is created in requestRegistrationOtp), but guard anyway.
      throw new AuthError(500, "patient_missing", "Registration record not found. Please start over.");
    }
    db.prepare(
      `UPDATE patients SET is_verified = 1, updated_at = datetime('now') WHERE id = ?`
    ).run(patient.id);
    patient = findPatientById(patient.id);
  } else {
    if (!patient || !patient.is_verified) {
      throw new AuthError(404, "phone_not_registered", "No account found for this phone number.");
    }
  }

  const session = createSession(patient.id);

  return { patient: sanitizePatient(patient), session };
}

function createSession(patientId) {
  const token = generateToken();
  const tokenHash = sha256(token);
  const expiresAt = daysFromNow(SESSION_EXPIRY_DAYS);

  db.prepare(
    `INSERT INTO sessions (patient_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).run(patientId, tokenHash, expiresAt);

  return { token, expiresAt };
}

function findSessionByToken(token) {
  if (!token) return null;
  const tokenHash = sha256(token);
  const row = db
    .prepare(
      `SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
    )
    .get(tokenHash);
  return row || null;
}

function revokeSession(token) {
  if (!token) return;
  const tokenHash = sha256(token);
  db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ?").run(tokenHash);
}

function sanitizePatient(patient) {
  if (!patient) return null;
  return {
    id: patient.id,
    phoneNumber: patient.phone_number,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    weightKg: patient.weight_kg,
    language: patient.language,
    isVerified: !!patient.is_verified,
    createdAt: patient.created_at,
  };
}

module.exports = {
  AuthError,
  requestRegistrationOtp,
  requestLoginOtp,
  verifyOtp,
  createSession,
  findSessionByToken,
  revokeSession,
  findPatientById,
  findPatientByPhone,
  sanitizePatient,
};
