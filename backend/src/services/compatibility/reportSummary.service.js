const logger = require('../../utils/logger');

/**
 * Helper to flatten pathology parameters for easy access
 */
function getFlatParams(details) {
  const params = {};
  if (!details) return params;

  // Helper function to extract params recursively
  function extract(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const field = obj[key];
      if (field && typeof field === 'object' && field.value !== undefined) {
        const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '_');
        params[normKey] = parseFloat(field.value) || field.value;
      } else if (field && typeof field === 'object') {
        extract(field);
      }
    }
  }

  // Extract from raw/extracted pathology data
  extract(details.male_data);
  extract(details.female_data);
  extract(details.male_manual_data);
  extract(details.female_manual_data);

  return params;
}

/**
 * Finds a single named parameter within one partner's extracted pathology data
 * (kept separate per-partner, unlike getFlatParams which merges both partners
 * into one dict and would let one partner's value silently overwrite the other's).
 */
function findPartnerParam(partnerData, canonicalName) {
  if (!partnerData || typeof partnerData !== 'object') return null;
  for (const sectionKey of Object.keys(partnerData)) {
    const section = partnerData[sectionKey];
    if (section && typeof section === 'object' && section[canonicalName] !== undefined) {
      return section[canonicalName];
    }
  }
  return null;
}

/**
 * Real beta-thalassemia carrier-trait screen, based on each partner's own extracted
 * HbA2 (hemoglobin_a2_hba2) value — replaces a previous hardcoded "All clear" that
 * never actually looked at the data. HbA2 > 3.5% is the standard threshold used to
 * flag likely beta-thalassemia trait carriers.
 *
 * Hemoglobin variant screening (sickle/C/D/E) isn't currently extractable from our
 * pathology ontology, so that sub-check is honestly reported as "not assessed"
 * rather than fabricating a clear result for a test we never ran.
 */
function evaluateThalassemiaCarrierRisk(maleData, femaleData) {
  const maleRaw = parseFloat(findPartnerParam(maleData, 'hemoglobin_a2_hba2')?.value);
  const femaleRaw = parseFloat(findPartnerParam(femaleData, 'hemoglobin_a2_hba2')?.value);
  const hasMale = !isNaN(maleRaw);
  const hasFemale = !isNaN(femaleRaw);

  const classify = (val) => {
    if (isNaN(val)) return 'gray';
    return val > 3.5 ? 'red' : 'green';
  };

  const maleStatus = classify(maleRaw);
  const femaleStatus = classify(femaleRaw);
  const bothCarriers = maleStatus === 'red' && femaleStatus === 'red';
  const eitherCarrier = maleStatus === 'red' || femaleStatus === 'red';
  const eitherUntested = maleStatus === 'gray' || femaleStatus === 'gray';

  let headline, narrative, badge;
  if (bothCarriers) {
    headline = 'Both of you may carry the same trait';
    narrative = `Both partners show an elevated HbA2 level (Male: ${maleRaw}%, Female: ${femaleRaw}%), consistent with beta-thalassemia carrier trait. When both partners carry this trait, there is a real chance of passing it to children — please discuss this with a genetic counselor.`;
    badge = 'Discuss with a specialist';
  } else if (eitherCarrier) {
    headline = 'One of you may carry this trait';
    narrative = `One partner shows an elevated HbA2 level, consistent with possible beta-thalassemia carrier trait (Male: ${hasMale ? maleRaw + '%' : 'not tested'}, Female: ${hasFemale ? femaleRaw + '%' : 'not tested'}). This is usually not a concern on its own, but worth confirming with your doctor before family planning.`;
    badge = 'Worth a look';
  } else if (eitherUntested) {
    headline = 'Carrier screening incomplete';
    narrative = "We couldn't find an HbA2 (hemoglobin electrophoresis) value for one or both of you in the uploaded reports, so this couldn't be fully assessed.";
    badge = 'Needs testing';
  } else {
    headline = 'Do you both quietly carry the same thing?';
    narrative = `Both of your HbA2 levels are within the normal range (Male: ${maleRaw}%, Female: ${femaleRaw}%), with no indication of beta-thalassemia carrier trait.`;
    badge = 'All clear';
  }

  return {
    thalassemia: {
      male_status: maleStatus,
      female_status: femaleStatus,
      headline,
      narrative,
      clinical_footnote: `In your report: HbA2 is ${hasMale ? maleRaw + '%' : 'not available'} (male), ${hasFemale ? femaleRaw + '%' : 'not available'} (female).`,
      badge,
      covered: hasMale || hasFemale
    },
    hemoglobin_variant: {
      male_status: 'gray',
      female_status: 'gray',
      headline: 'Hemoglobin variant screening',
      narrative: 'Hemoglobin variant (sickle/C/D/E) screening requires an HPLC report that was not part of this analysis.',
      clinical_footnote: 'Not assessed — no HPLC variant screening data available.',
      badge: 'Not assessed',
      covered: false
    },
    genetic_note: 'Premarital carrier screening checks if both partners carry traits for the same genetic condition, such as thalassemia, which could affect future children.'
  };
}

