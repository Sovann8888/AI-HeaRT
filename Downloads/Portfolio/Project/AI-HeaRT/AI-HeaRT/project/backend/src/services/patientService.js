const db = require("../db");
const { findPatientById, sanitizePatient } = require("./authService");

const ALLOWED_GENDERS = new Set(["male", "female", "other", "prefer_not_to_say"]);

function updateProfile(patientId, updates) {
  const current = findPatientById(patientId);
  if (!current) return null;

  const name = updates.name !== undefined ? String(updates.name).slice(0, 100) : current.name;
  const age =
    updates.age !== undefined
      ? Math.max(0, Math.min(120, Number(updates.age) || 0))
      : current.age;
  const gender =
    updates.gender !== undefined && ALLOWED_GENDERS.has(updates.gender)
      ? updates.gender
      : current.gender;
  const weightKg =
    updates.weightKg !== undefined ? Number(updates.weightKg) || null : current.weight_kg;
  const language =
    updates.language === "km" || updates.language === "en" ? updates.language : current.language;

  db.prepare(
    `UPDATE patients
     SET name = ?, age = ?, gender = ?, weight_kg = ?, language = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(name, age, gender, weightKg, language, patientId);

  return sanitizePatient(findPatientById(patientId));
}

function saveSymptomCheck(patientId, { symptoms, results, triage }) {
  const symptomsJson = JSON.stringify(symptoms || []);
  const resultsJson = JSON.stringify(results || []);

  const info = db
    .prepare(
      `INSERT INTO symptom_checks (patient_id, symptoms_json, results_json, triage)
       VALUES (?, ?, ?, ?)`
    )
    .run(patientId, symptomsJson, resultsJson, triage || null);

  return getSymptomCheckById(info.lastInsertRowid);
}

function getSymptomCheckById(id) {
  const row = db.prepare("SELECT * FROM symptom_checks WHERE id = ?").get(id);
  return row ? formatCheck(row) : null;
}

function listSymptomChecks(patientId, { limit = 50 } = {}) {
  const rows = db
    .prepare(
      `SELECT * FROM symptom_checks WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(patientId, limit);
  return rows.map(formatCheck);
}

function formatCheck(row) {
  return {
    id: row.id,
    symptoms: JSON.parse(row.symptoms_json),
    results: JSON.parse(row.results_json),
    triage: row.triage,
    createdAt: row.created_at,
  };
}

module.exports = { updateProfile, saveSymptomCheck, listSymptomChecks };
