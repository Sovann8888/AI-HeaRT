module.exports = {
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: Number(process.env.OTP_EXPIRY_MINUTES || 5),
  OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  // How many OTPs a single phone number may request within the window below.
  OTP_RATE_LIMIT_WINDOW_MINUTES: Number(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || 60),
  OTP_RATE_LIMIT_MAX: Number(process.env.OTP_RATE_LIMIT_MAX || 5),
  SESSION_EXPIRY_DAYS: Number(process.env.SESSION_EXPIRY_DAYS || 30),
};
