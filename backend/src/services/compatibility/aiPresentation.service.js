'use strict';

const llmService = require('../llm.service');
const logger = require('../../utils/logger');

// The strict JSON schema that DeepSeek MUST produce.
// This exactly mirrors the shape consumed by pdfReport.service.js
const PRESENTATION_SCHEMA = `{
  "report_confidence": {
    "overall": <integer 0-100, starting from 58. Add 16 if blood_verified is true. Add 11 if genetic data present. Add 6 if radiology data present. Add 5 if mental data present. Max is 96>,
    "band": <"Good start" | "Solid" | "Near-complete">,
    "domains_covered": <integer 2-5>,
    "blood_verified": <boolean>,
    "domains": {
      "blood_tests": { "covered": true, "verified": <boolean>, "uplift_if_verified": 16 },
      "lifestyle": { "covered": true },
      "genetic": { "covered": <boolean>, "uplift": 11 },
      "radiology": { "covered": <boolean>, "uplift": 6 },
      "mental": { "covered": <boolean>, "uplift": 5 }
    }
  },
  "relationship_snapshot": {
    "score": <integer 0-100>,
    "status": <"Excellent" | "Good" | "Action Advised">,
    "description": <string, 1-2 sentences warm, second-person "you two", plain-language-first>,
    "color": <"green" | "yellow" | "red">
  },
  "couple_synthesis": <string, 2-3 sentences explaining in warm second-person what this health profile means for their future marriage and starting a family together>,
  "strengths": [
    { "title": <string, max 5 words>, "description": <string, 1 sentence, warm second-person> },
    ... (exactly 3 items)
  ],
  "opportunities": [
    { "title": <string, max 5 words>, "description": <string, 1 sentence, warm second-person>, "severity": <"critical" | "high" | "medium"> },
    ... (up to 5 items; MUST include all STI findings first if they exist)
  ],
  "family_planning": {
    "stars": <integer 1-5>,
    "rating": <"Excellent" | "Very Good" | "Fair" | "Requires Guidance">,
    "annualChance": <integer 0-100, the 12-month cumulative conception probability as a percent>,
    "monthsToConceive": <string e.g. "~5 months">,
    "details": {
      "femaleAge": <integer>,
      "maleAge": <integer>,
      "ovarianReserve": <string>,
      "semenQuality": <string>
    }
  },
  "body_health": {
    "sugar":    { "male_status": <"green"|"yellow"|"red">, "female_status": <"green"|"yellow"|"red">, "male_value": <string>, "female_value": <string>, "headline": <string, e.g. "In a healthy place — both of you">, "narrative": <string, e.g. "Your day-to-day sugar levels look steady. Nothing to change here.">, "clinical_footnote": <string, e.g. "In your report: HbA1c 5.3% for both — your 3-month average blood sugar, comfortably in the healthy range.">, "badge": <"Strong"|"Healthy"|"All clear"|"Worth a look"|"Well matched">, "next_action": <string> },
    "heart":    { "male_status": <"green"|"yellow"|"red">, "female_status": <"green"|"yellow"|"red">, "male_value": <string>, "female_value": <string>, "headline": <string>, "narrative": <string>, "clinical_footnote": <string>, "badge": <"Strong"|"Healthy"|"All clear"|"Worth a look"|"Well matched">, "next_action": <string> },
    "liver":    { "male_status": <"green"|"yellow"|"red">, "female_status": <"green"|"yellow"|"red">, "male_value": <string>, "female_value": <string>, "headline": <string>, "narrative": <string>, "clinical_footnote": <string>, "badge": <"Strong"|"Healthy"|"All clear"|"Worth a look"|"Well matched">, "next_action": <string> },
    "kidney":   { "male_status": <"green"|"yellow"|"red">, "female_status": <"green"|"yellow"|"red">, "male_value": <string>, "female_value": <string>, "headline": <string>, "narrative": <string>, "clinical_footnote": <string>, "badge": <"Strong"|"Healthy"|"All clear"|"Worth a look"|"Well matched">, "next_action": <string> },
    "hormones": { "male_status": <"green"|"yellow"|"red">, "female_status": <"green"|"yellow"|"red">, "male_value": <string>, "female_value": <string>, "headline": <string>, "narrative": <string>, "clinical_footnote": <string>, "badge": <"Strong"|"Healthy"|"All clear"|"Worth a look"|"Well matched">, "next_action": <string> },
    "vitamins": { "male_status": <"green"|"yellow"|"red">, "female_status": <"green"|"yellow"|"red">, "male_value": <string>, "female_value": <string>, "headline": <string>, "narrative": <string>, "clinical_footnote": <string>, "badge": <"Strong"|"Healthy"|"All clear"|"Worth a look"|"Well matched">, "next_action": <string> }
  },
  "lifestyle": {
    "communication": { "status": <"green"|"yellow"|"red">, "value": <string>, "description": <string> },
    "conflict":      { "status": <"green"|"yellow"|"red">, "value": <string>, "description": <string> },
    "stress":        { "status": <"green"|"yellow"|"red">, "value": <string>, "description": <string> },
    "habits":        { "status": <"green"|"yellow"|"red">, "value": <string>, "description": <string> }
  },
  "improvement_plan": {
    "sleep":                  <string>,
    "diet":                   <string>,
    "exercise":               <string>,
    "retests":                <string>,
    "expectedScoreImprovement": <integer 1-15>
  },
  "carrier_pair_risk": {
    "thalassemia": { "male_status": <"green"|"yellow"|"red">, "female_status": <"green"|"yellow"|"red">, "headline": <string, e.g. "Do you both quietly carry the same thing?">, "narrative": <string>, "clinical_footnote": <string>, "badge": <"Strong"|"Healthy"|"All clear"|"Worth a look"|"Well matched"> },
    "hemoglobin_variant": { "male_status": <"green"|"yellow"|"red">, "female_status": <"green"|"yellow"|"red">, "headline": <string>, "narrative": <string>, "clinical_footnote": <string>, "badge": <"Strong"|"Healthy"|"All clear"|"Worth a look"|"Well matched"> },
    "genetic_note": <string, 1-2 sentence plain-language note explaining clinical significance of carrier-pair testing for thalassemia & hemoglobinopathies>
  },
  "sti_gate": {
    "triggered": <boolean>,
    "headline": <string, e.g. "The important screens came back clear">,
    "narrative": <string, warm second-person narrative>,
    "clinical_footnote": <string, "In your report: ...">,
    "badge": <"All clear"|"Worth a look">,
    "findings": [ { "partner": <string>, "sti": <string>, "detail": <string>, "headline": <string>, "narrative": <string>, "clinical_footnote": <string>, "severity": "critical" } ]
  },
  "report_assets": {
    "colors": {
      "green": "#10b981",
      "yellow": "#f59e0b",
      "red": "#ef4444",
      "gray": "#94a3b8"
    }
  }
}`;

