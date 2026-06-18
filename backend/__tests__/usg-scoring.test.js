const test = require('node:test');
const assert = require('node:assert');
const {
  liverScore,
  prostateScore,
  femaleReproductiveScore,
  gallbladderScore,
  kidneyScore,
  bladderScore,
  compositeScore,
  calculateMetabolicHealthIndex,
  generateRiskFlags,
  generateCoupleInsights,
  calculateNuptiaScoreContribution
} = require('../src/controllers/usg.controller');

// Fixtures
const F_KARTIKAY = {
  patient: { name: 'Kartikay Bajaj', age_years: 24, sex: 'Male' },
  findings: {
    liver: { hepatomegaly: true, fatty_grade: 2 },
    gallbladder: { present: true, calculi_present: false },
    pancreas: { size_normal: true, echotexture_normal: true },
    spleen: { echotexture_normal: true },
    kidneys: {
      right: { size_normal: true, calculi_present: false },
      left: { size_normal: true, calculi_present: false }
    },
    urinary_bladder: { wall_thickness_normal: true },
    prostate: { _applicable: true, size_normal: true, grade: 'normal' }
  }
};

const F_GOVIND = {
  patient: { name: 'Govind Thakur', age_years: 80, sex: 'Male' },
  findings: {
    liver: { fatty_grade: 0, hepatomegaly: false },
    gallbladder: { present: true },
    pancreas: { size_normal: true },
    spleen: { size_category: 'small' }, // spleen atrophy
    kidneys: { right: {}, left: {} },
    urinary_bladder: { wall_thickness_normal: true },
    prostate: { _applicable: true, size_normal: false, weight_grams: 48, grade: 'Grade_I' },
    bowel: { enteritis_flag: true }
  }
};

const F_SHAMA = {
  patient: { name: 'Shama Mujawar', age_years: 24, sex: 'Female' },
  findings: {
    liver: { fatty_grade: 0 },
    kidneys: {
      right: { calculi_present: false },
      left: { calculi_present: true, calculi: [{ size_mm: 3.6, location: 'unspecified' }] }
    },
    uterus: { _applicable: true, size_normal: true },
    ovaries: {
      _applicable: true,
      right: {}, left: {},
      vaginal_cyst_collection: true,
      vaginal_collection_size_mm: { dim1: 53, dim2: 15 }
    }
  }
};

const F_SANJAY = {
  patient: { name: 'Sanjay Gupta', age_years: 61, sex: 'Male' },
  findings: {
    liver: { hepatomegaly: true, fatty_grade: 1, focal_lesions: [{ type: 'simple_cyst' }] },
    kidneys: {
      right: { calculi_present: true, calculi: [{ size_mm: 1, location: 'unspecified' }] },
      left: { calculi_present: true, calculi: [{ size_mm: 1, location: 'unspecified' }] }
    },
    prostate: { _applicable: true, size_normal: false, volume_cc: 32.8 }
  }
};

const F_SIMRAN = {
  patient: { name: 'Ms. Simran', age_years: 23, sex: 'Female' },
  findings: {
    liver: { fatty_grade: 0 },
    uterus: { _applicable: true, size_normal: true },
    ovaries: {
      _applicable: true,
      right: { volume_cc: 10.1, morphology: 'polycystic' },
      left: { volume_cc: 8.5, morphology: 'polycystic' },
      pcos_morphology_bilateral: true
    }
  }
};

const F_RIYAZ = {
  patient: { name: 'SM Riyaz', age_years: 58, sex: 'Male' },
  findings: {
    liver: { fatty_grade: 1, focal_lesions: [{ type: 'simple_cyst', size_mm: { dim1: 35, dim2: 33 } }] },
    gallbladder: { present: true, calculi_present: true, calculi: [{ size_mm: 18.7 }] },
    urinary_bladder: { wall_thickness_normal: false, wall_thickness_mm: 5.9, post_void_residual_cc: 107 },
    prostate: { _applicable: true, volume_cc: 25 }
  }
};

