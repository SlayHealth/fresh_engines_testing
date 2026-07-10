const Fuse = require('fuse.js');
const logger = require('../../utils/logger');

const sections = [
  {
    "id": "blood_group_abo_typing",
    "name": "Blood Group - ABO Typing",
    "aliases": [
      "blood group - abo typing",
      "blood group abo & rh typing"
    ]
  },
  {
    "id": "blood_group_rh_rhesus_typing",
    "name": "Blood Group - Rh (Rhesus) Typing",
    "aliases": [
      "blood group - rh (rhesus) typing",
      "rhesus"
    ]
  },
  {
    "id": "complete_blood_count_cbc_hemogram",
    "name": "Complete Blood Count (CBC) / Hemogram",
    "aliases": [
      "complete blood count (cbc) / hemogram",
      "cbc",
      "hemogram"
    ]
  },
  {
    "id": "erythrocyte_sedimentation_rate_esr",
    "name": "Erythrocyte Sedimentation Rate (ESR)",
    "aliases": [
      "erythrocyte sedimentation rate (esr)",
      "esr"
    ]
  },
  {
    "id": "blood_sugar_fasting_fbs_fbg",
    "name": "Blood Sugar - Fasting (FBS / FBG)",
    "aliases": [
      "blood sugar - fasting (fbs / fbg)",
      "fbs",
      "fbg"
    ]
  },
  {
    "id": "blood_sugar_random_rbs_bsr",
    "name": "Blood Sugar - Random (RBS / BSR)",
    "aliases": [
      "blood sugar - random (rbs / bsr)",
      "rbs",
      "bsr"
    ]
  },
  {
    "id": "glycated_hemoglobin_hba1c",
    "name": "Glycated Hemoglobin (HbA1c)",
    "aliases": [
      "glycated hemoglobin (hba1c)",
      "hba1c"
    ]
  },
  {
    "id": "average_blood_glucose_abg",
    "name": "Average Blood Glucose (ABG)",
    "aliases": [
      "average blood glucose (abg)",
      "abg"
    ]
  },
  {
    "id": "liver_function_test_lft_total_bilirubin",
    "name": "Liver Function Test (LFT) - Total Bilirubin",
    "aliases": [
      "liver function test (lft) - total bilirubin",
      "lft"
    ]
  },
  {
    "id": "liver_function_test_lft_sgpt_alt",
    "name": "Liver Function Test (LFT) - SGPT / ALT",
    "aliases": [
      "liver function test (lft) - sgpt / alt",
      "lft"
    ]
  },
  {
    "id": "liver_function_test_lft_sgot_ast",
    "name": "Liver Function Test (LFT) - SGOT / AST",
    "aliases": [
      "liver function test (lft) - sgot / ast",
      "lft"
    ]
  },
  {
    "id": "kidney_function_test_kft",
    "name": "Kidney Function Test (KFT)",
    "aliases": [
      "kidney function test (kft)",
      "kft"
    ]
  },
  {
    "id": "serum_iron",
    "name": "Serum Iron",
    "aliases": [
      "serum iron"
    ]
  },
  {
    "id": "total_iron_binding_capacity_tibc",
    "name": "Total Iron Binding Capacity (TIBC)",
    "aliases": [
      "total iron binding capacity (tibc)",
      "tibc"
    ]
  },
  {
    "id": "unsaturated_iron_binding_capacity_uibc",
    "name": "Unsaturated Iron Binding Capacity (UIBC)",
    "aliases": [
      "unsaturated iron binding capacity (uibc)",
      "uibc"
    ]
  },
  {
    "id": "transferrin_saturation",
    "name": "Transferrin Saturation (%)",
    "aliases": [
      "transferrin saturation (%)",
      "transferrin saturation"
    ]
  },
  {
    "id": "serum_ferritin",
    "name": "Serum Ferritin",
    "aliases": [
      "serum ferritin"
    ]
  },
  {
    "id": "hemoglobin_hplc_variant_analysis",
    "name": "Hemoglobin HPLC / Variant Analysis",
    "aliases": [
      "hemoglobin hplc / variant analysis"
    ]
  },
  {
    "id": "hemoglobin_a2",
    "name": "Hemoglobin A2",
    "aliases": [
      "hemoglobin a2"
    ]
  },
  {
    "id": "hemoglobin_c",
    "name": "Hemoglobin C",
    "aliases": [
      "hemoglobin c"
    ]
  },
  {
    "id": "hemoglobin_d",
    "name": "Hemoglobin D",
    "aliases": [
      "hemoglobin d"
    ]
  },
  {
    "id": "hemoglobin_f",
    "name": "Hemoglobin F",
    "aliases": [
      "hemoglobin f"
    ]
  },
  {
    "id": "hemoglobin_s",
    "name": "Hemoglobin S",
    "aliases": [
      "hemoglobin s"
    ]
  },
  {
    "id": "thyroid_test",
    "name": "Thyroid Test",
    "aliases": [
      "thyroid test",
      "thyroid stimulating hormone",
      "thyroid profile",
      "thyroid stimulating hormone (tsh)"
    ]
  },
  {
    "id": "vitamin_b12_cyanocobalamin",
    "name": "Vitamin B12 (Cyanocobalamin)",
    "aliases": [
      "vitamin b12 (cyanocobalamin)",
      "cyanocobalamin"
    ]
  },
  {
    "id": "lipid_profile_lipid_screen",
    "name": "Lipid Profile / Lipid Screen",
    "aliases": [
      "lipid profile / lipid screen"
    ]
  },
  {
    "id": "syphilis_vdrl_rpr",
    "name": "Syphilis - VDRL / RPR",
    "aliases": [
      "syphilis - vdrl / rpr"
    ]
  },
  {
    "id": "hepatitis_b_surface_antigen_hbsag",
    "name": "Hepatitis B Surface Antigen (HBsAg)",
    "aliases": [
      "hepatitis b surface antigen (hbsag)",
      "hepatitis b surface antigen (hbsag), rapid card",
      "hbsag"
    ]
  },
  {
    "id": "hepatitis_c_virus_antibody_anti_hcv",
    "name": "Hepatitis C Virus Antibody (Anti-HCV)",
    "aliases": [
      "hepatitis c virus antibody (anti-hcv)",
      "anti-hcv"
    ]
  },
  {
    "id": "hiv_1_2_antibody_test",
    "name": "HIV 1 & 2 Antibody Test",
    "aliases": [
      "hiv 1 & 2 antibody test"
    ]
  },
  {
    "id": "hiv_combo_p24_antigen_antibody_test",
    "name": "HIV Combo (P24 Antigen + Antibody) Test",
    "aliases": [
      "hiv combo (p24 antigen + antibody) test",
      "hiv combo",
      "p24 combo"
    ]
  },
  {
    "id": "rubella_virus_igg_antibody",
    "name": "Rubella Virus IgG Antibody",
    "aliases": [
      "rubella virus igg antibody"
    ]
  },
  {
    "id": "urine_routine",
    "name": "Urine Routine & Microscopy Examination",
    "aliases": [
      "urine routine & microscopy examination",
      "urine routine",
      "urine examination"
    ]
  },
  {
    "id": "semen_analysis",
    "name": "Semen Analysis",
    "aliases": [
      "semen analysis"
    ]
  },
  {
    "id": "urine_routine",
    "name": "Urine Routine",
    "aliases": [
      "urine routine",
      "urine routine & microscopy examination",
      "urine analysis"
    ]
  }
];

