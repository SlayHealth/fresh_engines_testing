module.exports = {
  modalityKey: 'MRA_AORTA',
  label: 'MRA Aorta',
  systemPromptAdditions: 'Extract thoracic and abdominal aorta details, aneurysm, stenosis, or narrowing.',
  jsonSchema: {
    study_normal: 'boolean',
    aneurysm_present: 'boolean',
    luminal_narrowing: 'boolean',
    branching_vessels_normal: 'boolean',
    impression_text: 'string'
  }
};
