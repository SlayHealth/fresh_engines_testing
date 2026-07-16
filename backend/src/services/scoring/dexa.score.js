// WS3B12: per ISCD 2019/2023 Adult Official Positions, the WHO T-score
// classification applies only to postmenopausal women and men >=50 — for
// premenopausal women and men <50 (menopausal status isn't collected here, so
// age<50 is the standard proxy), the Z-score must be used instead, with "below
// expected range for age" language rather than a T-score-based osteopenia/
// osteoporosis diagnosis (ISCD: osteoporosis cannot be diagnosed on BMD alone in
// this cohort). This is a premarital screening product, so this is the common
// case, not the exception.
const Z_SCORE_BELOW_EXPECTED_THRESHOLD = -2.0;

function lowestZScore(dexaData) {
  const sites = dexaData.sites || {};
  const zScores = Object.values(sites)
    .map((site) => site?.z_score)
    .filter((z) => typeof z === 'number');
  return zScores.length > 0 ? Math.min(...zScores) : null;
}

function dexaScore(dexaData, age) {
  if (!dexaData) return null;

  if (typeof age === 'number' && age < 50) {
    const lowestZ = lowestZScore(dexaData);
    if (lowestZ === null) return 80;
    // ISCD defines a single Z-score decision point, not a graduated WHO-style
    // scale — don't invent tiers the guideline doesn't support. Below -2.0 is
    // flagged for follow-up, not diagnosed as osteopenia/osteoporosis.
    return lowestZ <= Z_SCORE_BELOW_EXPECTED_THRESHOLD ? 60 : 100;
  }

  const lowestT = dexaData.lowest_t_score_value;
  if (lowestT === null || lowestT === undefined) return 80;

  if (lowestT >= -1.0) return 100;
  if (lowestT >= -1.5) return 80;
  if (lowestT >= -2.0) return 60;
  // WS3B11: WHO defines osteoporosis as T <= -2.5 (i.e. -2.5 itself is
  // osteoporosis, not osteopenia) — this previously used >= -2.5 here, which
  // put a T-score of exactly -2.5 in the osteopenia bucket, one tier too
  // lenient, and disagreed with this app's own DEXA schema prompt text
  // (dexa.schema.js), which already states the boundary correctly.
  if (lowestT > -2.5) return 40;  // osteopenia threshold
  return 20; // osteoporosis (T <= -2.5)
}

module.exports = { dexaScore, lowestZScore, Z_SCORE_BELOW_EXPECTED_THRESHOLD };
