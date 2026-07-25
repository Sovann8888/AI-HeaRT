require("dotenv").config();
const createApp = require("./app");

const PORT = process.env.PORT || 4000;

const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`AI-HeaRT backend listening on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Database file: ${process.env.DB_PATH || "./data/aiheart.db"}`);
  if (process.env.SMS_PROVIDER !== "twilio") {
    // eslint-disable-next-line no-console
    console.log("SMS_PROVIDER not set to a real provider — using MOCK OTP delivery (codes are logged here and returned in the API response).");
  }
});
