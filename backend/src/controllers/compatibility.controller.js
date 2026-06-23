const { v4: uuidv4 } = require('uuid');
const { db } = require('../services/storage/postgres.service');
const logger = require('../utils/logger');

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
    const { userId, chronicResult, mfrResult, maleManual, femaleManual } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

    const matchId = uuidv4();
    // Calculate an overall score if not provided, just mock for now
    const compatibility_score = chronicResult?.compatibility_score || 0.85;

    const analysisResult = {
      score: compatibility_score,
      chronicResult,
      mfrResult,
      details: {
        male_manual_data: maleManual || {},
        female_manual_data: femaleManual || {}
      }
    };

    // Grab report IDs from chronic result if available
    const male_report_id = chronicResult?.details?.male_report_id || null;
    const female_report_id = chronicResult?.details?.female_report_id || null;

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

module.exports = {
  analyzeCompatibility,
  saveMatch,
  listMatches
};
