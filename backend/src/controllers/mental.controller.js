const { db } = require('../services/storage/postgres.service');
const reportGenerationService = require('../services/compatibility/reportGeneration.service');
const logger = require('../utils/logger');

// Helper to scale 1-5 score to 0-100
const scaleTo100 = (val) => Math.max(0, Math.min(100, (parseFloat(val) - 1) * 25));

// WS1C02: agreeableness/conscientiousness were scored with the same strict
// linear scaleTo100 as every other item, treating an extreme answer (5 —
// "Always put others first" / "Everything scheduled, no surprises") as the best
// possible score. The research doc this app itself cites (Malouff et al. 2010,
// J Res Pers 44(1):124-127) frames the extreme pole of these two traits as a
// relationship risk (over-deference, rigidity), not the optimum — a strong-but-
// not-extreme answer (4) is. This peaks at 4 and dips back down at the extreme
// 5, instead of climbing monotonically to it.
const scaleAgreeablenessConscientiousness = (val) => {
  const v = parseFloat(val);
  if (isNaN(v)) return 75; // matches the old || 4 fallback's scaleTo100(4)=75
  if (v <= 4) return Math.max(0, Math.min(100, (v - 1) * (100 / 3)));
  return 70; // v === 5: extreme pole, scored below the v=4 peak (100) but still above-average
};

// Helper to get average
const average = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;

// v2.0 (see contexts/mental_health_engine_update.md): preference items (life
// goals / family & parenting) aren't "higher = healthier" — someone who is
// firmly career-first and someone who firmly isn't are both making a clear,
// legitimate choice. What predicts friction is not having settled on a stance
// at all. clarity() scores distance from the undecided midpoint (3), so a
// confident 1 or 5 both score 100 and the genuine "still figuring it out"
// middle scores 0 — direction is left entirely to the couple-agreement |A-B|
// diff, not baked into individual quality.
const clarity = (val) => {
  const v = parseFloat(val ?? 3);
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(100, (Math.abs(v - 3) / 2) * 100));
};

// All 27 questions the mental-health survey asks. Every answer below has an
// `|| 4` (or `|| 3` for the six dimensional attachment items, or `|| 'Low'`)
// fallback purely so the *math* doesn't throw on a missing key — that
// fallback must never be reached for a real submission. This list is how we
// tell "a real, fully-answered survey" apart from "an empty or partial one
// that would otherwise silently score as if everyone answered positively
// across the board".
const REQUIRED_MENTAL_FIELDS = [
  'emotional_wellbeing', 'stress_worry', 'life_stress_capacity',
  'personality_openness', 'personality_conscientiousness', 'personality_extraversion', 'personality_agreeableness', 'personality_stability',
  'attachment_anxiety_1', 'attachment_anxiety_2', 'attachment_anxiety_3',
  'attachment_avoidance_1', 'attachment_avoidance_2', 'attachment_avoidance_3',
  'readiness_communication', 'readiness_conflict', 'readiness_trust', 'readiness_commitment', 'readiness_support',
  'career_alignment', 'relocation_openness', 'financial_alignment', 'lifestyle_alignment',
  'family_expectations', 'parenting_alignment',
  'substance_concern', 'anger_regulation'
];

