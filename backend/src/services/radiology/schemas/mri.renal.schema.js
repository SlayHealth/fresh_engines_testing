module.exports = {
  modalityKey: 'MRI_RENAL',
  label: 'MRI Renal',
  systemPromptAdditions: 'Extract renal artery stenosis, aneurysms, and kidney sizes in mm.',
  jsonSchema: {
    study_normal: 'boolean',
    renal_artery_stenosis: 'boolean',
    aneurysm_present: 'boolean',
    kidneys: {
      right: { size_normal: 'boolean', length_mm: 'number | null' },
      left: { size_normal: 'boolean', length_mm: 'number | null' }
    },
    impression_text: 'string'
  }
};
