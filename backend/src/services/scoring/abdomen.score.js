// The extractor's own contract (radiologyExtractor.service.js BASE_SYSTEM_PROMPT
// rule 2) is "if a field is not mentioned, set it to null" — so every schema key is
// present on the object it hands back, but an organ that was never imaged/visualized
// still shows up as an object full of nulls, not as a missing key. A bare `!organ`
// check therefore misses the common case entirely. `hasSignal` is the one place that
// decides "was this organ actually reported on" — an explicit value (including a
// deliberate `false`) counts as a real finding; `null`/`undefined` doesn't. Every
// scorer below returns `null` ("not assessed") when none of its fields carry a real
// value, instead of silently defaulting to a fabricated healthy 100.
function hasSignal(obj, keys) {
  if (!obj) return false;
  return keys.some((k) => obj[k] !== null && obj[k] !== undefined);
}

function liverScore(liver) {
  if (!hasSignal(liver, ['fatty_grade', 'hepatomegaly', 'ihbr_dilated']) && !(liver?.focal_lesions?.length > 0)) {
    return null;
  }
  let score = 100;
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
  // `_applicable === false` is an explicit, confirmed "this patient is female"
  // signal — genuinely 100/not-applicable. An entirely absent `prostate` is a
  // DIFFERENT case (unknown / never assessed) and must not be folded into the same
  // 100 — callers only invoke this for a male patient in the first place, so absence
  // here means missing data, not an inferred sex.
  if (prostate && prostate._applicable === false) return 100;
  if (!hasSignal(prostate, ['size_normal', 'grade', 'volume_cc', 'weight_grams'])) return null; // applicable, but never actually assessed
  const ageNormals = { 40: 20, 50: 25, 60: 30, 70: 40, 80: 45 };
  const ageKey = Math.round(age / 10) * 10;
  const normal = ageNormals[Math.min(80, Math.max(40, ageKey))];
  const vol = prostate.volume_cc || prostate.weight_grams;
  if (!vol) return null; // applicable, but no measurement to score
  const ratio = vol / normal;
  if (ratio <= 1.2) return 100;
  if (ratio <= 1.5) return 80; // Grade I
  if (ratio <= 2.0) return 55; // Grade II
  return 30; // Grade III
}

function femaleReproductiveScore(uterus, ovaries) {
  // Same distinction as prostateScore: `_applicable === false` is a confirmed "this
  // patient is male" signal (100). An entirely absent `uterus` just means no data —
  // callers only invoke this for a female patient, so it must fall through to the
  // not-assessed check below rather than being treated as a confirmed male.
  if (uterus && uterus._applicable === false) return 100;
  const uterusAssessed = hasSignal(uterus, ['fibroid_present', 'collection_in_cavity', 'size_normal']);
  const ovariesAssessed = hasSignal(ovaries, [
    'pcos_morphology_bilateral', 'pcos_morphology_unilateral',
    'vaginal_cyst_collection', 'pouch_of_douglas_free_fluid'
  ]) || hasSignal(ovaries?.right, ['volume_cc', 'cyst_present']) || hasSignal(ovaries?.left, ['volume_cc', 'cyst_present']);
  if (!uterusAssessed && !ovariesAssessed) return null;

  let score = 100;
  // Uterine pathology — evaluated independent of whether ovaries were also reported,
  // so a real fibroid finding can never be skipped just because the ovaries section
  // is absent (the previous `if (!ovaries) return score` did exactly that).
  if (uterus?.fibroid_present) score -= 15;
  if (uterus?.collection_in_cavity) score -= 10;

  if (ovaries) {
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
    // POD / pelvic fluid
    if (ovaries.vaginal_cyst_collection) score -= 8;
    if (ovaries.pouch_of_douglas_free_fluid) score -= 5;
  }
  return Math.max(0, score);
}

function gallbladderScore(gb) {
  if (!gb) return null; // not mentioned at all
  if (gb.present === false) return 100; // confirmed absent (e.g. post-cholecystectomy) — nothing to score
  if (!hasSignal(gb, ['present', 'calculi_present', 'polyp_present', 'wall_thickness_normal'])) return null;
  let score = 100;
  if (gb.calculi_present) score -= 30;
  if (gb.wall_thickness_normal === false) score -= 15;
  if (gb.polyp_present) score -= 10;
  return Math.max(0, score);
}

