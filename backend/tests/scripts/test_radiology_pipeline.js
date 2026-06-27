require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const logger = require('../../src/utils/logger');
const classifier = require('../../src/services/radiology/reportClassifier.service');
const splitter = require('../../src/services/radiology/reportSplitter.service');
const extractor = require('../../src/services/radiology/radiologyExtractor.service');
const aggregator = require('../../src/services/radiology/reportAggregator.service');
const { calculateRadiologyNuptiaContribution } = require('../../src/services/scoring/nuptia.composite.score');
const { generateRiskFlags } = require('../../src/services/scoring/riskFlags.service');
const { initDB } = require('../../src/services/storage/postgres.service');

const MOCK_OCR_TEXT = `
USG WHOLE ABDOMEN REPORT
PATIENT NAME: Sachin  AGE: 32  GENDER: Male
LIVER: Shows moderate diffuse increase in echogenicity. Size is 16.2 cm (hepatomegaly). Grade II Fatty Liver changes.
KIDNEYS: Both kidneys are normal in size and position. A 4mm calculus is noted in the lower pole of the right kidney. Left kidney is normal.
PROSTATE: Mildly enlarged, volume is 24 cc.
IMPRESSION: Hepatomegaly with Grade II Fatty Liver. Right renal calculus.

USG SCROTUM COLOR DOPPLER REPORT
BILATERAL TESTES: Both testes are normal in size, shape and echotexture. Right testis measures 4.2 x 2.4 x 3.1 cm (Vol 16 cc). Left testis measures 4.1 x 2.3 x 3.0 cm (Vol 15 cc).
No focal lesion seen in either testis.
VASCULARITY: Right spermatic cord shows dilated tortuous veins measuring 3.2 mm on Valsalva maneuver with retrograde flow. Features compatible with Grade II Varicocele.
Left side is normal.
IMPRESSION: Dilated veins in right hemiscrotum suggesting Right Varicocele Grade II.

2D ECHOCARDIOGRAPHY REPORT
M-MODE & 2D ECHO FINDINGS:
LVEF (Left Ventricular Ejection Fraction) is estimated at 48%.
VALVES: Mild mitral regurgitation (MR) noted. Tricuspid and aortic valves are normal.
DIASTOLIC FUNCTION: Grade II diastolic dysfunction of the left ventricle.
PAH: No pulmonary arterial hypertension, estimated PASP is 28 mmHg.
IMPRESSION: Mildly reduced LV systolic function (LVEF 48%). Grade II diastolic dysfunction.

DEXA BONE MINERAL DENSITOMETRY REPORT
BMD STUDY RESULTS:
Scan site: Left Femoral Neck
Lowest T-score value: -2.2
WHO Classification: Osteopenia.
IMPRESSION: Bone mineral density indicates Osteopenia.
`;

