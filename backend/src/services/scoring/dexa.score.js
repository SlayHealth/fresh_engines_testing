function dexaScore(dexaData) {
  if (!dexaData) return null;
  const lowestT = dexaData.lowest_t_score_value;
  if (lowestT === null || lowestT === undefined) return 80;

  if (lowestT >= -1.0) return 100;
  if (lowestT >= -1.5) return 80;
  if (lowestT >= -2.0) return 60;
  if (lowestT >= -2.5) return 40;  // osteopenia threshold
  return 20; // osteoporosis
}

module.exports = { dexaScore };