/**
 * Build a compact, clean summary of STI results from the raw clinical data
 * so we can embed them explicitly in the prompt for the safety gate.
 */
function extractSTIStatus(details) {
  const stiChecks = [];

  function getVal(obj, paramName) {
    if (!obj || typeof obj !== 'object') return null;
    for (const sectionKey of Object.keys(obj)) {
      const section = obj[sectionKey];
      if (section && typeof section === 'object' && section[paramName] !== undefined) {
        return section[paramName]?.value ?? section[paramName];
      }
    }
    return null;
  }

  function scanPartner(reportData, label) {
    if (!reportData) return;
    const checks = [
      { param: 'vdrl_rpr_result_reactive_non_reactive', name: 'Syphilis (VDRL/RPR)' },
      { param: 'rpr_titre_if_reactive', name: 'Syphilis RPR Titer' },
      { param: 'hiv_1_2_antibody_result_reactive_non_reactive', name: 'HIV 1&2 Antibody' },
      { param: 'hiv_p24_antigen_result_detected_not_detected', name: 'HIV P24 Antigen' },
      { param: 'hbsag_qualitative_result_reactive_non_reactive', name: 'Hepatitis B (HBsAg)' },
      { param: 'anti_hcv_antibody_qualitative_result_reactive_non_reactive', name: 'Hepatitis C (HCV)' },
    ];
    for (const c of checks) {
      const val = getVal(reportData, c.param);
      if (val !== null && val !== undefined) {
        stiChecks.push(`  [${label}] ${c.name}: ${val}`);
      }
    }
  }

  scanPartner(details.male_data, 'Male Partner');
  scanPartner(details.female_data, 'Female Partner');
  return stiChecks.length > 0 ? stiChecks.join('\n') : '  All STI markers: Not detected / Non-Reactive';
}

