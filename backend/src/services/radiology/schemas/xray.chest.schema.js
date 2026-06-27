module.exports = {
  modalityKey: 'XRAY_CHEST',
  label: 'Chest X-Ray',
  systemPromptAdditions: `
    If multiple chest X-ray views are in the same section (PA + AP), extract once and set
    view to the first view found. If both are explicitly separate sections, they will be
    handled as separate splits.
    All pathology fields: if report says "No evidence of X" or "X are clear/normal" → false.
  `,
  jsonSchema: {
    view: 'PA | AP | lateral | unknown',
    lung_fields_clear: 'boolean',
    cardiomegaly: 'boolean',
    cardiothoracic_ratio_normal: 'boolean',
    pleural_effusion: 'boolean',
    pneumothorax: 'boolean',
    consolidation: 'boolean',
    fibrosis: 'boolean',
    nodule: 'boolean',
    mediastinal_widening: 'boolean',
    hilar_prominence: 'boolean',
    tracheal_shift: 'boolean',
    cp_angles_clear: 'boolean',
    diaphragm_normal: 'boolean',
    bony_cage_normal: 'boolean',
    soft_tissue_normal: 'boolean',
    impression_normal: 'boolean',
    impression_text: 'string'
  }
};
