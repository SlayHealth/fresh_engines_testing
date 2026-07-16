const { db } = require('../storage/postgres.service');
const reportSummaryService = require('./reportSummary.service');
const narrativeService = require('../llm/narrative.service');
const radiologyLookupService = require('../radiology/radiologyLookup.service');
const logger = require('../../utils/logger');

class ReportGenerationService {
  // Fetch each partner's own radiology analysis by identity (radiology reports aren't
  // linked by report ID — they're looked up the same way the PDF renderer does, by
  // patient name/slay-id — a previous version of this queried radiology_reports using
  // the *pathology* report ID, which is a different table's ID space and essentially
  // never matched, silently dropping the whole radiology domain out of the score).
  async _fetchRadiologyScore(maleManual, femaleManual) {
    let hasRadiology = false;
    let radScore = null;
    try {
      const [maleRad, femaleRad] = await Promise.all([
        radiologyLookupService.fetchRadiologyByIdentity(null, maleManual?.name),
        radiologyLookupService.fetchRadiologyByIdentity(null, femaleManual?.name)
      ]);

      const partnerScores = [maleRad, femaleRad]
        .map((rad) => rad?.scores?.radiology_nuptia_contribution)
        .filter((c) => typeof c === 'number');

      if (partnerScores.length > 0) {
        radScore = (partnerScores.reduce((sum, c) => sum + (c / 30) * 100, 0)) / partnerScores.length;
        hasRadiology = true;
      }
    } catch (radErr) {
      logger.warn(`Failed to fetch radiology score for compilation: ${radErr.message}`);
    }
    return { hasRadiology, radScore };
  }

