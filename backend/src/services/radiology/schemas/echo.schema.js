module.exports = {
  modalityKey: 'ECHO',
  label: 'Echocardiography',
  systemPromptAdditions: `
    LVEF: extract number only (e.g. "LVEF 60%" → 60).
    MR/TR/AR severity: none | mild | moderate | severe.
    Diastolic dysfunction grade: Grade I, II, or III → extract number.
    PASP: extract from "PASP = 18 + 10 = 28mmHg" → pasp_mmhg: 28.
    PAH severity: none if PASP <30, mild 30-50, moderate 50-70, severe >70.
    If "No RWMA" → rwma: false. If "No pericardial effusion" → pericardial_effusion: false.
  `,
  jsonSchema: {
    lvef_percent: 'number | null',
    lv_size_normal: 'boolean',
    lvid_mm: 'number | null',
    ivs_mm: 'number | null',
    pwd_mm: 'number | null',
    la_size_mm: 'number | null',
    aorta_ed_mm: 'number | null',
    rwma: 'boolean',
    diastolic_dysfunction: 'boolean',
    diastolic_dysfunction_grade: 'null | 1 | 2 | 3',
    pericardial_effusion: 'boolean',
    thrombus: 'boolean',
    vegetation: 'boolean',
    ivc_normal: 'boolean',
    rv_function_normal: 'boolean',
    valves: {
      mitral: { normal: 'boolean', mr_grade: 'none | mild | moderate | severe', ms: 'boolean' },
      aortic: { normal: 'boolean', ar_grade: 'none | mild | moderate | severe', as_present: 'boolean' },
      tricuspid: { normal: 'boolean', tr_grade: 'none | mild | moderate | severe' },
      pulmonary: { normal: 'boolean', pr_grade: 'none | mild | moderate | severe' }
    },
    pah: {
      present: 'boolean',
      pasp_mmhg: 'number | null',
      severity: 'none | mild | moderate | severe'
    },
    impression_normal: 'boolean',
    impression_text: 'string'
  }
};
