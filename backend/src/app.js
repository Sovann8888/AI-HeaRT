const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const patientRoutes = require("./routes/patient");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/patient", patientRoutes);

  // 404 fallback
  app.use((req, res) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found." } });
  });

  // Error fallback (in case a route handler throws synchronously and misses its own try/catch)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: { code: "internal_error", message: "Something went wrong." } });
  });

  return app;
}

module.exports = createApp;