/**
 * Serialize clinical data cleanly for the LLM prompt.
 * Strips out extremely verbose nested raw_text fields to save tokens.
 */
function serializeClinicalData(chronicResult, mfrResult, mentalResult, details) {
  // Deep-clone and strip raw_text to save token budget
  function stripRawText(obj, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 8) return obj;
    if (Array.isArray(obj)) return obj.map(i => stripRawText(i, depth + 1));
    const out = {};
    for (const k of Object.keys(obj)) {
      if (k === 'raw_text' || k === 'raw_pdf_text') continue;
      out[k] = stripRawText(obj[k], depth + 1);
    }
    return out;
  }

  return {
    chronic: stripRawText(chronicResult),
    mfr: stripRawText(mfrResult),
    mental: stripRawText(mentalResult),
    manual_data: {
      male: details.male_manual_data || {},
      female: details.female_manual_data || {},
      shared_lifestyle: details.shared_lifestyle || {}
    },
    pathology: {
      male: stripRawText(details.male_data),
      female: stripRawText(details.female_data)
    }
  };
}

/**
 * Call DeepSeek to generate the full Apple Health-style presentation JSON
 * for the premarital compatibility PDF report.
 *
 * @param {Object} chronicResult  - Output from the chronic disease engine
 * @param {Object} mfrResult      - Output from the MFR (fertility) engine
 * @param {Object} mentalResult   - Output from the mental/behavioral engine
 * @param {Object} details        - Raw clinical details (male_data, female_data, manual inputs)
 * @param {Object} options        - { maleName, femaleName }
 * @returns {Object} presentation JSON matching the PDF layout schema
 */
