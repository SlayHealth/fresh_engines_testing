function echoScore(echoData) {
  if (!echoData) return null;
  let score = 100;

  const lvef = echoData.lvef_percent;
  if (lvef !== null) {
    if (lvef < 35) score -= 50;
    else if (lvef < 50) score -= 25;
    else if (lvef < 55) score -= 10;
  }

  // Valve pathology
  const valves = echoData.valves || {};
  for (const valve of Object.values(valves)) {
    const grade = valve.mr_grade || valve.ar_grade || valve.tr_grade || valve.pr_grade;
    if (grade === 'mild') score -= 5;
    if (grade === 'moderate') score -= 15;
    if (grade === 'severe') score -= 35;
  }

  // PAH
  const pahSeverity = echoData.pah?.severity;
  if (pahSeverity === 'mild') score -= 10;
  if (pahSeverity === 'moderate') score -= 25;
  if (pahSeverity === 'severe') score -= 45;

  // Diastolic dysfunction
  const dGrade = echoData.diastolic_dysfunction_grade;
  if (dGrade === 1 || dGrade === '1') score -= 5;
  if (dGrade === 2 || dGrade === '2') score -= 15;
  if (dGrade === 3 || dGrade === '3') score -= 30;

  if (echoData.pericardial_effusion) score -= 10;
  if (echoData.rwma) score -= 20;
  if (echoData.thrombus || echoData.vegetation) score -= 40;

  return Math.max(0, score);
}

module.exports = { echoScore };
