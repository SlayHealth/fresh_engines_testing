const { db } = require('../services/storage/postgres.service');
const { generateStructuredInsight } = require('../services/llm.service');

// HSP v2.1 Priors & Constants
const BASELINE_RISK_PROB = 0.10;
const ODDS_0 = BASELINE_RISK_PROB / (1 - BASELINE_RISK_PROB);

const BIOMARKER_LRS = {
  bloodPressure: { High: 1.5, Elevated: 1.2, Normal: 1.0 },
  glucose: { Borderline: 1.5, Normal: 1.0, High: 1.0 }, // High triggers the Gate instead
  lipids: { High: 1.5, Borderline: 1.2, Normal: 1.0 }
};

// WS1A01: blood pressure, glucose, and lipids are physiologically correlated in
// insulin resistance / metabolic syndrome — they co-move rather than moving
// independently. Multiplying their LRs as if independent overstates combined risk
// by ~63% relative for a couple with multiple elevated markers (reproduced: BP
// High x glucose Borderline x lipids High = 3.375 -> 27.3% vs. a hand-estimated
// "true" correlated-cluster risk of ~16.7%). A shrinkage exponent < 1 is a
// standard technique for combining correlated likelihood ratios without a
// study-specific correlation coefficient. INTERIM measure, not a cited value: 0.7
// is a reasoned estimate pending the dedicated validation pass the review calls
// for (WS3B04/WS1A01) — there is no published correlation coefficient for this
// specific three-marker cluster to cite yet.
const BIOMARKER_LR_SHRINKAGE_EXPONENT = 0.7;

// Applies the shrinkage to only the *compounding* — the dominant (largest) single
// LR always passes through completely unshrunk, and the exponent damps just the
// extra multiplier the other, correlated markers contribute on top of it. This
// guarantees a single elevated marker's own LR is genuinely unchanged (the
// property this correction is supposed to have), not just approximately so:
// with one real factor and the rest at the neutral 1.0, product/max = 1, and
// 1^exponent = 1 regardless of the exponent's value.
function shrinkCorrelatedLRs(lrs, exponent) {
  const max = Math.max(...lrs);
  if (max <= 1.0) return 1.0;
  const product = lrs.reduce((acc, v) => acc * v, 1);
  return max * Math.pow(product / max, exponent);
}

// NOTE: `smoking` and `sleep` below have the same class of bug `alcohol` had
// until this fix — their keys ('Regular'/'Occasional'/'Never',
// 'Night owl'/'Irregular'/'Early bird') don't match the actual frontend
// option values (frontend/src/constants/lifestyleOptions.js's LIFESTYLE_SMOKING_TOBACCO
// uses 'never'/'occasion'/'regular'/'chain'; LIFESTYLE_SLEEP uses 'Early Bird'/
// 'night owl'/'irregular'/'insomniac') — every lookup below silently falls
// through to the neutral `|| 1.0` default (see getEffectiveLifestyleLR), so
// smoking/sleep habits currently contribute nothing to chronic risk scoring
// regardless of what a user actually answers. Flagged here, not fixed here —
// out of scope for the alcohol-specific fix this comment sits next to.
const LIFESTYLE_LRS = {
  diet: { Poor: 1.3, Mixed: 1.15, Healthy: 1.0 },
  smoking: { Regular: 1.5, Occasional: 1.25, Never: 1.0 },
  // Keys match LIFESTYLE_DRINKING's `val`s exactly (frontend/src/constants/
  // lifestyleOptions.js) — previously 'Regular'/'Occasional' here could never
  // match the frontend's actual 'socially'/'regularly'/'heavily' values, so
  // every non-abstinent answer silently scored as risk-neutral (1.0, same as
  // Never). `Quit` ("Previously, but quit") is intentionally also 1.0, not a
  // separate penalized tier: the person isn't currently consuming, so the
  // forward-looking behavioral risk this factor models doesn't apply: any
  // organ-level residual damage from past drinking is already captured
  // directly by the pathology panel's own liver-enzyme scoring rather than
  // inferred a second time here from a self-report category, and there's no
  // validated, citable time-decay curve for "risk since quitting" to apply
  // instead of just guessing one.
  alcohol: { Frequently: 1.2, Occasionally: 1.1, Quit: 1.0, Never: 1.0 },
  sleep: { 'Night owl': 1.2, Irregular: 1.1, 'Early bird': 1.0 },
  stress: { High: 1.2, Moderate: 1.1, Normal: 1.0 }
};

