// Major fertility indicators: varicocele, hydrocele, testicular volume

function scrotalScore(scrotumData) {
  if (!scrotumData) return null;
  let score = 100;

  // Varicocele — graded fertility impact
  if (scrotumData.varicocele?.present) {
    const grade = scrotumData.varicocele.grade;
    if (grade === 1) score -= 15;
    if (grade === 2) score -= 30;
    if (grade === 3) score -= 45;
    if (!grade) score -= 20; // present but grade unknown
  }

  // Hydrocele — bilateral more impactful
  if (scrotumData.hydrocele?.present) {
    if (scrotumData.hydrocele.side === 'bilateral') score -= 15;
    else if (scrotumData.hydrocele.significant) score -= 10;
    else score -= 5;
  }

  // Focal lesion — serious flag
  if (scrotumData.right_testis?.focal_lesion || scrotumData.left_testis?.focal_lesion) {
    score -= 40;
  }

  // Vascularity abnormal
  if (scrotumData.right_testis?.vascularity_normal === false ||
      scrotumData.left_testis?.vascularity_normal === false) {
    score -= 20;
  }

  // Inguinal hernia
  if (scrotumData.inguinal_hernia) score -= 5;

  return Math.max(0, score);
}

function scrotalFertilityRelevanceScore(scrotumData) {
  if (!scrotumData) return 0;
  let score = 0;
  if (scrotumData.varicocele?.present) {
    score += scrotumData.varicocele.grade === 3 ? 9 : scrotumData.varicocele.grade === 2 ? 7 : 5;
  }
  if (scrotumData.hydrocele?.significant) score += 4;
  if (scrotumData.right_testis?.focal_lesion || scrotumData.left_testis?.focal_lesion) score += 9;
  return Math.min(10, score);
}

module.exports = { scrotalScore, scrotalFertilityRelevanceScore };
