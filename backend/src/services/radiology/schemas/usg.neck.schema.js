module.exports = {
  modalityKey: 'USG_NECK',
  label: 'USG Neck (Thyroid)',
  systemPromptAdditions: `
    Extract thyroid lobe sizes if mentioned. Nodule: extract size in mm and echotexture.
    Goiter flag: if thyroid is globally enlarged. Vascularity from Doppler if mentioned.
    Lymphadenopathy: if "No cervical lymphadenopathy" → false.
  `,
  jsonSchema: {
    right_lobe_normal: 'boolean',
    left_lobe_normal: 'boolean',
    isthmus_normal: 'boolean',
    goiter: 'boolean',
    nodule_present: 'boolean',
    nodules: [{ size_mm: 'number | null', echotexture: 'string', side: 'right | left | isthmus' }],
    smoke_free: 'boolean | null',
    vascularity_normal: 'boolean',
    cervical_lymphadenopathy: 'boolean',
    submandibular_glands_normal: 'boolean | null',
    surrounding_vessels_normal: 'boolean',
    impression_normal: 'boolean',
    impression_text: 'string'
  }
};