// WS1A07: this used to also apply a "sharedness" exponent so a partner's own
// lifestyle LR partially multiplied into YOUR individual risk score (e.g. diet/
// sleep weighted as 100% shared, smoking 20%, alcohol/stress 0%) — an uncited,
// invented mechanism that could dock a person with genuinely perfect habits by
// several points purely because their partner's habits were poor. Removed: your
// own chronic-disease risk score is now computed from your own habits only.

// Indian Diabetes Risk Score (IDRS)
function calculateIDRS(age, waistCat, activity, familyHistory, sex) {
  let score = 0;
  
  // Age
  if (age >= 50) score += 30;
  else if (age >= 35) score += 20;
  
  // Waist Category (already mapped to Normal, Borderline, High)
  if (waistCat === 'High') score += 20;
  else if (waistCat === 'Borderline') score += 10;
  
  // Activity — WS3B02: the validated MDRF-IDRS activity axis is a 4-tier scale
  // (vigorous/strenuous exercise 0 / moderate exercise 10 / mild exercise 20 / no
  // exercise 30). The app's own UI (LIFESTYLE_ACTIVITIES) already offers four
  // tiers — Sedentary/Moderate/Active/Athletic — but this scorer only recognized
  // two of them ('Sedentary'/'Moderate'), silently scoring 'Active' and 'Athletic'
  // as 0 (the same points as vigorous exercise) and mis-scoring the app's own
  // "Moderate" (light exercise, 1-3x/week) at the validated instrument's "mild"
  // value's neighbor rather than its own. Mapped by descriptive intensity, not
  // label name: Athletic (daily intense exercise) = vigorous -> 0; Active (regular
  // exercise 3-5x/wk) = moderate -> 10; Moderate (light exercise 1-3x/wk) = mild
  // -> 20; Sedentary (0-1x/wk) = none -> 30.
  if (activity === 'Sedentary') score += 30;
  else if (activity === 'Moderate') score += 20;
  else if (activity === 'Active') score += 10;
  else if (activity === 'Athletic') score += 0;
  
  // Family History — WS1A04/WS3B01: the validated MDRF-IDRS family-history axis
  // is a 3-level ordinal (none 0 / one parent 10 / both parents 20). Previously
  // collapsed to a boolean, which could never award the 20-point "both parents"
  // tier and capped the theoretical maximum IDRS at 90 despite the UI/LLM prompt
  // labeling it "/100". `true`/'One' both map to the single-parent tier for
  // backwards compatibility with any caller still passing the old boolean shape.
  if (familyHistory.parentDiabetes === 'Both') score += 20;
  else if (familyHistory.parentDiabetes === 'One' || familyHistory.parentDiabetes === true) score += 10;
  
  return score;
}

// WS1A09: extracted so the 10-year projection can re-derive this same band/LR at
// each projected year from aged inputs, instead of duplicating the three-branch
// if/else and drifting out of sync with it.
function idrsToLR(idrs) {
  if (idrs >= 60) return 1.82;
  if (idrs >= 30) return 1.1; // Moderate Risk
  return 0.46; // Low Risk
}

function getEffectiveLifestyleLR(ownLifestyle) {
  const multipliers = {};
  let totalLR = 1.0;

  for (const factor of Object.keys(LIFESTYLE_LRS)) {
    const ownLR = LIFESTYLE_LRS[factor][ownLifestyle[factor]] || 1.0;
    multipliers[factor] = ownLR;
    totalLR *= ownLR;
  }

  return { multipliers, totalLR };
}

// Helper to find extracted parameter in PDF parsing
function findExtractedParam(extracted_data, canonical_name) {
  if (!extracted_data) return null;
  for (const sectionKey of Object.keys(extracted_data)) {
    const section = extracted_data[sectionKey];
    if (section && section[canonical_name]) {
      return section[canonical_name];
    }
  }
  return null;
}

