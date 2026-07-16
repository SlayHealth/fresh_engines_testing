const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const classifier = require('../services/radiology/reportClassifier.service');
const splitter = require('../services/radiology/reportSplitter.service');
const extractor = require('../services/radiology/radiologyExtractor.service');
const aggregator = require('../services/radiology/reportAggregator.service');
const { calculateRadiologyNuptiaContribution } = require('../services/scoring/nuptia.composite.score');
const { generateRiskFlags } = require('../services/scoring/riskFlags.service');
const ocrProvider = require('../services/ocr/ocrProvider');
const { db } = require('../services/storage/postgres.service');
const logger = require('../utils/logger');

// Scorer function maps for individual organs (moved from usg.controller.js)
const {
  liverScore,
  prostateScore,
  femaleReproductiveScore,
  gallbladderScore,
  kidneyScore,
  bladderScore,
  pancreasScore,
  spleenScore,
  calculateMetabolicHealthIndex,
  compositeAbdominalScore
} = require('../services/scoring/abdomen.score');

function mapRadiologyToLegacyFormat(report) {
  if (!report) return null;

  // If it's already mapped, return it
  if (report.raw_data) return report;

  const findings = report.findings || {};
  const scores = report.scores || {};
  const organScores = scores.organ_scores || {};
  
  const usgFindings = findings.USG_ABDOMEN || findings.USG_ABDOMEN_PELVIS || findings.USG_PELVIS || {};
  
  const mappedScores = {
    liver: liverScore(usgFindings.liver),
    gallbladder: gallbladderScore(usgFindings.gallbladder),
    pancreas: pancreasScore(usgFindings.pancreas),
    spleen: spleenScore(usgFindings.spleen),
    kidneys: kidneyScore(usgFindings.kidneys),
    bladder: bladderScore(usgFindings.urinary_bladder),
    reproductive: report.sex === 'Female' 
      ? femaleReproductiveScore(usgFindings.uterus, usgFindings.ovaries) 
      : prostateScore(usgFindings.prostate, report.age),
    composite_abdominal: compositeAbdominalScore(usgFindings, report.sex, report.age),
    metabolic_index: calculateMetabolicHealthIndex(usgFindings, null)
  };

  return {
    id: report.id,
    patient_slay_id: report.patient_slay_id,
    created_at: report.created_at,
    
    // Legacy compatibility fields
    nuptia_score_usg_contribution: scores.radiology_nuptia_contribution,
    scores: mappedScores,
    risk_flags: report.risk_flags,
    raw_data: {
      patient: {
        sex: report.sex,
        age_years: report.age
      },
      findings: usgFindings
    },

    // New multi-modality fields
    modalities_detected: report.modalities_detected,
    modalities_failed: report.modalities_failed,
    findings_all: findings,
    scores_all: scores
  };
}

// Helper to run full radiology pipeline
async function runRadiologyAnalysis(rawText, sex, age, patientSlayId = null, bmi = null) {
  // Step 1: Classify
  const detected = classifier.classify(rawText);
  logger.info(`Detected modalities: ${detected.map(d => d.key).join(', ')}`);

  if (detected.length === 0) {
    throw new Error('No recognized radiology report sections found in text');
  }

  // Step 2: Split
  const sections = splitter.split(rawText, detected);

  // Step 3: Extract (parallel)
  const extractionResults = await extractor.extractAll(sections, patientSlayId, sex, age);

  // Step 4: Aggregate
  const aggregated = aggregator.aggregate(extractionResults);

  // Step 5: Score
  const nuptiaContribution = calculateRadiologyNuptiaContribution(aggregated, sex, age);
  const riskFlags = generateRiskFlags(aggregated.unified, sex, age);

  return {
    raw_ocr_text: rawText,
    patient_slay_id: patientSlayId,
    sex,
    age,
    modalities_detected: aggregated.modalities_detected,
    modalities_failed: aggregated.modalities_failed,
    findings: aggregated.unified,
    scores: nuptiaContribution,
    risk_flags: riskFlags
  };
}

exports.analyze = async (req, res, next) => {
  try {
    const { rawText, patientSlayId, sex, age, bmi } = req.body;
    if (!rawText) return res.status(400).json({ error: 'rawText is required' });
    const analyzed = await runRadiologyAnalysis(rawText, sex || 'Female', parseFloat(age) || 30, patientSlayId, parseFloat(bmi) || null);
    const legacyMapped = mapRadiologyToLegacyFormat(analyzed);
    return res.json(legacyMapped);
  } catch (err) {
    logger.error('Radiology analyze failed: ' + err.message);
    return res.status(422).json({ error: err.message });
  }
};

