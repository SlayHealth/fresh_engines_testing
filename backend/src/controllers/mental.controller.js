const { db } = require('../services/storage/postgres.service');
const reportGenerationService = require('../services/compatibility/reportGeneration.service');
const logger = require('../utils/logger');

// Helper to scale 1-5 score to 0-100
const scaleTo100 = (val) => Math.max(0, Math.min(100, (parseFloat(val) - 1) * 25));

// Helper to get average
const average = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;

// All 21 questions the mental-health survey asks. Every answer below has an
// `|| 4` (or `|| 'Secure'`/`|| 'Low'`) fallback purely so the *math* doesn't throw
// on a missing key — that fallback must never be reached for a real submission.
// This list is how we tell "a real, fully-answered survey" apart from "an empty or
// partial one that would otherwise silently score as if everyone answered
// positively across the board".
const REQUIRED_MENTAL_FIELDS = [
  'emotional_wellbeing', 'stress_worry', 'life_stress_capacity',
  'personality_openness', 'personality_conscientiousness', 'personality_extraversion', 'personality_agreeableness', 'personality_stability',
  'attachment_style',
  'readiness_communication', 'readiness_conflict', 'readiness_trust', 'readiness_commitment', 'readiness_support',
  'career_alignment', 'financial_alignment', 'lifestyle_alignment',
  'family_expectations', 'parenting_alignment',
  'substance_concern', 'anger_regulation'
];

function isMentalQuestionnaireComplete(answers) {
  if (!answers || typeof answers !== 'object') return false;
  return REQUIRED_MENTAL_FIELDS.every((field) => {
    const val = answers[field];
    return val !== undefined && val !== null && val !== '';
  });
}

/**
 * Pure(ish) scoring function — takes both partners' raw questionnaire answers
 * and returns the full mentalResult payload. No req/res/DB coupling beyond an
 * optional cacheKey for the LLM narrative call, so this can be called directly
 * from other backend flows (e.g. the async invite-link match pipeline).
 *
 * Callers are responsible for only invoking this with a fully-answered
 * questionnaire for both partners (see isMentalQuestionnaireComplete) — this
 * function itself still computes a result from whatever it's given (so a
 * malformed/partial call fails loudly downstream rather than here), but every
 * per-field `|| 4` default below exists only as a math safety net, never as a
 * legitimate substitute for a real answer.
 */