const searchableSections = [];
sections.forEach(sec => {
  sec.aliases.forEach(alias => {
    searchableSections.push({
      id: sec.id,
      canonical_name: sec.name,
      alias: alias
    });
  });
});

const fuse = new Fuse(searchableSections, {
  keys: ['alias'],
  threshold: 0.3,
  includeScore: true
});

class SectionDetectorService {
  detectSection(text) {
    if (!text || text.trim().length < 3) return null;
    
    // Guard: The TSH parameter name contains "uTSH" / "utsh", whereas the section header does not.
    // This prevents the TSH parameter from being incorrectly detected as a section header.
    if (text.toLowerCase().includes('utsh')) return null;

    const normalizedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    // Guard: bare "Hemoglobin" / "Hemoglobin (Hb)" — the plain CBC parameter every real
    // lab report lists first — fuzzy-matches the unrelated "Hemoglobin A2" section
    // header at this threshold (confirmed against real-world reports: every single one
    // tested had its Hemoglobin value silently dropped and the rest of its CBC panel
    // misattributed to the hemoglobin_a2 section as a result). The real HbA2 section
    // header always says "A2" explicitly, so excluding the bare form is safe.
    if (normalizedText === 'hemoglobin' || normalizedText === 'hemoglobin hb') return null;

    const results = fuse.search(normalizedText);
    if (results.length > 0 && results[0].score <= 0.4) {
      return results[0].item.id;
    }
    return null;
  }
}

module.exports = new SectionDetectorService();