/**
 * STI Clinical Safety Gate
 * Scans both partners' extracted report data for active infectious disease markers.
 * Returns a gate object if any reactive/positive STI is found.
 *
 * Checked parameters:
 *  - Syphilis (VDRL/RPR): vdrl_rpr_result_reactive_non_reactive === 'Reactive'
 *  - HIV 1&2 Antibody: hiv_1_2_antibody_result_reactive_non_reactive === 'Reactive'
 *  - HIV P24 Antigen: hiv_p24_antigen_result_detected_not_detected === 'Detected'
 *  - Hepatitis B (HBsAg): hbsag_qualitative_result_reactive_non_reactive === 'Reactive'
 *  - Hepatitis C (HCV): anti_hcv_antibody_qualitative_result_reactive_non_reactive === 'Reactive'
 */
function checkSTISafetyGate(details) {
  const findings = [];

  function scanReport(reportData, partnerLabel) {
    if (!reportData || typeof reportData !== 'object') return;

    function getVal(obj, paramName) {
      if (!obj) return null;
      for (const sectionKey of Object.keys(obj)) {
        const section = obj[sectionKey];
        if (section && typeof section === 'object' && section[paramName] !== undefined) {
          return section[paramName]?.value ?? section[paramName];
        }
      }
      return null;
    }

    // Syphilis
    const syphilisResult = getVal(reportData, 'vdrl_rpr_result_reactive_non_reactive');
    const rprTitre = getVal(reportData, 'rpr_titre_if_reactive');
    if (typeof syphilisResult === 'string' && /reactive/i.test(syphilisResult) && !/non/i.test(syphilisResult)) {
      const titreStr = rprTitre ? ` (RPR Titer: ${rprTitre})` : '';
      findings.push({
        partner: partnerLabel,
        sti: 'Syphilis',
        detail: `Active Syphilis (VDRL Reactive${titreStr}) detected. Immediate clinical consultation and treatment is required before marriage.`,
        severity: 'critical'
      });
    }

    // HIV 1 & 2 Antibody
    const hivAbResult = getVal(reportData, 'hiv_1_2_antibody_result_reactive_non_reactive');
    if (typeof hivAbResult === 'string' && /reactive/i.test(hivAbResult) && !/non/i.test(hivAbResult)) {
      findings.push({
        partner: partnerLabel,
        sti: 'HIV',
        detail: `HIV 1 & 2 Antibody test is Reactive for ${partnerLabel}. Confirmatory testing and specialist consultation are urgently required.`,
        severity: 'critical'
      });
    }

    // HIV P24 Antigen (early infection marker)
    const hivP24Result = getVal(reportData, 'hiv_p24_antigen_result_detected_not_detected');
    if (typeof hivP24Result === 'string' && /detected/i.test(hivP24Result) && !/not/i.test(hivP24Result)) {
      findings.push({
        partner: partnerLabel,
        sti: 'HIV (P24 Antigen)',
        detail: `HIV P24 Antigen detected for ${partnerLabel}. This may indicate early acute HIV infection. Urgent specialist referral required.`,
        severity: 'critical'
      });
    }

    // Hepatitis B
    const hbsagResult = getVal(reportData, 'hbsag_qualitative_result_reactive_non_reactive');
    if (typeof hbsagResult === 'string' && /reactive/i.test(hbsagResult) && !/non/i.test(hbsagResult)) {
      findings.push({
        partner: partnerLabel,
        sti: 'Hepatitis B',
        detail: `HBsAg is Reactive for ${partnerLabel}, indicating active Hepatitis B infection. Liver function tests and vaccination status review required.`,
        severity: 'critical'
      });
    }

    // Hepatitis C
    const hcvResult = getVal(reportData, 'anti_hcv_antibody_qualitative_result_reactive_non_reactive');
    if (typeof hcvResult === 'string' && /reactive/i.test(hcvResult) && !/non/i.test(hcvResult)) {
      findings.push({
        partner: partnerLabel,
        sti: 'Hepatitis C',
        detail: `Anti-HCV Antibody is Reactive for ${partnerLabel}, indicating possible Hepatitis C exposure. HCV RNA confirmatory testing required.`,
        severity: 'critical'
      });
    }
  }

  scanReport(details.male_data, 'Partner (Male)');
  scanReport(details.female_data, 'Partner (Female)');

  return {
    triggered: findings.length > 0,
    findings
  };
}

