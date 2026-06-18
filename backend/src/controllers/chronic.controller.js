const { db } = require('../services/storage/postgres.service');

// HSP v2.1 Priors & Constants
const BASELINE_RISK_PROB = 0.10;
const ODDS_0 = BASELINE_RISK_PROB / (1 - BASELINE_RISK_PROB);

const BIOMARKER_LRS = {
  bloodPressure: { High: 1.5, Elevated: 1.2, Normal: 1.0 },
  glucose: { Borderline: 1.5, Normal: 1.0, High: 1.0 }, // High triggers the Gate instead
  lipids: { High: 1.5, Borderline: 1.2, Normal: 1.0 }
};

const LIFESTYLE_LRS = {
  diet: { Poor: 1.3, Mixed: 1.15, Healthy: 1.0 },
  smoking: { Regular: 1.5, Occasional: 1.25, Never: 1.0 },
  alcohol: { Regular: 1.2, Occasional: 1.1, Never: 1.0 },
  sleep: { 'Night owl': 1.2, Irregular: 1.1, 'Early bird': 1.0 },
  stress: { High: 1.2, Moderate: 1.1, Normal: 1.0 }
};

const SHAREDNESS = {
  diet: 1.0,
  sleep: 1.0,
  smoking: 0.2,
  alcohol: 0.0,
  stress: 0.0
};

// Indian Diabetes Risk Score (IDRS)
function calculateIDRS(age, waistCat, activity, familyHistory, sex) {
  let score = 0;
  
  // Age
  if (age >= 50) score += 30;
  else if (age >= 35) score += 20;
  
  // Waist Category (already mapped to Normal, Borderline, High)
  if (waistCat === 'High') score += 20;
  else if (waistCat === 'Borderline') score += 10;
  
  // Activity
  if (activity === 'Sedentary') score += 30;
  else if (activity === 'Moderate') score += 20;
  
  // Family History
  // Assuming 'bothParentsDiabetes' isn't explicitly captured, we give 10 for one parent
  if (familyHistory.parentDiabetes) score += 10;
  
  return score;
}