// 4. Clinical Parameter Mapping from PDF Reports
function detectWaistCategory(waistVal, gender) {
  if (!waistVal || isNaN(waistVal)) return 'Normal';
  const theta0 = gender === 'male' ? 90 : 80;
  const theta1 = gender === 'male' ? 100 : 90;
  if (waistVal >= theta1) return 'High';
  if (waistVal >= theta0) return 'Borderline';
  return 'Normal';
}

function detectBPCategory(sbp, dbp) {
  if (!sbp || isNaN(sbp)) return 'Normal';
  if (sbp >= 140 || dbp >= 90) return 'High';
  if (sbp >= 130 || dbp >= 85) return 'Elevated';
  return 'Normal';
}

// HbA1c-only detection missed the extremely common case of an Indian lab panel that
// only orders fasting glucose (FBS/FBG) — a report with FBS 250 and no HbA1c would
// resolve to 'Normal', no diabetic gate, no cap (WS1A03). Both measures are checked
// when available and the worse category wins, rather than one silently overriding
// or being ignored by the other.
function detectGlucoseCategory(hba1c, fbg) {
  const categories = [];
  if (hba1c && !isNaN(hba1c)) {
    if (hba1c >= 6.5) categories.push('High');
    else if (hba1c >= 5.7) categories.push('Borderline');
    else categories.push('Normal');
  }
  // ADA fasting plasma glucose thresholds: >=126 mg/dL diabetic range, 100-125 prediabetic.
  if (fbg && !isNaN(fbg)) {
    if (fbg >= 126) categories.push('High');
    else if (fbg >= 100) categories.push('Borderline');
    else categories.push('Normal');
  }
  if (categories.length === 0) return 'Normal';
  if (categories.includes('High')) return 'High';
  if (categories.includes('Borderline')) return 'Borderline';
  return 'Normal';
}

// WS3B08: these boundaries are verbatim NCEP ATP III (2001/2004) strata — accurate
// as descriptive lab reference ranges, but current lipid guidance (2018 ACC/AHA;
// 2019 ESC/EAS) has moved to risk-stratified LDL goals rather than these fixed
// bands; the LDL 130/160 "borderline/high" split in particular no longer maps to
// an actionable treatment category on its own. Kept as coarse categorical input
// to this engine's own risk model, not presented as a current clinical guideline.
function detectLipidsCategory(tc, ldl, tg) {
  if (!tc && !ldl && !tg) return 'Normal';
  const tcVal = parseFloat(tc) || 0;
  const ldlVal = parseFloat(ldl) || 0;
  const tgVal = parseFloat(tg) || 0;
  if (tcVal >= 240 || ldlVal >= 160 || tgVal >= 200) return 'High';
  if ((tcVal >= 200 && tcVal <= 239) || (ldlVal >= 130 && ldlVal <= 159) || (tgVal >= 150 && tgVal <= 199)) return 'Borderline';
  return 'Normal';
}

