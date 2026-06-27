require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { db, initDB } = require('../../src/services/storage/postgres.service');
const { v4: uuidv4 } = require('uuid');

const SachinReport = {
  id: 'sachin-rad-report-uuid-12345',
  patient_slay_id: 'Sachin',
  sex: 'Male',
  age: 32,
  modalities_detected: ['USG_ABDOMEN', 'USG_SCROTUM_DOPPLER', 'ECHO', 'DEXA'],
  findings: {
    USG_ABDOMEN: {
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
    USG_SCROTUM_DOPPLER: {
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
    ECHO: {
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
    DEXA: {
      lowest_t_score_value: -2.2,
      lowest_t_score_site: 'left femoral neck',
      overall_who_classification: 'osteopenia'
    }
  },
  scores: {
    organ_scores: {
      USG_ABDOMEN: 82.5,
      USG_SCROTUM_DOPPLER: 75.0,
      ECHO: 65.0,
      DEXA: 55.0
    },
    radiology_nuptia_contribution: 18.71,
    max_possible: 30,
    modalities_scored: ['USG_ABDOMEN', 'USG_SCROTUM_DOPPLER', 'ECHO', 'DEXA']
  },
  risk_flags: [
    { flag_id: 'FATTY_LIVER_2', flag_label: 'Grade II Fatty Liver', severity: 'moderate', fertility_relevance: 'Metabolic markers affect spermatogenesis' },
    { flag_id: 'RENAL_CALCULUS', flag_label: 'Right Kidney Stone (4mm)', severity: 'mild', fertility_relevance: 'No direct impact on fertility, watch hydration' },
    { flag_id: 'VARICOCELE_GR2', flag_label: 'Right Varicocele Grade II', severity: 'severe', fertility_relevance: 'Impaired spermatogenesis and semen quality' },
    { flag_id: 'ECHO_DIASTOLIC_DYSFUNCTION_G2', flag_label: 'Grade II Diastolic Dysfunction', severity: 'moderate', fertility_relevance: 'Cardiovascular assessment advised' },
    { flag_id: 'DEXA_OSTEOPENIA', flag_label: 'Osteopenia (T-score -2.2)', severity: 'mild', fertility_relevance: 'Assess vitamin D and calcium balance' }
  ],
  raw_ocr_text: 'MOCK SYSTEM INSERT FOR SACHIN'
};

const SwatiReport = {
  id: 'swati-rad-report-uuid-12345',
  patient_slay_id: 'Swati',
  sex: 'Female',
  age: 29,
  modalities_detected: ['USG_ABDOMEN', 'ECHO', 'DEXA'],
  findings: {
    USG_ABDOMEN: {
      liver: { fatty_grade: 0, hepatomegaly: false, ihbr_dilated: false, focal_lesions: [] },
      gallbladder: { present: true, calculi_present: false, polyp_present: false, wall_thickness_normal: true },
      pancreas: { size_normal: true, echotexture_normal: true, focal_lesion: false, calcifications: false },
      spleen: { size_normal: true, size_category: 'normal', focal_lesion: false },
      kidneys: {
        right: { calculi_present: false, size_normal: true, cysts: [], hydronephrosis: false, hydronephrosis_grade: null, corticomedullary_differentiation: 'normal' },
        left: { calculi_present: false, size_normal: true, cysts: [], hydronephrosis: false, hydronephrosis_grade: null, corticomedullary_differentiation: 'normal' }
      },
      urinary_bladder: { wall_thickness_normal: true, calculi_present: false, post_void_residual_cc: 0, mass_present: false },
      uterus: { length_mm: 75, width_mm: 40, height_mm: 30, volume_cc: null, endometrial_thickness_mm: 7.2, fibroids_present: false },
      ovaries: {
        right: { length_mm: 35, width_mm: 22, height_mm: 20, volume_cc: 8.1, follicles_count: 14, dominant_follicle_present: false },
        left: { length_mm: 34, width_mm: 21, height_mm: 19, volume_cc: 7.8, follicles_count: 15, dominant_follicle_present: false },
        pcos_morphology_bilateral: true,
        pcos_morphology_unilateral: false
      }
    },
    ECHO: {
      lvef_percent: 62,
      valves: {
        mitral: { mr_grade: 'none' }
      },
      diastolic_dysfunction_grade: null,
      pah: { present: false, pasp_mmhg: 20 },
      pericardial_effusion: false,
      rwma: false,
      thrombus: false,
      vegetation: false
    },
    DEXA: {
      lowest_t_score_value: -0.5,
      lowest_t_score_site: 'lumbar spine',
      overall_who_classification: 'normal'
    }
  },
  scores: {
    organ_scores: {
      USG_ABDOMEN: 95.0,
      ECHO: 95.0,
      DEXA: 90.0
    },
    radiology_nuptia_contribution: 27.5,
    max_possible: 30,
    modalities_scored: ['USG_ABDOMEN', 'ECHO', 'DEXA']
  },
  risk_flags: [
    { flag_id: 'PCOS_MORPHOLOGY', flag_label: 'Bilateral PCOS Ovarian Morphology', severity: 'moderate', fertility_relevance: 'Ovulatory subfertility risk, lifestyle reset advised' }
  ],
  raw_ocr_text: 'MOCK SYSTEM INSERT FOR SWATI'
};

async function run() {
  await initDB();
  console.log('Cleaning up existing mock reports...');
  await db.query('DELETE FROM radiology_reports WHERE id IN ($1, $2)', [SachinReport.id, SwatiReport.id]);

  console.log('Inserting Sachin...');
  await db.query(
    `INSERT INTO radiology_reports (id, patient_slay_id, sex, age, modalities_detected, findings_json, scores_json, risk_flags_json, raw_ocr_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      SachinReport.id,
      SachinReport.patient_slay_id,
      SachinReport.sex,
      SachinReport.age,
      SachinReport.modalities_detected,
      JSON.stringify(SachinReport.findings),
      JSON.stringify(SachinReport.scores),
      JSON.stringify(SachinReport.risk_flags),
      SachinReport.raw_ocr_text
    ]
  );
  console.log(`Inserted Sachin successfully. ID: ${SachinReport.id}`);

  console.log('Inserting Swati...');
  await db.query(
    `INSERT INTO radiology_reports (id, patient_slay_id, sex, age, modalities_detected, findings_json, scores_json, risk_flags_json, raw_ocr_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      SwatiReport.id,
      SwatiReport.patient_slay_id,
      SwatiReport.sex,
      SwatiReport.age,
      SwatiReport.modalities_detected,
      JSON.stringify(SwatiReport.findings),
      JSON.stringify(SwatiReport.scores),
      JSON.stringify(SwatiReport.risk_flags),
      SwatiReport.raw_ocr_text
    ]
  );
  console.log(`Inserted Swati successfully. ID: ${SwatiReport.id}`);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
