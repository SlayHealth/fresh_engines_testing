const Fuse = require('fuse.js');

const parametersOntology = [
  {
    "canonical_name": "blood_group_a_b_ab_o",
    "section": "cbc",
    "aliases": [
      "blood group (a / b / ab / o)",
      "a",
      "b",
      "ab",
      "o"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "rh_factor_positive_negative",
    "section": "general",
    "aliases": [
      "rh factor (positive / negative)",
      "positive",
      "negative"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_red_blood_cell_count_rbc",
    "section": "cbc",
    "aliases": [
      "total red blood cell count (rbc)",
      "rbc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_hb",
    "section": "cbc",
    "aliases": [
      "hemoglobin (hb)",
      "hemoglobin",
      "hb"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hematocrit_packed_cell_volume_pcv",
    "section": "general",
    "aliases": [
      "hematocrit / packed cell volume (pcv)",
      "pcv"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "mean_corpuscular_volume_mcv",
    "section": "cbc",
    "aliases": [
      "mean corpuscular volume (mcv)",
      "mcv"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "mean_corpuscular_hemoglobin_mch",
    "section": "cbc",
    "aliases": [
      "mean corpuscular hemoglobin (mch)",
      "mch"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "mean_corpuscular_hemoglobin_concentration_mchc",
    "section": "cbc",
    "aliases": [
      "mean corpuscular hemoglobin concentration (mchc)",
      "mchc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "red_cell_distribution_width_cv_rdw_cv",
    "section": "general",
    "aliases": [
      "red cell distribution width - cv (rdw-cv)",
      "rdw-cv"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "red_cell_distribution_width_sd_rdw_sd",
    "section": "general",
    "aliases": [
      "red cell distribution width - sd (rdw-sd)",
      "rdw-sd"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_white_blood_cell_count_wbc_tlc",
    "section": "cbc",
    "aliases": [
      "total white blood cell count (wbc / tlc)",
      "wbc",
      "tlc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "neutrophils",
    "section": "cbc",
    "aliases": [
      "neutrophils (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "neutrophils_absolute_count",
    "section": "cbc",
    "aliases": [
      "neutrophils - absolute count"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "lymphocytes",
    "section": "cbc",
    "aliases": [
      "lymphocytes (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "lymphocytes_absolute_count",
    "section": "cbc",
    "aliases": [
      "lymphocytes - absolute count"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "monocytes",
    "section": "cbc",
    "aliases": [
      "monocytes (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "monocytes_absolute_count",
    "section": "cbc",
    "aliases": [
      "monocytes - absolute count"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "eosinophils",
    "section": "cbc",
    "aliases": [
      "eosinophils (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "eosinophils_absolute_count",
    "section": "cbc",
    "aliases": [
      "eosinophils - absolute count"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "basophils",
    "section": "cbc",
    "aliases": [
      "basophils (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "basophils_absolute_count",
    "section": "cbc",
    "aliases": [
      "basophils - absolute count"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "immature_granulocytes",
    "section": "general",
    "aliases": [
      "immature granulocytes (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "immature_granulocytes_absolute_count",
    "section": "general",
    "aliases": [
      "immature granulocytes - absolute count"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "nucleated_red_blood_cells_nrbc_absolute_count",
    "section": "cbc",
    "aliases": [
      "nucleated red blood cells (nrbc) - absolute count",
      "nrbc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "nucleated_red_blood_cells_nrbc",
    "section": "cbc",
    "aliases": [
      "nucleated red blood cells (nrbc) %",
      "nrbc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "platelet_count",
    "section": "cbc",
    "aliases": [
      "platelet count"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "mean_platelet_volume_mpv",
    "section": "cbc",
    "aliases": [
      "mean platelet volume (mpv)",
      "mpv"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "platelet_distribution_width_pdw",
    "section": "cbc",
    "aliases": [
      "platelet distribution width (pdw)",
      "pdw"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "plateletcrit_pct",
    "section": "cbc",
    "aliases": [
      "plateletcrit (pct)",
      "pct"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "platelet_large_cell_ratio_p_lcr",
    "section": "cbc",
    "aliases": [
      "platelet-large cell ratio (p-lcr)",
      "p-lcr"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "erythrocyte_sedimentation_rate_esr",
    "section": "general",
    "aliases": [
      "erythrocyte sedimentation rate (esr)",
      "esr",
      "esr - erythrocyte sedimentation rate"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "fasting_blood_glucose_fbg",
    "section": "cbc",
    "aliases": [
      "fasting blood glucose (fbg)",
      "fbg"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "random_blood_sugar_rbs",
    "section": "cbc",
    "aliases": [
      "random blood sugar (rbs)",
      "rbs",
      "glucose random"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hba1c",
    "section": "diabetes",
    "aliases": [
      "hba1c",
      "hb a1c",
      "hba-1c",
      "hba1c (%)",
      "%",
      "glycated hemoglobin",
      "glycosylated hemoglobin"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "estimated_average_glucose_eag",
    "section": "diabetes",
    "aliases": [
      "estimated average glucose (eag)",
      "eag"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "average_blood_glucose_abg",
    "section": "cbc",
    "aliases": [
      "average blood glucose (abg)",
      "abg"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hs_crp",
    "section": "general",
    "aliases": [
      "c-reactive protein",
      "crp",
      "hs-crp",
      "hs_crp",
      "high sensitivity c-reactive protein",
      "hscrp"
    ],
    "expected_units": ["mg/L", "mg/l"],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_bilirubin",
    "section": "lft",
    "aliases": [
      "total bilirubin"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "direct_conjugated_bilirubin",
    "section": "lft",
    "aliases": [
      "direct (conjugated) bilirubin",
      "conjugated"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "indirect_unconjugated_bilirubin",
    "section": "lft",
    "aliases": [
      "indirect (unconjugated) bilirubin",
      "unconjugated"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "alanine_aminotransferase_sgpt_alt",
    "section": "lft",
    "aliases": [
      "alanine aminotransferase (sgpt / alt)",
      "sgpt",
      "alt"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "aspartate_aminotransferase_sgot_ast",
    "section": "lft",
    "aliases": [
      "aspartate aminotransferase (sgot / ast)",
      "sgot",
      "ast"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_creatinine",
    "section": "kft",
    "aliases": [
      "serum creatinine",
      "creatinine"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "blood_urea_nitrogen_bun",
    "section": "cbc",
    "aliases": [
      "blood urea nitrogen (bun)",
      "bun"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "bun_creatinine_ratio",
    "section": "kft",
    "aliases": [
      "bun / creatinine ratio"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_uric_acid",
    "section": "kft",
    "aliases": [
      "serum uric acid"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_urea",
    "section": "kft",
    "aliases": [
      "serum urea"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "estimated_glomerular_filtration_rate_egfr",
    "section": "kft",
    "aliases": [
      "estimated glomerular filtration rate (egfr)",
      "egfr",
      "e-gfr",
      "estimated gfr",
      "gfr",
      "egfr (ckd-epi)"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_sodium_na",
    "section": "general",
    "aliases": [
      "serum sodium (na⁺)",
      "na⁺"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_potassium_k",
    "section": "general",
    "aliases": [
      "serum potassium (k⁺)",
      "k⁺"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_chloride_cl",
    "section": "general",
    "aliases": [
      "serum chloride (cl⁻)",
      "cl⁻"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_bicarbonate_hco",
    "section": "general",
    "aliases": [
      "serum bicarbonate (hco₃⁻)",
      "hco₃⁻"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_iron",
    "section": "general",
    "aliases": [
      "serum iron"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_iron_binding_capacity_tibc",
    "section": "general",
    "aliases": [
      "total iron binding capacity (tibc)",
      "tibc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "unsaturated_iron_binding_capacity_uibc",
    "section": "general",
    "aliases": [
      "unsaturated iron binding capacity (uibc)",
      "uibc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "transferrin_saturation",
    "section": "general",
    "aliases": [
      "transferrin saturation (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "serum_ferritin",
    "section": "general",
    "aliases": [
      "serum ferritin"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_a_hba",
    "section": "cbc",
    "aliases": [
      "hemoglobin a (hba)",
      "hba"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_a2_hba2",
    "section": "cbc",
    "aliases": [
      "hemoglobin a2 (hba2)",
      "hba2"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_f_hbf_fetal_hemoglobin",
    "section": "cbc",
    "aliases": [
      "hemoglobin f (hbf / fetal hemoglobin)",
      "hbf",
      "fetal"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_s_hbs",
    "section": "cbc",
    "aliases": [
      "hemoglobin s (hbs)",
      "hbs"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_c_hbc",
    "section": "cbc",
    "aliases": [
      "hemoglobin c (hbc)",
      "hbc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_d_hbd",
    "section": "cbc",
    "aliases": [
      "hemoglobin d (hbd)",
      "hbd"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_e_hbe",
    "section": "cbc",
    "aliases": [
      "hemoglobin e (hbe)",
      "hbe"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_hemoglobin_g_dl",
    "section": "cbc",
    "aliases": [
      "total hemoglobin (g/dl)",
      "g",
      "dl"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "unknown_other_hemoglobin_fractions",
    "section": "cbc",
    "aliases": [
      "unknown / other hemoglobin fractions"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "interpretation_diagnosis",
    "section": "general",
    "aliases": [
      "interpretation / diagnosis"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_a2_hba2",
    "section": "cbc",
    "aliases": [
      "hemoglobin a2 (hba2) %",
      "hba2"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_c_hbc",
    "section": "cbc",
    "aliases": [
      "hemoglobin c (hbc) %",
      "hbc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_d_hbd",
    "section": "cbc",
    "aliases": [
      "hemoglobin d (hbd) %",
      "hbd"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_f_fetal_hemoglobin_hbf",
    "section": "cbc",
    "aliases": [
      "hemoglobin f / fetal hemoglobin (hbf) %",
      "hbf"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hemoglobin_s_hbs",
    "section": "cbc",
    "aliases": [
      "hemoglobin s (hbs) %",
      "hbs"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "thyroid_stimulating_hormone_tsh_utsh",
    "section": "thyroid",
    "aliases": [
      "thyroid stimulating hormone (tsh / utsh)",
      "tsh",
      "utsh"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "triiodothyronine_t3_total",
    "section": "thyroid",
    "aliases": [
      "triiodothyronine (t3) - total",
      "t3"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "thyroxine_t4_total",
    "section": "thyroid",
    "aliases": [
      "thyroxine (t4) - total",
      "t4"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "free_t3_ft3",
    "section": "thyroid",
    "aliases": [
      "free t3 (ft3)",
      "ft3"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "free_t4_ft4",
    "section": "thyroid",
    "aliases": [
      "free t4 (ft4)",
      "ft4"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "vitamin_b12_cobalamin_serum",
    "section": "general",
    "aliases": [
      "vitamin b12 (cobalamin) - serum",
      "cobalamin"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_cholesterol",
    "section": "lipid",
    "aliases": [
      "total cholesterol"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "high_density_lipoprotein_cholesterol_hdl_c",
    "section": "lipid",
    "aliases": [
      "high-density lipoprotein cholesterol (hdl-c)",
      "hdl-c"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "low_density_lipoprotein_cholesterol_ldl_c",
    "section": "lipid",
    "aliases": [
      "low-density lipoprotein cholesterol (ldl-c)",
      "ldl-c"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "very_low_density_lipoprotein_vldl_c",
    "section": "lipid",
    "aliases": [
      "very low-density lipoprotein (vldl-c)",
      "vldl-c"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "triglycerides",
    "section": "lipid",
    "aliases": [
      "triglycerides"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "non_hdl_cholesterol",
    "section": "lipid",
    "aliases": [
      "non-hdl cholesterol"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_cholesterol_hdl_ratio_tc_hdl",
    "section": "lipid",
    "aliases": [
      "total cholesterol / hdl ratio (tc:hdl)",
      "tc:hdl"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "ldl_hdl_ratio",
    "section": "general",
    "aliases": [
      "ldl / hdl ratio"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "vdrl_rpr_result_reactive_non_reactive",
    "section": "general",
    "aliases": [
      "vdrl / rpr result (reactive / non-reactive)",
      "vdrl / rpr result"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "rpr_titre_if_reactive",
    "section": "general",
    "aliases": [
      "rpr titre (if reactive)",
      "rpr titre"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hbsag_qualitative_result_reactive_non_reactive",
    "section": "general",
    "aliases": [
      "hbsag - qualitative result (reactive / non-reactive)",
      "hbsag - qualitative result",
      "hepatitis b surface antigen (hbsag)"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hbsag_od_value_signal_to_cutoff_ratio",
    "section": "general",
    "aliases": [
      "hbsag - od value / signal-to-cutoff ratio"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "anti_hcv_antibody_qualitative_result_reactive_non_reactive",
    "section": "general",
    "aliases": [
      "anti-hcv antibody - qualitative result (reactive / non-reactive)",
      "anti-hcv antibody - qualitative result"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "anti_hcv_od_value_signal_to_cutoff_ratio",
    "section": "general",
    "aliases": [
      "anti-hcv - od value / signal-to-cutoff ratio"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hiv_1_2_antibody_result_reactive_non_reactive",
    "section": "general",
    "aliases": [
      "hiv 1 & 2 antibody - result (reactive / non-reactive)",
      "hiv 1 & 2 antibody - result",
      "hiv 1 & 2 antibodies"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hiv_ict_immunochromatographic_test_result",
    "section": "general",
    "aliases": [
      "hiv ict (immunochromatographic test) result",
      "hiv ict result"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hiv_p24_antigen_result_detected_not_detected",
    "section": "general",
    "aliases": [
      "hiv p24 antigen - result (detected / not detected)",
      "hiv p24 antigen - result"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hiv_1_2_antibody_result_reactive_non_reactive",
    "section": "general",
    "aliases": [
      "hiv 1 & 2 antibody - result (reactive / non-reactive)",
      "hiv 1 & 2 antibody - result",
      "hiv 1 & 2 antibodies"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hiv_combo_assay_od_value_s_co_ratio",
    "section": "general",
    "aliases": [
      "hiv combo assay - od value / s/co ratio"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hiv_1_differentiation_result",
    "section": "general",
    "aliases": [
      "hiv 1 differentiation result"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "hiv_2_differentiation_result",
    "section": "general",
    "aliases": [
      "hiv 2 differentiation result"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "rubella_igg_antibody_quantitative_iu_ml",
    "section": "general",
    "aliases": [
      "rubella igg antibody - quantitative (iu/ml)",
      "rubella igg antibody"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "rubella_igg_interpretation_immune_non_immune",
    "section": "general",
    "aliases": [
      "rubella igg - interpretation (immune / non-immune)",
      "rubella igg - interpretation"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "colour",
    "section": "general",
    "aliases": [
      "colour"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "appearance_clarity_turbidity",
    "section": "general",
    "aliases": [
      "appearance / clarity / turbidity"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "specific_gravity",
    "section": "general",
    "aliases": [
      "specific gravity"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "ph",
    "section": "general",
    "aliases": [
      "ph"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "urinary_protein",
    "section": "urine_routine",
    "aliases": [
      "urinary protein"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "urinary_glucose",
    "section": "diabetes",
    "aliases": [
      "urinary glucose"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "urinary_ketones",
    "section": "urine_routine",
    "aliases": [
      "urinary ketones"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "urinary_bilirubin",
    "section": "lft",
    "aliases": [
      "urinary bilirubin"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "urobilinogen",
    "section": "urine_routine",
    "aliases": [
      "urobilinogen"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "blood_haemoglobin_in_urine",
    "section": "cbc",
    "aliases": [
      "blood / haemoglobin in urine"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "nitrites",
    "section": "general",
    "aliases": [
      "nitrites"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "leukocyte_esterase",
    "section": "general",
    "aliases": [
      "leukocyte esterase"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "pus_cells_wbcs_per_hpf",
    "section": "cbc",
    "aliases": [
      "pus cells (wbcs) per hpf",
      "wbcs"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "red_blood_cells_rbcs_per_hpf",
    "section": "cbc",
    "aliases": [
      "red blood cells (rbcs) per hpf",
      "rbcs"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "epithelial_cells",
    "section": "general",
    "aliases": [
      "epithelial cells"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "casts",
    "section": "general",
    "aliases": [
      "casts"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "crystals",
    "section": "general",
    "aliases": [
      "crystals"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "bacteria",
    "section": "general",
    "aliases": [
      "bacteria"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "yeast_fungi",
    "section": "general",
    "aliases": [
      "yeast / fungi"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "mucus_threads",
    "section": "general",
    "aliases": [
      "mucus threads"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "amorphous_material",
    "section": "general",
    "aliases": [
      "amorphous material"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "semen_volume",
    "section": "semen_analysis",
    "aliases": [
      "semen volume"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "semen_ph",
    "section": "semen_analysis",
    "aliases": [
      "semen ph"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "colour_appearance",
    "section": "general",
    "aliases": [
      "colour / appearance"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "viscosity",
    "section": "general",
    "aliases": [
      "viscosity"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "liquefaction_time",
    "section": "semen_analysis",
    "aliases": [
      "liquefaction time"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "sperm_concentration",
    "section": "semen_analysis",
    "aliases": [
      "sperm concentration"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_sperm_count_per_ejaculate",
    "section": "semen_analysis",
    "aliases": [
      "total sperm count per ejaculate"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_sperm_motility",
    "section": "semen_analysis",
    "aliases": [
      "total sperm motility (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "progressive_motility_pr",
    "section": "general",
    "aliases": [
      "progressive motility (pr) %",
      "pr"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "non_progressive_motility_np",
    "section": "general",
    "aliases": [
      "non-progressive motility (np) %",
      "np"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "immotility_im",
    "section": "general",
    "aliases": [
      "immotility (im) %",
      "im"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "total_motile_sperm_count_tmsc",
    "section": "semen_analysis",
    "aliases": [
      "total motile sperm count (tmsc)",
      "tmsc"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "sperm_morphology_normal_forms",
    "section": "semen_analysis",
    "aliases": [
      "sperm morphology - normal forms (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "sperm_head_defects",
    "section": "semen_analysis",
    "aliases": [
      "sperm head defects (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "sperm_midpiece_defects",
    "section": "semen_analysis",
    "aliases": [
      "sperm midpiece defects (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "sperm_tail_defects",
    "section": "semen_analysis",
    "aliases": [
      "sperm tail defects (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "sperm_vitality_viability",
    "section": "semen_analysis",
    "aliases": [
      "sperm vitality / viability (%)",
      "%"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "pus_cells_leucocytes_per_hpf",
    "section": "general",
    "aliases": [
      "pus cells / leucocytes (per hpf)",
      "per",
      "hpf"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "round_cells_per_ml",
    "section": "general",
    "aliases": [
      "round cells per ml"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "sperm_agglutination",
    "section": "semen_analysis",
    "aliases": [
      "sperm agglutination"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "interpretation_fertility_prognosis",
    "section": "general",
    "aliases": [
      "interpretation / fertility prognosis"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "height",
    "section": "general",
    "aliases": [
      "height"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "weight",
    "section": "general",
    "aliases": [
      "weight"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "bmi",
    "section": "general",
    "aliases": [
      "bmi",
      "body mass index"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "waist",
    "section": "general",
    "aliases": [
      "waist",
      "waist circumference"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "systolic_blood_pressure",
    "section": "general",
    "aliases": [
      "systolic blood pressure",
      "blood_pressure_high",
      "bp systolic"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    "canonical_name": "diastolic_blood_pressure",
    "section": "general",
    "aliases": [
      "diastolic blood pressure",
      "blood_pressure_low",
      "bp diastolic"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  },
  {
    // Special-cased in parameterExtractor.service.js: a value like "130.0/80.0" under
    // this mapping gets split into systolic_blood_pressure / diastolic_blood_pressure
    // rather than stored as one unusable combined string — some real reports print
    // blood pressure as a single "Blood Pressure" row with a slash-separated value
    // instead of two separate systolic/diastolic rows.
    "canonical_name": "blood_pressure_combined",
    "section": "general",
    "aliases": [
      "blood pressure"
    ],
    "expected_units": [],
    "normal_range_type": "unknown"
  }
];

// Shared normalization for both the alias index and incoming raw names, so e.g. a
// hyphenated alias ("rdw-cv") and a parenthesized real-world label ("RDW (CV)")
// converge on the same normalized form instead of differing by punctuation alone —
// Fuse's fuzzy threshold does NOT reliably treat "-" vs " " as a near-miss on short
// strings, so without this the two would fail to match despite being the same test.
function normalizeParamName(raw) {
  return raw
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const searchableParams = [];
// Exact-match index for short abbreviations (PCV, MCV, TLC, Hb, ...) — these are all
// explicitly registered aliases, so an exact lookup resolves them with zero fuzzy
// false-positive risk. Fuzzy matching short queries against a corpus of much longer
// alias strings is inherently noisy (e.g. "ID" — from "Patient ID" — fuzzy-matched
// "triglycerides" at the relaxed length floor below, fabricating a bogus lab value),
// so fuzzy search stays gated behind a longer minimum length further down.
const exactAliasIndex = new Map();
parametersOntology.forEach(param => {
  param.aliases.forEach(alias => {
    const normalizedAlias = normalizeParamName(alias);
    searchableParams.push({
      canonical_name: param.canonical_name,
      section: param.section,
      expected_units: param.expected_units,
      alias: normalizedAlias
    });
    if (!exactAliasIndex.has(normalizedAlias)) {
      exactAliasIndex.set(normalizedAlias, {
        canonical_name: param.canonical_name,
        section: param.section,
        expected_units: param.expected_units
      });
    }
  });
});

const fuse = new Fuse(searchableParams, {
  keys: ['alias'],
  threshold: 0.3,
  includeScore: true
});

class OntologyMapperService {
  mapParameter(rawName, currentSection) {
    if (!rawName) return null;

    // Normalize string: lowercase, and unwrap (don't delete) parenthetical content —
    // e.g. "RDW (CV)" must stay recognizable as "rdw cv" to match the "rdw-cv" alias.
    // Fully deleting the parenthetical (the previous behavior) reduced it to just
    // "RDW", which is indistinguishable from the unrelated RDW-SD parameter and
    // couldn't match the RDW-CV alias at all.
    const normalized = normalizeParamName(rawName);
    if (normalized.length < 2) return null;

    // Exact match first — this is how real short lab abbreviations (Hb, PCV, MCV,
    // MCH, TLC, ...) get recognized: they're registered aliases, so an exact lookup
    // finds them with no fuzzy tolerance and thus no false-positive risk.
    const exact = exactAliasIndex.get(normalized);
    if (exact) {
      return { canonical_name: exact.canonical_name, section: exact.section, expected_units: exact.expected_units || [], match_score: 1.0 };
    }

    // Fuzzy fallback (OCR typos, minor wording variance) — gated to longer strings
    // only. Below this length, fuzzy matching against a corpus of much longer alias
    // strings has too high a false-positive rate (e.g. "ID", from "Patient ID",
    // fuzzy-matched "triglycerides" and fabricated a bogus lab value).
    if (normalized.length < 4) return null;

    const results = fuse.search(normalized);
    
    for (const result of results) {
      if (result.score <= 0.15) {
        // If score is very good, ignore section mismatch
        // Or if sections loosely match
        const itemSec = result.item.section || '';
        const currSec = currentSection || '';
        
        if (result.score <= 0.1 || !currSec || itemSec === 'general' || currSec.includes(itemSec) || itemSec.includes(currSec)) {
          return {
            canonical_name: result.item.canonical_name,
            section: result.item.section,
            expected_units: result.item.expected_units || [],
            match_score: 1.0 - result.score
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Content-driven gender resolver.
   * Determines the biological gender of a report by inspecting its parsed extracted_json.
   *
   * @param {Object} extractedJson
   * @param {string} [rawText='']
   * @returns {'male' | 'female' | null}
   */
  resolveGenderRole(extractedJson, rawText = '') {
    if (!extractedJson || typeof extractedJson !== 'object') return null;

    function hasParam(obj, paramName) {
      if (!obj) return false;
      for (const sectionKey of Object.keys(obj)) {
        const section = obj[sectionKey];
        if (section && typeof section === 'object' && section[paramName] !== undefined) return true;
      }
      return false;
    }

    const MALE_MARKERS = ['semen_volume', 'sperm_concentration', 'total_sperm_count', 'total_sperm_motility_', 'progressive_motility_pr_'];
    for (const marker of MALE_MARKERS) {
      if (hasParam(extractedJson, marker)) {
        return 'male';
      }
    }

    const FEMALE_MARKERS = ['rubella_igg_antibody_quantitative_iu_ml', 'rubella_igg_interpretation_immune_non_immune', 'amh', 'anti_mullerian_hormone', 'afc'];
    for (const marker of FEMALE_MARKERS) {
      if (hasParam(extractedJson, marker)) {
        return 'female';
      }
    }

    if (rawText) {
      if (/\b(Mr\.|Age\/Sex:\s*\d+\s*Yrs?\s*\/\s*M\b)/i.test(rawText)) {
        return 'male';
      }
      if (/\b(Ms\.|Mrs\.|Age\/Sex:\s*\d+\s*Yrs?\s*\/\s*F\b)/i.test(rawText)) {
        return 'female';
      }
    }

    return null;
  }
}

module.exports = new OntologyMapperService();