function extractPatientData(manual_data, extracted_data, gender, shared_lifestyle_data) {
  const age = parseFloat(manual_data.age) || 30;
  const sex = gender === 'male' ? 'M' : 'F';
  
  // 1. Detect categories from extracted report data if present
  let waist_raw = parseFloat(findExtractedParam(extracted_data, 'waist')?.value);
  let sbp_raw = parseFloat(findExtractedParam(extracted_data, 'systolic_blood_pressure')?.value);
  let dbp_raw = parseFloat(findExtractedParam(extracted_data, 'diastolic_blood_pressure')?.value);
  let hba1c_raw = parseFloat(findExtractedParam(extracted_data, 'hba1c')?.value);
  let fbg_raw = parseFloat(findExtractedParam(extracted_data, 'fasting_blood_glucose_fbg')?.value);
  let tc_raw = parseFloat(findExtractedParam(extracted_data, 'total_cholesterol')?.value);
  let ldl_raw = parseFloat(findExtractedParam(extracted_data, 'low_density_lipoprotein_cholesterol_ldl_c')?.value || findExtractedParam(extracted_data, 'ldl_cholesterol')?.value);
  let tg_raw = parseFloat(findExtractedParam(extracted_data, 'triglycerides')?.value);

  const detected_waist = detectWaistCategory(waist_raw, gender);
  const detected_bp = detectBPCategory(sbp_raw, dbp_raw);
  const detected_glucose = detectGlucoseCategory(hba1c_raw, fbg_raw);
  const detected_lipids = detectLipidsCategory(tc_raw, ldl_raw, tg_raw);

  const rawValues = {
    hba1c: manual_data.hba1c ?? hba1c_raw,
    fbg: manual_data.fbg ?? fbg_raw,
    sbp: manual_data.sbp ?? sbp_raw,
    dbp: manual_data.dbp ?? dbp_raw,
    tc: manual_data.tc ?? tc_raw,
    ldl: manual_data.ldl ?? ldl_raw,
    tg: manual_data.tg ?? tg_raw,
    hdl: manual_data.hdl ?? parseFloat(findExtractedParam(extracted_data, 'high_density_lipoprotein_cholesterol_hdl_c')?.value || findExtractedParam(extracted_data, 'hdl_cholesterol')?.value),
    bmi: manual_data.bmi ?? parseFloat(findExtractedParam(extracted_data, 'bmi')?.value),
    homa: manual_data.homa ?? parseFloat(findExtractedParam(extracted_data, 'homa_ir')?.value),
    crp: manual_data.crp ?? parseFloat(findExtractedParam(extracted_data, 'hs_crp')?.value)
  };
  
  // 2. Resolve with manual overrides
  let waist = manual_data.waist;
  if (!waist || !['Normal', 'Borderline', 'High'].includes(waist)) waist = detected_waist;
  
  let bloodPressure = manual_data.bloodPressure;
  if (!bloodPressure || !['Normal', 'Elevated', 'High'].includes(bloodPressure)) bloodPressure = detected_bp;
  
  let glucose = manual_data.glucose;
  if (!glucose || !['Normal', 'Borderline', 'High'].includes(glucose)) glucose = detected_glucose;
  
  let lipids = manual_data.lipids;
  if (!lipids || !['Normal', 'Borderline', 'High'].includes(lipids)) lipids = detected_lipids;
  
  const history = {
    // WS1A04/WS3B01: preserve the real 'None'/'One'/'Both' string — a `!!` boolean
    // coercion here would collapse all three onto `true` (any non-empty string,
    // including 'None', is truthy), silently destroying the distinction
    // calculateIDRS's 3-tier scoring depends on.
    parentDiabetes: manual_data.parentDiabetes || 'None',
    parentHbp: !!manual_data.parentHbp,
    prematureHeartDisease: !!manual_data.prematureHeartDisease
  };

  const getLifestyleFactor = (factor, defaultValue) => {
    return manual_data.lifestyle?.[factor] || manual_data[factor] || shared_lifestyle_data?.[factor] || defaultValue;
  };
  
  const lifestyle = {
    diet: getLifestyleFactor('diet', 'Healthy'),
    // WS1A08: every other lifestyle field here defaults to its own best-case tier
    // (LR/point-neutral) when unspecified. 'Moderate' broke that policy — it's a
    // mid-tier value carrying a real +20 IDRS penalty, so simply omitting activity
    // silently docked points nothing else omitted does. Aligned to 'Athletic'
    // (this scale's zero-penalty tier) to match the same missing-data policy
    // already applied to diet/smoking/alcohol/sleep/stress below.
    activity: getLifestyleFactor('activity', 'Athletic'), // Activity owned by IDRS now
    smoking: getLifestyleFactor('smoking', 'Never'),
    alcohol: getLifestyleFactor('alcohol', 'Never'),
    sleep: getLifestyleFactor('sleep', 'Early bird'),
    stress: getLifestyleFactor('stress', 'Normal')
  };
  
  return {
    age, sex, waist, bloodPressure, glucose, lipids, history, lifestyle,
    rawValues,
    detected_categories: { waist: detected_waist, bloodPressure: detected_bp, glucose: detected_glucose, lipids: detected_lipids }
  };
}

