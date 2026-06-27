const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/storage/postgres.service');
const logger = require('../utils/logger');
const pdfReportService = require('../services/pdfReport.service');
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

    // Fetch both reports from DB
    const maleReportRes = await db.query("SELECT extracted_json FROM reports WHERE id = $1", [male_report_id]);
    const femaleReportRes = await db.query("SELECT extracted_json FROM reports WHERE id = $1", [female_report_id]);
    const maleReport = maleReportRes.rows[0];
    const femaleReport = femaleReportRes.rows[0];

    if (!maleReport || !maleReport.extracted_json) {
      return res.status(404).json({ success: false, error: 'Male report not found or processing not completed' });
    }
    if (!femaleReport || !femaleReport.extracted_json) {
      return res.status(404).json({ success: false, error: 'Female report not found or processing not completed' });
    }

    let parsedMaleData = JSON.parse(maleReport.extracted_json);
    if (male_manual_data) {
      parsedMaleData.manual_data = male_manual_data;
      await db.query("UPDATE reports SET extracted_json = $1 WHERE id = $2", [JSON.stringify(parsedMaleData), male_report_id]);
    }

    let parsedFemaleData = JSON.parse(femaleReport.extracted_json);
    if (female_manual_data) {
      parsedFemaleData.manual_data = female_manual_data;
      await db.query("UPDATE reports SET extracted_json = $1 WHERE id = $2", [JSON.stringify(parsedFemaleData), female_report_id]);
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
        male_data: parsedMaleData,
        female_data: parsedFemaleData,
        male_manual_data: male_manual_data || {},
        female_manual_data: female_manual_data || {}
      }
    };

    // Save to matches table
    await db.query(`
      INSERT INTO matches (id, male_report_id, female_report_id, status, compatibility_score, analysis_json)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [matchId, male_report_id, female_report_id, 'completed', compatibility_score, JSON.stringify(analysisResult)]);

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
    // Calculate an overall score if not provided, just mock for now
    const compatibility_score = chronicResult?.compatibility_score || 0.85;

    const analysisResult = {
      score: compatibility_score,
      chronicResult,
      mfrResult,
      mentalResult: mentalResult || null,
      details: {
        male_manual_data: maleManual || {},
        female_manual_data: femaleManual || {}
      }
    };

    // Grab report IDs from body or chronic result if available
    const male_report_id = maleReportId || chronicResult?.details?.male_report_id || null;
    const female_report_id = femaleReportId || chronicResult?.details?.female_report_id || null;

    await db.query(`
      INSERT INTO matches (id, user_id, male_report_id, female_report_id, status, compatibility_score, analysis_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [matchId, userId, male_report_id, female_report_id, 'completed', compatibility_score, JSON.stringify(analysisResult)]);

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

module.exports = {
  analyzeCompatibility,
  saveMatch,
  listMatches,
  generatePDFReport,
  getMatchRadiology
};
