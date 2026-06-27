module.exports = {
  modalityKey: 'USG_PELVIS',
  label: 'USG Pelvis',
  systemPromptAdditions: `
    Extract Pelvic sonography details.
    Map urinary bladder wall/mass/calculi, prostate size/volume/grade, uterus size and fibroids, ovaries size/volume and PCOS morphology.
  `,
  jsonSchema: {
    urinary_bladder: { 
      wall_thickness_normal: 'boolean', 
      calculi_present: 'boolean', 
      post_void_residual_cc: 'number', 
      mass_present: 'boolean' 
    },
    prostate: { 
      _applicable: 'boolean', 
      size_normal: 'boolean', 
      grade: 'string', 
      volume_cc: 'number', 
      weight_grams: 'number | null' 
    },
    uterus: { 
      _applicable: 'boolean', 
      size_normal: 'boolean', 
      fibroid_present: 'boolean', 
      collection_in_cavity: 'boolean' 
    },
    ovaries: { 
      _applicable: 'boolean', 
      pcos_morphology_bilateral: 'boolean', 
      pcos_morphology_unilateral: 'boolean',
      right: { volume_cc: 'number | null', cyst_present: 'boolean' },
      left: { volume_cc: 'number | null', cyst_present: 'boolean' },
      pouch_of_douglas_free_fluid: 'boolean',
      vaginal_cyst_collection: 'boolean'
    }
  }
};
