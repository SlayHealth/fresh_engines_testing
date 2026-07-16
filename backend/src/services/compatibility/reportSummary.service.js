const logger = require('../../utils/logger');
const { classifyOvarianReserve } = require('../../controllers/mfr.controller');

/**
 * Finds a single named parameter within one partner's extracted pathology data.
 * Deliberately kept per-partner (never merged into one shared dict) — a couple where,
 * say, only the male partner has elevated LDL must not have that value silently
 * overwritten or averaged away by the female partner's own separate reading.
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

/** Numeric convenience wrapper around findPartnerParam — null (not NaN/0) when absent,
 * so callers can tell "genuinely not tested" apart from "tested and came back zero". */
function getPartnerNumeric(partnerData, canonicalName) {
  const val = parseFloat(findPartnerParam(partnerData, canonicalName)?.value);
  return isNaN(val) ? null : val;
}

/**
 * HbA1c (%) is the standard sugar marker. If it's missing but estimated average
 * glucose (mg/dL) was reported instead, convert it back to an HbA1c-equivalent via the
 * standard ADA relationship (HbA1c% = (eAG + 46.7) / 28.7) rather than comparing the
 * two different units directly — mixing them (e.g. via Math.max on the raw numbers,
 * the previous approach) compares a value typically 4-14 against one typically
 * 70-300, so the mg/dL figure would always "win" and falsely trip the elevated-sugar
 * threshold whenever eAG was present at all, regardless of its actual value.
 */
function getPartnerHba1c(partnerData) {
  const direct = getPartnerNumeric(partnerData, 'hba1c');
  if (direct !== null) return direct;
  const eag = getPartnerNumeric(partnerData, 'estimated_average_glucose_eag');
  return eag !== null ? (eag + 46.7) / 28.7 : null;
}

// WS1D05/WS1D06/WS3A05: a single strict >3.5% cutoff over-called a 3.5-4.0%
// borderline value as a definite carrier and under-caveated a normal result — per
// common lab practice / ICSH, 3.5-3.9% is a recognized indeterminate zone (one
// screen of 23,485 people found ~17% landed here) needing repeat HPLC + RBC
// indices, not a definite-carrier call. Iron deficiency can also falsely LOWER
// HbA2, masking a true carrier, so a normal result is scoped to "by HbA2" rather
// than an unqualified "all clear".
const HBA2_BORDERLINE_LOW = 3.5;
const HBA2_DEFINITE_CARRIER = 4.0;