// 6. Main Analyze Endpoint Route
async function analyzeChronic(req, res, next) {
  try {
    const { 
      male_report_id, 
      female_report_id, 
      male_manual_data = {}, 
      female_manual_data = {},
      shared_lifestyle_data = null,
      match_id
    } = req.body;

    if (!male_report_id || !female_report_id) {
      return res.status(400).json({ success: false, error: 'Both male_report_id and female_report_id are required' });
    }

    const maleReportRes = await db.query("SELECT extracted_json FROM reports WHERE id = $1", [male_report_id]);
    const femaleReportRes = await db.query("SELECT extracted_json FROM reports WHERE id = $1", [female_report_id]);
    const maleReport = maleReportRes.rows[0];
    const femaleReport = femaleReportRes.rows[0];

    if (!maleReport) return res.status(404).json({ success: false, error: 'Male report not found' });
    if (!femaleReport) return res.status(404).json({ success: false, error: 'Female report not found' });

    let parsedMaleData = JSON.parse(maleReport.extracted_json);
    let parsedFemaleData = JSON.parse(femaleReport.extracted_json);
    
    const partnerA = extractPatientData(male_manual_data, parsedMaleData, 'male', shared_lifestyle_data);
    const partnerB = extractPatientData(female_manual_data, parsedFemaleData, 'female', shared_lifestyle_data);

    // Core HSP v2.1 Logic: Calculate IDRS
    const idrsA = calculateIDRS(partnerA.age, partnerA.waist, partnerA.lifestyle.activity, partnerA.history, partnerA.sex);
    const idrsB = calculateIDRS(partnerB.age, partnerB.waist, partnerB.lifestyle.activity, partnerB.history, partnerB.sex);

    const idrsLrA = idrsToLR(idrsA);
    const idrsLrB = idrsToLR(idrsB);

    // Calculate Lifestyle Evidence (Disjoint from IDRS; own habits only — WS1A07)
    const lifestyleResultA = getEffectiveLifestyleLR(partnerA.lifestyle);
    const lifestyleResultB = getEffectiveLifestyleLR(partnerB.lifestyle);

    // Calculate Biomarker Evidence — shrunk via shrinkCorrelatedLRs (see comment
    // above) to correct for these three markers' real physiological correlation.
    const bioLrA = shrinkCorrelatedLRs([
      BIOMARKER_LRS.bloodPressure[partnerA.bloodPressure] || 1.0,
      BIOMARKER_LRS.glucose[partnerA.glucose] || 1.0,
      BIOMARKER_LRS.lipids[partnerA.lipids] || 1.0
    ], BIOMARKER_LR_SHRINKAGE_EXPONENT);
    const bioLrB = shrinkCorrelatedLRs([
      BIOMARKER_LRS.bloodPressure[partnerB.bloodPressure] || 1.0,
      BIOMARKER_LRS.glucose[partnerB.glucose] || 1.0,
      BIOMARKER_LRS.lipids[partnerB.lipids] || 1.0
    ], BIOMARKER_LR_SHRINKAGE_EXPONENT);

    // Calculate Final Current Odds and Probabilities
    const currentOddsA = ODDS_0 * idrsLrA * lifestyleResultA.totalLR * bioLrA;
    const currentOddsB = ODDS_0 * idrsLrB * lifestyleResultB.totalLR * bioLrB;
    
    const pA = currentOddsA / (1 + currentOddsA);
    const pB = currentOddsB / (1 + currentOddsB);

    // The Gate: routing for established disease. A partner whose HbA1c is already in
    // the diagnosed-diabetic range (glucose === 'High') doesn't just have an elevated
    // RISK of developing diabetes — they already have it. BIOMARKER_LRS.glucose.High
    // is deliberately left neutral (1.0, same as Normal) above specifically because
    // this gate applies a direct, real cap to that partner's own score below, instead
    // of the LR trying (and failing) to represent "already diagnosed" as a risk
    // multiplier. Previously this gate only swapped the status text to "Specialist
    // conversation" while leaving gA/gB/coupleIndex computed as if glucose were
    // perfectly normal — someone already diagnosed diabetic could still show a high
    // protective score.
    const DIABETIC_SCORE_CAP = 25;
    const partnerADiabetic = partnerA.glucose === 'High';
    const partnerBDiabetic = partnerB.glucose === 'High';
    const gateOpen = partnerADiabetic || partnerBDiabetic;

    // Protect Scores & Couple OWA Index
    const gA = partnerADiabetic ? Math.min(100 * (1 - pA), DIABETIC_SCORE_CAP) : 100 * (1 - pA);
    const gB = partnerBDiabetic ? Math.min(100 * (1 - pB), DIABETIC_SCORE_CAP) : 100 * (1 - pB);
    const w = 0.6; // Convergence weight
    const coupleIndex = w * Math.min(gA, gB) + (1 - w) * Math.max(gA, gB);

    // 10-Year Projections
    // WS1A09: previously compounded currentOdds by a fixed 1.05^y cosmetic drift that
    // never re-derived the IDRS band from the aged inputs — so this curve and the
    // IDRS-vs-age graph (idrsProjectionA/B) told two inconsistent stories: e.g.
    // someone crossing an IDRS age-band at 35 or 50 mid-window jumped on one graph
    // while this score curve's slope stayed the same smooth, person-agnostic
    // exponential regardless. Recomputing the real IDRS band (and its LR) at each
    // projected year — the same calculateIDRS/idrsToLR already used for the current
    // score — keeps both curves consistent and reflects an actual age-risk threshold
    // being crossed, not just a cosmetic compounding factor. At y=0 this reduces to
    // exactly idrsA/idrsLrA, so the curve's starting point is unchanged.
    const currentLifestyleCurve = [];
    const optimizedLifestyleCurve = [];
    const idrsProjectionA = [];
    const idrsProjectionB = [];
    const years = Array.from({ length: 11 }, (_, i) => i);

    for (let y = 0; y < 11; y++) {
      const idrsY_A = calculateIDRS(partnerA.age + y, partnerA.waist, partnerA.lifestyle.activity, partnerA.history, partnerA.sex);
      const idrsY_B = calculateIDRS(partnerB.age + y, partnerB.waist, partnerB.lifestyle.activity, partnerB.history, partnerB.sex);
      idrsProjectionA.push(idrsY_A);
      idrsProjectionB.push(idrsY_B);
      const idrsLrY_A = idrsToLR(idrsY_A);
      const idrsLrY_B = idrsToLR(idrsY_B);

      const oddsY_A = ODDS_0 * idrsLrY_A * lifestyleResultA.totalLR * bioLrA;
      const oddsY_B = ODDS_0 * idrsLrY_B * lifestyleResultB.totalLR * bioLrB;
      const pY_A = oddsY_A / (1 + oddsY_A);
      const pY_B = oddsY_B / (1 + oddsY_B);

      const gY_A = partnerADiabetic ? Math.min(100 * (1 - pY_A), DIABETIC_SCORE_CAP) : 100 * (1 - pY_A);
      const gY_B = partnerBDiabetic ? Math.min(100 * (1 - pY_B), DIABETIC_SCORE_CAP) : 100 * (1 - pY_B);
      const indexY_curr = w * Math.min(gY_A, gY_B) + (1 - w) * Math.max(gY_A, gY_B);
      currentLifestyleCurve.push(Math.round(indexY_curr));

      // Optimized means lifestyle totalLR is 1.0 — the diabetic cap still applies here
      // too: an already-diagnosed partner doesn't stop being diagnosed just because
      // this branch models an idealized lifestyle instead of their current one.
      const optOddsY_A = ODDS_0 * idrsLrY_A * bioLrA;
      const optOddsY_B = ODDS_0 * idrsLrY_B * bioLrB;
      const optPY_A = optOddsY_A / (1 + optOddsY_A);
      const optPY_B = optOddsY_B / (1 + optOddsY_B);

      const optGY_A = partnerADiabetic ? Math.min(100 * (1 - optPY_A), DIABETIC_SCORE_CAP) : 100 * (1 - optPY_A);
      const optGY_B = partnerBDiabetic ? Math.min(100 * (1 - optPY_B), DIABETIC_SCORE_CAP) : 100 * (1 - optPY_B);
      const indexY_opt = w * Math.min(optGY_A, optGY_B) + (1 - w) * Math.max(optGY_A, optGY_B);
      optimizedLifestyleCurve.push(Math.round(indexY_opt));
    }

    // Lifestyle dividend: Difference at year 10 between optimised and current
    const lifestyleDividend = optimizedLifestyleCurve[10] - currentLifestyleCurve[10];

    // Status Pill & Red Warning Banner
    let state = 'Aligned';
    if (gateOpen || currentLifestyleCurve[0] < 50) {
      state = 'Specialist conversation';
    } else if (currentLifestyleCurve[0] < 75) {
      state = 'Plan together';
    }

    // Children's Predisposition Tier
    // parentDiabetes is now the 'None'/'One'/'Both' string (WS1A04/WS3B01) — a bare
    // truthy check would treat 'None' itself as loaded (any non-empty string is
    // truthy in JS), so this explicitly excludes only the real "no history" case.
    const isLoadedA = partnerA.history.parentDiabetes !== 'None' || partnerA.glucose === 'High';
    const isLoadedB = partnerB.history.parentDiabetes !== 'None' || partnerB.glucose === 'High';
    const loadedCount = (isLoadedA ? 1 : 0) + (isLoadedB ? 1 : 0);
    
    let childrenPredisposition = 'Low';
    if (loadedCount === 1) childrenPredisposition = 'Moderate';
    else if (loadedCount === 2) childrenPredisposition = 'High';

    // Scale risk for the UI radar (UI expects percentage out of 60 for risk).
    // Derived from gA/gB (not pA/pB directly) so the diabetic gate's cap is never
    // silently dropped from this second display quantity — previously uiRisk came
    // straight from pA*100, which deliberately excludes glucose (see the gate
    // comment above), so a lean diagnosed diabetic could see a reassuring ~5% radar
    // risk right next to a correctly diabetic-capped protective score of <=25 (WS1A02:
    // "risk 5% / protective score 25" is not a state, it's a contradiction). For the
    // non-diabetic case this is mathematically identical to the old pA*100 formula
    // (gA = 100*(1-pA) there, so 100-gA = 100*pA) — only the diabetic case changes,
    // where it now correctly floors at the radar's own max instead of understating.
    const uiRiskA = Math.min(60, 100 - gA);
    const uiRiskB = Math.min(60, 100 - gB);

    const calculations = {
      w,
      baselineProb: BASELINE_RISK_PROB,
      partnerA: {
        idrs: idrsA, idrsLR: idrsLrA, bioLR: bioLrA, lifestyleLR: lifestyleResultA.totalLR,
        odds: currentOddsA, prob: pA, protectiveScore: gA
      },
      partnerB: {
        idrs: idrsB, idrsLR: idrsLrB, bioLR: bioLrB, lifestyleLR: lifestyleResultB.totalLR,
        odds: currentOddsB, prob: pB, protectiveScore: gB
      },
      coupleIndex
    };

    // LLM Dynamic Insights Generation
    let dynamic_insights = {};
    try {
      const llmMessages = [
        {
          role: "system",
          content: "You are an expert cardiometabolic clinician analyzing a premarital health screening. Provide a supportive, medically accurate evaluation in JSON format containing:\n1. 'conversation_needed_summary': A 2-3 sentence paragraph explaining the overall couple alignment state and if they need a clinician conversation (based on the provided state).\n2. 'partnerA_insight' and 'partnerB_insight': objects each containing 'what_it_means' (1 sentence), 'what_drove_it' (1 sentence), and 'what_to_do_next' (1-2 sentences) based on their specific risk markers."
        },
        {
          role: "user",
          content: `Please analyze this couple's chronic/metabolic profile:
Overall State: ${state} (Diabetic Range Detected: ${gateOpen})
Partner A (Age ${partnerA.age}, Sex ${partnerA.sex}): IDRS Score ${idrsA}/100, Waist: ${partnerA.waist}, Activity: ${partnerA.lifestyle.activity}, Glucose: ${partnerA.glucose}, Lipids: ${partnerA.lipids}, BP: ${partnerA.bloodPressure}
Partner B (Age ${partnerB.age}, Sex ${partnerB.sex}): IDRS Score ${idrsB}/100, Waist: ${partnerB.waist}, Activity: ${partnerB.lifestyle.activity}, Glucose: ${partnerB.glucose}, Lipids: ${partnerB.lipids}, BP: ${partnerB.bloodPressure}
Respond ONLY with JSON matching the schema: { "conversation_needed_summary": "...", "partnerA_insight": { "what_it_means": "...", "what_drove_it": "...", "what_to_do_next": "..." }, "partnerB_insight": { ... } }`
        }
      ];

      const fallbackObj = {
        conversation_needed_summary: state === "Aligned" ? "Your health baselines are aligned today. No immediate warning flags were detected in your clinical panels. The focus now is on protecting this strong foundation as your household routines merge." : "Your health profiles show variations that warrant attention. A clinician conversation is recommended to establish a shared routine.",
        partnerA_insight: {
          what_it_means: "Risk score reflects current baseline.",
          what_drove_it: "Influenced by age, lifestyle, and detected biomarkers.",
          what_to_do_next: "Maintain a healthy lifestyle and monitor any elevated markers."
        },
        partnerB_insight: {
          what_it_means: "Risk score reflects current baseline.",
          what_drove_it: "Influenced by age, lifestyle, and detected biomarkers.",
          what_to_do_next: "Maintain a healthy lifestyle and monitor any elevated markers."
        }
      };

      const cacheKey = match_id ? `chronic_insights_${match_id}` : null;
      dynamic_insights = await generateStructuredInsight(llmMessages, fallbackObj, { temperature: 0.3, max_tokens: 400, cacheKey });
      // Ensure all fields exist
      if (!dynamic_insights.conversation_needed_summary) dynamic_insights = fallbackObj;
    } catch (err) {
      console.error("[Chronic] LLM Generation failed:", err);
      dynamic_insights = {
        conversation_needed_summary: state === "Aligned" ? "Health baselines are aligned." : "Please consult a clinician regarding your elevated markers.",
        partnerA_insight: { what_it_means: "Baseline calculated.", what_drove_it: "Standard inputs.", what_to_do_next: "Review with a doctor." },
        partnerB_insight: { what_it_means: "Baseline calculated.", what_drove_it: "Standard inputs.", what_to_do_next: "Review with a doctor." }
      };
    }

    res.json({
      success: true,
      partnerARisk: parseFloat(uiRiskA.toFixed(1)),
      partnerBRisk: parseFloat(uiRiskB.toFixed(1)),
      childrenPredisposition,
      lifestyleDividend: parseFloat(lifestyleDividend.toFixed(1)),
      diabeticRangeDetected: gateOpen,
      state,
      projection: {
        years,
        currentLifestyle: currentLifestyleCurve,
        optimizedLifestyle: optimizedLifestyleCurve,
        idrsA: idrsProjectionA,
        idrsB: idrsProjectionB
      },
      partner_A: {
        ...partnerA,
        pathologyScore: gA,
        risk: uiRiskA
      },
      partner_B: {
        ...partnerB,
        pathologyScore: gB,
        risk: uiRiskB
      },
      dynamic_insights,
      calculations,
      details: {
        male_data: parsedMaleData,
        female_data: parsedFemaleData,
        male_manual_data: male_manual_data,
        female_manual_data: female_manual_data,
        shared_lifestyle_data: shared_lifestyle_data
      }
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  analyzeChronic,
  // Exported for direct unit testing (see __tests__/lifestyle-lr-mapping.test.js)
  // rather than only reachable through the full analyzeChronic req/res flow —
  // this is exactly the surface where the alcohol val<->key mismatch bug lived
  // undetected, since nothing exercised getEffectiveLifestyleLR directly.
  LIFESTYLE_LRS,
  getEffectiveLifestyleLR
};
