const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  AuthError,
  requestRegistrationOtp,
  requestLoginOtp,
  verifyOtp,
  revokeSession,
} = require("../services/authService");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// Coarse per-IP limiter on top of the per-phone limiter in authService,
// so one IP can't hammer the OTP endpoints across many different numbers.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.OTP_IP_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many requests. Please try again later." } },
});

function handleAuthError(res, err) {
  if (err instanceof AuthError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: { code: "internal_error", message: "Something went wrong." } });
}

/** POST /api/auth/register — start registration for a new phone number. */
router.post("/register", otpRequestLimiter, async (req, res) => {
  try {
    const { phoneNumber, language } = req.body || {};
    const result = await requestRegistrationOtp(phoneNumber, language);
    res.status(201).json(result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

/** POST /api/auth/login — request an OTP for an existing account. */
router.post("/login", otpRequestLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body || {};
    const result = await requestLoginOtp(phoneNumber);
    res.status(200).json(result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

/** POST /api/auth/verify — verify the OTP for either register or login. */
router.post("/verify", (req, res) => {
  try {
    const { phoneNumber, code, purpose } = req.body || {};
    if (purpose !== "register" && purpose !== "login") {
      return res
        .status(400)
        .json({ error: { code: "invalid_purpose", message: "purpose must be 'register' or 'login'." } });
    }
    const result = verifyOtp(phoneNumber, code, purpose);
    res.status(200).json(result);
  } catch (err) {
    handleAuthError(res, err);
  }
});

/** POST /api/auth/logout — revoke the current session token. */
router.post("/logout", requireAuth, (req, res) => {
  revokeSession(req.sessionToken);
  res.status(204).send();
});

/** GET /api/auth/session — quick check for whether the current token is still valid. */
router.get("/session", requireAuth, (req, res) => {
  res.status(200).json({ patient: req.patient });
});

module.exports = router;