exports.uploadReport = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = req.file.path;
    const { patientSlayId, sex, age, bmi } = req.body;

    // 1. OCR
    // WS2-08: previously called ocrSpaceService directly, bypassing ocrProvider's
    // local PyMuPDF fast path (paid OCR.space latency/cost on every upload, even
    // text-native PDFs) and its mock-mode guard (radiology couldn't run in dev
    // without a real OCR key, unlike pathology). Routed through the shared
    // provider so both pipelines behave the same way.
    logger.info(`Running OCR on file: ${filePath}`);
    const ocrResults = await ocrProvider.process(filePath);
    const rawText = ocrResults.map(p => p.text).join('\n\n');

    // 2. Master radiology pipeline
    const analyzed = await runRadiologyAnalysis(rawText, sex || 'Female', parseFloat(age) || 30, patientSlayId, parseFloat(bmi) || null);

    // 3. Save report to DB
    const reportId = uuidv4();
    await db.query(
      `INSERT INTO radiology_reports (id, patient_slay_id, sex, age, modalities_detected, findings_json, scores_json, risk_flags_json, raw_ocr_text, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        reportId,
        analyzed.patient_slay_id,
        analyzed.sex,
        analyzed.age,
        analyzed.modalities_detected,
        JSON.stringify(analyzed.findings),
        JSON.stringify(analyzed.scores),
        JSON.stringify(analyzed.risk_flags),
        analyzed.raw_ocr_text,
        req.user?.id || null
      ]
    );

    // Clean up temp file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      logger.warn(`Failed to clean up uploaded file: ${e.message}`);
    }

    const legacyMapped = mapRadiologyToLegacyFormat(analyzed);
    return res.status(201).json({ reportId, analyzed: legacyMapped });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    logger.error('Radiology upload failed: ' + err.message);
    next(err);
  }
};

// This endpoint's only current caller is the frontend's "use a mock report" opt-in
// (both add-prospect/page.js and core-engine/usg/page.js post fixed, hardcoded
// findings/scores/risk_flags here — there is no real-upload path that uses it).
// Previously it stored whatever scores/risk_flags the client sent, verbatim, with no
// server-side recomputation and no mock marker — indistinguishable in storage from a
// genuinely analyzed report. Now: recompute scores/flags from the supplied findings
// server-side (so persisted scores can never be inconsistent with the findings that
// produced them) and always flag the row as mock, since that's what this path is.
exports.saveReport = async (req, res, next) => {
  try {
    const reportData = req.body;
    const reportId = uuidv4();
    const sex = reportData.sex || 'Female';
    const age = parseFloat(reportData.age) || 30;
    const findings = reportData.findings || {};

    const recomputedScores = calculateRadiologyNuptiaContribution({ unified: findings }, sex, age);
    const recomputedRiskFlags = generateRiskFlags(findings, sex, age);

    await db.query(
      `INSERT INTO radiology_reports (id, patient_slay_id, sex, age, modalities_detected, findings_json, scores_json, risk_flags_json, raw_ocr_text, is_mock, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)`,
      [
        reportId,
        reportData.patient_slay_id,
        sex,
        age,
        reportData.modalities_detected,
        JSON.stringify(findings),
        JSON.stringify(recomputedScores),
        JSON.stringify(recomputedRiskFlags),
        reportData.raw_ocr_text || '',
        req.user?.id || null
      ]
    );
    const legacyMapped = mapRadiologyToLegacyFormat({ ...reportData, findings, scores: recomputedScores, risk_flags: recomputedRiskFlags });
    return res.status(201).json({ reportId, analyzed: legacyMapped });
  } catch (err) {
    next(err);
  }
};

async function fetchReportWithFallback(id) {
  let result = await db.query('SELECT * FROM radiology_reports WHERE id = $1', [id]);
  let row = result.rows[0];
  if (row) {
    return {
      id: row.id,
      patient_slay_id: row.patient_slay_id,
      sex: row.sex,
      age: row.age,
      modalities_detected: row.modalities_detected,
      findings: typeof row.findings_json === 'string' ? JSON.parse(row.findings_json) : row.findings_json,
      scores: typeof row.scores_json === 'string' ? JSON.parse(row.scores_json) : row.scores_json,
      risk_flags: typeof row.risk_flags_json === 'string' ? JSON.parse(row.risk_flags_json) : row.risk_flags_json,
      created_at: row.created_at
    };
  }
  
  result = await db.query('SELECT * FROM usg_reports WHERE id = $1', [id]);
  row = result.rows[0];
  if (row) {
    const extracted = typeof row.extracted_json === 'string' ? JSON.parse(row.extracted_json) : row.extracted_json;
    const analyzed = typeof row.analyzed_results === 'string' ? JSON.parse(row.analyzed_results) : row.analyzed_results;
    return {
      id: row.id,
      patient_slay_id: row.patient_slay_id,
      sex: extracted?.patient?.sex || 'Female',
      age: extracted?.patient?.age_years || 30,
      modalities_detected: ['USG_ABDOMEN'],
      findings: {
        USG_ABDOMEN: extracted?.findings || {}
      },
      scores: {
        organ_scores: analyzed?.scores || {},
        radiology_nuptia_contribution: analyzed?.nuptia_score_usg_contribution || null,
        max_possible: 0.30,
        modalities_scored: ['USG_ABDOMEN']
      },
      risk_flags: analyzed?.risk_flags || [],
      created_at: row.created_at
    };
  }
  return null;
}

exports.getReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await fetchReportWithFallback(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const legacyMapped = mapRadiologyToLegacyFormat(report);
    return res.json({
      id: report.id,
      patient_slay_id: report.patient_slay_id,
      analyzed_results: legacyMapped,
      created_at: report.created_at
    });
  } catch (err) {
    next(err);
  }
};

function generateCoupleInsights(reportA, reportB) {
  const insights = [];
  const A_findings = reportA?.findings || {};
  const B_findings = reportB?.findings || {};

  const A_abd = A_findings.USG_ABDOMEN || A_findings.USG_ABDOMEN_PELVIS || A_findings.USG_PELVIS || {};
  const B_abd = B_findings.USG_ABDOMEN || B_findings.USG_ABDOMEN_PELVIS || B_findings.USG_PELVIS || {};
  
  if (A_abd.liver?.fatty_grade >= 1 && B_abd.liver?.fatty_grade >= 1) {
    insights.push({
      id: 'SHARED_METABOLIC',
      title: 'Shared Metabolic Pattern',
      text: 'Both partners show hepatic fat deposition. This suggests similar dietary and physical activity patterns. A joint metabolic reset program is recommended.'
    });
  }
  
  const aPcos = A_abd.ovaries?.pcos_morphology_bilateral || A_abd.ovaries?.pcos_morphology_unilateral || (A_findings.USG_TVS?.pcos_morphology_bilateral);
  const bPcos = B_abd.ovaries?.pcos_morphology_bilateral || B_abd.ovaries?.pcos_morphology_unilateral || (B_findings.USG_TVS?.pcos_morphology_bilateral);
  const aProstate = A_abd.prostate?.size_normal === false || (A_abd.prostate?.grade && A_abd.prostate?.grade !== 'normal');
  const bProstate = B_abd.prostate?.size_normal === false || (B_abd.prostate?.grade && B_abd.prostate?.grade !== 'normal');
  
  if ((aPcos && bProstate) || (bPcos && aProstate)) {
    insights.push({
      id: 'SHARED_HORMONAL',
      title: 'Hormonal Health Flags',
      text: 'Hormonal health flags detected in both partners. Endocrinology consultation recommended before family planning.'
    });
  }
  
  const aRenal = A_abd.kidneys?.right?.calculi_present || A_abd.kidneys?.left?.calculi_present || A_findings.MRI_RENAL?.renal_artery_stenosis;
  const bRenal = B_abd.kidneys?.right?.calculi_present || B_abd.kidneys?.left?.calculi_present || B_findings.MRI_RENAL?.renal_artery_stenosis;
  if (aRenal || bRenal) {
    insights.push({
      id: 'SHARED_RENAL',
      title: 'Renal Calculus History',
      text: 'Kidney stone history or renal anomalies may recur during pregnancy-related hydration shifts. Urology clearance recommended.'
    });
  }
  
  return insights;
}

exports.analyzeCouple = async (req, res, next) => {
  try {
    const { reportId_A, reportId_B } = req.body;
    if (!reportId_A || !reportId_B) return res.status(400).json({ error: 'Both reportId_A and reportId_B are required' });

    const [reportA, reportB] = await Promise.all([
      fetchReportWithFallback(reportId_A),
      fetchReportWithFallback(reportId_B)
    ]);

    if (!reportA || !reportB) {
      return res.status(404).json({ error: 'One or both reports not found in database' });
    }

    const insights = generateCoupleInsights(reportA, reportB);

    const mappedA = mapRadiologyToLegacyFormat(reportA);
    const mappedB = mapRadiologyToLegacyFormat(reportB);

    return res.json({
      partner_A: mappedA,
      partner_B: mappedB,
      shared_insights: insights
    });
  } catch (err) {
    next(err);
  }
};

function generateCoupleSummary(analyzedA, analyzedB) {
  const summary = {
    good_things: [],
    minor_issues: [],
    major_issues: []
  };

  const getFriendlyEffect = (flag) => {
    const map = {
      PCOS_BILATERAL: "we noticed polycystic patterns in both ovaries. This points to a hormonal imbalance that can sometimes make your cycles irregular and mean natural conception might take a little longer. It's super common, though—a chat with your doctor will help guide you!",
      PCOS_UNILATERAL: "there's a slight polycystic pattern in one ovary. It's a minor hormonal variation that might occasionally throw your cycle off, but usually isn't a big deal.",
      FATTY_LIVER_2: "looks like there's some moderate fat buildup in the liver (Grade II). This can make you feel a bit sluggish and slow down your metabolism. The great news? It's highly reversible with some fun, healthy diet tweaks!",
      FATTY_LIVER_1: "we noticed a tiny bit of fat starting to store in the liver (Grade I). Think of it as a gentle early warning sign from your metabolism—super easy to reverse with a few small lifestyle changes.",
      BPH_I: "there's a mild enlargement in the prostate. It's totally normal and might just mean needing to pee a bit more often, but it's very manageable.",
      BPH_SEVERE: "there's some more noticeable prostate enlargement. This can occasionally impact reproductive health and make daily bathroom trips a bit annoying, so it's a good idea to bring it up with a doctor.",
      RENAL_CALCULUS: "we spotted a kidney stone. While it might not bother you right now, it's really important to know about because pregnancy shifts your hydration needs, which could trigger some discomfort later on. Drink up!",
      LIVER_CYST: "we found a simple cyst in the liver. 'Cyst' sounds scary, but it's actually completely harmless! It won't affect your daily life, energy, or fertility at all.",
      VAGINAL_CYST: "we noticed a small fluid collection (a cyst) in the vaginal area. It's typically completely harmless, but it's good to keep an eye on it just to make sure you stay comfortable.",
      VARICOCELE_GR1: "we noticed a mild (Grade I) varicocele in the scrotum. This is a common and highly correctable variation in blood flow that can sometimes affect sperm quality.",
      VARICOCELE_GR2: "we noticed a moderate (Grade II) varicocele. Grade II varicoceles are clinically significant and are a common cause of fertility changes.",
      VARICOCELE_GR3: "we detected a prominent (Grade III) varicocele. Grade III varicoceles can impact sperm parameters and testosterone production.",
      VARICOCELE_UNGRADED: "we noticed a varicocele (fluid/vein congestion) in the scrotum.",
      ECHO_DIASTOLIC_DYSFUNCTION_G2: "echocardiography indicates Grade II/III diastolic dysfunction, showing that the heart muscle takes slightly longer to relax. It's a key marker to review before pregnancy.",
      PAH_ELEVATED: "we noticed elevated pressures in the pulmonary arteries. Because pregnancy increases total blood volume and cardiac workload, this is a critical marker that requires urologist/cardiologist review.",
      DEXA_OSTEOPENIA: "bone densitometry indicates osteopenia/osteoporosis. This means bone mineral density is lower than typical, and indicates a need for calcium and vitamin D review."
    };
    return map[flag.flag_id] || `we noticed something called '${flag.flag_label}'. It's best to review this with your doctor to understand if it has any long-term effects on your wellness.`;
  };

  const processFlags = (flags, partnerName) => {
    (flags || []).forEach(f => {
      const effectText = getFriendlyEffect(f);
      if (f.severity === 'high' || f.severity === 'critical') {
        summary.major_issues.push(`For ${partnerName}, ${effectText}`);
      } else {
        summary.minor_issues.push(`For ${partnerName}, ${effectText}`);
      }
    });
  };

  processFlags(analyzedA.risk_flags, "Partner A");
  processFlags(analyzedB.risk_flags, "Partner B");

  // Add good things based on scores
  if (analyzedA.scores?.USG_ABDOMEN && analyzedB.scores?.USG_ABDOMEN) {
    summary.good_things.push("You both have optimal liver health! This means your metabolisms are strong and your energy levels should be great.");
  }

  if (summary.minor_issues.length === 0 && summary.major_issues.length === 0) {
    summary.good_things.push("Wow! We didn't detect any significant pathological findings for either of you. Everything looks completely clear!");
  }

  return summary;
}

exports.getCoupleSummary = async (req, res, next) => {
  try {
    const { reportId_A, reportId_B } = req.body;
    if (!reportId_A || !reportId_B) return res.status(400).json({ error: 'Both reportId_A and reportId_B are required' });

    const [reportA, reportB] = await Promise.all([
      fetchReportWithFallback(reportId_A),
      fetchReportWithFallback(reportId_B)
    ]);

    if (!reportA || !reportB) {
      return res.status(404).json({ error: 'One or both reports not found in database' });
    }

    const mappedA = mapRadiologyToLegacyFormat(reportA);
    const mappedB = mapRadiologyToLegacyFormat(reportB);

    const summary = generateCoupleSummary(mappedA, mappedB);
    return res.json(summary);
  } catch (err) {
    next(err);
  }
};

exports.mapRadiologyToLegacyFormat = mapRadiologyToLegacyFormat;
exports.generateCoupleInsights = generateCoupleInsights;
exports.generateCoupleSummary = generateCoupleSummary;
exports.runRadiologyAnalysis = runRadiologyAnalysis;