async function run() {
  try {
    console.log('--- RADIOLOGY MULTI-MODALITY PIPELINE TEST ---');
    console.log('1. CLASSIFYING OCR TEXT...');
    const detected = classifier.classify(MOCK_OCR_TEXT);
    console.log('Detected modalities:', detected.map(d => `${d.key} (index: ${d.matchIndex})`));

    // Assert that we classified all 4 modalities
    const detectedKeys = detected.map(d => d.key);
    const expectedKeys = ['USG_ABDOMEN', 'USG_SCROTUM_DOPPLER', 'ECHO', 'DEXA'];
    for (const key of expectedKeys) {
      if (!detectedKeys.includes(key)) {
        throw new Error(`FAIL: Modality ${key} was not detected by classifier`);
      }
    }
    console.log('SUCCESS: All 4 modalities classified correctly.');

    console.log('\n2. SPLITTING OCR SECTIONS...');
    const sections = splitter.split(MOCK_OCR_TEXT, detected);
    console.log(`Split report into ${sections.length} sections:`);
    sections.forEach(s => {
      console.log(`- Section ${s.modalityKey} (${s.rawSectionText.length} chars)`);
    });

    if (sections.length !== 4) {
      throw new Error(`FAIL: Expected 4 sections, got ${sections.length}`);
    }
    console.log('SUCCESS: Splitter correctly parsed section bounds.');

    console.log('\n3. RUNNING EXTRACTIONS...');
    let extractionResults = [];
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('WARNING: OPENROUTER_API_KEY is not defined. Simulating LLM extractions.');
      
      extractionResults = [
        {
          modalityKey: 'USG_ABDOMEN',
          extracted: {
            liver: { fatty_grade: 2, hepatomegaly: true, ihbr_dilated: false, focal_lesions: [] },
            gallbladder: { present: true, calculi_present: false, polyp_present: false, wall_thickness_normal: true },
            pancreas: { size_normal: true, echotexture_normal: true, focal_lesion: false, calcifications: false },
            spleen: { size_normal: true, size_category: 'normal', focal_lesion: false },
            kidneys: {
              right: { calculi_present: true, size_normal: true, cysts: [], hydronephrosis: false, hydronephrosis_grade: null, corticomedullary_differentiation: 'normal' },
              left: { calculi_present: false, size_normal: true, cysts: [], hydronephrosis: false, hydronephrosis_grade: null, corticomedullary_differentiation: 'normal' }
            },
            urinary_bladder: { wall_thickness_normal: true, calculi_present: false, post_void_residual_cc: 0, mass_present: false },
            prostate: { _applicable: true, size_normal: false, grade: 'Grade_I', volume_cc: 24, weight_grams: null }
          },
          error: null
        },
        {
          modalityKey: 'USG_SCROTUM_DOPPLER',
          extracted: {
            right_testis: { length_mm: 42, width_mm: 24, height_mm: 31, volume_cc: 16, echopattern_normal: true, focal_lesion: false, vascularity_normal: true },
            left_testis: { length_mm: 41, width_mm: 23, height_mm: 30, volume_cc: 15, echopattern_normal: true, focal_lesion: false, vascularity_normal: true },
            right_epididymis: { normal: true, thickened: false, cyst_present: false },
            left_epididymis: { normal: true, thickened: false, cyst_present: false },
            varicocele: { present: true, side: 'right', grade: 2 },
            hydrocele: { present: false, side: 'none', significant: false },
            spermatic_cord_normal: true,
            inguinal_hernia: false,
            impression_normal: false,
            impression_text: 'Right varicocele Grade II'
          },
          error: null
        },
        {
          modalityKey: 'ECHO',
          extracted: {
            lvef_percent: 48,
            valves: {
              mitral: { mr_grade: 'mild' }
            },
            diastolic_dysfunction_grade: 2,
            pah: { present: false, pasp_mmhg: 28 },
            pericardial_effusion: false,
            rwma: false,
            thrombus: false,
            vegetation: false
          },
          error: null
        },
        {
          modalityKey: 'DEXA',
          extracted: {
            lowest_t_score_value: -2.2,
            lowest_t_score_site: 'left femoral neck',
            overall_who_classification: 'osteopenia'
          },
          error: null
        }
      ];
    } else {
      console.log('Running actual OpenRouter LLM extractions (takes ~10-15 seconds)...');
      extractionResults = await extractor.extractAll(sections);
      console.log('Extraction results received:');
      extractionResults.forEach(r => {
        console.log(`- ${r.modalityKey}: Error=${r.error}, ExtractedKeys=${r.extracted ? Object.keys(r.extracted).join(', ') : 'None'}`);
      });
    }

    console.log('\n4. AGGREGATING FINDINGS...');
    const aggregated = aggregator.aggregate(extractionResults);
    console.log('Aggregated Modalities:', aggregated.modalities_detected);
    console.log('Aggregated Unified Keys:', Object.keys(aggregated.unified));

    console.log('\n5. COMPUTING NUPTIA RAD-COMPOSITE SCORE...');
    const nuptiaScore = calculateRadiologyNuptiaContribution(aggregated, 'Male', 32);
    console.log('Organ Scores:', nuptiaScore.organ_scores);
    console.log('Radiology Nuptia Contribution (out of 30%):', nuptiaScore.radiology_nuptia_contribution);

    // Verify organ scores calculations
    if (nuptiaScore.organ_scores.USG_ABDOMEN === undefined || nuptiaScore.organ_scores.USG_SCROTUM_DOPPLER === undefined || nuptiaScore.organ_scores.ECHO === undefined || nuptiaScore.organ_scores.DEXA === undefined) {
      throw new Error('FAIL: Not all modalities were scored');
    }
    console.log('SUCCESS: Composite score calculated successfully.');

    console.log('\n6. GENERATING RISK FLAGS...');
    const riskFlags = generateRiskFlags(aggregated.unified, 'Male', 32);
    console.log(`Generated ${riskFlags.length} risk flags:`);
    riskFlags.forEach(f => {
      console.log(`- Flag: ${f.flag_id} | Label: ${f.flag_label} | Severity: ${f.severity} | Fertility relevance: ${f.fertility_relevance}`);
    });

    // Assert that we generated the expected clinical risk flags
    const flagIds = riskFlags.map(f => f.flag_id);
    const expectedFlags = ['FATTY_LIVER_2', 'RENAL_CALCULUS', 'VARICOCELE_GR2', 'ECHO_DIASTOLIC_DYSFUNCTION_G2', 'DEXA_OSTEOPENIA'];
    for (const key of expectedFlags) {
      if (!flagIds.includes(key)) {
        throw new Error(`FAIL: Expected flag ${key} was not generated`);
      }
    }

    console.log('\nSUCCESS: All clinical risk flags generated correctly!');
    console.log('\n--- ALL TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);

  } catch (err) {
    console.error('TEST PIPELINE FAILED:', err);
    process.exit(1);
  }
}

run();
