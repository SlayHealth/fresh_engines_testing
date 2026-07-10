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

  let res = await db.query(
    'SELECT * FROM radiology_reports WHERE (patient_slay_id = $1 OR LOWER(patient_slay_id) = LOWER($2)) ORDER BY created_at DESC LIMIT 1',
    [slayId, name]
  );
  if (res.rows[0]) {
    const row = res.rows[0];
    return {
      findings_json: typeof row.findings_json === 'string' ? JSON.parse(row.findings_json) : row.findings_json,
      scores_json: typeof row.scores_json === 'string' ? JSON.parse(row.scores_json) : row.scores_json,
      risk_flags_json: typeof row.risk_flags_json === 'string' ? JSON.parse(row.risk_flags_json) : row.risk_flags_json,
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
      findings_json: { USG_ABDOMEN: extracted?.findings || {} },
      scores_json: {
        organ_scores: analyzed?.scores || {},
        radiology_nuptia_contribution: analyzed?.nuptia_score_usg_contribution || null,
        modalities_scored: ['USG_ABDOMEN']
      },
      risk_flags_json: analyzed?.risk_flags || [],
      modalities_detected: ['USG_ABDOMEN'],
      created_at: row.created_at
    };
  }

  return null;
}

module.exports = { fetchRadiologyByIdentity };