test('usg-scoring tests', async (t) => {
  await t.test('Kartikay: metabolic flags and composite score ~78', () => {
    // Metabolic Health Index
    const mhi = calculateMetabolicHealthIndex(
      F_KARTIKAY.findings.liver.fatty_grade,
      F_KARTIKAY.findings.liver.hepatomegaly,
      false,
      33 // BMI
    );
    assert.strictEqual(mhi < 10, true, 'Metabolic score should be reduced due to fatty liver and BMI');

    const comp = compositeScore(F_KARTIKAY.findings, F_KARTIKAY.patient.sex, F_KARTIKAY.patient.age_years);
    assert.ok(comp >= 75 && comp <= 88, `Expected composite score around 78-86, got ${comp}`);
  });

  await t.test('Govind: Prostate score accounts for age_years', () => {
    // 80M with 48g prostate. Age normal for 80 is 45cc. 48/45 = 1.06 <= 1.2 -> should be normal score (100)
    const score = prostateScore(F_GOVIND.findings.prostate, F_GOVIND.patient.age_years);
    assert.strictEqual(score, 100, '48g at age 80 should be normal (score 100)');
  });

  await t.test('Shama: Renal calculus and vaginal cyst', () => {
    const kScore = kidneyScore(F_SHAMA.findings.kidneys);
    assert.ok(kScore < 100, 'Kidney score should be reduced due to calculus');
    
    const rScore = femaleReproductiveScore(F_SHAMA.findings.uterus, F_SHAMA.findings.ovaries);
    assert.ok(rScore < 100, 'Reproductive score should be reduced due to vaginal cyst');
  });

  await t.test('Sanjay: Hepatomegaly, Grade 1, cyst, bilateral concretions, Prostatomegaly', () => {
    const pScore = prostateScore(F_SANJAY.findings.prostate, F_SANJAY.patient.age_years);
    // Age 61 -> Normal 30cc. 32.8/30 = 1.09 <= 1.2 -> Normal score 100
    assert.strictEqual(pScore, 100, '32.8cc at age 61 should be normal (score 100)');

    const lScore = liverScore(F_SANJAY.findings.liver);
    assert.ok(lScore < 100, 'Liver score should be reduced due to fatty grade, hepatomegaly, and cyst');
  });

  await t.test('Simran: BCOM, reproductive_score ~50, fertility_relevance 9+', () => {
    const rScore = femaleReproductiveScore(F_SIMRAN.findings.uterus, F_SIMRAN.findings.ovaries);
    // Expected: 100 - 35 (bilateral PCOS) - 10 (Right ovary > 10cc) = 55
    assert.ok(rScore >= 45 && rScore <= 60, `Reproductive score should be ~50, got ${rScore}`);

    const flags = generateRiskFlags(F_SIMRAN.findings, F_SIMRAN.patient.sex, F_SIMRAN.patient.age_years);
    const pcosFlag = flags.find(f => f.flag_id === 'PCOS_BILATERAL');
    assert.ok(pcosFlag, 'PCOS flag must be generated');
    assert.ok(pcosFlag.fertility_relevance === 'high' || pcosFlag.fertility_relevance === 'critical', 'Fertility relevance should be 9 or critical/high');
  });

  await t.test('Riyaz: Fatty liver, cholelithiasis, thickened bladder wall, PVR', () => {
    const gbScore = gallbladderScore(F_RIYAZ.findings.gallbladder);
    assert.ok(gbScore < 100, 'GB score reduced due to cholelithiasis');

    const bScore = bladderScore(F_RIYAZ.findings.urinary_bladder);
    assert.ok(bScore < 100, 'Bladder score reduced due to thickened wall and high PVR');
  });
  
  await t.test('Couple insights: Concordance checks', () => {
    const insights = generateCoupleInsights(F_KARTIKAY, F_SIMRAN);
    assert.ok(Array.isArray(insights));

    const insights2 = generateCoupleInsights(F_KARTIKAY, F_RIYAZ);
    const metabolicShared = insights2.find(i => i.id === 'SHARED_METABOLIC');
    assert.ok(metabolicShared, 'Should flag shared metabolic insight');
  });
});
