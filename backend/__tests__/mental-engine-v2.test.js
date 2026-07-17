// Regression net for the v2.0 mental-wellbeing engine rewrite (see
// contexts/mental_health_engine_update.md §5 "Acceptance checks" — every
// test below is named after the check it verifies). The LLM narrative call
// inside computeMentalResult is stubbed to return its fallback object
// untouched: these tests are about the deterministic scoring math (pillars,
// attachment, agreement), not the AI-generated strengths/discussion copy,
// and a real network call per test would make this suite slow, flaky, and
// dependent on a live OPENROUTER_API_KEY.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const llmService = require('../src/services/llm.service');
const originalGenerateStructuredInsight = llmService.generateStructuredInsight;
llmService.generateStructuredInsight = async (_messages, fallbackObj) => fallbackObj;
test.after(() => {
  llmService.generateStructuredInsight = originalGenerateStructuredInsight;
});

const {
  computeMentalResult,
  REQUIRED_MENTAL_FIELDS,
  NUMERIC_AGREEMENT_FIELDS,
  scaleAgreeablenessConscientiousness
} = require('../src/controllers/mental.controller');

// A fully-answered, neutral (all-midpoint) baseline — every field present so
// isMentalQuestionnaireComplete-style callers would treat it as real, with
// every 1-5 answer at the true midpoint (3) and 'Low' substance risk. Tests
// override only the fields they care about, spreading this as a base so an
// unrelated field never accidentally starves a pillar's average.
const NEUTRAL_ANSWERS = {
  emotional_wellbeing: 3, stress_worry: 3, life_stress_capacity: 3,
  personality_openness: 3, personality_conscientiousness: 3, personality_extraversion: 3, personality_agreeableness: 3, personality_stability: 3,
  attachment_anxiety_1: 3, attachment_anxiety_2: 3, attachment_anxiety_3: 3,
  attachment_avoidance_1: 3, attachment_avoidance_2: 3, attachment_avoidance_3: 3,
  readiness_communication: 3, readiness_conflict: 3, readiness_trust: 3, readiness_commitment: 3, readiness_support: 3,
  career_alignment: 3, relocation_openness: 3, financial_alignment: 3, lifestyle_alignment: 3,
  family_expectations: 3, parenting_alignment: 3,
  substance_concern: 'Low', anger_regulation: 3
};

test('§5.1 — 27 total items, pillar weights sum to 100', async (t) => {
  await t.test('REQUIRED_MENTAL_FIELDS has exactly 27 entries', () => {
    assert.strictEqual(REQUIRED_MENTAL_FIELDS.length, 27);
  });

  await t.test('a couple maxed on every pillar scores a perfect 100 overall (weights sum to exactly 1.00)', async () => {
    // Each field set to whatever value maximizes ITS pillar's quality
    // (agreeableness/conscientiousness peak at 4, not 5; life/family items
    // are clarity-scored so 1 or 5 both max out) — if the six pillar weights
    // didn't sum to exactly 100, an all-100-quality input could not itself
    // produce a rounded overall score of 100.
    const maxed = {
      ...NEUTRAL_ANSWERS,
      emotional_wellbeing: 5, stress_worry: 5, life_stress_capacity: 5,
      personality_conscientiousness: 4, personality_agreeableness: 4, personality_stability: 5,
      attachment_anxiety_1: 1, attachment_anxiety_2: 1, attachment_anxiety_3: 1,
      attachment_avoidance_1: 1, attachment_avoidance_2: 1, attachment_avoidance_3: 1,
      readiness_communication: 5, readiness_conflict: 5, readiness_trust: 5, readiness_commitment: 5, readiness_support: 5,
      career_alignment: 5, relocation_openness: 5, financial_alignment: 5, lifestyle_alignment: 5,
      family_expectations: 5, parenting_alignment: 5,
      substance_concern: 'Low', anger_regulation: 5
    };
    const result = await computeMentalResult(maxed, maxed);
    assert.strictEqual(result.overall_readiness.partner_A_overall, 100);
    assert.strictEqual(result.overall_readiness.partner_B_overall, 100);
    assert.strictEqual(result.overall_readiness.score, 100);
    assert.strictEqual(result.overall_readiness.label, 'Highly Aligned');
  });
});

test('§5.2 — attachment_style is fully removed, no code path references it', () => {
  assert.ok(!REQUIRED_MENTAL_FIELDS.includes('attachment_style'));
  const src = fs.readFileSync(path.join(__dirname, '../src/controllers/mental.controller.js'), 'utf8');
  assert.ok(!src.includes('attachment_style'), 'mental.controller.js still references the removed attachment_style field');
});

test('§5.3 — both partners parenting_alignment=1 scores high family quality (clarity) AND high agreement, not penalized', async () => {
  const answers = { ...NEUTRAL_ANSWERS, family_expectations: 1, parenting_alignment: 1 };
  const result = await computeMentalResult(answers, answers);
  assert.strictEqual(result.pillar_scores.familyParentingAlignment.A, 100);
  assert.strictEqual(result.pillar_scores.familyParentingAlignment.B, 100);
  assert.strictEqual(result.overall_readiness.agreement_index, 92);
});