function getEffectiveLifestyleLR(ownLifestyle, partnerLifestyle) {
  const multipliers = {};
  let totalLR = 1.0;
  
  for (const factor of Object.keys(SHAREDNESS)) {
    const ownVal = ownLifestyle[factor];
    const partnerVal = partnerLifestyle[factor];
    const ownLR = LIFESTYLE_LRS[factor][ownVal] || 1.0;
    const partnerLR = LIFESTYLE_LRS[factor][partnerVal] || 1.0;
    
    // Effective LR = ownLR * (partnerLR ^ s_f)
    const effectiveLR = ownLR * Math.pow(partnerLR, SHAREDNESS[factor]);
    multipliers[factor] = effectiveLR;
    totalLR *= effectiveLR;
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

function detectGlucoseCategory(hba1c) {
  if (!hba1c || isNaN(hba1c)) return 'Normal';
  if (hba1c >= 6.5) return 'High';
  if (hba1c >= 5.7) return 'Borderline';
  return 'Normal';
}

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
  let tc_raw = parseFloat(findExtractedParam(extracted_data, 'total_cholesterol')?.value);
  let ldl_raw = parseFloat(findExtractedParam(extracted_data, 'low_density_lipoprotein_cholesterol_ldl_c')?.value || findExtractedParam(extracted_data, 'ldl_cholesterol')?.value);
  let tg_raw = parseFloat(findExtractedParam(extracted_data, 'triglycerides')?.value);
  
  const detected_waist = detectWaistCategory(waist_raw, gender);
  const detected_bp = detectBPCategory(sbp_raw, dbp_raw);
  const detected_glucose = detectGlucoseCategory(hba1c_raw);
  const detected_lipids = detectLipidsCategory(tc_raw, ldl_raw, tg_raw);
  
  const rawValues = {
    hba1c: manual_data.hba1c ?? hba1c_raw,
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
    parentDiabetes: !!manual_data.parentDiabetes,
    parentHbp: !!manual_data.parentHbp,
    prematureHeartDisease: !!manual_data.prematureHeartDisease
  };

  const getLifestyleFactor = (factor, defaultValue) => {
    return manual_data.lifestyle?.[factor] || manual_data[factor] || shared_lifestyle_data?.[factor] || defaultValue;
  };
  
  const lifestyle = {
    diet: getLifestyleFactor('diet', 'Healthy'),
    activity: getLifestyleFactor('activity', 'Moderate'), // Activity owned by IDRS now
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
      shared_lifestyle_data = null
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
    
    const idrsLrA = idrsA >= 60 ? 1.82 : 0.46;
    const idrsLrB = idrsB >= 60 ? 1.82 : 0.46;

    // Calculate Lifestyle Evidence (Disjoint from IDRS, with sharedness)
    const lifestyleResultA = getEffectiveLifestyleLR(partnerA.lifestyle, partnerB.lifestyle);
    const lifestyleResultB = getEffectiveLifestyleLR(partnerB.lifestyle, partnerA.lifestyle);

    // Calculate Biomarker Evidence
    const bioLrA = (BIOMARKER_LRS.bloodPressure[partnerA.bloodPressure] || 1.0) *
                   (BIOMARKER_LRS.glucose[partnerA.glucose] || 1.0) *
                   (BIOMARKER_LRS.lipids[partnerA.lipids] || 1.0);
    const bioLrB = (BIOMARKER_LRS.bloodPressure[partnerB.bloodPressure] || 1.0) *
                   (BIOMARKER_LRS.glucose[partnerB.glucose] || 1.0) *
                   (BIOMARKER_LRS.lipids[partnerB.lipids] || 1.0);

    // Calculate Final Current Odds and Probabilities
    const currentOddsA = ODDS_0 * idrsLrA * lifestyleResultA.totalLR * bioLrA;
    const currentOddsB = ODDS_0 * idrsLrB * lifestyleResultB.totalLR * bioLrB;
    
    const pA = currentOddsA / (1 + currentOddsA);
    const pB = currentOddsB / (1 + currentOddsB);

    // The Gate: Routing for established disease
    const gateOpen = partnerA.glucose === 'High' || partnerB.glucose === 'High';

    // Protect Scores & Couple OWA Index
    const gA = 100 * (1 - pA);
    const gB = 100 * (1 - pB);
    const w = 0.6; // Convergence weight
    const coupleIndex = w * Math.min(gA, gB) + (1 - w) * Math.max(gA, gB);

    // 10-Year Projections (Continuous Ageing Drift)
    // We approximate continuous forward instrument M by compounding baseline odds roughly 1.05 per year
    const AGE_COMPOUND_FACTOR = 1.05;
    const currentLifestyleCurve = [];
    const optimizedLifestyleCurve = [];
    const years = Array.from({ length: 11 }, (_, i) => i);

    for (let y = 0; y < 11; y++) {
      const ageDrift = Math.pow(AGE_COMPOUND_FACTOR, y);
      
      const oddsY_A = currentOddsA * ageDrift;
      const oddsY_B = currentOddsB * ageDrift;
      const pY_A = oddsY_A / (1 + oddsY_A);
      const pY_B = oddsY_B / (1 + oddsY_B);
      
      const gY_A = 100 * (1 - pY_A);
      const gY_B = 100 * (1 - pY_B);
      const indexY_curr = w * Math.min(gY_A, gY_B) + (1 - w) * Math.max(gY_A, gY_B);
      currentLifestyleCurve.push(Math.round(indexY_curr));

      // Optimized means lifestyle totalLR is 1.0
      const optOddsY_A = (ODDS_0 * idrsLrA * bioLrA) * ageDrift;
      const optOddsY_B = (ODDS_0 * idrsLrB * bioLrB) * ageDrift;
      const optPY_A = optOddsY_A / (1 + optOddsY_A);
      const optPY_B = optOddsY_B / (1 + optOddsY_B);
      
      const optGY_A = 100 * (1 - optPY_A);
      const optGY_B = 100 * (1 - optPY_B);
      const indexY_opt = w * Math.min(optGY_A, optGY_B) + (1 - w) * Math.max(optGY_A, optGY_B);
      optimizedLifestyleCurve.push(Math.round(indexY_opt));
    }

    // IDRS Projections for graphing
    const idrsProjectionA = [];
    const idrsProjectionB = [];
    for (let y = 0; y < 11; y++) {
      idrsProjectionA.push(calculateIDRS(partnerA.age + y, partnerA.waist, partnerA.lifestyle.activity, partnerA.history, partnerA.sex));
      idrsProjectionB.push(calculateIDRS(partnerB.age + y, partnerB.waist, partnerB.lifestyle.activity, partnerB.history, partnerB.sex));
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
    const isLoadedA = partnerA.history.parentDiabetes || partnerA.glucose === 'High';
    const isLoadedB = partnerB.history.parentDiabetes || partnerB.glucose === 'High';
    const loadedCount = (isLoadedA ? 1 : 0) + (isLoadedB ? 1 : 0);
    
    let childrenPredisposition = 'Low';
    if (loadedCount === 1) childrenPredisposition = 'Moderate';
    else if (loadedCount === 2) childrenPredisposition = 'High';

    // Scale risk for the UI radar (UI expects percentage out of 60 for risk)
    const uiRiskA = Math.min(60, pA * 100);
    const uiRiskB = Math.min(60, pB * 100);

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
  analyzeChronic
};