  /**
   * The single place the overall compatibility score gets computed. Both the initial
   * match compile (compileMatchReport, below) and any later recompute — e.g. once
   * mental-wellbeing answers arrive after the initial match already ran, see
   * mental.controller.js's analyzeMental — call this same method, so the DB's
   * `compatibility_score` column and `presentation_json.relationship_snapshot.score`
   * can never again be computed independently, drift apart, or bypass the STI safety
   * gate the way they previously could when each caller re-derived its own number.
   */
  async computeGatedComposite({
    chronicResult,
    mfrResult,
    mentalResult,
    maleManual = {},
    femaleManual = {},
    sharedLifestyle = {}
  }) {
    const { hasRadiology, radScore } = await this._fetchRadiologyScore(maleManual, femaleManual);

    const maleData = chronicResult?.details?.male_data || {};
    const femaleData = chronicResult?.details?.female_data || {};

    const detailsForPresentation = {
      male_data: maleData,
      female_data: femaleData,
      male_manual_data: maleManual,
      female_manual_data: femaleManual,
      shared_lifestyle: sharedLifestyle,
      radiology_report_id: hasRadiology || null
    };

    // Genetics (thalassemia carrier-pair) contribution — computed once here, ahead of
    // mapPresentation, so it can feed the weighted blend below instead of only being
    // available after the presentation object already exists.
    const carrierRisk = reportSummaryService.evaluateThalassemiaCarrierRisk(maleData, femaleData);
    let hasGenetic = carrierRisk.thalassemia.covered;
    // A carrier-pair risk only clinically matters for an autosomal recessive condition
    // like thalassemia when BOTH partners carry the trait (that's what puts a child at
    // real risk) — a single carrier alongside a non-carrier partner is a much smaller
    // concern. Score accordingly rather than treating "either partner flagged" the same
    // as "both partners flagged".
    let genScore = 100;
    // WS1D08: both-carrier thalassemia is a categorical genetic-risk marker, not a
    // continuous domain score that just happens to be low — flagged separately so
    // the composite floor below can force a status-downgrade for it regardless of
    // whether genScore's raw value crosses the generic critical-domain threshold.
    let bothConfirmedCarriers = false;
    if (hasGenetic) {
      const maleRed = carrierRisk.thalassemia.male_status === 'red';
      const femaleRed = carrierRisk.thalassemia.female_status === 'red';
      const maleUntested = carrierRisk.thalassemia.male_status === 'gray';
      const femaleUntested = carrierRisk.thalassemia.female_status === 'gray';
      const eitherBorderline = carrierRisk.thalassemia.male_status === 'yellow' || carrierRisk.thalassemia.female_status === 'yellow';
      if (maleRed && femaleRed) {
        genScore = 50;
        bothConfirmedCarriers = true;
      } else if ((maleRed && femaleUntested) || (femaleRed && maleUntested)) {
        // WS1D06: one partner confirmed a carrier, the other never tested — the
        // couple's real both-carrier risk (the only thing that clinically matters
        // here) can't be ruled out. Previously this scored a reassuring 75, treating
        // the untested partner as if confirmed clear. Excluded from the composite
        // instead — an untested partner alongside a confirmed carrier is genuinely
        // "not assessed", not "probably fine".
        hasGenetic = false;
      } else if (maleRed || femaleRed) {
        genScore = 75;
      } else if (eitherBorderline) {
        // WS1D05/WS3A05: a 3.5-4.0% borderline HbA2 (with no confirmed carrier on
        // either side) is genuinely unresolved pending a repeat HPLC — not a clean
        // 100, but also not a number the review specifies, so this is excluded from
        // the composite rather than inventing an untested intermediate score.
        hasGenetic = false;
      }
    }

    // Weights: Chronic=35%, Fertility=25%, Mental=20%, Radiology=10%, Genetics=10%
    let sumScores = 0;
    let sumWeights = 0;
    const domainScores = [];

    if (chronicResult?.calculations?.coupleIndex) {
      sumScores += chronicResult.calculations.coupleIndex * 0.35;
      sumWeights += 0.35;
      domainScores.push(chronicResult.calculations.coupleIndex);
    }
    if (mfrResult?.p_12m_current) {
      // mfrResult.p_12m_current is already 0-100 scale (see mfr.controller.js) — don't re-multiply by 100.
      sumScores += mfrResult.p_12m_current * 0.25;
      sumWeights += 0.25;
      domainScores.push(mfrResult.p_12m_current);
    }
    // A truthy check here would silently drop a genuine score of 0 (mental.controller.js's
    // compatibilityIndex is legitimately 0 for a maximally-incompatible couple,
    // avgDiff >= 5 — see WS6-03/WS8-04) out of the composite entirely, as if the
    // domain were simply absent — erasing the couple's worst real finding rather
    // than weighting it in.
    if (typeof mentalResult?.overall_readiness?.score === 'number') {
      sumScores += mentalResult.overall_readiness.score * 0.20;
      sumWeights += 0.20;
      domainScores.push(mentalResult.overall_readiness.score);
    }
    if (hasRadiology) {
      sumScores += radScore * 0.10;
      sumWeights += 0.10;
      domainScores.push(radScore);
    }
    if (hasGenetic) {
      sumScores += genScore * 0.10;
      sumWeights += 0.10;
      domainScores.push(genScore);
    }

    // If literally no domain produced a usable score, there is nothing real to
    // report — leave it null (pending) rather than presenting a fabricated number.
    const rawCrossDomainScore = sumWeights > 0 ? (sumScores / sumWeights) : null;

    // WS1D07: a plain weighted average lets one catastrophic domain (e.g. chronic=10)
    // get averaged away by healthy domains elsewhere (chronic=10, others=90 -> 63,
    // still a reassuring-looking headline). abdomen.score.js already solves this exact
    // problem one layer down for individual organs — reusing the same threshold/buffer
    // here for consistency rather than inventing a new, separately-uncited cap.
    const CRITICAL_DOMAIN_SCORE_THRESHOLD = 30;
    const CRITICAL_DOMAIN_CAP_BUFFER = 20;
    let flooredCrossDomainScore = rawCrossDomainScore;
    if (rawCrossDomainScore !== null && domainScores.length > 0) {
      const worstDomainScore = Math.min(...domainScores);
      if (worstDomainScore < CRITICAL_DOMAIN_SCORE_THRESHOLD) {
        flooredCrossDomainScore = Math.min(rawCrossDomainScore, worstDomainScore + CRITICAL_DOMAIN_CAP_BUFFER);
      }
    }

    // WS1D08: genScore's raw value (50) sits above the generic 30-point critical-
    // domain threshold, so a confirmed both-carrier couple could otherwise stay in
    // an "Excellent"-adjacent headline band (e.g. 91) despite the single most
    // clinically significant premarital finding this app can surface. Forces the
    // same worst+buffer cap used above, anchored to genScore specifically,
    // independent of whether it happened to cross the generic threshold.
    if (bothConfirmedCarriers && flooredCrossDomainScore !== null) {
      flooredCrossDomainScore = Math.min(flooredCrossDomainScore, genScore + CRITICAL_DOMAIN_CAP_BUFFER);
    }

    // STI safety gate applied directly to the real composite score — not just to a
    // display-layer copy of it — so it's structurally impossible for a positive/reactive
    // infectious-disease result to be diluted or bypassed anywhere downstream (the DB
    // column, the report page, the PDF, and the match list all ultimately derive from
    // this one gated value).
    const stiGate = reportSummaryService.checkSTISafetyGate(detailsForPresentation);
    const crossDomainScore = stiGate.triggered
      ? Math.min(flooredCrossDomainScore !== null ? flooredCrossDomainScore : 50, 50)
      : flooredCrossDomainScore;

    detailsForPresentation.compiled_compatibility_score = crossDomainScore;

    const { presentation, assets } = reportSummaryService.mapPresentation(
      chronicResult,
      mfrResult,
      mentalResult,
      detailsForPresentation
    );
    presentation.report_assets = assets;
    // genScore (100/75/50 by real carrier-pair status, computed above) previously
    // fed only into the composite blend and was discarded — surfaced here as-is
    // so a "Genetic carrier risk" tile can show it without inventing a new score.
    presentation.genetic_score = hasGenetic ? genScore : null;

    const compatibilityScore = crossDomainScore !== null ? crossDomainScore / 100 : null;

    return { compatibilityScore, crossDomainScore, presentation, assets };
  }

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
      const { compatibilityScore, presentation } = await this.computeGatedComposite({
        chronicResult,
        mfrResult,
        mentalResult,
        maleManual,
        femaleManual,
        sharedLifestyle
      });

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

      // (visual assets are already embedded onto presentation.report_assets inside computeGatedComposite)

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
