const { db } = require('../storage/postgres.service');
const reportSummaryService = require('./reportSummary.service');
const narrativeService = require('../llm/narrative.service');
const radiologyLookupService = require('../radiology/radiologyLookup.service');
const logger = require('../../utils/logger');

class ReportGenerationService {
  /**
   * Orchestrates the entire match compilation flow: clinical calculations, presentation mapping, AI narratives, and DB saving.
   */
  async compileMatchReport(matchId, {
    userId,
    maleReportId,
    femaleReportId,
    chronicResult,
    mfrResult,
    mentalResult,
    maleManual = {},
    femaleManual = {},
    sharedLifestyle = {},
    inviterName = 'Partner A',
    prospectName = 'Partner B'
  }) {
    logger.info(`Orchestrator: Compiling report for match ${matchId}...`);

    try {
      // Fetch each partner's own radiology analysis by identity (radiology reports
      // aren't linked by report ID — they're looked up the same way the PDF renderer
      // does, by patient name/slay-id — a previous version of this queried
      // radiology_reports using the *pathology* report ID, which is a different
      // table's ID space and essentially never matched, silently dropping the whole
      // radiology domain out of the score).
      let hasRadiology = false;
      let radScore = null;
      try {
        const [maleRad, femaleRad] = await Promise.all([
          radiologyLookupService.fetchRadiologyByIdentity(null, maleManual?.name),
          radiologyLookupService.fetchRadiologyByIdentity(null, femaleManual?.name)
        ]);

        const partnerScores = [maleRad, femaleRad]
          .map((rad) => rad?.scores_json?.radiology_nuptia_contribution)
          .filter((c) => typeof c === 'number');

        if (partnerScores.length > 0) {
          radScore = (partnerScores.reduce((sum, c) => sum + (c / 30) * 100, 0)) / partnerScores.length;
          hasRadiology = true;
        }
      } catch (radErr) {
        logger.warn(`Failed to fetch radiology score for compilation: ${radErr.message}`);
      }

      // 1. Run deterministic Presentation & Summary mapping
      const { presentation, assets } = reportSummaryService.mapPresentation(
        chronicResult,
        mfrResult,
        mentalResult,
        {
          male_data: chronicResult?.details?.male_data || {},
          female_data: chronicResult?.details?.female_data || {},
          male_manual_data: maleManual,
          female_manual_data: femaleManual,
          shared_lifestyle: sharedLifestyle,
          radiology_report_id: hasRadiology || null
        }
      );

      const hasGenetic = !!presentation.report_confidence?.domains?.genetic?.covered;
      // A carrier-pair risk only clinically matters for an autosomal recessive condition
      // like thalassemia when BOTH partners carry the trait (that's what puts a child at
      // real risk) — a single carrier alongside a non-carrier partner is a much smaller
      // concern. Score accordingly rather than treating "either partner flagged" the same
      // as "both partners flagged".
      let genScore = 100;
      if (hasGenetic) {
        const cpr = presentation.carrier_pair_risk || {};
        const maleRed = cpr.thalassemia?.male_status === 'red';
        const femaleRed = cpr.thalassemia?.female_status === 'red';
        if (maleRed && femaleRed) {
          genScore = 50;
        } else if (maleRed || femaleRed) {
          genScore = 75;
        }
      }

      // Weights: Chronic=35%, Fertility=25%, Mental=20%, Radiology=10%, Genetics=10%
      let sumScores = 0;
      let sumWeights = 0;

      if (chronicResult?.calculations?.coupleIndex) {
        sumScores += chronicResult.calculations.coupleIndex * 0.35;
        sumWeights += 0.35;
      }
      if (mfrResult?.p_12m_current) {
        // mfrResult.p_12m_current is already 0-100 scale (see mfr.controller.js) — don't re-multiply by 100.
        sumScores += mfrResult.p_12m_current * 0.25;
        sumWeights += 0.25;
      }
      if (mentalResult?.overall_readiness?.score) {
        sumScores += mentalResult.overall_readiness.score * 0.20;
        sumWeights += 0.20;
      }
      if (hasRadiology) {
        sumScores += radScore * 0.10;
        sumWeights += 0.10;
      }
      if (hasGenetic) {
        sumScores += genScore * 0.10;
        sumWeights += 0.10;
      }

      // If literally no domain produced a usable score, there is nothing real to
      // report — leave it null (pending) rather than presenting a fabricated number.
      const crossDomainScore = sumWeights > 0 ? (sumScores / sumWeights) : null;
      const compatibilityScore = crossDomainScore !== null ? crossDomainScore / 100 : null;

      if (presentation && presentation.compatibility_score) {
        presentation.compatibility_score.percentage = crossDomainScore !== null ? Math.round(crossDomainScore) : null;
        presentation.compatibility_score.score = crossDomainScore !== null ? Math.round(crossDomainScore) : null;
      }

      const analysisJson = {
        score: compatibilityScore,
        chronicResult,
        mfrResult,
        mentalResult: mentalResult || null,
        details: {
          male_report_id: maleReportId,
          female_report_id: femaleReportId,
          male_manual_data: maleManual,
          female_manual_data: femaleManual,
          shared_lifestyle: sharedLifestyle,
          inviterName,
          prospectName
        }
      };

      // Embed visual assets directly inside the presentation structure for easy transport
      presentation.report_assets = assets;

      // Add version metadata to the presentation structure
      presentation.versions = {
        clinical_engine_version: "v1.2",
        presentation_mapper_version: "v2.0",
        narrative_prompt_version: "v5.0",
        pdf_template_version: "v2.0"
      };

      // 3. Generate structured AI narratives using DeepSeek
      const aiNarrative = await narrativeService.generateNarratives(
        presentation,
        inviterName,
        prospectName
      );

      // 4. Save/Update everything in Supabase Database
      logger.info(`Orchestrator: Saving compiled match data in DB...`);

      // Check if match already exists to run insert or update
      const existingMatch = await db.query('SELECT id FROM matches WHERE id = $1', [matchId]);

      if (existingMatch.rows.length > 0) {
        await db.query(`
          UPDATE matches 
          SET user_id = $1, 
              male_report_id = $2, 
              female_report_id = $3, 
              status = $4, 
              compatibility_score = $5, 
              analysis_json = $6,
              presentation_json = $7,
              ai_narrative = $8,
              presentation_version = $9,
              ai_prompt_version = $10
          WHERE id = $11
        `, [
          userId || null,
          maleReportId || null,
          femaleReportId || null,
          'completed',
          compatibilityScore,
          JSON.stringify(analysisJson),
          JSON.stringify(presentation),
          JSON.stringify(aiNarrative),
          "v2.0",
          "v5.0",
          matchId
        ]);
      } else {
        await db.query(`
          INSERT INTO matches (
            id, user_id, male_report_id, female_report_id, status, compatibility_score, 
            analysis_json, presentation_json, ai_narrative, presentation_version, ai_prompt_version
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          matchId,
          userId || null,
          maleReportId || null,
          femaleReportId || null,
          'completed',
          compatibilityScore,
          JSON.stringify(analysisJson),
          JSON.stringify(presentation),
          JSON.stringify(aiNarrative),
          "v2.0",
          "v5.0"
        ]);
      }

      logger.info(`Orchestrator: Completed report compilation for matchId=${matchId}`);
      return {
        success: true,
        matchId,
        presentation,
        aiNarrative
      };

    } catch (error) {
      logger.error(`Orchestrator failed: ${error.message}`);
      // Update match status to failed in DB if matchId exists
      try {
        await db.query("UPDATE matches SET status = 'failed' WHERE id = $1", [matchId]);
      } catch (dbErr) {
        logger.error(`Failed to update match status to failed: ${dbErr.message}`);
      }
      throw error;
    }
  }
}

module.exports = new ReportGenerationService();
