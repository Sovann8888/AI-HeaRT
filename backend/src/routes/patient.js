const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { updateProfile, saveSymptomCheck, listSymptomChecks } = require("../services/patientService");

const router = express.Router();

router.use(requireAuth);

/** GET /api/patient/me — current patient's profile. */
router.get("/me", (req, res) => {
  res.status(200).json({ patient: req.patient });
});

/** PUT /api/patient/me — update profile fields (name, age, gender, weight, language). */
router.put("/me", (req, res) => {
  const updated = updateProfile(req.patientId, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: { code: "not_found", message: "Account not found." } });
  }
  res.status(200).json({ patient: updated });
});

/** POST /api/patient/symptom-checks — save a completed symptom-check result. */
router.post("/symptom-checks", (req, res) => {
  const { symptoms, results, triage } = req.body || {};
  if (!Array.isArray(symptoms) || !Array.isArray(results)) {
    return res
      .status(400)
      .json({ error: { code: "invalid_body", message: "symptoms and results must be arrays." } });
  }
  const check = saveSymptomCheck(req.patientId, { symptoms, results, triage });
  res.status(201).json({ symptomCheck: check });
});

/** GET /api/patient/symptom-checks — this patient's saved history, newest first. */
router.get("/symptom-checks", (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const checks = listSymptomChecks(req.patientId, { limit });
  res.status(200).json({ symptomChecks: checks });
});

module.exports = router;
