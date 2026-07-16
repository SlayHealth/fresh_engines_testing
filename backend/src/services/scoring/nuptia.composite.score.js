const schemaRegistry = require('../radiology/schemaRegistry');
const { scrotalScore, scrotalFertilityRelevanceScore } = require('./scrotum.score');
const { echoScore } = require('./echo.score');
const { ecgScore } = require('./ecg.score');
const { dexaScore } = require('./dexa.score');
const { compositeAbdominalScore, femaleReproductiveScore } = require('./abdomen.score');

function calculateRadiologyNuptiaContribution(aggregatedRecord, patientSex, patientAge) {
  const unified = aggregatedRecord.unified;
  const scores = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // USG Abdomen (a full abdomen scan already covers the same bladder/reproductive
  // organs a standalone pelvis scan would, via the same compositeAbdominalScore call
  // below — so USG_PELVIS is only scored as its own modality when there's no abdomen
  // scan to fall back to, rather than double-counting the same organs under two
  // different weights.)
  // compositeAbdominalScore / femaleReproductiveScore can now return null — "this
  // modality was detected but nothing in it was actually assessed" (WS1D01) — which
  // must be excluded from the blend entirely, not folded in as a contributing score.
  // `null * weight` silently evaluates to 0 in JS, which would otherwise count a
  // not-assessed modality as if it were a confirmed catastrophic (score-0) finding —
  // exactly the fabrication this fix exists to remove, just inverted.
  const addModalityScore = (key, score, weight) => {
    if (score === null || score === undefined) return;
    scores[key] = score;
    totalWeightedScore += score * weight;
    totalWeight += weight;
  };

  if (unified.USG_ABDOMEN || unified.USG_ABDOMEN_PELVIS) {
    const usgData = unified.USG_ABDOMEN || unified.USG_ABDOMEN_PELVIS;
    const usgScore = compositeAbdominalScore(usgData, patientSex, patientAge);
    addModalityScore('USG_ABDOMEN', usgScore, schemaRegistry.getWeight('USG_ABDOMEN'));
  } else if (unified.USG_PELVIS) {
    // USG_PELVIS was previously classified, scored for risk flags, and given a weight
    // in schemaRegistry — but never actually read here, so a patient whose only scan
    // was a standalone pelvis ultrasound got risk flags but zero score contribution
    // and never appeared in modalities_scored. compositeAbdominalScore already
    // degrades gracefully for the abdomen-only organs (liver/gallbladder/pancreas/
    // spleen/kidneys) a pelvis scan doesn't cover — those are genuinely out of scope
    // for this modality and excluded from its internal blend, not scored as
    // unremarkable.
    const pelvisScore = compositeAbdominalScore(unified.USG_PELVIS, patientSex, patientAge);
    addModalityScore('USG_PELVIS', pelvisScore, schemaRegistry.getWeight('USG_PELVIS'));
  }

  // USG Scrotum (male only)
  if (unified.USG_SCROTUM_DOPPLER && patientSex === 'Male') {
    const sc = scrotalScore(unified.USG_SCROTUM_DOPPLER);
    const weight = schemaRegistry.getWeight('USG_SCROTUM_DOPPLER');
    scores.USG_SCROTUM_DOPPLER = sc;
    totalWeightedScore += sc * weight;
    totalWeight += weight;
  }

  // USG TVS (female only)
  if (unified.USG_TVS && patientSex === 'Female') {
    const tvs = femaleReproductiveScore(
      unified.USG_TVS.uterus,
      unified.USG_TVS
    );
    addModalityScore('USG_TVS', tvs, schemaRegistry.getWeight('USG_TVS'));
  }

  // Echo
  if (unified.ECHO) {
    const es = echoScore(unified.ECHO);
    const weight = schemaRegistry.getWeight('ECHO');
    scores.ECHO = es;
    totalWeightedScore += es * weight;
    totalWeight += weight;
  }

  // ECG
  if (unified.ECG) {
    const ecg = ecgScore(unified.ECG, patientSex);
    const weight = schemaRegistry.getWeight('ECG');
    scores.ECG = ecg;
    totalWeightedScore += ecg * weight;
    totalWeight += weight;
  }

  // DEXA
  if (unified.DEXA) {
    const ds = dexaScore(unified.DEXA, patientAge);
    const weight = schemaRegistry.getWeight('DEXA');
    scores.DEXA = ds;
    totalWeightedScore += ds * weight;
    totalWeight += weight;
  }

  // A critically low score in any single modality (e.g. a severe ECHO or scrotal
  // finding) must not be diluted away just because it happens to carry a small
  // weight relative to the others — cap the blended average close to the worst
  // modality's own score rather than letting it get averaged into a healthy-looking
  // overall number.
  const modalityScores = Object.values(scores);
  const worstModalityScore = modalityScores.length > 0 ? Math.min(...modalityScores) : null;
  let weightedAverage = totalWeight > 0 ? (totalWeightedScore / totalWeight) : null;
  if (weightedAverage !== null && worstModalityScore !== null && worstModalityScore < 30) {
    weightedAverage = Math.min(weightedAverage, worstModalityScore + 20);
  }

  // Normalize to 0-30 range (radiology total weight = 30% of NuptiaScore)
  const normalizedScore = weightedAverage !== null ? weightedAverage * 0.30 : null;

  return {
    organ_scores: scores,
    // A genuine score of 0 (worst-case finding) must still be reported as 0, not
    // silently coerced to null the way a falsy-check would.
    radiology_nuptia_contribution: normalizedScore !== null
      ? parseFloat(normalizedScore.toFixed(2))
      : null,
    max_possible: 0.30,
    modalities_scored: Object.keys(scores)
  };
}

module.exports = { calculateRadiologyNuptiaContribution };