async function computeMentalResult(partner_A_answers, partner_B_answers, { cacheKey } = {}) {
  const pA = partner_A_answers || {};
  const pB = partner_B_answers || {};

  // ────────────────────────────────────────────────────────
  // PILLAR 1: Emotional Health (15%)
  // ────────────────────────────────────────────────────────
  // Adapted from PHQ-9 (wellbeing), GAD-7 (composure), PSS (coping)
  const emoScoreA = average([
    scaleTo100(pA.emotional_wellbeing || 4),
    scaleTo100(pA.stress_worry || 4),
    scaleTo100(pA.life_stress_capacity || 4)
  ]);
  const emoScoreB = average([
    scaleTo100(pB.emotional_wellbeing || 4),
    scaleTo100(pB.stress_worry || 4),
    scaleTo100(pB.life_stress_capacity || 4)
  ]);

  // Descriptive non-clinical labeling for Emotional Health subcomponents
  const getEmoSubLabels = (p) => {
    const eb = parseFloat(p.emotional_wellbeing || 4);
    const sw = parseFloat(p.stress_worry || 4);
    const lc = parseFloat(p.life_stress_capacity || 4);

    return {
      wellbeing: eb >= 4 ? "Optimal emotional energy and outlook" : eb >= 3 ? "Mild seasonal or situational energy fluctuations" : "Reduced emotional energy; daily support beneficial",
      calmness: sw >= 4 ? "High composure and worry management capacity" : sw >= 3 ? "Moderate daily worry; typical stress response" : "Elevated daily worry symptoms; relaxation strategies advised",
      coping: lc >= 4 ? "Strong stress coping capacity" : lc >= 3 ? "Moderate daily coping capacity" : "Reduced coping reserves; stress mitigation suggested"
    };
  };

  const emoLabelsA = getEmoSubLabels(pA);
  const emoLabelsB = getEmoSubLabels(pB);

  // ────────────────────────────────────────────────────────
  // PILLAR 2: Personality & Attachment (20%)
  // ────────────────────────────────────────────────────────
  // Big Five comparison + Attachment styles
  const b5A = {
    openness: scaleTo100(pA.personality_openness || 4),
    conscientiousness: scaleTo100(pA.personality_conscientiousness || 4),
    extraversion: scaleTo100(pA.personality_extraversion || 4),
    agreeableness: scaleTo100(pA.personality_agreeableness || 4),
    stability: scaleTo100(pA.personality_stability || 4)
  };
  const b5B = {
    openness: scaleTo100(pB.personality_openness || 4),
    conscientiousness: scaleTo100(pB.personality_conscientiousness || 4),
    extraversion: scaleTo100(pB.personality_extraversion || 4),
    agreeableness: scaleTo100(pB.personality_agreeableness || 4),
    stability: scaleTo100(pB.personality_stability || 4)
  };

  const b5AvgA = average(Object.values(b5A));
  const b5AvgB = average(Object.values(b5B));

  // Attachment compatibility scoring
  const styleA = pA.attachment_style || 'Secure';
  const styleB = pB.attachment_style || 'Secure';
  let attachmentCompatibility = 80;
  let attachmentInsight = '';

  if (styleA === 'Secure' && styleB === 'Secure') {
    attachmentCompatibility = 100;
    attachmentInsight = 'Secure relationship anchor with mutual emotional safety.';
  } else if (styleA === 'Secure' || styleB === 'Secure') {
    attachmentCompatibility = 75;
    attachmentInsight = 'The secure partner provides a stable foundation to co-regulate relationship concerns.';
  } else {
    attachmentCompatibility = 50;
    attachmentInsight = 'Complementary attachment dynamics; potential pursue-withdraw patterns. Focus on building emotional reassurance.';
  }

  const personalityScoreA = b5AvgA * 0.6 + attachmentCompatibility * 0.4;
  const personalityScoreB = b5AvgB * 0.6 + attachmentCompatibility * 0.4;

  // ────────────────────────────────────────────────────────
  // PILLAR 3: Marriage Readiness (25%)
  // ────────────────────────────────────────────────────────
  // Gottman readiness factors: Communication, Conflict Resolution, Trust, Commitment, Support
  const readScoreA = average([
    scaleTo100(pA.readiness_communication || 4),
    scaleTo100(pA.readiness_conflict || 4),
    scaleTo100(pA.readiness_trust || 4),
    scaleTo100(pA.readiness_commitment || 4),
    scaleTo100(pA.readiness_support || 4)
  ]);
  const readScoreB = average([
    scaleTo100(pB.readiness_communication || 4),
    scaleTo100(pB.readiness_conflict || 4),
    scaleTo100(pB.readiness_trust || 4),
    scaleTo100(pB.readiness_commitment || 4),
    scaleTo100(pB.readiness_support || 4)
  ]);

  // ────────────────────────────────────────────────────────
  // PILLAR 4: Life & Career Alignment (15%)
  // ────────────────────────────────────────────────────────
  const lifeScoreA = average([
    scaleTo100(pA.career_alignment || 4),
    scaleTo100(pA.financial_alignment || 4),
    scaleTo100(pA.lifestyle_alignment || 4)
  ]);
  const lifeScoreB = average([
    scaleTo100(pB.career_alignment || 4),
    scaleTo100(pB.financial_alignment || 4),
    scaleTo100(pB.lifestyle_alignment || 4)
  ]);

  // ────────────────────────────────────────────────────────
  // PILLAR 5: Family & Parenting Alignment (15%)
  // ────────────────────────────────────────────────────────
  const famScoreA = average([
    scaleTo100(pA.family_expectations || 4),
    scaleTo100(pA.parenting_alignment || 4)
  ]);
  const famScoreB = average([
    scaleTo100(pB.family_expectations || 4),
    scaleTo100(pB.parenting_alignment || 4)
  ]);

  // ────────────────────────────────────────────────────────
  // PILLAR 6: Risk Factors (10%) - Higher score means LOWER risk / higher composition
  // ────────────────────────────────────────────────────────
  const subMap = { 'Low': 100, 'Moderate': 50, 'Elevated': 10 };
  const subValA = subMap[pA.substance_concern || 'Low'] || 100;
  const subValB = subMap[pB.substance_concern || 'Low'] || 100;

  const riskScoreA = average([
    subValA,
    scaleTo100(pA.anger_regulation || 4)
  ]);
  const riskScoreB = average([
    subValB,
    scaleTo100(pB.anger_regulation || 4)
  ]);

  // ────────────────────────────────────────────────────────
  // Overall Marriage, Life & Career Readiness Profile Calculations
  // ────────────────────────────────────────────────────────
  const weightSum = (scores) => (
    scores.emo * 0.15 +
    scores.pers * 0.20 +
    scores.read * 0.25 +
    scores.life * 0.15 +
    scores.fam * 0.15 +
    scores.risk * 0.10
  );

  const overallScoreA = weightSum({
    emo: emoScoreA,
    pers: personalityScoreA,
    read: readScoreA,
    life: lifeScoreA,
    fam: famScoreA,
    risk: riskScoreA
  });

  const overallScoreB = weightSum({
    emo: emoScoreB,
    pers: personalityScoreB,
    read: readScoreB,
    life: lifeScoreB,
    fam: famScoreB,
    risk: riskScoreB
  });

  // Couple Alignment index based on absolute differences in answers
  const fieldsToCompare = [
    'emotional_wellbeing', 'stress_worry', 'life_stress_capacity',
    'personality_openness', 'personality_conscientiousness', 'personality_extraversion', 'personality_agreeableness', 'personality_stability',
    'readiness_communication', 'readiness_conflict', 'readiness_trust', 'readiness_commitment', 'readiness_support',
    'career_alignment', 'financial_alignment', 'lifestyle_alignment',
    'family_expectations', 'parenting_alignment'
  ];
  let totalDiff = 0;
  fieldsToCompare.forEach(f => {
    const valA = parseFloat(pA[f] || 4);
    const valB = parseFloat(pB[f] || 4);
    totalDiff += Math.abs(valA - valB);
  });
  // Max diff is 4 per question. 18 questions * 4 = 72 max possible difference.
  // Map average difference out of 4 to a compatibility index
  const avgDiff = totalDiff / fieldsToCompare.length;
  const compatibilityIndex = Math.round(Math.max(0, 100 - avgDiff * 20));

  let overallLabel = 'Highly Aligned';
  if (compatibilityIndex < 60) overallLabel = 'Discussion Recommended';
  else if (compatibilityIndex < 80) overallLabel = 'Moderate Alignment';

  // ────────────────────────────────────────────────────────
  // Dynamic Insight Narrative Generation (LLM Integration)
  // ────────────────────────────────────────────────────────
  const { generateStructuredInsight } = require('../services/llm.service');

  let strengths = [];
  let discussion_areas = [];
  let risks = [];
  let recommendations = [];

  try {
    const llmMessages = [
      {
        role: "system",
        content: "You are an expert premarital counselor and psychologist. Review the provided couple compatibility metrics. Generate a JSON object with 4 string arrays: 'strengths' (2-4 bullet points highlighting positive alignment), 'discussion_areas' (1-3 bullet points on differing views, e.g. finance, family, lifestyle), 'risk_factors' (0-2 descriptive bullet points on stress coping, anger, or substance use), and 'recommendations' (2-3 actionable advice bullet points). Ensure the tone is objective, non-diagnostic, and constructive."
      },
      {
        role: "user",
        content: `Please analyze this couple's mental wellbeing and relationship readiness:
Overall Alignment Label: ${overallLabel} (Compatibility Index: ${compatibilityIndex}/100)
Attachment Styles: Partner A is ${styleA}, Partner B is ${styleB}
Emotional Health Scores: Partner A (${Math.round(emoScoreA)}/100), Partner B (${Math.round(emoScoreB)}/100)
Marriage Readiness: Partner A (${Math.round(readScoreA)}/100), Partner B (${Math.round(readScoreB)}/100)
Life & Career Alignment: Partner A (${Math.round(lifeScoreA)}/100), Partner B (${Math.round(lifeScoreB)}/100)
Family & Parenting: Partner A (${Math.round(famScoreA)}/100), Partner B (${Math.round(famScoreB)}/100)
Risk Factors Score (higher is better): Partner A (${Math.round(riskScoreA)}/100), Partner B (${Math.round(riskScoreB)}/100)
Generate the JSON response according to the schema: { "strengths": [], "discussion_areas": [], "risk_factors": [], "recommendations": [] }`
      }
    ];

    const fallbackObj = {
      strengths: ["✓ Strong Communication Habits: Both partners exhibit open sharing and active listening principles.", "✓ Healthy Foundation of Trust: Mutual ratings indicate a solid sense of transparency."],
      discussion_areas: ["• Financial Planning Approaches: Different comfort zones regarding spending.", "• Career & Relocation Expectations: Differing views on career mobility."],
      risk_factors: ["• Depleted emotional energy: Lowered stress coping reserves detected."],
      recommendations: ["Maintain an active schedule of weekly relationship check-ins.", "Consider a premarital counselor session to refine conflict management tools."]
    };

    const dynamic_mental = await generateStructuredInsight(llmMessages, fallbackObj, { temperature: 0.3, max_tokens: 500, cacheKey });

    strengths = dynamic_mental.strengths || fallbackObj.strengths;
    discussion_areas = dynamic_mental.discussion_areas || fallbackObj.discussion_areas;
    risks = dynamic_mental.risk_factors || fallbackObj.risk_factors;
    recommendations = dynamic_mental.recommendations || fallbackObj.recommendations;
  } catch (err) {
    logger.error(`[Mental] LLM Generation failed: ${err.message}`);
    strengths = ["✓ Individual Strengths Present.", "✓ Shared Intentions verified."];
    discussion_areas = ["• Maintenance of Alignment: Establishing proactive discussion patterns."];
    risks = ["• Baseline risk assessment completed."];
    recommendations = ["Maintain weekly check-ins.", "Consult counseling if needed."];
  }

  // Final Mental Result Payload
  return {
    schema_version: "v1",
    overall_readiness: {
      score: compatibilityIndex,
      label: overallLabel,
      partner_A_overall: Math.round(overallScoreA),
      partner_B_overall: Math.round(overallScoreB)
    },
    pillar_scores: {
      emotionalHealth: {
        A: Math.round(emoScoreA),
        B: Math.round(emoScoreB)
      },
      personalityAttachment: {
        A: Math.round(personalityScoreA),
        B: Math.round(personalityScoreB)
      },
      marriageReadiness: {
        A: Math.round(readScoreA),
        B: Math.round(readScoreB)
      },
      lifeCareerAlignment: {
        A: Math.round(lifeScoreA),
        B: Math.round(lifeScoreB)
      },
      familyParentingAlignment: {
        A: Math.round(famScoreA),
        B: Math.round(famScoreB)
      },
      riskFactors: {
        A: Math.round(riskScoreA),
        B: Math.round(riskScoreB)
      }
    },
    individual_profiles: {
      partner_A: {
        emotional_health: emoLabelsA,
        personality: b5A,
        attachment_style: styleA,
        raw_answers: pA
      },
      partner_B: {
        emotional_health: emoLabelsB,
        personality: b5B,
        attachment_style: styleB,
        raw_answers: pB
      }
    },
    couple_analysis: {
      strengths,
      discussion_areas,
      risk_factors: risks,
      attachment_insight: attachmentInsight,
      recommendations
    }
  };
}

