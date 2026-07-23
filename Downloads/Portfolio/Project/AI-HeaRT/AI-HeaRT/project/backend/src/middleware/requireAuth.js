const { findSessionByToken, findPatientById, sanitizePatient } = require("../services/authService");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: { code: "missing_token", message: "Authentication required." } });
  }

  const session = findSessionByToken(token);
  if (!session) {
    return res.status(401).json({ error: { code: "invalid_session", message: "Session is invalid or expired. Please log in again." } });
  }

  const patient = findPatientById(session.patient_id);
  if (!patient) {
    return res.status(401).json({ error: { code: "patient_missing", message: "Account not found." } });
  }

  req.patient = sanitizePatient(patient);
  req.patientId = patient.id;
  req.sessionToken = token;
  next();
}

module.exports = requireAuth;
