function liverScore(liver) {
  let score = 100;
  if (!liver) return score;
  if (liver.fatty_grade === 1) score -= 15;
  if (liver.fatty_grade === 2) score -= 30;
  if (liver.fatty_grade === 3) score -= 50;
  if (liver.hepatomegaly) score -= 10;
  if (liver.ihbr_dilated) score -= 20;
  if (liver.focal_lesions?.length > 0) {
    liver.focal_lesions.forEach(l => {
      if (l.type === 'simple_cyst') score -= 5;
      else if (l.type === 'mass') score -= 40;
    });
  }
  return Math.max(0, score);
}

function prostateScore(prostate, age) {
  if (!prostate || !prostate._applicable) return 100; // Not applicable for females
  const ageNormals = { 40: 20, 50: 25, 60: 30, 70: 40, 80: 45 };
  const ageKey = Math.round(age / 10) * 10;
  const normal = ageNormals[Math.min(80, Math.max(40, ageKey))];
  const vol = prostate.volume_cc || prostate.weight_grams;
  if (!vol) return 80; // insufficient data
  const ratio = vol / normal;
  if (ratio <= 1.2) return 100;
  if (ratio <= 1.5) return 80; // Grade I
  if (ratio <= 2.0) return 55; // Grade II
  return 30; // Grade III
}

function femaleReproductiveScore(uterus, ovaries) {
  if (!uterus || !uterus._applicable) return 100; // Male
  let score = 100;
  if (!ovaries) return score;
  // PCOS flags
  if (ovaries.pcos_morphology_bilateral) score -= 35;
  else if (ovaries.pcos_morphology_unilateral) score -= 20;
  // Ovarian volume
  const rightVol = ovaries.right?.volume_cc;
  const leftVol = ovaries.left?.volume_cc;
  if (rightVol > 10) score -= 10;
  if (leftVol > 10) score -= 10;
  // Ovarian cysts
  if (ovaries.right?.cyst_present) score -= 8;
  if (ovaries.left?.cyst_present) score -= 8;
  // Uterine pathology
  if (uterus?.fibroid_present) score -= 15;
  if (uterus?.collection_in_cavity) score -= 10;
  // POD / pelvic fluid
  if (ovaries.vaginal_cyst_collection) score -= 8;
  if (ovaries.pouch_of_douglas_free_fluid) score -= 5;
  return Math.max(0, score);
}

function gallbladderScore(gb) {
  if (!gb || !gb.present) return 100;
  let score = 100;
  if (gb.calculi_present) score -= 30; 
  if (gb.wall_thickness_normal === false) score -= 15;
  if (gb.polyp_present) score -= 10;
  return Math.max(0, score);
}

function kidneyScore(kidneys) {
  if (!kidneys) return 100;
  let score = 100;
  const checkKidney = (k) => {
    if (!k) return;
    if (k.calculi_present) score -= 20;
    if (k.cysts && k.cysts.length > 0) score -= 5;
    if (k.hydronephrosis) {
       if (k.hydronephrosis_grade === 1) score -= 15;
       else score -= 30;
    }
    if (k.corticomedullary_differentiation === 'poor' || k.corticomedullary_differentiation === 'lost') {
      score -= 30;
    }
  };
  checkKidney(kidneys.right);
  checkKidney(kidneys.left);
  return Math.max(0, score);
}

function bladderScore(bladder) {
  if (!bladder) return 100;
  let score = 100;
  if (bladder.wall_thickness_normal === false) score -= 15;
  if (bladder.calculi_present) score -= 30;
  if (bladder.mass_present) score -= 50;
  
  if (bladder.post_void_residual_cc > 100) score -= 20;
  else if (bladder.post_void_residual_cc > 50) score -= 10;
  
  return Math.max(0, score);
}

function pancreasScore(pancreas) {
  if (!pancreas) return 100;
  let score = 100;
  if (pancreas.size_normal === false) score -= 15;
  if (pancreas.echotexture_normal === false) score -= 15;
  if (pancreas.focal_lesion) score -= 40;
  if (pancreas.calcifications) score -= 20;
  return Math.max(0, score);
}

function spleenScore(spleen) {
  if (!spleen) return 100;
  let score = 100;
  if (spleen.size_category === 'small') score -= 10;
  else if (spleen.size_category && spleen.size_category !== 'normal') score -= 15;
  if (spleen.focal_lesion) score -= 30;
  return Math.max(0, score);
}

function compositeAbdominalScore(findings, sex, age) {
  if (!findings) return 100;
  const l_score = liverScore(findings.liver);
  const gb_score = gallbladderScore(findings.gallbladder);
  const p_score = pancreasScore(findings.pancreas);
  const s_score = spleenScore(findings.spleen);
  const k_score = kidneyScore(findings.kidneys);
  const b_score = bladderScore(findings.urinary_bladder);
  let rep_score = 100;
  if (sex === 'Female') rep_score = femaleReproductiveScore(findings.uterus, findings.ovaries);
  else rep_score = prostateScore(findings.prostate, age || 40);

  const weights = {
    liver: 0.22,
    gallbladder: 0.10,
    pancreas: 0.08,
    spleen: 0.07,
    kidneys: 0.18,
    bladder: 0.10,
    reproductive: 0.25
  };
  
  const total = l_score * weights.liver +
                gb_score * weights.gallbladder +
                p_score * weights.pancreas +
                s_score * weights.spleen +
                k_score * weights.kidneys +
                b_score * weights.bladder +
                rep_score * weights.reproductive;
                
  return Math.round(total);
}

function calculateMetabolicHealthIndex(findings, bmi) {
  let score = 10;
  if (!findings || !findings.liver) return score;
  
  const fatty_grade = findings.liver.fatty_grade;
  const hepatomegaly = findings.liver.hepatomegaly;
  const cholelithiasis = findings.gallbladder?.calculi_present;

  if (fatty_grade === 1) score -= 1;
  else if (fatty_grade === 2) score -= 2.5;
  else if (fatty_grade === 3) score -= 4;
  
  if (hepatomegaly && !fatty_grade) score -= 1; // "hepatomegaly without fatty"
  if (cholelithiasis) score -= 1;
  
  if (bmi > 35) score -= 2;
  else if (bmi > 30) score -= 1;
  else if (bmi >= 25) score -= 0.5;
  
  return Math.max(0, score);
}

module.exports = {
  liverScore,
  prostateScore,
  femaleReproductiveScore,
  gallbladderScore,
  kidneyScore,
  bladderScore,
  pancreasScore,
  spleenScore,
  compositeAbdominalScore,
  calculateMetabolicHealthIndex
};