test('§5.4 — parenting_alignment=1 vs =5 keeps high individual clarity but drops agreement via the |A-B| diff', async () => {
  const pA = { ...NEUTRAL_ANSWERS, family_expectations: 1, parenting_alignment: 1 };
  const pB = { ...NEUTRAL_ANSWERS, family_expectations: 1, parenting_alignment: 5 };
  const result = await computeMentalResult(pA, pB);
  // Same individual clarity as §5.3 — an extreme-but-opposite stance is still a
  // clear, well-formed answer for each partner individually.
  assert.strictEqual(result.pillar_scores.familyParentingAlignment.A, 100);
  assert.strictEqual(result.pillar_scores.familyParentingAlignment.B, 100);
  // But the couple-level agreement (and therefore the headline, via min()) must
  // drop relative to §5.3's identical-answers case, because the two partners
  // actually disagree on a real, meaningful axis.
  assert.strictEqual(result.overall_readiness.agreement_index, 89);
  assert.ok(result.overall_readiness.agreement_index < 92);
});

test('§5.5 — anxious+avoidant (pursue-withdraw) couple scores lower attachment agreement than equally-insecure-but-non-complementary partners', async () => {
  const secure = { ...NEUTRAL_ANSWERS,
    attachment_anxiety_1: 1, attachment_anxiety_2: 1, attachment_anxiety_3: 1,
    attachment_avoidance_1: 1, attachment_avoidance_2: 1, attachment_avoidance_3: 1 };
  const bothAnxious = { ...NEUTRAL_ANSWERS,
    attachment_anxiety_1: 5, attachment_anxiety_2: 5, attachment_anxiety_3: 5,
    attachment_avoidance_1: 1, attachment_avoidance_2: 1, attachment_avoidance_3: 1 };
  const avoidant = { ...NEUTRAL_ANSWERS,
    attachment_anxiety_1: 1, attachment_anxiety_2: 1, attachment_anxiety_3: 1,
    attachment_avoidance_1: 5, attachment_avoidance_2: 5, attachment_avoidance_3: 5 };

  const secureResult = await computeMentalResult(secure, secure);
  const nonComplementaryResult = await computeMentalResult(bothAnxious, bothAnxious); // both anxious, same way — not pursue/withdraw
  const pursueWithdrawResult = await computeMentalResult(bothAnxious, avoidant); // one anxious, one avoidant — complementary

  // Individual attachment security is IDENTICAL in the last two scenarios
  // (each partner is just as insecure in isolation) — only the pairing pattern
  // differs, isolating the pursue-withdraw penalty specifically.
  assert.strictEqual(nonComplementaryResult.individual_profiles.partner_A.attachment.security, pursueWithdrawResult.individual_profiles.partner_A.attachment.security);

  assert.ok(secureResult.overall_readiness.agreement_index > nonComplementaryResult.overall_readiness.agreement_index);
  assert.ok(nonComplementaryResult.overall_readiness.agreement_index > pursueWithdrawResult.overall_readiness.agreement_index,
    'an anxious+avoidant pair must score visibly lower attachment agreement than two equally-insecure but non-complementary partners');
});

test('§5.6 — personality_agreeableness/conscientiousness peak at option 4 (100), not the extreme option 5 (70)', () => {
  assert.strictEqual(scaleAgreeablenessConscientiousness(4), 100);
  assert.strictEqual(scaleAgreeablenessConscientiousness(5), 70);
});

test('§5.7 — numeric agreement denominator is exactly the 20 non-attachment items, and relocation_openness is one of them', async () => {
  assert.strictEqual(NUMERIC_AGREEMENT_FIELDS.length, 20);
  assert.ok(NUMERIC_AGREEMENT_FIELDS.includes('relocation_openness'));
  for (const attachmentField of ['attachment_anxiety_1', 'attachment_anxiety_2', 'attachment_anxiety_3', 'attachment_avoidance_1', 'attachment_avoidance_2', 'attachment_avoidance_3']) {
    assert.ok(!NUMERIC_AGREEMENT_FIELDS.includes(attachmentField));
  }
  assert.ok(!NUMERIC_AGREEMENT_FIELDS.includes('substance_concern'));

  // Behavioral proof it's actually wired in (not just present in the list):
  // disagreeing only on relocation_openness must move the agreement_index
  // relative to an otherwise-identical baseline.
  const baseline = await computeMentalResult(NEUTRAL_ANSWERS, NEUTRAL_ANSWERS);
  const disagreeing = await computeMentalResult(
    { ...NEUTRAL_ANSWERS, relocation_openness: 1 },
    { ...NEUTRAL_ANSWERS, relocation_openness: 5 }
  );
  assert.ok(disagreeing.overall_readiness.agreement_index < baseline.overall_readiness.agreement_index);
});

test('§5.8 — missing attachment items and missing substance tier both fail CLOSED (midpoint/worst), never best-case', async () => {
  const pAMissingAttachment = { ...NEUTRAL_ANSWERS };
  delete pAMissingAttachment.attachment_anxiety_1;
  delete pAMissingAttachment.attachment_anxiety_2;
  delete pAMissingAttachment.attachment_anxiety_3;
  delete pAMissingAttachment.attachment_avoidance_1;
  delete pAMissingAttachment.attachment_avoidance_2;
  delete pAMissingAttachment.attachment_avoidance_3;

  const result = await computeMentalResult(pAMissingAttachment, NEUTRAL_ANSWERS);
  // Midpoint (3) fallback -> security 50, NOT 100 (which is what defaulting to
  // the most-secure answer, 1, would have produced).
  assert.strictEqual(result.individual_profiles.partner_A.attachment.security, 50);

  const pAMissingSubstance = { ...NEUTRAL_ANSWERS };
  delete pAMissingSubstance.substance_concern;
  const resultB = await computeMentalResult(pAMissingSubstance, NEUTRAL_ANSWERS);
  // subMap[undefined] ?? 10 (Elevated tier) -> riskScore = avg(10, 50) = 30,
  // never avg(100, 50) = 75 (which is what fail-open-to-best-case would give).
  assert.strictEqual(resultB.pillar_scores.riskFactors.A, 30);
});
