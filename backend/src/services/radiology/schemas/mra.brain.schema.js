module.exports = {
  modalityKey: 'MRA_BRAIN',
  label: 'MRA Brain',
  systemPromptAdditions: 'Flag any vascular abnormality, stenosis, or aneurysms. Informational only.',
  jsonSchema: {
    study_normal: 'boolean',
    aneurysm_present: 'boolean',
    stenosis_present: 'boolean',
    circle_of_willis_normal: 'boolean',
    impression_text: 'string'
  }
};