// The couple-agreement field set (§2.5) — every 1-5 Likert item EXCEPT the 6
// attachment items, which are compared via attachmentCompatibility's
// dimensional model instead of a raw |A-B| (see computeMentalResult). Pulled
// out as its own top-level constant (rather than inlined in the function) so
// its exact membership/count is directly testable — this is exactly the field
// whose length going wrong (19 or 21 instead of 20) would silently mis-weight
// every couple's agreement score.
const NUMERIC_AGREEMENT_FIELDS = [
  'emotional_wellbeing', 'stress_worry', 'life_stress_capacity',
  'personality_openness', 'personality_conscientiousness', 'personality_extraversion', 'personality_agreeableness', 'personality_stability',
  'readiness_communication', 'readiness_conflict', 'readiness_trust', 'readiness_commitment', 'readiness_support',
  'career_alignment', 'relocation_openness', 'financial_alignment', 'lifestyle_alignment',
  'family_expectations', 'parenting_alignment',
  'anger_regulation'
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
  // Big Five comparison + Attachment (dimensional, v2.0)
  // WS1C02: openness/extraversion dropped from this per-partner QUALITY average —
  // the research doc this app itself cites (Malouff et al. 2010) finds no robust
  // link from either trait to marital satisfaction, so scoring "more of the trait"
  // as "healthier" here wasn't supported. Both remain in the couple-AGREEMENT
  // index below (fieldsToCompare) unaffected — comparing how similarly two
  // partners answered is a different question than scoring one answer "better."
  const traitQualityA = average([
    scaleAgreeablenessConscientiousness(pA.personality_conscientiousness || 4),
    scaleAgreeablenessConscientiousness(pA.personality_agreeableness || 4),
    scaleTo100(pA.personality_stability || 4)
  ]);
  const traitQualityB = average([
    scaleAgreeablenessConscientiousness(pB.personality_conscientiousness || 4),
    scaleAgreeablenessConscientiousness(pB.personality_agreeableness || 4),
    scaleTo100(pB.personality_stability || 4)
  ]);
  const traitsA = {
    conscientiousness: scaleAgreeablenessConscientiousness(pA.personality_conscientiousness || 4),
    agreeableness: scaleAgreeablenessConscientiousness(pA.personality_agreeableness || 4),
    stability: scaleTo100(pA.personality_stability || 4)
  };
  const traitsB = {
    conscientiousness: scaleAgreeablenessConscientiousness(pB.personality_conscientiousness || 4),
    agreeableness: scaleAgreeablenessConscientiousness(pB.personality_agreeableness || 4),
    stability: scaleTo100(pB.personality_stability || 4)
  };

  // v2.0: the old single forced Secure/Anxious/Avoidant/Disorganized attachment
  // pick is replaced entirely by 6 indirect agree/disagree items scored as two
  // continuous dimensions (Experiences in Close Relationships-style: anxiety,
  // avoidance), per the psychologist review — a forced category couldn't tell a
  // mildly anxious partner from a severely anxious one, and collapsed two
  // independent axes into one label.
  //
  // A missing item defaults to the scale midpoint (3), never to 1 ("not like me
  // at all" — the most SECURE-reading answer) — an unanswered question must never
  // score as if it were the best possible case.
  const anxietyA = scaleTo100(average([pA.attachment_anxiety_1 || 3, pA.attachment_anxiety_2 || 3, pA.attachment_anxiety_3 || 3]));
  const avoidanceA = scaleTo100(average([pA.attachment_avoidance_1 || 3, pA.attachment_avoidance_2 || 3, pA.attachment_avoidance_3 || 3]));
  const insecurityA = (anxietyA + avoidanceA) / 2;
  const securityA = 100 - insecurityA; // per-partner attachment quality, used in the personality pillar below

  const anxietyB = scaleTo100(average([pB.attachment_anxiety_1 || 3, pB.attachment_anxiety_2 || 3, pB.attachment_anxiety_3 || 3]));
  const avoidanceB = scaleTo100(average([pB.attachment_avoidance_1 || 3, pB.attachment_avoidance_2 || 3, pB.attachment_avoidance_3 || 3]));
  const insecurityB = (anxietyB + avoidanceB) / 2;
  const securityB = 100 - insecurityB;

  // Couple-level attachment compatibility: a baseline from mutual security, with
  // an extra penalty when one partner runs anxious while the other runs
  // avoidant — the specific "pursue-withdraw" combination that drives friction
  // more than either trait alone, distinct from two partners who are both
  // simply somewhat insecure in the same direction.
  // ATTACHMENT_PURSUE_WITHDRAW_WEIGHT and the anxiety/avoidance mean used above
  // are tunable starting points (per the spec), kept as named constants rather
  // than inlined magic numbers so they're easy to retune from real outcome data
  // later without hunting through the formula.
  const ATTACHMENT_PURSUE_WITHDRAW_WEIGHT = 0.25;
  const baseSecurity = 100 - (insecurityA + insecurityB) / 2;
  const pursueWithdraw = Math.max(anxietyA * avoidanceB, anxietyB * avoidanceA) / 100;
  const attachmentCompatibility = Math.max(0, Math.min(100, baseSecurity - ATTACHMENT_PURSUE_WITHDRAW_WEIGHT * pursueWithdraw));

  let attachmentInsight;
  if (pursueWithdraw >= 50) {
    attachmentInsight = 'A pursue-withdraw pattern shows up here — one partner tends to seek closeness or reassurance while the other tends to create distance under stress. Naming this dynamic out loud, with explicit reassurance on one side and agreed space-with-a-return-plan on the other, tends to help.';
  } else if (baseSecurity >= 75) {
    attachmentInsight = 'Both partners lean secure — comfortable with closeness and able to self-regulate, which gives the relationship a stable emotional foundation.';
  } else if (baseSecurity >= 55) {
    attachmentInsight = 'A mostly secure attachment dynamic overall, with some room to build consistency and reassurance.';
  } else {
    attachmentInsight = 'Elevated attachment insecurity on one or both sides. Open conversation about the need for closeness versus space — rather than assuming it — tends to reduce friction here.';
  }

  const personalityScoreA = traitQualityA * 0.5 + securityA * 0.5;
  const personalityScoreB = traitQualityB * 0.5 + securityB * 0.5;

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
  // v2.0: these are PREFERENCE items, not "more = healthier" items — quality is
  // scored as clarity() (distance from the undecided midpoint), not scaleTo100().
  // Using scaleTo100() here would score someone who's genuinely, validly not
  // career-focused as low-quality, then unfairly cap the couple headline via the
  // min() in the readiness calc below. relocation_openness is new in v2.0, split
  // out of the old combined career_alignment item so career focus and
  // willingness to relocate can be judged (and mismatched) independently.
  const lifeScoreA = average([
    clarity(pA.career_alignment || 3),
    clarity(pA.relocation_openness || 3),
    clarity(pA.financial_alignment || 3),
    clarity(pA.lifestyle_alignment || 3)
  ]);
  const lifeScoreB = average([
    clarity(pB.career_alignment || 3),
    clarity(pB.relocation_openness || 3),
    clarity(pB.financial_alignment || 3),
    clarity(pB.lifestyle_alignment || 3)
  ]);

  // ────────────────────────────────────────────────────────
  // PILLAR 5: Family & Parenting Alignment (15%)
  // ────────────────────────────────────────────────────────
  // v2.0: also preference items — clarity(), not scaleTo100(), for the same
  // reason as Pillar 4. parenting_alignment now runs on a directional stance
  // (definitely-no ... definitely-yes) instead of a confusing "certainty of an
  // undecided position" scale, so a firm "I don't want children" (1) correctly
  // scores as high-clarity, not as if it were a poorly-answered question.
  const famScoreA = average([
    clarity(pA.family_expectations || 3),
    clarity(pA.parenting_alignment || 3)
  ]);
  const famScoreB = average([
    clarity(pB.family_expectations || 3),
    clarity(pB.parenting_alignment || 3)
  ]);

  // ────────────────────────────────────────────────────────
  // PILLAR 6: Risk Factors (10%) - Higher score means LOWER risk / higher composition
  // ────────────────────────────────────────────────────────
  const subMap = { 'Low': 100, 'Moderate': 50, 'Elevated': 10 };
  // WS1C06: subMap[key] || 100 fails open twice — a missing substance_concern AND
  // any unrecognized/mistyped value (a future enum drift, wrong casing) both fell
  // through to 100, the best possible score, on a risk-specific field. `?? 10`
  // (the 'Elevated' score) makes both cases fail toward the worst reading instead,
  // per the review's fail-safe-for-risk-fields recommendation.
  const subValA = subMap[pA.substance_concern] ?? 10;
  const subValB = subMap[pB.substance_concern] ?? 10;

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
  // WS1C05: anger_regulation is numeric (1-5, like every field below) but was
  // deliberately left out of this comparison — added here as one more field.
  // v2.0: relocation_openness (new item) joins NUMERIC_AGREEMENT_FIELDS above;
  // the 6 attachment items are deliberately excluded from it — they're compared
  // via attachmentCompatibility's dimensional model below instead of a raw
  // |A-B|, since two partners who both answer "3" on every attachment item
  // aren't actually in agreement about anything meaningful the way two
  // partners both answering "3" on, say, financial_alignment are. This is
  // exactly 20 fields (see acceptance check §5.7 in the spec) — 3 emotional +
  // 5 personality + 5 readiness + 4 life/career + 2 family + 1 anger,
  // deliberately not 19 or 21.
  const fieldsToCompare = NUMERIC_AGREEMENT_FIELDS;
  let totalDiff = 0;
  fieldsToCompare.forEach(f => {
    const valA = parseFloat(pA[f] || 4);
    const valB = parseFloat(pB[f] || 4);
    totalDiff += Math.abs(valA - valB);
  });
  // Max diff is 4 per question. Map average difference out of 4 to an agreement index.
  const avgDiff = totalDiff / fieldsToCompare.length;
  const numericAgreementIndex = Math.max(0, 100 - avgDiff * 20);

  // WS1C04/05: attachment and substance_concern can't join the |A-B| numeric
  // diff above (attachment is now a dimensional model, not a single number;
  // substance_concern is categorical) — but excluding them entirely from the
  // headline meant the single best-replicated relationship predictor in the
  // underlying research doc (attachment style, per Li & Chan 2012) and a
  // substance-use mismatch both moved nothing a user sees: an anxious+avoidant
  // couple and a fully-secure couple with identical numeric answers both scored
  // compatibilityIndex=100. attachmentCompatibility (computed above in Pillar 2,
  // §2.3 of the spec — mutual security with a pursue-withdraw penalty) is
  // already a 0-100 couple-agreement score, reused here directly rather than
  // re-deriving a second attachment number. substanceAgreement is the
  // equivalent couple-level construct for substance_concern: a linear 0-100
  // scale over ordinal distance between tiers (same tier -> 100, adjacent tier
  // -> 50, opposite ends, e.g. Low vs Elevated -> 0) — unrecognized/missing
  // values rank as 'Elevated' (the worst tier), matching WS1C06's
  // fail-safe-for-risk-fields policy rather than silently reading as agreement.
  const SUBSTANCE_RANK = { Low: 0, Moderate: 1, Elevated: 2 };
  const MAX_SUBSTANCE_RANK_DIFF = 2;
  const subRankA = SUBSTANCE_RANK[pA.substance_concern] ?? SUBSTANCE_RANK.Elevated;
  const subRankB = SUBSTANCE_RANK[pB.substance_concern] ?? SUBSTANCE_RANK.Elevated;
  const substanceAgreement = 100 - (Math.abs(subRankA - subRankB) / MAX_SUBSTANCE_RANK_DIFF) * 100;

  const compatibilityIndex = Math.round(
    numericAgreementIndex * 0.70 +
    attachmentCompatibility * 0.15 +
    substanceAgreement * 0.15
  );

  // WS1C01: compatibilityIndex measures agreement only (|answerA-answerB|) — two
  // partners who both floor every answer agree with each other perfectly and score
  // "100 Highly Aligned", identical to two partners who both answer at ceiling.
  // overallScoreA/B (computed above, per-partner quality across emotional/
  // personality/readiness/life/family/risk pillars) already exist and already go
  // unused for the headline. The headline now can never exceed what per-partner
  // quality justifies — real agreement still matters (it's the other side of the
  // min), but can no longer stand alone as an unqualified positive.
  const qualityMean = (overallScoreA + overallScoreB) / 2;
  const overallReadinessScore = Math.round(Math.min(compatibilityIndex, qualityMean));

  let overallLabel = 'Highly Aligned';
  if (overallReadinessScore < 60) overallLabel = 'Discussion Recommended';
  else if (overallReadinessScore < 80) overallLabel = 'Moderate Alignment';

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
Attachment Pattern: Partner A anxiety ${Math.round(anxietyA)}/100, avoidance ${Math.round(avoidanceA)}/100; Partner B anxiety ${Math.round(anxietyB)}/100, avoidance ${Math.round(avoidanceB)}/100. Pursue-withdraw dynamic ${pursueWithdraw >= 50 ? 'is present (one partner anxious, the other avoidant)' : 'is not prominent'}.
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
      score: overallReadinessScore,
      label: overallLabel,
      agreement_index: compatibilityIndex,
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
        personality: traitsA,
        attachment: { anxiety: Math.round(anxietyA), avoidance: Math.round(avoidanceA), security: Math.round(securityA) },
        raw_answers: pA
      },
      partner_B: {
        emotional_health: emoLabelsB,
        personality: traitsB,
        attachment: { anxiety: Math.round(anxietyB), avoidance: Math.round(avoidanceB), security: Math.round(securityB) },
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
        error: 'Complete questionnaire responses (all 27 questions) for both partners are required.'
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
  isMentalQuestionnaireComplete,
  REQUIRED_MENTAL_FIELDS,
  NUMERIC_AGREEMENT_FIELDS,
  scaleTo100,
  scaleAgreeablenessConscientiousness,
  clarity
};
