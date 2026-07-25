const crypto = require("crypto");

const PEPPER = process.env.HASH_PEPPER || "dev-only-insecure-pepper-change-me";

function sha256(value) {
  return crypto.createHash("sha256").update(`${value}${PEPPER}`).digest("hex");
}

function generateOtp() {
  // 6-digit numeric code, zero-padded (e.g. "004821")
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/** Constant-time-ish comparison of two hex hash strings. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { sha256, generateOtp, generateToken, safeEqual };