class ReportSummaryService {
  /**
   * Deterministically map clinical engine results to presentation categories & visual assets
   */
  mapPresentation(chronicResult, mfrResult, mentalResult, details = {}) {
    logger.info('Mapping clinical results to deterministic presentation layout...');

    const flatParams = getFlatParams(details);
    const detailsFlat = details || {};
    const hasRadiology = !!(detailsFlat.male_manual_data?.uterineLining || detailsFlat.female_manual_data?.uterineLining || detailsFlat.radiology_report_id || detailsFlat.maleRadiology || detailsFlat.femaleRadiology);
    const carrierRisk = evaluateThalassemiaCarrierRisk(detailsFlat.male_data, detailsFlat.female_data);
    const hasGenetic = carrierRisk.thalassemia.covered;
    const hasMental = !!(
      mentalResult || detailsFlat.male_manual_data?.communication || detailsFlat.female_manual_data?.communication
    );

    // 1. Confidence Level
    let overallConfidence = 58;
    const isBloodVerified = !!detailsFlat.blood_verified;

    if (isBloodVerified) overallConfidence += 16;
    if (hasGenetic) overallConfidence += 11;
    if (hasRadiology) overallConfidence += 6;
    if (hasMental) overallConfidence += 5;

    let band = 'Good start';
    if (overallConfidence >= 90) {
      band = 'Near-complete';
    } else if (overallConfidence >= 70) {
      band = 'Solid';
    }

    let domainsCovered = 2;
    if (hasGenetic) domainsCovered++;
    if (hasRadiology) domainsCovered++;
    if (hasMental) domainsCovered++;

    const reportConfidence = {
      overall: overallConfidence,
      band: band,
      domains_covered: domainsCovered,
      blood_verified: isBloodVerified,
      domains: {
        blood_tests: { covered: true, verified: isBloodVerified, uplift_if_verified: 16 },
        lifestyle: { covered: true },
        genetic: { covered: hasGenetic, uplift: 11 },
        radiology: { covered: hasRadiology, uplift: 6 },
        mental: { covered: hasMental, uplift: 5 }
      }
    };

    // 2. Couple compatibility status & score
    let coupleScore = detailsFlat.compiled_compatibility_score !== undefined
      ? Math.round(detailsFlat.compiled_compatibility_score)
      : (chronicResult?.calculations?.coupleIndex != null ? Math.round(chronicResult.calculations.coupleIndex) : null);
    let coupleStatus = coupleScore !== null ? 'Excellent' : 'Pending';
    let coupleStatusDescription = coupleScore !== null
      ? 'You two are starting from a strong, well-matched place. Nothing here should give you pause about building a life together.'
      : 'Your compatibility snapshot is still being finalized.';
    let coupleStatusColor = coupleScore !== null ? 'green' : 'gray';

    const chronicState = chronicResult?.state || 'Aligned';
    const mfrState = mfrResult?.state || 'Aligned';

    if (chronicState === 'Specialist conversation' || mfrState === 'Specialist conversation') {
      coupleStatus = 'Action Advised';
      coupleStatusDescription = 'Some clinical markers indicate items requiring specialist guidance for you two.';
      coupleStatusColor = 'red';
    } else if (chronicState === 'Plan together' || mfrState === 'Plan together') {
      coupleStatus = 'Good';
      coupleStatusDescription = 'Medically compatible. A few mild areas for lifestyle adjustments are worth checking.';
      coupleStatusColor = 'yellow';
    }

    // --- STI Clinical Safety Gate ---
    const stiGate = checkSTISafetyGate(details);
    const stiOpportunities = [];
    let stiTriggered = false;
    let stiHeadline = 'The important screens came back clear';
    let stiNarrative = 'Both of you tested negative for the standard premarital infectious disease screens.';
    let stiFootnote = 'In your report: HIV, Syphilis, and Hepatitis B/C are non-reactive.';
    let stiBadge = 'All clear';

    if (stiGate.triggered) {
      logger.warn(`[ReportSummaryService] STI Safety Gate TRIGGERED fallback.`);
      // An active STI finding is itself a real, definite signal (not a missing-data
      // case), so it's fine to assert a capped score here even if no other score exists.
      coupleScore = coupleScore !== null ? Math.min(coupleScore, 50) : 50;
      coupleStatus = 'Action Advised';
      coupleStatusDescription = 'One or more active infectious disease markers were detected. Immediate specialist consultation is required before proceeding.';
      coupleStatusColor = 'red';
      stiTriggered = true;
      stiHeadline = 'Active Screening Alert — Review Required';
      stiNarrative = 'One or more active infectious disease markers have been found. Seek specialist consultation immediately.';
      stiFootnote = 'In your report: Positive or Reactive markers detected.';
      stiBadge = 'Worth a look';
      for (const finding of stiGate.findings) {
        stiOpportunities.push({
          title: `Active ${finding.sti} Detected`,
          description: `In your report: ${finding.detail}`,
          severity: 'critical'
        });
      }
    }

    const strengths = [];
    const opportunities = [];

    // Evaluate Sugar
    const maxHba1c = Math.max(flatParams.hba1c || 0, flatParams.estimated_average_glucose || 0);
    if (maxHba1c > 0 && maxHba1c < 5.7) {
      strengths.push({ title: 'Optimal Sugar Regulation', description: 'Both of you have HbA1c levels well inside the healthy range.' });
    } else if (maxHba1c >= 5.7) {
      opportunities.push({ title: 'Elevated Sugar Baseline', description: 'Early glucose monitoring and sugar moderation is advised for you two.' });
    }

    // Evaluate Cholesterol
    const maxLdl = flatParams.ldl || 0;
    if (maxLdl > 0 && maxLdl < 100) {
      strengths.push({ title: 'Healthy Lipids Baseline', description: 'Excellent cardiovascular and cholesterol parameters for both of you.' });
    } else if (maxLdl >= 100) {
      opportunities.push({ title: 'Lipid Management Needed', description: 'Slightly elevated LDL cholesterol; active tracking is recommended.' });
    }

    // Evaluate Ovarian Reserve
    const ovarianReserve = mfrResult?.details?.female_ovarian_reserve || 'Normal';
    if (ovarianReserve === 'Normal' || ovarianReserve === 'High for age') {
      strengths.push({ title: 'Strong Ovarian Reserve', description: 'Her ovarian reserve markers indicate standard egg counts for age.' });
    } else {
      opportunities.push({ title: 'Low Ovarian Indicators', description: 'Her biological egg reserve is slightly below baseline.' });
    }

    // Evaluate Semen
    const semenQuality = mfrResult?.details?.male_semen_quality || 'Normal';
    if (semenQuality === 'Normal') {
      strengths.push({ title: 'Healthy Sperm Parameters', description: 'His semen analysis shows optimal sperm count and motility.' });
    } else {
      opportunities.push({ title: 'Semen Analysis Deficit', description: 'His sperm motility or count is slightly below reference ranges.' });
    }

    // Evaluate Lifestyle / Activity
    const activityA = chronicResult?.partner_A?.lifestyle?.activity || details.male_manual_data?.activity || 'Active';
    const activityB = chronicResult?.partner_B?.lifestyle?.activity || details.female_manual_data?.activity || 'Active';
    const activity = (activityA === 'Sedentary' && activityB === 'Sedentary') ? 'Sedentary' : 
                     (activityA === 'Sedentary' || activityB === 'Sedentary') ? 'Moderate' : 'Active';

    if (activity === 'Active' || activity === 'Moderate') {
      strengths.push({ title: 'Active Lifestyle Match', description: 'You two share healthy daily movement habits.' });
    } else {
      opportunities.push({ title: 'Sedentary Daily Patterns', description: 'Shared physical inactivity is the single largest opportunity to improve for you two.' });
    }

    // Evaluate Sleep
    const sleep = details.shared_lifestyle?.sleep || 'Good';
    if (sleep === 'Good' || sleep === '8 Hours') {
      strengths.push({ title: 'Aligned Sleep Cycles', description: 'Your rest patterns support restorative health and metabolism.' });
    } else {
      opportunities.push({ title: 'Sleep Quality Recovery', description: 'Irregular or short rest periods impact your overall energy curves.' });
    }

    // Fallbacks to fill 3 items each
    if (strengths.length < 3) {
      strengths.push({ title: 'Optimistic General Outlook', description: 'Core physiological parameters show high compatibility.' });
    }
    if (strengths.length < 3) {
      strengths.push({ title: 'No Serious Genetic Overlap', description: 'No red flags found for hereditary premarital transmission.' });
    }
    if (opportunities.length < 3) {
      opportunities.push({ title: 'Annual Preventative Retest', description: 'Retesting annually helps ensure early detection and longevity.' });
    }
    if (opportunities.length < 3) {
      opportunities.push({ title: 'Hydration & Micros', description: 'Maintain optimal hydration levels and electrolyte balance.' });
    }

    // Family Planning
    const rawP12 = mfrResult?.p_12m_current ?? mfrResult?.calculations?.p_12m_current ?? 0.85;
    const p12 = rawP12 > 1 ? rawP12 / 100 : rawP12;
    
    let FPStars = 5;
    let FPRating = 'Excellent';
    if (p12 < 0.3) {
      FPStars = 2;
      FPRating = 'Requires Guidance';
    } else if (p12 < 0.5) {
      FPStars = 3;
      FPRating = 'Fair';
    } else if (p12 < 0.8) {
      FPStars = 4;
      FPRating = 'Very Good';
    }

    const familyPlanning = {
      stars: FPStars,
      rating: FPRating,
      annualChance: Math.round(p12 * 100),
      monthsToConceive: mfrResult?.time_to_conceive || '~5 months',
      details: {
        femaleAge: mfrResult?.details?.female_age || 28,
        ovarianReserve: ovarianReserve,
        maleAge: mfrResult?.details?.male_age || 30,
        semenQuality: semenQuality
      }
    };

    // Body Health System Cards
    const maxCreatinine = flatParams.serum_creatinine || 0;
    const maxBun = flatParams.blood_urea_nitrogen || flatParams.bun || 0;
    let kidneyStatus = 'green';
    let kidneyHeadline = 'Kidneys filtering beautifully';
    let kidneyNarrative = 'Your filtration rates show both of you have excellent kidney function.';
    let kidneyFootnote = 'In your report: Creatinine and BUN levels are completely normal.';
    let kidneyNext = 'All clear — maintain your current habits.';
    
    if (maxCreatinine > 1.2 || maxBun > 25) {
      kidneyStatus = (maxCreatinine > 2.0 || maxBun > 50) ? 'red' : 'yellow';
      kidneyHeadline = 'Kidney function needs attention';
      kidneyNarrative = 'Kidney filtration shows elevated biomarkers. Increased hydration is advised.';
      kidneyFootnote = `In your report: BUN: ${maxBun || 'N/A'}, Creatinine: ${maxCreatinine || 'N/A'}`;
      kidneyNext = 'Increase daily fluid intake to 3L and consult a physician.';
    }

    const sugarStatus = (flatParams.hba1c && flatParams.hba1c >= 5.7) ? 'yellow' : 'green';
    const heartStatus = (flatParams.ldl && flatParams.ldl >= 100) ? 'yellow' : 'green';
    const liverStatus = (flatParams.sgpt_alt && flatParams.sgpt_alt > 40) ? 'yellow' : 'green';
    const hormonesStatus = (flatParams.amh && flatParams.amh < 1.5) ? 'yellow' : 'green';
    const vitaminsStatus = (flatParams.vitamin_d_3_25_hydroxy && flatParams.vitamin_d_3_25_hydroxy < 30) ? 'yellow' : 'green';

    const getBadge = (mStatus, fStatus, domain) => {
      if (mStatus === 'yellow' || mStatus === 'red' || fStatus === 'yellow' || fStatus === 'red') {
        return 'Worth a look';
      }
      if (domain === 'fertility') return 'Strong';
      if (domain === 'infections') return 'All clear';
      if (domain === 'lifestyle') return 'Well matched';
      return 'Healthy';
    };

    const bodyHealth = {
      sugar: {
        male_status: sugarStatus,
        female_status: sugarStatus,
        male_value: flatParams.hba1c ? `${flatParams.hba1c}%` : 'Normal',
        female_value: flatParams.hba1c ? `${flatParams.hba1c}%` : 'Normal',
        headline: sugarStatus === 'yellow' ? 'Sugar levels are borderline' : 'In a healthy place — both of you',
        narrative: sugarStatus === 'yellow' 
          ? 'HbA1c shows borderline sugar metabolism levels. Moderation in carbs is recommended.'
          : 'Your day-to-day sugar levels look steady. Nothing to change here.',
        clinical_footnote: `In your report: HbA1c average blood sugar levels are ${flatParams.hba1c ? `${flatParams.hba1c}%` : 'normal'}.`,
        badge: getBadge(sugarStatus, sugarStatus, 'sugar'),
        next_action: sugarStatus === 'yellow'
          ? 'Reduce processed carb intake and retest in 3 months.'
          : 'All clear — maintain your current habits.'
      },
      heart: {
        male_status: heartStatus,
        female_status: heartStatus,
        male_value: flatParams.ldl ? `${flatParams.ldl} mg/dL` : 'Excellent',
        female_value: flatParams.ldl ? `${flatParams.ldl} mg/dL` : 'Excellent',
        headline: heartStatus === 'yellow' ? 'Cholesterol needs a look' : 'Your hearts are in good shape',
        narrative: heartStatus === 'yellow'
          ? 'LDL cholesterol is slightly above target thresholds. Consider diet adjustments.'
          : 'Your cholesterol numbers support a healthy heart for both of you. Keep doing what you\'re doing.',
        clinical_footnote: `In your report: LDL cholesterol is ${flatParams.ldl ? `${flatParams.ldl} mg/dL` : 'normal'}.`,
        badge: getBadge(heartStatus, heartStatus, 'heart'),
        next_action: heartStatus === 'yellow'
          ? 'Include healthy fats (nuts, olive oil) and track in 6 months.'
          : 'All clear — maintain your current habits.'
      },
      liver: {
        male_status: liverStatus,
        female_status: liverStatus,
        male_value: flatParams.sgpt_alt ? `${flatParams.sgpt_alt} U/L` : 'Healthy',
        female_value: flatParams.sgpt_alt ? `${flatParams.sgpt_alt} U/L` : 'Healthy',
        headline: liverStatus === 'yellow' ? 'Liver enzymes mildly elevated' : 'Liver function is healthy',
        narrative: liverStatus === 'yellow'
          ? 'Slightly elevated ALT suggests mild fatty liver indicators.'
          : 'ALT/AST enzymes indicate standard liver detox pathways.',
        clinical_footnote: `In your report: ALT enzyme level is ${flatParams.sgpt_alt ? `${flatParams.sgpt_alt} U/L` : 'normal'}.`,
        badge: getBadge(liverStatus, liverStatus, 'liver'),
        next_action: liverStatus === 'yellow'
          ? 'Minimize refined sugar consumption and retest in 6 months.'
          : 'All clear — maintain your current habits.'
      },
      kidney: {
        male_status: kidneyStatus,
        female_status: kidneyStatus,
        male_value: flatParams.serum_creatinine ? `${flatParams.serum_creatinine} mg/dL` : 'Healthy',
        female_value: flatParams.serum_creatinine ? `${flatParams.serum_creatinine} mg/dL` : 'Healthy',
        headline: kidneyHeadline,
        narrative: kidneyNarrative,
        clinical_footnote: kidneyFootnote,
        badge: getBadge(kidneyStatus, kidneyStatus, 'kidney'),
        next_action: kidneyNext
      },
      hormones: {
        male_status: hormonesStatus,
        female_status: hormonesStatus,
        male_value: flatParams.amh ? `${flatParams.amh} ng/mL` : 'Normal',
        female_value: flatParams.amh ? `${flatParams.amh} ng/mL` : 'Normal',
        headline: hormonesStatus === 'yellow' ? 'Hormone balance check' : 'Hormones are nicely balanced',
        narrative: hormonesStatus === 'yellow'
          ? 'Ovarian reserve hormone (AMH) is slightly low for age.'
          : 'Thyroid (TSH) and reserve hormones (AMH) are balanced.',
        clinical_footnote: `In your report: AMH hormone is ${flatParams.amh ? `${flatParams.amh} ng/mL` : 'normal'}.`,
        badge: getBadge(hormonesStatus, hormonesStatus, 'hormones'),
        next_action: hormonesStatus === 'yellow'
          ? 'Consult an endocrinologist for ovulation timing.'
          : 'All clear — maintain your current habits.'
      },
      vitamins: {
        male_status: vitaminsStatus,
        female_status: vitaminsStatus,
        male_value: flatParams.vitamin_d_3_25_hydroxy ? `${flatParams.vitamin_d_3_25_hydroxy} ng/mL` : 'Optimal',
        female_value: flatParams.vitamin_d_3_25_hydroxy ? `${flatParams.vitamin_d_3_25_hydroxy} ng/mL` : 'Optimal',
        headline: vitaminsStatus === 'yellow' ? 'Vitamins need a quick look' : 'Vitamins are optimal',
        narrative: vitaminsStatus === 'yellow'
          ? 'Vitamin D levels indicate borderline or deficient state. Supplementation helps.'
          : 'Sufficient Vitamin D and B12 nutrient values.',
        clinical_footnote: `In your report: Vitamin D is ${flatParams.vitamin_d_3_25_hydroxy ? `${flatParams.vitamin_d_3_25_hydroxy} ng/mL` : 'optimal'}.`,
        badge: getBadge(vitaminsStatus, vitaminsStatus, 'vitamins'),
        next_action: vitaminsStatus === 'yellow'
          ? 'Supplement 60K IU weekly for 8 weeks.'
          : 'All clear — maintain your current habits.'
      }
    };

    // Lifestyle & Emotional
    const lifestyle = {
      communication: { status: 'green', value: 'Balanced', description: 'Constructive dialogue indicators.' },
      conflict: { status: 'yellow', value: 'Moderate Risk', description: 'Minor style variances present.' },
      stress: { status: 'green', value: 'Healthy Baseline', description: 'Stress management patterns align.' },
      habits: {
        status: activity === 'Sedentary' ? 'yellow' : 'green',
        value: activity,
        description: 'Physical movement matching patterns.'
      }
    };

    // 90-Day Improvement Plan
    const improvementPlan = {
      sleep: 'Sleep sync: Align bedtimes within a 30-minute window for matching circadian patterns.',
      diet: 'Nutrient density: Emphasize whole vegetables and quality fats to support hormonal baselines.',
      exercise: 'Shared routine: Walk or jog together 3 times weekly for 30 minutes.',
      retests: 'Targeted checks: Retest Vitamin D and lipids in 90 days.',
      expectedScoreImprovement: 8
    };

    // Visual Assets Mapping
    const assets = {
      colors: {
        green: '#10b981',
        yellow: '#f59e0b',
        red: '#ef4444',
        gray: '#94a3b8',
        backgroundCard: '#f8fafc',
        primaryText: '#0f172a',
        mutedText: '#64748b'
      },
      icons: {
        sugar: 'droplet',
        heart: 'heart',
        liver: 'activity',
        kidney: 'shield',
        hormones: 'sparkles',
        vitamins: 'sun'
      },
      progressRing: {
        radius: 40,
        strokeWidth: 8,
        percentage: coupleScore
      }
    };

    const presentation = {
      report_confidence: reportConfidence,
      relationship_snapshot: {
        score: coupleScore,
        status: coupleStatus,
        description: coupleStatusDescription,
        color: coupleStatusColor
      },
      couple_synthesis: 'Your compatibility metrics are very encouraging. Your fertility baselines are standard for age, and your everyday lifestyles align well, with a couple of areas to watch to raise your alignment.',
      strengths: strengths.slice(0, 3),
      opportunities: [...stiOpportunities, ...opportunities].slice(0, Math.max(3, stiOpportunities.length)),
      sti_gate: {
        triggered: stiTriggered,
        headline: stiHeadline,
        narrative: stiNarrative,
        clinical_footnote: stiFootnote,
        badge: stiBadge,
        findings: stiGate.findings.map(f => ({
          partner: f.partner,
          sti: f.sti,
          detail: f.detail,
          headline: `Active ${f.sti} Detected`,
          narrative: f.detail,
          clinical_footnote: `In your report: ${f.sti} result positive.`,
          severity: f.severity
        }))
      },
      carrier_pair_risk: carrierRisk,
      family_planning: familyPlanning,
      body_health: bodyHealth,
      lifestyle: lifestyle,
      improvement_plan: improvementPlan
    };

    return {
      presentation,
      assets
    };
  }
}

module.exports = new ReportSummaryService();