/**
 * Real beta-thalassemia carrier-trait screen, based on each partner's own extracted
 * HbA2 (hemoglobin_a2_hba2) value — replaces a previous hardcoded "All clear" that
 * never actually looked at the data.
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
    if (val > HBA2_DEFINITE_CARRIER) return 'red';
    if (val > HBA2_BORDERLINE_LOW) return 'yellow';
    return 'green';
  };
  const fmt = (val, has) => (has ? val + '%' : 'not tested');

  const maleStatus = classify(maleRaw);
  const femaleStatus = classify(femaleRaw);
  const bothCarriers = maleStatus === 'red' && femaleStatus === 'red';
  const eitherCarrier = maleStatus === 'red' || femaleStatus === 'red';
  const eitherBorderline = maleStatus === 'yellow' || femaleStatus === 'yellow';
  const eitherUntested = maleStatus === 'gray' || femaleStatus === 'gray';

  let headline, narrative, badge;
  if (bothCarriers) {
    headline = 'Both of you may carry the same trait';
    narrative = `Both partners show an elevated HbA2 level (Male: ${maleRaw}%, Female: ${femaleRaw}%), consistent with beta-thalassemia carrier trait. When both partners carry this trait, there is a real chance of passing it to children — please discuss this with a genetic counselor.`;
    badge = 'Discuss with a specialist';
  } else if (eitherCarrier) {
    headline = 'One of you may carry this trait';
    narrative = `One partner shows an elevated HbA2 level, consistent with possible beta-thalassemia carrier trait (Male: ${fmt(maleRaw, hasMale)}, Female: ${fmt(femaleRaw, hasFemale)}). This is usually not a concern on its own, but worth confirming with your doctor before family planning.`;
    badge = 'Worth a look';
  } else if (eitherBorderline) {
    headline = 'Borderline result — worth confirming';
    narrative = `An HbA2 in the 3.5-4.0% range (Male: ${fmt(maleRaw, hasMale)}, Female: ${fmt(femaleRaw, hasFemale)}) is a recognized borderline zone — not a definite carrier result, but not clearly normal either. A repeat HPLC test correlated with red-cell indices (MCV/MCH) and iron status is the standard next step before ruling beta-thalassemia trait in or out.`;
    badge = 'Confirm with repeat test';
  } else if (eitherUntested) {
    headline = 'Carrier screening incomplete';
    narrative = "We couldn't find an HbA2 (hemoglobin electrophoresis) value for one or both of you in the uploaded reports, so this couldn't be fully assessed.";
    badge = 'Needs testing';
  } else {
    headline = 'Do you both quietly carry the same thing?';
    narrative = `Both of your HbA2 levels are within the normal range for beta-thalassemia trait screening (Male: ${maleRaw}%, Female: ${femaleRaw}%). Note: this checks beta-thalassemia trait by HbA2 only — iron deficiency can lower HbA2 and mask a true carrier, and other hemoglobin variants aren't assessed by this test.`;
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
      // WS2-10 (2026-07): the ontology already defines hemoglobin_s_hbs/c/d/e
      // canonicals and could extract these values, but no clinical
      // interpretation thresholds have been sourced/signed off for variant
      // carrier classification (trait vs. disease vs. compound genotypes like
      // HbSC/HbS-beta-thal). This is a tracked gap to wire up, not a permanent
      // limitation of the underlying report data.
      narrative: 'Hemoglobin variant (sickle/C/D/E) screening is not yet interpreted in this report. The underlying HPLC values may be present in your uploaded report but are not currently read here — this is a known gap, not necessarily a missing test.',
      clinical_footnote: 'Not assessed — hemoglobin variant interpretation not yet available in this report.',
      badge: 'Not assessed',
      covered: false
    },
    genetic_note: 'Premarital carrier screening checks if both partners carry traits for the same genetic condition, such as thalassemia, which could affect future children.'
  };
}

// Whole-word vocabulary, not bare substring tests — a bare `/non/i` guard
// (the previous implementation) wrongly cleared "Reactive (non-specific
// pattern)" as negative, wrongly triggered on "Not Reactive"/"Undetected",
// and neither pattern recognized plain "Positive"/"Detected" phrasing at
// all (common in real Indian lab reports for HBsAg/HIV/syphilis), letting
// a genuinely reactive result through as if clear. Order matters: negative
// and equivocal vocabulary are checked before positive, since e.g.
// "Non-Reactive" and "Not Reactive" both also contain the substring
// "reactive".
const NEGATIVE_SEROLOGY_PATTERN = /\b(?:non[- ]?reactive|not[- ]?reactive|not[- ]?detected|undetected|negative|absent)\b/i;
const EQUIVOCAL_SEROLOGY_PATTERN = /\b(?:equivocal|indeterminate|borderline)\b/i;
const POSITIVE_SEROLOGY_PATTERN = /\b(?:reactive|positive|detected|present)\b/i;

function classifySerologyResult(rawValue) {
  if (typeof rawValue !== 'string') return 'unknown';
  const value = rawValue.trim();
  if (!value) return 'unknown';
  if (NEGATIVE_SEROLOGY_PATTERN.test(value)) return 'negative';
  if (EQUIVOCAL_SEROLOGY_PATTERN.test(value)) return 'equivocal';
  if (POSITIVE_SEROLOGY_PATTERN.test(value)) return 'positive';
  return 'unknown';
}

// WS0-05: the gate and the ontology are two independently-maintained string
// contracts, bound by nothing but convention — if the ontology's extractor ever
// renames, drops, or fuzzy-loses one of these five canonicals, getVal() below
// silently returns null and the gate never fires for that marker again, with no
// error anywhere. Exported (and the sole source `checks` builds from below) so a
// test can assert every one of these still exists as a real canonical_name in
// the ontology — see backend/__tests__/sti-gate-ontology-binding.test.js.
const STI_GATE_CANONICAL_PARAMS = {
  syphilis: 'vdrl_rpr_result_reactive_non_reactive',
  hivAntibody: 'hiv_1_2_antibody_result_reactive_non_reactive',
  hivP24: 'hiv_p24_antigen_result_detected_not_detected',
  hepatitisB: 'hbsag_qualitative_result_reactive_non_reactive',
  hepatitisC: 'anti_hcv_antibody_qualitative_result_reactive_non_reactive'
};

/**
 * STI Clinical Safety Gate
 * Scans both partners' extracted report data for reactive infectious-disease
 * screening markers (screening results — not, on their own, confirmed diagnoses;
 * see classifySerologyResult and the per-marker detail strings below for the
 * confirmatory-testing framing this gate uses).
 * Returns a gate object if any reactive/positive STI screen is found.
 *
 * Checked parameters:
 *  - Syphilis (VDRL/RPR): vdrl_rpr_result_reactive_non_reactive
 *  - HIV 1&2 Antibody: hiv_1_2_antibody_result_reactive_non_reactive
 *  - HIV P24 Antigen: hiv_p24_antigen_result_detected_not_detected
 *  - Hepatitis B (HBsAg): hbsag_qualitative_result_reactive_non_reactive
 *  - Hepatitis C (HCV): anti_hcv_antibody_qualitative_result_reactive_non_reactive
 *
 * A result only trips the gate when classifySerologyResult() reads it as
 * 'positive' — 'equivocal'/'unknown' results are deliberately NOT gated
 * here (they don't clear the couple either; a confirmatory-testing flow
 * for those is tracked separately, not built into this gate).
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

    // WS3A06/REG-04: a single reactive screening assay is not a diagnosis — VDRL/RPR
    // (non-treponemal), HIV antibody/P24, HBsAg, and anti-HCV all have real
    // false-positive rates and each has an established confirmatory pathway
    // (CDC/NACO/FDA guidance). These detail strings previously asserted "Active ...
    // detected"/"active infection" as settled fact from the screen alone; reframed
    // to name the result as reactive-and-unconfirmed while keeping the same
    // specialist-referral urgency.
    const checks = [
      {
        sti: 'Syphilis',
        param: STI_GATE_CANONICAL_PARAMS.syphilis,
        detail: () => {
          const rprTitre = getVal(reportData, 'rpr_titre_if_reactive');
          const titreStr = rprTitre ? ` (RPR Titer: ${rprTitre})` : '';
          return `VDRL/RPR is Reactive${titreStr} for ${partnerLabel} — a screening result, not a confirmed diagnosis. Confirmatory treponemal testing (TPHA/TPPA/FTA-ABS) and clinical consultation are required before this can be treated as an active infection.`;
        }
      },
      {
        sti: 'HIV',
        param: STI_GATE_CANONICAL_PARAMS.hivAntibody,
        detail: () => `HIV 1 & 2 Antibody test is Reactive for ${partnerLabel} — a screening result. Per NACO guidelines, a diagnosis requires the full 3-test confirmatory algorithm; urgent specialist consultation is required.`
      },
      {
        sti: 'HIV (P24 Antigen)',
        param: STI_GATE_CANONICAL_PARAMS.hivP24,
        detail: () => `HIV P24 Antigen is Reactive for ${partnerLabel} — a screening result that may indicate early infection but requires confirmatory testing before it can be treated as such. Urgent specialist referral is required.`
      },
      {
        sti: 'Hepatitis B',
        param: STI_GATE_CANONICAL_PARAMS.hepatitisB,
        detail: () => `HBsAg is Reactive for ${partnerLabel} — a screening result. Confirmatory neutralization testing is required before active Hepatitis B infection can be confirmed; liver function tests and specialist consultation are also advised.`
      },
      {
        sti: 'Hepatitis C',
        param: STI_GATE_CANONICAL_PARAMS.hepatitisC,
        detail: () => `Anti-HCV Antibody is Reactive for ${partnerLabel} — a screening result indicating possible past or current Hepatitis C exposure. HCV RNA confirmatory testing is required to determine if the infection is active.`
      }
    ];

    for (const check of checks) {
      if (classifySerologyResult(getVal(reportData, check.param)) === 'positive') {
        findings.push({
          partner: partnerLabel,
          sti: check.sti,
          detail: check.detail(),
          severity: 'critical'
        });
      }
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

    const detailsFlat = details || {};
    const hasRadiology = !!(detailsFlat.male_manual_data?.uterineLining || detailsFlat.female_manual_data?.uterineLining || detailsFlat.radiology_report_id || detailsFlat.maleRadiology || detailsFlat.femaleRadiology);
    const carrierRisk = evaluateThalassemiaCarrierRisk(detailsFlat.male_data, detailsFlat.female_data);
    const hasGenetic = carrierRisk.thalassemia.covered;
    const hasMental = !!(
      mentalResult || detailsFlat.male_manual_data?.communication || detailsFlat.female_manual_data?.communication
    );

    // Per-partner lab values for the body-health cards below (real canonical names,
    // read independently per partner — see getPartnerNumeric's doc comment for why).
    const maleData = detailsFlat.male_data;
    const femaleData = detailsFlat.female_data;
    const maleHba1c = getPartnerHba1c(maleData);
    const femaleHba1c = getPartnerHba1c(femaleData);
    const maleLdl = getPartnerNumeric(maleData, 'low_density_lipoprotein_cholesterol_ldl_c');
    const femaleLdl = getPartnerNumeric(femaleData, 'low_density_lipoprotein_cholesterol_ldl_c');
    const maleAlt = getPartnerNumeric(maleData, 'alanine_aminotransferase_sgpt_alt');
    const femaleAlt = getPartnerNumeric(femaleData, 'alanine_aminotransferase_sgpt_alt');
    const maleCreatinine = getPartnerNumeric(maleData, 'serum_creatinine');
    const femaleCreatinine = getPartnerNumeric(femaleData, 'serum_creatinine');
    const maleBun = getPartnerNumeric(maleData, 'blood_urea_nitrogen_bun');
    const femaleBun = getPartnerNumeric(femaleData, 'blood_urea_nitrogen_bun');
    const maleTsh = getPartnerNumeric(maleData, 'thyroid_stimulating_hormone_tsh_utsh');
    const femaleTsh = getPartnerNumeric(femaleData, 'thyroid_stimulating_hormone_tsh_utsh');
    const femaleAmh = getPartnerNumeric(femaleData, 'amh');
    const femaleAge = mfrResult?.details?.female_age;
    // Reuse the real, age-banded ovarian-reserve model from the fertility engine
    // instead of a second, age-blind AMH cutoff that could disagree with it for the
    // exact same value — only call it when a real age is available, since the
    // function's own age-band branching silently falls through to its oldest (40+)
    // band for an undefined age.
    const femaleReserveClass = (femaleAmh !== null && typeof femaleAge === 'number')
      ? classifyOvarianReserve(femaleAmh, undefined, femaleAge)
      : null;
    const maleVitD = getPartnerNumeric(maleData, 'vitamin_d_3_25_hydroxy');
    const femaleVitD = getPartnerNumeric(femaleData, 'vitamin_d_3_25_hydroxy');

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
    // WS3A07: an unqualified "all clear" doesn't account for window periods — a
    // non-reactive result taken shortly after a potential exposure doesn't rule
    // out infection (e.g. HIV Ab-only up to ~3 months, HCV ~8-11 weeks, HBsAg ~4
    // weeks, syphilis ~3-6 weeks per standard CDC/NACO testing guidance).
    let stiNarrative = 'Both of you tested negative for the standard premarital infectious disease screens. Note: a negative result only reliably rules out infection when testing is done after the relevant window period has passed since any potential exposure — if in doubt, ask your doctor whether retesting is advisable.';
    let stiFootnote = 'In your report: HIV, Syphilis, and Hepatitis B/C are non-reactive.';
    let stiBadge = 'All clear';

    if (stiGate.triggered) {
      logger.warn(`[ReportSummaryService] STI Safety Gate TRIGGERED fallback.`);
      // A reactive screening finding is itself a real, definite signal (not a
      // missing-data case), so it's fine to assert a capped score here even if no
      // other score exists — the score cap doesn't claim a diagnosis, only that a
      // reactive screen changes the couple's status until confirmed either way.
      coupleScore = coupleScore !== null ? Math.min(coupleScore, 50) : 50;
      coupleStatus = 'Action Advised';
      coupleStatusDescription = 'One or more infectious-disease screening markers came back reactive. These are screening results, not confirmed diagnoses — confirmatory testing and immediate specialist consultation are required before proceeding.';
      coupleStatusColor = 'red';
      stiTriggered = true;
      stiHeadline = 'Reactive Screening Result — Confirmation Needed';
      stiNarrative = 'One or more infectious-disease screening markers came back reactive. These require confirmatory testing — please seek specialist consultation to confirm or rule out infection.';
      stiFootnote = 'In your report: one or more screening markers came back Positive or Reactive.';
      stiBadge = 'Worth a look';
      for (const finding of stiGate.findings) {
        stiOpportunities.push({
          title: `${finding.sti} Screening Reactive`,
          description: `In your report: ${finding.detail}`,
          severity: 'critical'
        });
      }
    }

    // UX3-02/UX9-01: coupleStatus above only escalates off chronicState/mfrState
    // (2 of the 5 composite domains) plus the STI gate — radiology severity and
    // a confirmed both-carrier genetic finding were never consulted here, even
    // though both already correctly lower coupleScore itself via the critical-
    // domain floor / status-downgrade in reportGeneration.service.js. That gap
    // let a couple whose real score was capped for a severe organ finding or a
    // confirmed carrier pair still be told "Excellent — nothing here should
    // give you pause." Falling back to the final, already-gated score itself
    // closes this for every present or future severity source, rather than
    // requiring each one to be separately wired into this status label too.
    if (coupleStatus === 'Excellent' && coupleScore !== null && coupleScore < 60) {
      coupleStatus = 'Action Advised';
      coupleStatusDescription = 'One or more clinical domains in your combined report need a closer look — see the details below before drawing conclusions.';
      coupleStatusColor = 'red';
    } else if (coupleStatus === 'Excellent' && coupleScore !== null && coupleScore < 80) {
      coupleStatus = 'Good';
      coupleStatusDescription = 'Medically compatible overall. A few areas are worth checking with your doctor — see the details below.';
      coupleStatusColor = 'yellow';
    }

    const strengths = [];
    const opportunities = [];

    // Evaluate Sugar (HbA1c, real per-partner values — see getPartnerHba1c for why
    // eAG is converted rather than compared against HbA1c directly)
    const hba1cValues = [maleHba1c, femaleHba1c].filter((v) => v !== null);
    if (hba1cValues.length > 0) {
      const maxHba1c = Math.max(...hba1cValues);
      if (maxHba1c < 5.7) {
        strengths.push({ title: 'Optimal Sugar Regulation', description: 'Both of you have HbA1c levels well inside the healthy range.' });
      } else {
        opportunities.push({ title: 'Elevated Sugar Baseline', description: 'Early glucose monitoring and sugar moderation is advised for you two.' });
      }
    }

    // Evaluate Cholesterol (LDL, aligned to the same ATP-III bands chronic.controller.js
    // already uses — Borderline 130-159, High >=160 — instead of an unrelated >=100
    // cutoff that would disagree with the chronic engine's own read of the same value)
    const ldlValues = [maleLdl, femaleLdl].filter((v) => v !== null);
    if (ldlValues.length > 0) {
      const maxLdl = Math.max(...ldlValues);
      if (maxLdl < 130) {
        strengths.push({ title: 'Healthy Lipids Baseline', description: 'Excellent cardiovascular and cholesterol parameters for both of you.' });
      } else {
        opportunities.push({ title: 'Lipid Management Needed', description: 'Slightly elevated LDL cholesterol; active tracking is recommended.' });
      }
    }

    // Evaluate Ovarian Reserve — mfrResult.details.female_ovarian_reserve is NOT itself
    // a reliable signal that real data exists: mfr.controller.js needs *some* baseline
    // for its own conception-probability math, so that field defaults internally to
    // 'Normal' the moment mfrResult exists at all, even when no AMH/AFC was ever found
    // and no manual value was ever entered. detected_reserve_from_pathology is the
    // honest "did we actually find this in a report" signal; a manual override is also
    // genuine real data. Only trust 'Normal' as an actual strength when one of those
    // two real sources backs it — otherwise this silently claimed "Strong Ovarian
    // Reserve" for every couple regardless of whether fertility was assessed at all.
    const hasRealOvarianData = !!(mfrResult?.details?.detected_reserve_from_pathology) || !!(detailsFlat.female_manual_data?.ovarianReserve);
    const ovarianReserve = hasRealOvarianData ? (mfrResult?.details?.female_ovarian_reserve || null) : null;
    if (ovarianReserve === 'Normal' || ovarianReserve === 'High for age') {
      strengths.push({ title: 'Strong Ovarian Reserve', description: 'Her ovarian reserve markers indicate standard egg counts for age.' });
    } else if (ovarianReserve) {
      opportunities.push({ title: 'Low Ovarian Indicators', description: 'Her biological egg reserve is slightly below baseline.' });
    }

    // Evaluate Semen — same honesty principle as ovarian reserve above.
    const hasRealSemenData = !!(mfrResult?.details?.detected_semen_from_pathology) || !!(detailsFlat.male_manual_data?.semenQuality);
    const semenQuality = hasRealSemenData ? (mfrResult?.details?.male_semen_quality || null) : null;
    if (semenQuality === 'Normal') {
      strengths.push({ title: 'Healthy Sperm Parameters', description: 'His semen analysis shows optimal sperm count and motility.' });
    } else if (semenQuality) {
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

    // Family Planning — if the fertility engine hasn't actually produced a score
    // (mfrResult missing or incomplete), there is nothing real to report. Previously
    // this silently fell back to a fabricated 85% conception chance, a "~5 months"
    // timeline, and default ages 28/30 — all presented as if genuinely computed for
    // this specific couple.
    const rawP12 = mfrResult?.p_12m_current ?? mfrResult?.calculations?.p_12m_current;
    const hasFertilityScore = typeof rawP12 === 'number';
    const p12 = hasFertilityScore ? (rawP12 > 1 ? rawP12 / 100 : rawP12) : null;

    let FPStars = null;
    let FPRating = 'Not yet assessed';
    if (hasFertilityScore) {
      FPStars = 5;
      FPRating = 'Excellent';
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
    }

    const familyPlanning = {
      stars: FPStars,
      rating: FPRating,
      annualChance: hasFertilityScore ? Math.round(p12 * 100) : null,
      monthsToConceive: mfrResult?.time_to_conceive || null,
      details: {
        femaleAge: mfrResult?.details?.female_age ?? null,
        ovarianReserve: ovarianReserve || 'Not assessed',
        maleAge: mfrResult?.details?.male_age ?? null,
        semenQuality: semenQuality || 'Not assessed'
      }
    };

    // Body Health System Cards — each partner scored independently from their own real
    // lab values (not merged into one shared reading), and marked 'gray' rather than
    // silently defaulting to "healthy" when a value was never actually tested.
    const classifyLevel = (val, borderline, high) => {
      if (val === null) return 'gray';
      if (high !== undefined && val >= high) return 'red';
      if (val >= borderline) return 'yellow';
      return 'green';
    };
    const classifyKidney = (creatinine, bun) => {
      if (creatinine === null && bun === null) return 'gray';
      const cr = creatinine ?? 0;
      const bunVal = bun ?? 0;
      if (cr > 2.0 || bunVal > 50) return 'red';
      if (cr > 1.2 || bunVal > 25) return 'yellow';
      return 'green';
    };
    const classifyHormonesFor = (tsh, reserveClass) => {
      if (tsh === null && reserveClass === null) return 'gray';
      const tshAbnormal = tsh !== null && (tsh < 0.35 || tsh > 5.0);
      const reserveAbnormal = reserveClass === 'Low' || reserveClass === 'Very Low';
      return (tshAbnormal || reserveAbnormal) ? 'yellow' : 'green';
    };
    const classifyVitaminD = (val) => {
      if (val === null) return 'gray';
      return val < 30 ? 'yellow' : 'green';
    };

    const sugarStatusM = classifyLevel(maleHba1c, 5.7, 6.5);
    const sugarStatusF = classifyLevel(femaleHba1c, 5.7, 6.5);
    const heartStatusM = classifyLevel(maleLdl, 130, 160);
    const heartStatusF = classifyLevel(femaleLdl, 130, 160);
    const liverStatusM = classifyLevel(maleAlt, 40);
    const liverStatusF = classifyLevel(femaleAlt, 40);
    const kidneyStatusM = classifyKidney(maleCreatinine, maleBun);
    const kidneyStatusF = classifyKidney(femaleCreatinine, femaleBun);
    const hormonesStatusM = classifyHormonesFor(maleTsh, null);
    const hormonesStatusF = classifyHormonesFor(femaleTsh, femaleReserveClass);
    const vitaminsStatusM = classifyVitaminD(maleVitD);
    const vitaminsStatusF = classifyVitaminD(femaleVitD);

    const anyAbnormal = (m, f) => m === 'yellow' || m === 'red' || f === 'yellow' || f === 'red';
    const bothUntested = (m, f) => m === 'gray' && f === 'gray';

    const getBadge = (mStatus, fStatus, domain) => {
      if (bothUntested(mStatus, fStatus)) return 'Not assessed';
      if (anyAbnormal(mStatus, fStatus)) return 'Worth a look';
      if (domain === 'fertility') return 'Strong';
      if (domain === 'infections') return 'All clear';
      if (domain === 'lifestyle') return 'Well matched';
      return 'Healthy';
    };

    const fmtVal = (val, unit) => (val === null ? 'Not tested' : `${val}${unit}`);

    const bodyHealth = {
      sugar: {
        male_status: sugarStatusM,
        female_status: sugarStatusF,
        male_value: fmtVal(maleHba1c !== null ? Math.round(maleHba1c * 10) / 10 : null, '%'),
        female_value: fmtVal(femaleHba1c !== null ? Math.round(femaleHba1c * 10) / 10 : null, '%'),
        headline: anyAbnormal(sugarStatusM, sugarStatusF) ? 'Sugar levels are borderline' : bothUntested(sugarStatusM, sugarStatusF) ? 'Sugar levels not yet tested' : 'In a healthy place — both of you',
        narrative: anyAbnormal(sugarStatusM, sugarStatusF)
          ? 'HbA1c shows borderline sugar metabolism levels for at least one of you. Moderation in carbs is recommended.'
          : bothUntested(sugarStatusM, sugarStatusF)
            ? 'Neither report included an HbA1c or blood glucose value, so this could not be assessed.'
            : 'Your day-to-day sugar levels look steady. Nothing to change here.',
        clinical_footnote: `In your report: HbA1c is ${fmtVal(maleHba1c !== null ? Math.round(maleHba1c * 10) / 10 : null, '%')} (male), ${fmtVal(femaleHba1c !== null ? Math.round(femaleHba1c * 10) / 10 : null, '%')} (female).`,
        badge: getBadge(sugarStatusM, sugarStatusF, 'sugar'),
        next_action: anyAbnormal(sugarStatusM, sugarStatusF)
          ? 'Reduce processed carb intake and retest in 3 months.'
          : bothUntested(sugarStatusM, sugarStatusF) ? 'Get an HbA1c test done for both of you.' : 'All clear — maintain your current habits.'
      },
      heart: {
        male_status: heartStatusM,
        female_status: heartStatusF,
        male_value: fmtVal(maleLdl, ' mg/dL'),
        female_value: fmtVal(femaleLdl, ' mg/dL'),
        headline: anyAbnormal(heartStatusM, heartStatusF) ? 'Cholesterol needs a look' : bothUntested(heartStatusM, heartStatusF) ? 'Cholesterol not yet tested' : 'Your hearts are in good shape',
        narrative: anyAbnormal(heartStatusM, heartStatusF)
          ? 'LDL cholesterol is slightly above target thresholds for at least one of you. Consider diet adjustments.'
          : bothUntested(heartStatusM, heartStatusF)
            ? 'Neither report included an LDL cholesterol value, so this could not be assessed.'
            : 'Your cholesterol numbers support a healthy heart for both of you. Keep doing what you\'re doing.',
        clinical_footnote: `In your report: LDL cholesterol is ${fmtVal(maleLdl, ' mg/dL')} (male), ${fmtVal(femaleLdl, ' mg/dL')} (female).`,
        badge: getBadge(heartStatusM, heartStatusF, 'heart'),
        next_action: anyAbnormal(heartStatusM, heartStatusF)
          ? 'Include healthy fats (nuts, olive oil) and track in 6 months.'
          : bothUntested(heartStatusM, heartStatusF) ? 'Get a lipid profile done for both of you.' : 'All clear — maintain your current habits.'
      },
      liver: {
        male_status: liverStatusM,
        female_status: liverStatusF,
        male_value: fmtVal(maleAlt, ' U/L'),
        female_value: fmtVal(femaleAlt, ' U/L'),
        headline: anyAbnormal(liverStatusM, liverStatusF) ? 'Liver enzymes mildly elevated' : bothUntested(liverStatusM, liverStatusF) ? 'Liver enzymes not yet tested' : 'Liver function is healthy',
        narrative: anyAbnormal(liverStatusM, liverStatusF)
          ? 'Slightly elevated ALT suggests mild fatty liver indicators for at least one of you.'
          : bothUntested(liverStatusM, liverStatusF)
            ? 'Neither report included an ALT (SGPT) value, so this could not be assessed.'
            : 'ALT enzymes indicate standard liver detox pathways.',
        clinical_footnote: `In your report: ALT enzyme level is ${fmtVal(maleAlt, ' U/L')} (male), ${fmtVal(femaleAlt, ' U/L')} (female).`,
        badge: getBadge(liverStatusM, liverStatusF, 'liver'),
        next_action: anyAbnormal(liverStatusM, liverStatusF)
          ? 'Minimize refined sugar consumption and retest in 6 months.'
          : bothUntested(liverStatusM, liverStatusF) ? 'Get a liver function test done for both of you.' : 'All clear — maintain your current habits.'
      },
      kidney: {
        male_status: kidneyStatusM,
        female_status: kidneyStatusF,
        male_value: fmtVal(maleCreatinine, ' mg/dL'),
        female_value: fmtVal(femaleCreatinine, ' mg/dL'),
        headline: anyAbnormal(kidneyStatusM, kidneyStatusF) ? 'Kidney function needs attention' : bothUntested(kidneyStatusM, kidneyStatusF) ? 'Kidney function not yet tested' : 'Kidneys filtering beautifully',
        narrative: anyAbnormal(kidneyStatusM, kidneyStatusF)
          ? 'Kidney filtration shows elevated biomarkers for at least one of you. Increased hydration is advised.'
          : bothUntested(kidneyStatusM, kidneyStatusF)
            ? 'Neither report included creatinine or BUN values, so this could not be assessed.'
            : 'Your filtration rates show both of you have excellent kidney function.',
        clinical_footnote: `In your report: Creatinine is ${fmtVal(maleCreatinine, ' mg/dL')} (male), ${fmtVal(femaleCreatinine, ' mg/dL')} (female); BUN is ${fmtVal(maleBun, ' mg/dL')} (male), ${fmtVal(femaleBun, ' mg/dL')} (female).`,
        badge: getBadge(kidneyStatusM, kidneyStatusF, 'kidney'),
        next_action: anyAbnormal(kidneyStatusM, kidneyStatusF)
          ? 'Increase daily fluid intake to 3L and consult a physician.'
          : bothUntested(kidneyStatusM, kidneyStatusF) ? 'Get a kidney function test (creatinine/BUN) done for both of you.' : 'All clear — maintain your current habits.'
      },
      hormones: {
        male_status: hormonesStatusM,
        female_status: hormonesStatusF,
        male_value: fmtVal(maleTsh, ' mIU/L TSH'),
        female_value: femaleAmh !== null ? `${femaleAmh} ng/mL AMH` : fmtVal(femaleTsh, ' mIU/L TSH'),
        headline: anyAbnormal(hormonesStatusM, hormonesStatusF) ? 'Hormone balance check' : bothUntested(hormonesStatusM, hormonesStatusF) ? 'Hormones not yet tested' : 'Hormones are nicely balanced',
        narrative: anyAbnormal(hormonesStatusM, hormonesStatusF)
          ? (femaleReserveClass === 'Low' || femaleReserveClass === 'Very Low'
            ? `Her ovarian reserve hormone (AMH) reads ${femaleReserveClass.toLowerCase()} for her age.`
            : 'Thyroid (TSH) levels are outside the typical range for at least one of you.')
          : bothUntested(hormonesStatusM, hormonesStatusF)
            ? 'Neither report included a thyroid (TSH) or AMH value, so this could not be assessed.'
            : 'Thyroid (TSH) and, where tested, reserve hormones (AMH) are balanced.',
        clinical_footnote: `In your report: TSH is ${fmtVal(maleTsh, ' mIU/L')} (male), ${fmtVal(femaleTsh, ' mIU/L')} (female); AMH is ${fmtVal(femaleAmh, ' ng/mL')} (female).`,
        badge: getBadge(hormonesStatusM, hormonesStatusF, 'hormones'),
        next_action: anyAbnormal(hormonesStatusM, hormonesStatusF)
          ? 'Consult an endocrinologist for ovulation timing / thyroid follow-up.'
          : bothUntested(hormonesStatusM, hormonesStatusF) ? 'Get a thyroid panel (and AMH, for her) done.' : 'All clear — maintain your current habits.'
      },
      vitamins: {
        male_status: vitaminsStatusM,
        female_status: vitaminsStatusF,
        male_value: fmtVal(maleVitD, ' ng/mL'),
        female_value: fmtVal(femaleVitD, ' ng/mL'),
        headline: anyAbnormal(vitaminsStatusM, vitaminsStatusF) ? 'Vitamins need a quick look' : bothUntested(vitaminsStatusM, vitaminsStatusF) ? 'Vitamin D not yet tested' : 'Vitamins are optimal',
        narrative: anyAbnormal(vitaminsStatusM, vitaminsStatusF)
          ? 'Vitamin D levels indicate a borderline or deficient state for at least one of you. Supplementation helps.'
          : bothUntested(vitaminsStatusM, vitaminsStatusF)
            ? 'Neither report included a Vitamin D value, so this could not be assessed.'
            : 'Sufficient Vitamin D values for both of you.',
        clinical_footnote: `In your report: Vitamin D is ${fmtVal(maleVitD, ' ng/mL')} (male), ${fmtVal(femaleVitD, ' ng/mL')} (female).`,
        badge: getBadge(vitaminsStatusM, vitaminsStatusF, 'vitamins'),
        next_action: anyAbnormal(vitaminsStatusM, vitaminsStatusF)
          ? 'Supplement 60K IU weekly for 8 weeks.'
          : bothUntested(vitaminsStatusM, vitaminsStatusF) ? 'Get a Vitamin D test done for both of you.' : 'All clear — maintain your current habits.'
      }
    };

    // Lifestyle & Emotional — communication/conflict/stress now driven by the real
    // mental-compatibility pillar scores (marriageReadiness covers communication;
    // riskFactors covers anger regulation/substance habits, the closest real proxy
    // for conflict; emotionalHealth covers stress/coping) instead of three identical
    // hardcoded values ("Balanced"/"Moderate Risk"/"Healthy Baseline") shown to every
    // couple regardless of whether they even completed the Mental Wellbeing section.
    const pillarAvg = (pillar) => (pillar && typeof pillar.A === 'number' && typeof pillar.B === 'number') ? Math.round((pillar.A + pillar.B) / 2) : null;
    const pillarStatus = (score) => score === null ? 'gray' : (score >= 70 ? 'green' : score >= 45 ? 'yellow' : 'red');
    const pillarCard = (score, assessedDescription) => ({
      status: pillarStatus(score),
      value: score !== null ? `${score}/100` : 'Not assessed',
      description: score !== null ? assessedDescription : 'Complete the Mental Wellbeing questionnaire to unlock this.'
    });

    const communicationScore = pillarAvg(mentalResult?.pillar_scores?.marriageReadiness);
    const conflictScore = pillarAvg(mentalResult?.pillar_scores?.riskFactors);
    const stressScore = pillarAvg(mentalResult?.pillar_scores?.emotionalHealth);

    const lifestyle = {
      communication: pillarCard(communicationScore, 'Based on your marriage-readiness questionnaire answers.'),
      conflict: pillarCard(conflictScore, 'Based on your composure & substance-habits questionnaire answers.'),
      stress: pillarCard(stressScore, 'Based on your emotional-health questionnaire answers.'),
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

    // A single fixed, reassuring synthesis line previously showed for every couple
    // regardless of outcome — including alongside an active STI alert or an
    // "Action Advised" status, which could read as a jarring, contradictory
    // reassurance right next to a serious finding. Branch it on the same status the
    // rest of the report already uses instead.
    let coupleSynthesis;
    if (stiTriggered) {
      coupleSynthesis = 'A reactive infectious-disease screening marker was found — please read the alert above first. This is a screening result requiring confirmatory testing, not a confirmed diagnosis; the rest of this summary should be considered alongside that finding, not instead of it.';
    } else if (coupleStatus === 'Action Advised') {
      coupleSynthesis = 'A few clinical markers in this report are significant enough to warrant a specialist conversation before moving forward — see the flagged items below for specifics.';
    } else if (coupleStatus === 'Good') {
      coupleSynthesis = 'Your compatibility metrics are solid overall, with a few areas worth discussing together — see the opportunities below.';
    } else if (coupleStatus === 'Pending') {
      coupleSynthesis = 'Your compatibility snapshot is still being finalized — check back once more of your health profile is complete.';
    } else {
      coupleSynthesis = 'Your compatibility metrics are very encouraging. Your fertility baselines are standard for age, and your everyday lifestyles align well, with a couple of areas to watch to raise your alignment.';
    }

    const presentation = {
      report_confidence: reportConfidence,
      relationship_snapshot: {
        score: coupleScore,
        status: coupleStatus,
        description: coupleStatusDescription,
        color: coupleStatusColor
      },
      couple_synthesis: coupleSynthesis,
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
          headline: `${f.sti} Screening Reactive`,
          narrative: f.detail,
          clinical_footnote: `In your report: ${f.sti} screening result reactive/positive — confirmatory testing required.`,
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
// Exposed so reportGeneration.service.js (and anywhere else recomputing the overall
// composite score, e.g. mental.controller.js's post-hoc recompute) can apply the exact
// same genetics-scoring and STI-gate logic BEFORE calling mapPresentation, instead of
// only being able to apply it to the presentation layer after the fact.
module.exports.checkSTISafetyGate = checkSTISafetyGate;
module.exports.evaluateThalassemiaCarrierRisk = evaluateThalassemiaCarrierRisk;
module.exports.classifySerologyResult = classifySerologyResult;
// WS0-05: the single source of truth for the gate's five canonical param names —
// see backend/__tests__/sti-gate-ontology-binding.test.js, which asserts each of
// these still exists as a real canonical_name in the ontology.
module.exports.STI_GATE_CANONICAL_PARAMS = STI_GATE_CANONICAL_PARAMS;
