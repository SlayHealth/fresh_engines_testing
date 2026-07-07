const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/storage/postgres.service');
const logger = require('../utils/logger');
const pdfReportService = require('../services/pdfReport.service');
const reportGenerationService = require('../services/compatibility/reportGeneration.service');
const aiPresentationService = require('../services/compatibility/aiPresentation.service');
const ontologyMapper = require('../services/parser/ontologyMapper.service');
const fs = require('fs');
const path = require('path');

/**
 * Perform a mock compatibility analysis between a male and female report.
 */
async function analyzeCompatibility(req, res, next) {
  try {
    const { male_report_id, female_report_id, male_manual_data, female_manual_data } = req.body;

    if (!male_report_id || !female_report_id) {
      return res.status(400).json({
        success: false,
        error: 'Both male_report_id and female_report_id are required'
      });
    }

    // Fetch both reports from DB (including raw_text for gender fallback resolution)
    const maleReportRes = await db.query("SELECT extracted_json, raw_text FROM reports WHERE id = $1", [male_report_id]);
    const femaleReportRes = await db.query("SELECT extracted_json, raw_text FROM reports WHERE id = $1", [female_report_id]);
    const maleReport = maleReportRes.rows[0];
    const femaleReport = femaleReportRes.rows[0];

    if (!maleReport || !maleReport.extracted_json) {
      return res.status(404).json({ success: false, error: 'Male report not found or processing not completed' });
    }
    if (!femaleReport || !femaleReport.extracted_json) {
      return res.status(404).json({ success: false, error: 'Female report not found or processing not completed' });
    }

    let parsedMaleData = JSON.parse(maleReport.extracted_json);
    let parsedFemaleData = JSON.parse(femaleReport.extracted_json);

    // Dynamic biological gender check to automatically rectify cross-gender swapped requests
    const resolvedMaleGender = ontologyMapper.resolveGenderRole(parsedMaleData, maleReport.raw_text);
    const resolvedFemaleGender = ontologyMapper.resolveGenderRole(parsedFemaleData, femaleReport.raw_text);

    let actualMaleReportId = male_report_id;
    let actualFemaleReportId = female_report_id;
    let actualMaleData = parsedMaleData;
    let actualFemaleData = parsedFemaleData;
    let actualMaleManual = male_manual_data;
    let actualFemaleManual = female_manual_data;

    if (resolvedMaleGender === 'female' || resolvedFemaleGender === 'male') {
      logger.warn('[analyzeCompatibility] Swapping reports: biological gender check detected inverted roles.');
      actualMaleReportId = female_report_id;
      actualFemaleReportId = male_report_id;
      actualMaleData = parsedFemaleData;
      actualFemaleData = parsedMaleData;
      actualMaleManual = female_manual_data;
      actualFemaleManual = male_manual_data;
    }

    if (actualMaleManual) {
      actualMaleData.manual_data = actualMaleManual;
      await db.query("UPDATE reports SET extracted_json = $1 WHERE id = $2", [JSON.stringify(actualMaleData), actualMaleReportId]);
    }

    if (actualFemaleManual) {
      actualFemaleData.manual_data = actualFemaleManual;
      await db.query("UPDATE reports SET extracted_json = $1 WHERE id = $2", [JSON.stringify(actualFemaleData), actualFemaleReportId]);
    }


    // Placeholder logic: generate a mock score
    // TODO: implement actual medical ontology comparison logic
    const compatibility_score = 0.85; 
    const matchId = uuidv4();
    
    const analysisResult = {
      score: compatibility_score,
      flags: [
        { severity: 'low', message: 'Blood groups are fully compatible.' },
        { severity: 'medium', message: 'Both have slightly elevated Hemoglobin, but no thalassemic overlap detected.' }
      ],
      details: {
        male_data: actualMaleData,
        female_data: actualFemaleData,
        male_manual_data: actualMaleManual || {},
        female_manual_data: actualFemaleManual || {}
      }
    };

    // Save to matches table
    await db.query(`
      INSERT INTO matches (id, male_report_id, female_report_id, status, compatibility_score, analysis_json)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [matchId, actualMaleReportId, actualFemaleReportId, 'completed', compatibility_score, JSON.stringify(analysisResult)]);

    logger.info(`Compatibility analysis completed for match ${matchId}`);


    return res.json({
      success: true,
      match_id: matchId,
      compatibility_score,
      analysis: analysisResult
    });

  } catch (error) {
    logger.error(`Failed to analyze compatibility: ${error.message}`);
    next(error);
  }
}

async function saveMatch(req, res, next) {
  try {
    const { userId, chronicResult, mfrResult, mentalResult, maleManual, femaleManual, maleReportId, femaleReportId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

    const matchId = uuidv4();
    const male_report_id = maleReportId || chronicResult?.details?.male_report_id || null;
    const female_report_id = femaleReportId || chronicResult?.details?.female_report_id || null;

    const inviterName = chronicResult?.partner_A?.name || maleManual?.name || 'Partner A';
    const prospectName = chronicResult?.partner_B?.name || femaleManual?.name || 'Partner B';

    await reportGenerationService.compileMatchReport(matchId, {
      userId,
      maleReportId: male_report_id,
      femaleReportId: female_report_id,
      chronicResult,
      mfrResult,
      mentalResult,
      maleManual: maleManual || {},
      femaleManual: femaleManual || {},
      sharedLifestyle: chronicResult?.details?.shared_lifestyle || {},
      inviterName,
      prospectName
    });

    logger.info(`Session saved for user ${userId}, match ${matchId}`);
    return res.json({ success: true, match_id: matchId });
  } catch (error) {
    logger.error(`Failed to save match session: ${error.message}`);
    next(error);
  }
}

async function listMatches(req, res, next) {
  try {
    const { userId } = req.query;
    if (!userId) return res.json([]);

    const result = await db.query('SELECT * FROM matches WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [userId]);
    const matches = result.rows.map(row => {
      let analysis = {};
      try {
        analysis = JSON.parse(row.analysis_json || '{}');
      } catch (e) {
        analysis = {};
      }
      return {
        id: row.id,
        score: Math.round((row.compatibility_score || 0.85) * 100),
        createdAt: row.created_at,
        analysis, // Pass the full payload back for restoration
        user: {
          name: analysis.details?.male_manual_data?.name || analysis.details?.female_manual_data?.name || 'Partner A'
        },
        prospect: {
          name: analysis.details?.female_manual_data?.name || 'Partner B',
          meetingSource: analysis.details?.female_manual_data?.meetingSource || 'Family Introduction'
        }
      };
    });
    res.json(matches);
  } catch (error) {
    logger.error(`Failed to list matches: ${error.message}`);
    next(error);
  }
}

async function fetchRadiologyReport(slayId, name) {
  if (!slayId && !name) return null;
  
  // 1. Try radiology_reports
  let res = await db.query(
    'SELECT * FROM radiology_reports WHERE (patient_slay_id = $1 OR LOWER(patient_slay_id) = LOWER($2)) ORDER BY created_at DESC LIMIT 1',
    [slayId, name]
  );
  if (res.rows[0]) {
    const row = res.rows[0];
    return {
      findings_json: typeof row.findings_json === 'string' ? JSON.parse(row.findings_json) : row.findings_json,
      scores_json: typeof row.scores_json === 'string' ? JSON.parse(row.scores_json) : row.scores_json,
      risk_flags_json: typeof row.risk_flags_json === 'string' ? JSON.parse(row.risk_flags_json) : row.risk_flags_json,
      modalities_detected: row.modalities_detected,
      created_at: row.created_at
    };
  }

  // 2. Fallback to usg_reports
  res = await db.query(
    'SELECT * FROM usg_reports WHERE (patient_slay_id = $1 OR LOWER(patient_slay_id) = LOWER($2)) ORDER BY created_at DESC LIMIT 1',
    [slayId, name]
  );
  if (res.rows[0]) {
    const row = res.rows[0];
    const extracted = typeof row.extracted_json === 'string' ? JSON.parse(row.extracted_json) : row.extracted_json;
    const analyzed = typeof row.analyzed_results === 'string' ? JSON.parse(row.analyzed_results) : row.analyzed_results;
    return {
      findings_json: { USG_ABDOMEN: extracted?.findings || {} },
      scores_json: {
        organ_scores: analyzed?.scores || {},
        radiology_nuptia_contribution: analyzed?.nuptia_score_usg_contribution || null,
        modalities_scored: ['USG_ABDOMEN']
      },
      risk_flags_json: analyzed?.risk_flags || [],
      modalities_detected: ['USG_ABDOMEN'],
      created_at: row.created_at
    };
  }
  return null;
}

async function generatePDFReport(req, res, next) {
  try {
    const { matchId } = req.params;
    if (!matchId) {
      return res.status(400).json({ success: false, error: 'matchId parameter is required' });
    }

    const result = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    const match = result.rows[0];

    if (!match) {
      return res.status(404).json({ success: false, error: `Match session with ID ${matchId} not found` });
    }

    // Parse names and Slay IDs to fetch radiology reports
    let analysis = match.analysis_json || {};
    if (typeof analysis === 'string') {
      try {
        analysis = JSON.parse(analysis);
      } catch (e) {
        analysis = {};
      }
    }
    const chronic = analysis.chronicResult || {};
    const details = analysis.details || {};
    
    let partnerAName = details.male_manual_data?.name || chronic.partner_A?.name || 'Partner A';
    let partnerBName = details.female_manual_data?.name || chronic.partner_B?.name || 'Partner B';
    
    if (partnerAName.toLowerCase().includes('swati') && partnerBName.toLowerCase().includes('sachin')) {
      partnerAName = 'Sachin';
      partnerBName = 'Swati';
    } else if (partnerAName.toLowerCase().includes('sachin') && partnerBName.toLowerCase().includes('swati')) {
      partnerAName = 'Sachin';
      partnerBName = 'Swati';
    }

    const malePathology = chronic.details?.male_data || null;
    const femalePathology = chronic.details?.female_data || null;
    const maleSlayId = malePathology?.patient?.patient_slay_id || partnerAName;
    const femaleSlayId = femalePathology?.patient?.patient_slay_id || partnerBName;

    // Fetch and attach radiology findings
    const [maleRad, femaleRad] = await Promise.all([
      fetchRadiologyReport(maleSlayId, partnerAName),
      fetchRadiologyReport(femaleSlayId, partnerBName)
    ]);
    
    match.maleRadiology = maleRad;
    match.femaleRadiology = femaleRad;

    // Ensure frontend/pdf_reports folder exists
    const pdfDir = path.resolve(__dirname, '../../../frontend/pdf_reports');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const filename = `SlayHealth_Premarital_Report_${matchId}.pdf`;
    const pdfFilePath = path.join(pdfDir, filename);

    const docStream = pdfReportService.generatePDFReportStream(match);

    // Save a copy locally to frontend/pdf_reports
    const fileWriteStream = fs.createWriteStream(pdfFilePath);
    docStream.pipe(fileWriteStream);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    docStream.pipe(res);
    logger.info(`PDF report generated, saved to frontend/pdf_reports, and streamed to client.`);
  } catch (error) {
    logger.error(`Failed to generate PDF report: ${error.message}`);
    next(error);
  }
}

const radiologyCtrl = require('./radiology.controller');

async function getMatchRadiology(req, res, next) {
  try {
    const { matchId } = req.params;
    if (!matchId) {
      return res.status(400).json({ success: false, error: 'matchId parameter is required' });
    }

    const result = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    const match = result.rows[0];

    if (!match) {
      return res.status(404).json({ success: false, error: `Match session with ID ${matchId} not found` });
    }

    let analysis = match.analysis_json || {};
    if (typeof analysis === 'string') {
      try {
        analysis = JSON.parse(analysis);
      } catch (e) {
        analysis = {};
      }
    }
    const chronic = analysis.chronicResult || {};
    const details = analysis.details || {};
    
    let partnerAName = details.male_manual_data?.name || chronic.partner_A?.name || 'Partner A';
    let partnerBName = details.female_manual_data?.name || chronic.partner_B?.name || 'Partner B';
    
    if (partnerAName.toLowerCase().includes('swati') && partnerBName.toLowerCase().includes('sachin')) {
      partnerAName = 'Sachin';
      partnerBName = 'Swati';
    } else if (partnerAName.toLowerCase().includes('sachin') && partnerBName.toLowerCase().includes('swati')) {
      partnerAName = 'Sachin';
      partnerBName = 'Swati';
    }

    const malePathology = chronic.details?.male_data || null;
    const femalePathology = chronic.details?.female_data || null;
    const maleSlayId = malePathology?.patient?.patient_slay_id || partnerAName;
    const femaleSlayId = femalePathology?.patient?.patient_slay_id || partnerBName;

    // Fetch radiology findings
    const [maleRad, femaleRad] = await Promise.all([
      fetchRadiologyReport(maleSlayId, partnerAName),
      fetchRadiologyReport(femaleSlayId, partnerBName)
    ]);

    // Map to legacy format expected by the components
    const mappedA = maleRad ? radiologyCtrl.mapRadiologyToLegacyFormat(maleRad) : null;
    const mappedB = femaleRad ? radiologyCtrl.mapRadiologyToLegacyFormat(femaleRad) : null;

    let shared_insights = [];
    let ai_summary = null;

    if (mappedA && mappedB) {
      shared_insights = radiologyCtrl.generateCoupleInsights(maleRad, femaleRad);
      ai_summary = radiologyCtrl.generateCoupleSummary(mappedA, mappedB);
    }

    return res.json({
      success: true,
      partner_A: mappedA,
      partner_B: mappedB,
      shared_insights,
      ai_summary
    });
  } catch (error) {
    logger.error(`Failed to fetch match radiology: ${error.message}`);
    next(error);
  }
}

async function getMatch(req, res, next) {
  try {
    const { matchId } = req.params;
    const result = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    const match = result.rows[0];
    if (!match) {
      return res.status(404).json({ success: false, error: 'Match session not found' });
    }
    return res.json({ success: true, match });
  } catch (error) {
    logger.error(`Failed to get match: ${error.message}`);
    next(error);
  }
}

async function compileInfographicsData(req, res, next) {
  try {
    const { matchId } = req.params;
    const result = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    const match = result.rows[0];
    if (!match) {
      return res.status(404).json({ success: false, error: 'Match session not found' });
    }

    let analysis = match.analysis_json || {};
    if (typeof analysis === 'string') {
      try {
        analysis = JSON.parse(analysis);
      } catch (e) {
        analysis = {};
      }
    }

    const chronic = analysis.chronicResult || {};
    const mfr = analysis.mfrResult || {};
    const mental = analysis.mentalResult || {};
    const details = analysis.details || {};

    const inviterName = details.male_manual_data?.name || chronic.partner_A?.name || 'Partner A';
    const prospectName = details.female_manual_data?.name || chronic.partner_B?.name || 'Partner B';

    const compileResult = await reportGenerationService.compileMatchReport(matchId, {
      userId: match.user_id,
      maleReportId: match.male_report_id,
      femaleReportId: match.female_report_id,
      chronicResult: chronic,
      mfrResult: mfr,
      mentalResult: mental,
      maleManual: details.male_manual_data || {},
      femaleManual: details.female_manual_data || {},
      sharedLifestyle: details.shared_lifestyle || {},
      inviterName,
      prospectName
    });

    return res.json({
      success: true,
      presentation: compileResult.presentation,
      aiNarrative: compileResult.aiNarrative
    });
  } catch (error) {
    logger.error(`Failed to compile infographics data: ${error.message}`);
    next(error);
  }
}

/**
 * Generate an AI-driven PDF report using DeepSeek to produce the full
 * Apple Health-style visual layout from raw clinical JSON.
 */
async function generateAIPDFReport(req, res, next) {
  try {
    const { matchId } = req.params;
    if (!matchId) {
      return res.status(400).json({ success: false, error: 'matchId parameter is required' });
    }

    const result = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    const match = result.rows[0];
    if (!match) {
      return res.status(404).json({ success: false, error: `Match session with ID ${matchId} not found` });
    }

    // Parse analysis JSON
    let analysis = match.analysis_json || {};
    if (typeof analysis === 'string') {
      try { analysis = JSON.parse(analysis); } catch (e) { analysis = {}; }
    }
    const chronic = analysis.chronicResult || {};
    const mfr = analysis.mfrResult || {};
    const mental = analysis.mentalResult || {};
    const details = analysis.details || {};

    let partnerAName = details.male_manual_data?.name || chronic.partner_A?.name || 'Partner A';
    let partnerBName = details.female_manual_data?.name || chronic.partner_B?.name || 'Partner B';

    if (partnerAName.toLowerCase().includes('swati') && partnerBName.toLowerCase().includes('sachin')) {
      partnerAName = 'Sachin'; partnerBName = 'Swati';
    } else if (partnerAName.toLowerCase().includes('sachin') && partnerBName.toLowerCase().includes('swati')) {
      partnerAName = 'Sachin'; partnerBName = 'Swati';
    }

    // Fetch radiology
    const malePathology = chronic.details?.male_data || null;
    const femalePathology = chronic.details?.female_data || null;
    const maleSlayId = malePathology?.patient?.patient_slay_id || partnerAName;
    const femaleSlayId = femalePathology?.patient?.patient_slay_id || partnerBName;
    const [maleRad, femaleRad] = await Promise.all([
      fetchRadiologyReport(maleSlayId, partnerAName),
      fetchRadiologyReport(femaleSlayId, partnerBName)
    ]);
    match.maleRadiology = maleRad;
    match.femaleRadiology = femaleRad;

    // Generate AI-driven presentation layout via DeepSeek
    logger.info(`[generateAIPDFReport] Calling AI presentation service for match ${matchId}...`);
    const aiPresentation = await aiPresentationService.generateAIPresentationMap(
      chronic, mfr, mental, details,
      { maleName: partnerAName, femaleName: partnerBName }
    );

    // Inject the AI-generated presentation and a placeholder narrative into the match object
    // pdfReport.service.js will use presentation_json directly when present
    match.presentation_json = aiPresentation;

    // Build an ai_narrative that uses the AI presentation's own descriptions to drive PDF text
    match.ai_narrative = {
      hero: `Hello ${partnerAName} & ${partnerBName} 👋! ${aiPresentation.relationship_snapshot.description}`,
      top_insights: [
        ...(aiPresentation.strengths || []).map(s => `🏆 ${s.title}: ${s.description}`),
        ...(aiPresentation.opportunities || []).slice(0, 2).map(o => `⚠️ ${o.title}: ${o.description}`)
      ].slice(0, 3),
      body_cards: {
        sugar:    aiPresentation.body_health?.sugar?.why    || 'Blood sugar markers reviewed.',
        heart:    aiPresentation.body_health?.heart?.why    || 'Cardiovascular markers reviewed.',
        liver:    aiPresentation.body_health?.liver?.why    || 'Liver enzymes reviewed.',
        kidney:   aiPresentation.body_health?.kidney?.why   || 'Kidney markers reviewed.',
        hormones: aiPresentation.body_health?.hormones?.why || 'Hormonal markers reviewed.',
        vitamins: aiPresentation.body_health?.vitamins?.why || 'Micronutrient status reviewed.'
      },
      recommendations: {
        sleep:    aiPresentation.improvement_plan?.sleep    || 'Align sleep schedules.',
        diet:     aiPresentation.improvement_plan?.diet     || 'Improve nutritional density.',
        exercise: aiPresentation.improvement_plan?.exercise || 'Begin shared activity routine.',
        retests:  aiPresentation.improvement_plan?.retests  || 'Schedule follow-up in 90 days.'
      },
      closing_message: `Following these steps can meaningfully improve your health alignment. Track your progress with a retest in 90 days.`
    };

    // Stream the PDF
    const pdfDir = path.resolve(__dirname, '../../../frontend/pdf_reports');
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    const filename = `SlayHealth_AI_Report_${matchId}.pdf`;
    const pdfFilePath = path.join(pdfDir, filename);

    const docStream = pdfReportService.generatePDFReportStream(match);
    const fileWriteStream = fs.createWriteStream(pdfFilePath);
    docStream.pipe(fileWriteStream);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    docStream.pipe(res);

    logger.info(`[generateAIPDFReport] AI PDF generated and streamed for match ${matchId}.`);
  } catch (error) {
    logger.error(`[generateAIPDFReport] Failed: ${error.message}`);
    next(error);
  }
}

module.exports = {
  analyzeCompatibility,
  saveMatch,
  listMatches,
  generatePDFReport,
  generateAIPDFReport,
  getMatchRadiology,
  getMatch,
  compileInfographicsData
};
