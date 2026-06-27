module.exports = {
  modalityKey: 'MRI_BRAIN',
  label: 'MRI Brain',
  systemPromptAdditions: 'Flag any abnormality. These are informational only.',
  jsonSchema: {
    study_normal: 'boolean',
    focal_lesion: 'boolean',
    white_matter_changes: 'boolean',
    restricted_diffusion: 'boolean',
    ventricular_system_normal: 'boolean',
    impression_text: 'string'
  }
};
