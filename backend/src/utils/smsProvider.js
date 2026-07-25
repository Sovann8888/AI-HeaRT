/**
 * MOCK SMS PROVIDER
 * ------------------------------------------------------------------
 * This does NOT send a real text message. It logs the OTP to the server
 * console and returns it in the API response so you can test the full
 * register/verify flow without a paid SMS account.
 *
 * TO GO LIVE: replace the body of sendOtpSms() with a real provider call,
 * e.g. Twilio Verify, or a local Cambodian SMS gateway. Something like:
 *
 *   const twilio = require("twilio")(ACCOUNT_SID, AUTH_TOKEN);
 *   await twilio.messages.create({
 *     to: phoneNumber,
 *     from: YOUR_TWILIO_NUMBER,
 *     body: `Your AI-HeaRT verification code is ${code}`,
 *   });
 *
 * and remove `devCode` from the response so the code is never exposed
 * to the client in production.
 * ------------------------------------------------------------------
 */
async function sendOtpSms(phoneNumber, code) {
  const isMock = process.env.SMS_PROVIDER !== "twilio"; // extend this as real providers are added

  if (isMock) {
    // eslint-disable-next-line no-console
    console.log(`[MOCK SMS] -> ${phoneNumber}: Your AI-HeaRT verification code is ${code}`);
    return { delivered: false, mock: true };
  }

  throw new Error(
    "SMS_PROVIDER is set to a real provider, but no real integration has been implemented yet."
  );
}

module.exports = { sendOtpSms };