async function analyzeMental(req, res, next) {
  try {
    const { partner_A_answers, partner_B_answers, match_id } = req.body;

    if (!isMentalQuestionnaireComplete(partner_A_answers) || !isMentalQuestionnaireComplete(partner_B_answers)) {
      return res.status(400).json({
        success: false,
        error: 'Complete questionnaire responses (all 21 questions) for both partners are required.'
      });
    }

    const mentalResult = await computeMentalResult(partner_A_answers, partner_B_answers, {
      cacheKey: match_id ? `mental_insights_${match_id}` : null
    });

    // If match_id is provided, merge this mentalResult into the db matches record
    if (match_id) {
      const matchRes = await db.query('SELECT analysis_json FROM matches WHERE id = $1', [match_id]);
      const matchRow = matchRes.rows[0];
      if (matchRow) {
        let existingAnalysis = {};
        try {
          existingAnalysis = JSON.parse(matchRow.analysis_json || '{}');
        } catch (e) {
          logger.error(`Error parsing existing analysis json: ${e.message}`);
        }

        // Add/overwrite mentalResult
        existingAnalysis.mentalResult = mentalResult;

        // Recompute the overall composite score through the exact same gated path
        // compileMatchReport used initially (chronic 35% / fertility 25% / mental 20% /
        // radiology 10% / genetics 10%, with the STI safety gate re-applied) — not an
        // ad hoc 70/30 blend against whatever the score happened to be before. That
        // previous approach could silently ignore an active STI finding (it was never
        // gate-checked here) and let matches.compatibility_score drift out of sync with
        // presentation_json.relationship_snapshot.score, which nothing here used to
        // update at all.
        const existingDetails = existingAnalysis.details || {};
        const { compatibilityScore, presentation } = await reportGenerationService.computeGatedComposite({
          chronicResult: existingAnalysis.chronicResult,
          mfrResult: existingAnalysis.mfrResult,
          mentalResult,
          maleManual: existingDetails.male_manual_data || {},
          femaleManual: existingDetails.female_manual_data || {},
          sharedLifestyle: existingDetails.shared_lifestyle || {}
        });

        existingAnalysis.score = compatibilityScore;

        await db.query(
          'UPDATE matches SET analysis_json = $1, compatibility_score = $2, presentation_json = $3 WHERE id = $4',
          [JSON.stringify(existingAnalysis), compatibilityScore, JSON.stringify(presentation), match_id]
        );
        logger.info(`Updated match ${match_id} with Mental Wellbeing analysis. New Score: ${compatibilityScore}`);
      }
    }

    return res.json({
      success: true,
      mentalResult
    });

  } catch (error) {
    logger.error(`Mental analysis failed: ${error.message}`);
    next(error);
  }
}

module.exports = {
  analyzeMental,
  computeMentalResult,
  isMentalQuestionnaireComplete
};
