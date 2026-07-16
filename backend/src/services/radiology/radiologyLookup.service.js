const { db } = require('../storage/postgres.service');

/**
 * Looks up a person's most recent radiology analysis by patient identity.
 * Radiology reports aren't linked to a match/pathology report by foreign key —
 * they're associated by the patient_slay_id/name the analysis was run under —
 * so this is the one correct way to find "this person's radiology," matching
 * how the report was actually stored at upload time.
 */
async function fetchRadiologyByIdentity(slayId, name) {
  if (!slayId && !name) return null;

  // Shape must match radiology.controller.js's fetchReportWithFallback exactly
  // (id/patient_slay_id/sex/age/findings/scores/risk_flags/modalities_detected/
  // created_at) — both are interchangeable inputs to mapRadiologyToLegacyFormat,
  // which reads those unprefixed keys. This function previously returned
  // findings_json/scores_json/risk_flags_json (the raw DB column names) and omitted
  // sex/age/id entirely, so mapRadiologyToLegacyFormat silently read all-undefined
  // for every field and fell back to default/100 organ scores and an empty risk-flag
  // list — for every couple, on the one endpoint (getMatchRadiology) and the one
  // scoring path (_fetchRadiologyScore) that call this function.
  let res = await db.query(
    'SELECT * FROM radiology_reports WHERE (patient_slay_id = $1 OR LOWER(patient_slay_id) = LOWER($2)) ORDER BY created_at DESC LIMIT 1',
    [slayId, name]
  );
  if (res.rows[0]) {
    const row = res.rows[0];
    return {
      id: row.id,
      patient_slay_id: row.patient_slay_id,
      sex: row.sex,
      age: row.age,
      findings: typeof row.findings_json === 'string' ? JSON.parse(row.findings_json) : row.findings_json,
      scores: typeof row.scores_json === 'string' ? JSON.parse(row.scores_json) : row.scores_json,
      risk_flags: typeof row.risk_flags_json === 'string' ? JSON.parse(row.risk_flags_json) : row.risk_flags_json,
      modalities_detected: row.modalities_detected,
      created_at: row.created_at
    };
  }

  // Fallback to the legacy usg_reports table for older USG-only reports.
  res = await db.query(
    'SELECT * FROM usg_reports WHERE (patient_slay_id = $1 OR LOWER(patient_slay_id) = LOWER($2)) ORDER BY created_at DESC LIMIT 1',
    [slayId, name]
  );
  if (res.rows[0]) {
    const row = res.rows[0];
    const extracted = typeof row.extracted_json === 'string' ? JSON.parse(row.extracted_json) : row.extracted_json;
    const analyzed = typeof row.analyzed_results === 'string' ? JSON.parse(row.analyzed_results) : row.analyzed_results;
    return {
      id: row.id,
      patient_slay_id: row.patient_slay_id,
      sex: extracted?.patient?.sex || 'Female',
      age: extracted?.patient?.age_years || 30,
      findings: { USG_ABDOMEN: extracted?.findings || {} },
      scores: {
        organ_scores: analyzed?.scores || {},
        radiology_nuptia_contribution: analyzed?.nuptia_score_usg_contribution || null,
        modalities_scored: ['USG_ABDOMEN']
      },
      risk_flags: analyzed?.risk_flags || [],
      modalities_detected: ['USG_ABDOMEN'],
      created_at: row.created_at
    };
  }

  return null;
}

module.exports = { fetchRadiologyByIdentity };