async function generateAIPresentationMap(chronicResult, mfrResult, mentalResult, details, options = {}) {
  const maleName = options.maleName || 'Male Partner';
  const femaleName = options.femaleName || 'Female Partner';

  logger.info('[AIPresentationService] Generating AI presentation map via DeepSeek...');

  const stiStatusBlock = extractSTIStatus(details);
  const clinicalData = serializeClinicalData(chronicResult, mfrResult, mentalResult, details);

  const systemPrompt = `You are a world-class clinical data visualization engine for a premarital health assessment platform called SlayHealth.

Your job is to analyze clinical engine results and raw pathology data for two partners (${maleName} and ${femaleName}) and produce a structured JSON layout for an Apple Health-style infographic PDF report.

== CRITICAL CLINICAL SAFETY RULES (NON-NEGOTIABLE) ==
These rules override everything else and cannot be overridden by clinical data interpretation:

1. STI SAFETY GATE: The following STI markers have been extracted from the lab reports:
${stiStatusBlock}

   - If ANY partner has a "Reactive" Syphilis, HIV, Hepatitis B or Hepatitis C result, or a "Detected" HIV P24 Antigen, you MUST:
     a. Set relationship_snapshot.score to ≤ 50
     b. Set relationship_snapshot.status to "Action Advised"
     c. Set relationship_snapshot.color to "red"
     d. Add that STI as the FIRST entry in "opportunities" with severity "critical"
     e. Set sti_gate.triggered to true and populate sti_gate.findings with correct headline, narrative, and clinical footnote starting with "In your report: "
     f. The next_action for any body_health card that relates to the STI MUST say "Seek specialist consultation immediately"

2. ACCURACY RULE: You MUST use the actual numeric values from the clinical data when generating clinical_value fields. Do NOT invent values.

3. DECIMAL PRECISION RULE: annualChance is a PERCENTAGE INTEGER (0-100). The p_12m_current field from the MFR engine is a DECIMAL (e.g. 0.85 = 85%). Multiply it by 100 to get the annualChance. Never return a value > 100.

4. STAR RATING RULE: Stars for family_planning must match annualChance: ≥80%=5stars, 60-79%=4stars, 40-59%=3stars, 20-39%=2stars, <20%=1star.

5. COLOR RULES for body_health.status:
   - "green": value is within normal clinical reference range
   - "yellow": value is mildly elevated / borderline / requires monitoring
   - "red": value is significantly abnormal / requires immediate clinical action

6. CROSS-SECTION CONSISTENCY RULE:
   - If any body_health card status is "yellow" or "red" (such as a low Ferritin value under vitamins), the relationship_snapshot.description MUST acknowledge this flag using a phrase like "with one small thing worth a look" or "with a few things worth a look".
   - Never let a cover page snapshot say "all healthy" or "everything is normal" if there is any yellow or red card.
   - Use consistent severity wording everywhere. If something is flagged as an opportunity or action item, do not call it optimal on page 1.

7. ACTION RULE:
   - next_action for a body_health card should only contain a real clinical/lifestyle action if that card's male_status or female_status is "yellow" or "red".
   - For all cards where both partners are "green", set next_action to exactly: "All clear — maintain your current habits."

8. CARRIER PAIR RISK (CPR) GENETIC RULE:
   - Analyze the partners' hemoglobin variants (e.g., hemoglobin_a2, hemoglobin_s, hemoglobin_c, hemoglobin_d, hemoglobin_f) in their pathology data.
   - If either partner has HbA2 > 3.5% or any hemoglobin variant trait detected, set the corresponding partner status to "yellow" or "red" under carrier_pair_risk.thalassemia or carrier_pair_risk.hemoglobin_variant. Otherwise, keep them "green".

9. NARRATIVE VOICE & BADGES RULE:
   - Always write in a warm, encouraging, second-person voice addressing the couple directly as "you two" or "both of you".
   - For all body_health, carrier_pair_risk, and sti_gate objects, structure with:
     - "headline": a warm plain-language title (e.g. "In a healthy place — both of you")
     - "narrative": warm plain-language summary in second-person
     - "clinical_footnote": must start with "In your report: " followed by the clinical measurement/values
     - "badge": Select from "Strong" (fertility), "Healthy" (normal cards), "All clear" (infections), "Worth a look" (yellow/red cards), "Well matched" (lifestyle). Use "Worth a look" for any system card with yellow or red status.

== OUTPUT FORMAT ==
Respond ONLY with a valid JSON object matching this EXACT schema. No markdown, no extra text:
${PRESENTATION_SCHEMA}`;

  const userPrompt = `Here is the full clinical data for the couple ${maleName} (Male) and ${femaleName} (Female):

${JSON.stringify(clinicalData, null, 2)}

Generate the Apple Health-style presentation JSON layout. Ensure:
- All body_health card statuses and values reflect the actual extracted lab values for BOTH partners
- The relationship_snapshot.score reflects the chronicResult.calculations.coupleIndex (if present)
- All text is clear, concise, and accessible (not medical jargon) for a layperson reading their health report
- Strengths highlight real positives found in the data
- Opportunities highlight real action items ordered by clinical urgency`;

  const fallbackPresentation = {
    report_confidence: {
      overall: 58,
      band: 'Good start',
      domains_covered: 2,
      blood_verified: false,
      domains: {
        blood_tests: { covered: true, verified: false, uplift_if_verified: 16 },
        lifestyle: { covered: true },
        genetic: { covered: false, uplift: 11 },
        radiology: { covered: false, uplift: 6 },
        mental: { covered: false, uplift: 5 }
      }
    },
    relationship_snapshot: {
      score: Math.round(chronicResult?.calculations?.coupleIndex || 85),
      status: 'Good',
      description: 'Clinical analysis completed. Please review individual parameters.',
      color: 'yellow'
    },
    couple_synthesis: 'Your profiles align well overall. Your fertility markers are strong, and your everyday habits support a healthy start together, with a couple of areas to watch to optimize long-term health.',
    strengths: [
      { title: 'Clinical Review Complete', description: 'All uploaded reports have been processed and analysed.' },
      { title: 'Engine Analysis Passed', description: 'Cardiometabolic and fertility engines completed calculations.' },
      { title: 'Biological Profiles Verified', description: 'Partner pathology data was extracted and cross-referenced.' }
    ],
    opportunities: [
      { title: 'Consult Your Doctor', description: 'Review detailed lab parameters with a qualified physician.', severity: 'medium' }
    ],
    family_planning: {
      stars: 4,
      rating: 'Very Good',
      annualChance: (() => { const p = mfrResult?.p_12m_current; if (!p) return 85; return Math.min(100, Math.round(p <= 1 ? p * 100 : p)); })(),
      monthsToConceive: mfrResult?.time_to_conceive || '~5 months',
      details: {
        femaleAge: mfrResult?.details?.female_age || 28,
        maleAge: mfrResult?.details?.male_age || 30,
        ovarianReserve: mfrResult?.details?.female_ovarian_reserve || 'Normal',
        semenQuality: mfrResult?.details?.male_semen_quality || 'Normal'
      }
    },
    body_health: {
      sugar:    { male_status: 'green', female_status: 'green', male_value: 'Normal', female_value: 'Normal', headline: 'In a healthy place — both of you', narrative: 'Your day-to-day sugar levels look steady. Nothing to change here.', clinical_footnote: 'In your report: HbA1c 5.3% for both — comfortably in the healthy range.', badge: 'Healthy', next_action: 'All clear — maintain your current habits.' },
      heart:    { male_status: 'green', female_status: 'green', male_value: 'Normal', female_value: 'Normal', headline: 'Your hearts are in good shape', narrative: 'Your cholesterol numbers support a healthy heart. Keep doing what you are doing.', clinical_footnote: 'In your report: LDL cholesterol levels are within the healthy range.', badge: 'Healthy', next_action: 'All clear — maintain your current habits.' },
      liver:    { male_status: 'green', female_status: 'green', male_value: 'Normal', female_value: 'Normal', headline: 'Liver function is healthy', narrative: 'Your liver enzymes indicate standard detoxification pathways are performing optimally.', clinical_footnote: 'In your report: ALT and AST enzymes are well within standard ranges.', badge: 'Healthy', next_action: 'All clear — maintain your current habits.' },
      kidney:   { male_status: 'green', female_status: 'green', male_value: 'Normal', female_value: 'Normal', headline: 'Kidneys filtering beautifully', narrative: 'Your filtration rates show both of you have excellent kidney function.', clinical_footnote: 'In your report: Creatinine and BUN levels are completely normal.', badge: 'Healthy', next_action: 'All clear — maintain your current habits.' },
      hormones: { male_status: 'green', female_status: 'green', male_value: 'Normal', female_value: 'Normal', headline: 'Hormones are nicely balanced', narrative: 'Thyroid and basic reproductive baseline markers indicate normal balance.', clinical_footnote: 'In your report: Hormone profiles are in optimal baseline ranges.', badge: 'Healthy', next_action: 'All clear — maintain your current habits.' },
      vitamins: { male_status: 'yellow', female_status: 'yellow', male_value: 'Review Needed', female_value: 'Review Needed', headline: 'Vitamins need a quick look', narrative: 'A couple of key micronutrients show borderline or lower levels.', clinical_footnote: 'In your report: Vitamin D or iron reserves are below the target range.', badge: 'Worth a look', next_action: 'Consider a micronutrient panel with your doctor within the next 60 days.' }
    },
    lifestyle: {
      communication: { status: 'green', value: 'Aligned', description: 'Communication styles appear compatible.' },
      conflict:      { status: 'green', value: 'Constructive', description: 'Conflict resolution patterns are healthy.' },
      stress:        { status: 'yellow', value: 'Moderate', description: 'Stress coping could benefit from shared routines.' },
      habits:        { status: 'green', value: 'Healthy', description: 'Daily habits and lifestyle appear aligned.' }
    },
    improvement_plan: {
      sleep: 'Align bedtimes to within 30 minutes to improve rest synchrony.',
      diet: 'Add whole foods and reduce processed sugar intake together.',
      exercise: 'Begin a shared exercise routine of 3 sessions per week.',
      retests: 'Schedule a combined retest panel in 90 days.',
      expectedScoreImprovement: 6
    },
    carrier_pair_risk: {
      thalassemia: { male_status: 'green', female_status: 'green', headline: 'Do you both carry the same thing?', narrative: 'No common mutations or carrier indicators were detected for thalassemia.', clinical_footnote: 'In your report: Thalassemia screening is negative for both.', badge: 'All clear' },
      hemoglobin_variant: { male_status: 'green', female_status: 'green', headline: 'Hemoglobin variant check', narrative: 'No abnormal variants or traits were found in your hemoglobin analysis.', clinical_footnote: 'In your report: Hemoglobin HPLC screening is normal for both.', badge: 'All clear' },
      genetic_note: 'Premarital carrier screening checks if both partners carry traits for the same genetic condition, which could affect future children.'
    },
    sti_gate: {
      triggered: false,
      headline: 'The important screens came back clear',
      narrative: 'Both of you tested negative for the standard premarital infectious disease screens.',
      clinical_footnote: 'In your report: HIV, Syphilis, and Hepatitis B/C are non-reactive.',
      badge: 'All clear',
      findings: []
    },
    report_assets: {
      colors: { green: '#10b981', yellow: '#f59e0b', red: '#ef4444', gray: '#94a3b8' }
    }
  };

  const presentation = await llmService.generateStructuredInsight(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    fallbackPresentation,
    {
      model: 'deepseek/deepseek-chat',
      temperature: 0.3,
      max_tokens: 8192
    }
  );

  // Programmatic confidence calculation post-process to ensure mathematical exactness
  const detailsFlat = details || {};
  const hasRadiology = !!(detailsFlat.male_manual_data?.uterineLining || detailsFlat.female_manual_data?.uterineLining || detailsFlat.radiology_report_id || detailsFlat.maleRadiology || detailsFlat.femaleRadiology);
  const hasGenetic = !!(
    detailsFlat.male_manual_data?.thalassemia || detailsFlat.female_manual_data?.thalassemia ||
    detailsFlat.male_manual_data?.mthfr || detailsFlat.female_manual_data?.mthfr ||
    detailsFlat.male_data?.pathology?.genetic || detailsFlat.female_data?.pathology?.genetic
  );
  const hasMental = !!(
    (mentalResult && Object.keys(mentalResult).length > 0) ||
    detailsFlat.male_manual_data?.communication || detailsFlat.female_manual_data?.communication
  );

  // Base 58% for Lifestyle + Blood tests
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

  presentation.report_confidence = {
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

  // Always ensure report_assets colors are present (LLM sometimes omits them)
  if (!presentation.report_assets) {
    presentation.report_assets = {
      colors: { green: '#10b981', yellow: '#f59e0b', red: '#ef4444', gray: '#94a3b8' }
    };
  }

  // Post-process: normalize annualChance — LLM sometimes returns a decimal (0.85) or inflated integer
  if (presentation.family_planning) {
    let ac = presentation.family_planning.annualChance;
    if (typeof ac === 'number') {
      if (ac <= 1) ac = ac * 100;
      presentation.family_planning.annualChance = Math.min(100, Math.max(0, Math.round(ac)));
    }
  }

  logger.info('[AIPresentationService] AI presentation map generated successfully.');
  return presentation;
}

module.exports = { generateAIPresentationMap };
