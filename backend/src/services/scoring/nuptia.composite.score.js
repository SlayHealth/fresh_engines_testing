const schemaRegistry = require('../radiology/schemaRegistry');
const { scrotalScore, scrotalFertilityRelevanceScore } = require('./scrotum.score');
const { echoScore } = require('./echo.score');
const { dexaScore } = require('./dexa.score');
const { compositeAbdominalScore, femaleReproductiveScore } = require('./abdomen.score');

function calculateRadiologyNuptiaContribution(aggregatedRecord, patientSex, patientAge) {
  const unified = aggregatedRecord.unified;
  const scores = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  // USG Abdomen
  if (unified.USG_ABDOMEN || unified.USG_ABDOMEN_PELVIS) {
    const usgData = unified.USG_ABDOMEN || unified.USG_ABDOMEN_PELVIS;
    const usgScore = compositeAbdominalScore(usgData, patientSex, patientAge);
    const weight = schemaRegistry.getWeight('USG_ABDOMEN');
    scores.USG_ABDOMEN = usgScore;
    totalWeightedScore += usgScore * weight;
    totalWeight += weight;
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
    const weight = schemaRegistry.getWeight('USG_TVS');
    scores.USG_TVS = tvs;
    totalWeightedScore += tvs * weight;
    totalWeight += weight;
  }

  // Echo
  if (unified.ECHO) {
    const es = echoScore(unified.ECHO);
    const weight = schemaRegistry.getWeight('ECHO');
    scores.ECHO = es;
    totalWeightedScore += es * weight;
    totalWeight += weight;
  }

  // DEXA
  if (unified.DEXA) {
    const ds = dexaScore(unified.DEXA);
    const weight = schemaRegistry.getWeight('DEXA');
    scores.DEXA = ds;
    totalWeightedScore += ds * weight;
    totalWeight += weight;
  }

  // Normalize to 0-30 range (radiology total weight = 30% of NuptiaScore)
  const normalizedScore = totalWeight > 0
    ? (totalWeightedScore / totalWeight) * 0.30
    : null;

  return {
    organ_scores: scores,
    radiology_nuptia_contribution: normalizedScore
      ? parseFloat(normalizedScore.toFixed(2))
      : null,
    max_possible: 0.30,
    modalities_scored: Object.keys(scores)
  };
}

module.exports = { calculateRadiologyNuptiaContribution };
