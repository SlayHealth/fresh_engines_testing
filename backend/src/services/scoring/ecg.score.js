// Thresholds are standard, widely-cited ECG reference values (Bazett-corrected QTc,
// QRS/PR interval norms) — not the deeper clinical calibration (relative point
// deductions) that dexa.score.js's WHO T-score cutoffs have. Point values here follow
// the same style as echo.score.js's deductions and should get the same clinical
// sign-off before being treated as final.
function ecgScore(ecgData, sex) {
  if (!ecgData) return null;
  let score = 100;

  // Rhythm — a non-sinus rhythm (e.g. atrial fibrillation) is the single most
  // significant ECG finding for a premarital/long-term-health context.
  if (ecgData.rhythm === 'atrial_fibrillation') score -= 40;
  else if (ecgData.rhythm === 'other') score -= 20;

  // QTc prolongation: >450ms (male) / >460ms (female) is the standard threshold;
  // >500ms is associated with materially higher Torsades de Pointes risk. A very
  // short QTc (<350ms) is also a recognized (rarer) risk and worth a small deduction.
  const qtc = ecgData.qtc_ms;
  if (typeof qtc === 'number') {
    const prolongedThreshold = sex === 'Female' ? 460 : 450;
    if (qtc > 500) score -= 40;
    else if (qtc > prolongedThreshold) score -= 20;
    else if (qtc < 350) score -= 10;
  }

  // QRS duration >120ms suggests a bundle branch block / conduction delay.
  if (typeof ecgData.qrs_ms === 'number' && ecgData.qrs_ms > 120) score -= 15;

  // PR interval: >200ms suggests first-degree AV block; <120ms can suggest
  // pre-excitation (e.g. WPW pattern) — both worth a modest deduction/follow-up.
  if (typeof ecgData.pr_ms === 'number') {
    if (ecgData.pr_ms > 200) score -= 10;
    else if (ecgData.pr_ms > 0 && ecgData.pr_ms < 120) score -= 10;
  }

  if (ecgData.axis === 'left_deviation' || ecgData.axis === 'right_deviation') score -= 10;

  // LVH voltage criteria is frequently a benign/normal variant in younger adults
  // (reports often say so explicitly), so this is a modest deduction, not a severe
  // one — but it should still surface as a real finding rather than being invisible.
  if (ecgData.lvh_voltage_criteria === true) score -= 15;

  // Resting bradycardia (<50bpm) or tachycardia (>100bpm).
  if (typeof ecgData.heart_rate_bpm === 'number') {
    if (ecgData.heart_rate_bpm < 50 || ecgData.heart_rate_bpm > 100) score -= 10;
  }

  return Math.max(0, Math.round(score));
}

module.exports = { ecgScore };
