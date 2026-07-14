// Maps the ~152 canonical parameters the OCR extractor recognizes (see
// ontologyMapper.service.js's `parametersOntology`) to the real, named tests a
// premarital pathology panel is built from, and to the one report dimension
// each test actually feeds (see reportSummary.service.js's body_health/
// family_planning/carrier_pair_risk computation). This lets an upload be
// checked against "which named tests did this PDF actually contain" instead
// of just "how many raw parameters did we find" — and, for whatever's
// missing, tells the user plainly what that means for their report rather
// than leaving them to guess.
//
// Deliberately NOT included: PSA and Nicotine/Cotinine appear in the
// frontend's SUGGESTED_PATHOLOGY_TESTS list but have no matching entry in the
// extractor's ontology yet — the extractor genuinely cannot detect them from
// any report today, so listing them here as "missing" would misrepresent a
// real product gap as something the user's report failed to include.
const TEST_COVERAGE_MAP = [
  {
    test: 'Blood Group — ABO Typing',
    parameters: ['blood_group_a_b_ab_o'],
    impacts: 'Blood group compatibility'
  },
  {
    test: 'Blood Group — Rh (Rhesus) Typing',
    parameters: ['rh_factor_positive_negative'],
    impacts: 'Rh compatibility — relevant for pregnancy planning'
  },
  {
    test: 'Complete Blood Count (CBC) / Hemogram',
    parameters: ['hemoglobin_hb', 'total_white_blood_cell_count_wbc_tlc', 'platelet_count'],
    impacts: 'General blood health baseline'
  },
  {
    test: 'Blood Sugar — Fasting (FBS / FBG)',
    parameters: ['fasting_blood_glucose_fbg'],
    impacts: 'Metabolic health — sugar'
  },
  {
    test: 'Glycated Hemoglobin (HbA1c)',
    parameters: ['hba1c'],
    impacts: 'Metabolic health — sugar'
  },
  {
    test: 'Liver Function Test (LFT)',
    parameters: ['alanine_aminotransferase_sgpt_alt', 'aspartate_aminotransferase_sgot_ast', 'total_bilirubin'],
    impacts: 'Metabolic health — liver'
  },
  {
    test: 'Kidney Function Test (KFT)',
    parameters: ['serum_creatinine', 'serum_urea', 'blood_urea_nitrogen_bun'],
    impacts: 'Metabolic health — kidney'
  },
  {
    test: 'Hemoglobin HPLC',
    parameters: ['hemoglobin_a2_hba2', 'hemoglobin_s_hbs', 'hemoglobin_f_hbf_fetal_hemoglobin', 'hemoglobin_e_hbe'],
    impacts: 'Genetic carrier risk (thalassemia)'
  },
  {
    test: 'Vitamin B12 (Cyanocobalamin)',
    parameters: ['vitamin_b12_cobalamin_serum'],
    impacts: 'General health baseline'
  },
  {
    test: 'Vitamin D (25-Hydroxy)',
    parameters: ['vitamin_d_3_25_hydroxy'],
    impacts: 'Metabolic health — vitamins'
  },
  {
    test: 'Thyroid Test',
    parameters: ['thyroid_stimulating_hormone_tsh_utsh', 'free_t3_ft3', 'free_t4_ft4'],
    impacts: 'Metabolic health — hormones'
  },
  {
    test: 'Lipid Profile Test',
    parameters: ['total_cholesterol', 'low_density_lipoprotein_cholesterol_ldl_c', 'high_density_lipoprotein_cholesterol_hdl_c', 'triglycerides'],
    impacts: 'Metabolic health — heart'
  },
  {
    test: 'Semen Analysis — Male',
    parameters: ['sperm_concentration', 'total_sperm_count_per_ejaculate', 'total_motile_sperm_count_tmsc'],
    impacts: 'Fertility outlook (male)'
  },
  {
    test: 'AMH (Anti-Müllerian Hormone) — Female Only',
    parameters: ['amh'],
    impacts: 'Fertility outlook (female)'
  },
  {
    test: 'Urine Routine & Microscopy Examination',
    parameters: ['specific_gravity', 'ph', 'urinary_protein', 'pus_cells_leucocytes_per_hpf'],
    impacts: 'General health baseline'
  },
  {
    test: 'Syphilis — VDRL / RPR',
    parameters: ['vdrl_rpr_result_reactive_non_reactive'],
    impacts: 'Infectious-disease safety check'
  },
  {
    test: 'Hepatitis B Surface Antigen (HBsAg)',
    parameters: ['hbsag_qualitative_result_reactive_non_reactive'],
    impacts: 'Infectious-disease safety check'
  },
  {
    test: 'Hepatitis C Antibody (Anti-HCV)',
    parameters: ['anti_hcv_antibody_qualitative_result_reactive_non_reactive'],
    impacts: 'Infectious-disease safety check'
  },
  {
    test: 'HIV Combo (P24 Antigen + Antibody) Test',
    parameters: ['hiv_1_2_antibody_result_reactive_non_reactive', 'hiv_combo_assay_od_value_s_co_ratio'],
    impacts: 'Infectious-disease safety check'
  },
  {
    test: 'Rubella Virus IgG Antibody — Female Only',
    parameters: ['rubella_igg_antibody_quantitative_iu_ml', 'rubella_igg_interpretation_immune_non_immune'],
    impacts: 'Pregnancy-safety immunity check'
  }
];

// extractedData is grouped by ontology `section` (cbc/general/lft/...), but a
// canonical_name is unique across the whole ontology — scanning every section
// rather than trusting one specific section keeps this correct even if a
// parameter's section grouping changes upstream.
function hasParameter(extractedData, canonicalName) {
  if (!extractedData) return false;
  return Object.values(extractedData).some((section) => section && Object.prototype.hasOwnProperty.call(section, canonicalName));
}

function computeTestCoverage(extractedData) {
  const available = [];
  const missing = [];
  for (const entry of TEST_COVERAGE_MAP) {
    const found = entry.parameters.some((p) => hasParameter(extractedData, p));
    const row = { test: entry.test, impacts: entry.impacts };
    if (found) available.push(row);
    else missing.push(row);
  }
  return { available, missing };
}

module.exports = { TEST_COVERAGE_MAP, computeTestCoverage };
