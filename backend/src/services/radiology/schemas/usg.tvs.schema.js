module.exports = {
  modalityKey: 'USG_TVS',
  label: 'Transvaginal Sonography',
  systemPromptAdditions: `
    TVS provides more detail than transabdominal USG pelvis.
    Extract antral follicle count (AFC) if mentioned.
    Endometrial thickness in mm — extract the number only.
    If "No adnexal lesion" → adnexal_mass: false on both sides.
  `,
  jsonSchema: {
    uterus: {
      position: 'anteverted | retroverted | axial | null',
      length_mm: 'number | null',
      width_mm: 'number | null',
      ap_mm: 'number | null',
      size_normal: 'boolean',
      myometrial_echotexture_normal: 'boolean',
      fibroid_present: 'boolean',
      fibroid_count: 'number | null',
      endometrial_thickness_mm: 'number | null',
      endometrial_cavity_clear: 'boolean',
      cervix_normal: 'boolean'
    },
    right_ovary: {
      length_mm: 'number | null',
      width_mm: 'number | null',
      volume_cc: 'number | null',
      morphology_normal: 'boolean',
      pcos_morphology: 'boolean',
      antral_follicle_count: 'number | null',
      dominant_follicle_mm: 'number | null',
      cyst_present: 'boolean',
      cyst_details: [{ type: 'string', size_mm: 'number | null' }],
      mass_present: 'boolean'
    },
    left_ovary: {
      length_mm: 'number | null',
      width_mm: 'number | null',
      volume_cc: 'number | null',
      morphology_normal: 'boolean',
      pcos_morphology: 'boolean',
      antral_follicle_count: 'number | null',
      dominant_follicle_mm: 'number | null',
      cyst_present: 'boolean',
      cyst_details: [{ type: 'string', size_mm: 'number | null' }],
      mass_present: 'boolean'
    },
    pcos_morphology_bilateral: 'boolean',
    pouch_of_douglas_free_fluid: 'boolean',
    adnexal_mass: 'boolean',
    impression_normal: 'boolean',
    impression_text: 'string'
  }
};