function kidneyScore(kidneys) {
  const rightAssessed = hasSignal(kidneys?.right, ['calculi_present', 'size_normal', 'hydronephrosis', 'hydronephrosis_grade', 'corticomedullary_differentiation']) || kidneys?.right?.cysts?.length > 0;
  const leftAssessed = hasSignal(kidneys?.left, ['calculi_present', 'size_normal', 'hydronephrosis', 'hydronephrosis_grade', 'corticomedullary_differentiation']) || kidneys?.left?.cysts?.length > 0;
  if (!rightAssessed && !leftAssessed) return null;
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
  if (!hasSignal(bladder, ['wall_thickness_normal', 'calculi_present', 'post_void_residual_cc', 'mass_present'])) return null;
  let score = 100;
  if (bladder.wall_thickness_normal === false) score -= 15;
  if (bladder.calculi_present) score -= 30;
  if (bladder.mass_present) score -= 50;

  if (bladder.post_void_residual_cc > 100) score -= 20;
  else if (bladder.post_void_residual_cc > 50) score -= 10;

  return Math.max(0, score);
}

function pancreasScore(pancreas) {
  if (!hasSignal(pancreas, ['size_normal', 'echotexture_normal', 'focal_lesion', 'calcifications'])) return null;
  let score = 100;
  if (pancreas.size_normal === false) score -= 15;
  if (pancreas.echotexture_normal === false) score -= 15;
  if (pancreas.focal_lesion) score -= 40;
  if (pancreas.calcifications) score -= 20;
  return Math.max(0, score);
}

function spleenScore(spleen) {
  if (!hasSignal(spleen, ['size_normal', 'size_category', 'focal_lesion'])) return null;
  let score = 100;
  if (spleen.size_category === 'small') score -= 10;
  else if (spleen.size_category && spleen.size_category !== 'normal') score -= 15;
  if (spleen.focal_lesion) score -= 30;
  return Math.max(0, score);
}

// Below this, a single organ's finding is severe enough (e.g. a mass, high-grade
// hydronephrosis, marked fatty liver) that it must not be averaged away by other
// normal organs — see the cap applied in compositeAbdominalScore below.
const CRITICAL_ORGAN_SCORE_THRESHOLD = 30;

function compositeAbdominalScore(findings, sex, age) {
  if (!findings) return null;
  const l_score = liverScore(findings.liver);
  const gb_score = gallbladderScore(findings.gallbladder);
  const p_score = pancreasScore(findings.pancreas);
  const s_score = spleenScore(findings.spleen);
  const k_score = kidneyScore(findings.kidneys);
  const b_score = bladderScore(findings.urinary_bladder);
  const rep_score = sex === 'Female'
    ? femaleReproductiveScore(findings.uterus, findings.ovaries)
    : prostateScore(findings.prostate, age || 40);

  const weights = {
    liver: 0.22,
    gallbladder: 0.10,
    pancreas: 0.08,
    spleen: 0.07,
    kidneys: 0.18,
    bladder: 0.10,
    reproductive: 0.25
  };
  const organScores = {
    liver: l_score, gallbladder: gb_score, pancreas: p_score, spleen: s_score,
    kidneys: k_score, bladder: b_score, reproductive: rep_score
  };

  // Only organs the extractor actually reported on contribute to the blend — an
  // unimaged/unmentioned organ is "not assessed" (null, from the scorers above), not
  // a fabricated normal 100. Weights renormalize over whichever organs ARE present,
  // the same pattern computeGatedComposite already uses across composite domains —
  // a scan imaging only the kidneys (normal) now correctly yields a 100 driven by
  // real kidney data alone, not a 100 padded out by six organs nobody looked at.
  let totalWeight = 0;
  let weightedSum = 0;
  const assessedScores = [];
  for (const organ of Object.keys(weights)) {
    const score = organScores[organ];
    if (score === null) continue;
    totalWeight += weights[organ];
    weightedSum += score * weights[organ];
    assessedScores.push(score);
  }

  if (totalWeight === 0) return null; // nothing in this scan was actually assessed

  const total = weightedSum / totalWeight;

  // A single critically-abnormal organ (e.g. a liver mass scoring 0) must not be
  // diluted into a reassuring-looking composite just because the other organs are
  // normal — cap the overall score close to the worst individual organ finding.
  const worstOrganScore = Math.min(...assessedScores);
  const finalScore = worstOrganScore < CRITICAL_ORGAN_SCORE_THRESHOLD
    ? Math.min(total, worstOrganScore + 20)
    : total;

  return Math.round(Math.max(0, finalScore));
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
  
  // WS3B09: WHO's international BMI bands (overweight >=25, obese >30/35) were
  // being applied to an India-focused product. WHO Asia-Pacific / Misra et al.
  // Indian consensus (JAPI 2009) define overweight >=23 and obese >=25 for Asian
  // Indians — under the old thresholds, the 23-24.9 at-risk band scored clean and
  // 25-29.9 (already obese by Indian criteria) was only mildly penalized. Same
  // penalty magnitudes at each tier, just re-anchored to the correct population's
  // cutoffs — also brings this in line with the IDRS waist bands elsewhere in
  // this file, which already use the Asian-Indian M90/F80 convention.
  if (bmi >= 32.5) score -= 2;
  else if (bmi >= 25) score -= 1;
  else if (bmi >= 23) score -= 0.5;

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
