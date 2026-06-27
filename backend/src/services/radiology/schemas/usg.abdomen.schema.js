module.exports = {
  modalityKey: 'USG_ABDOMEN',
  label: 'USG Abdomen',
  systemPromptAdditions: `
    Extract Whole Abdomen sonography details.
    Map liver fatty grade, hepatomegaly, gallbladder stones, pancreas size, spleen size, kidney cysts/stones/hydronephrosis, bladder wall and mass, prostate volume and grade, uterus size and fibroids, ovaries size/volume and PCOS morphology.
  `,
  jsonSchema: {
    liver: { 
      fatty_grade: 'number | null', 
      hepatomegaly: 'boolean', 
      ihbr_dilated: 'boolean',
      focal_lesions: [{ type: 'string', size_mm: 'number | null' }] 
    },
    gallbladder: { 
      present: 'boolean', 
      calculi_present: 'boolean', 
      polyp_present: 'boolean', 
      wall_thickness_normal: 'boolean' 
    },
    pancreas: { 
      size_normal: 'boolean', 
      echotexture_normal: 'boolean', 
      focal_lesion: 'boolean', 
      calcifications: 'boolean' 
    },
    spleen: { 
      size_normal: 'boolean', 
      size_category: 'string', 
      focal_lesion: 'boolean' 
    },
    kidneys: { 
      right: { 
        calculi_present: 'boolean', 
        size_normal: 'boolean', 
        cysts: [{ type: 'string', size_mm: 'number | null' }], 
        hydronephrosis: 'boolean', 
        hydronephrosis_grade: 'number | null',
        corticomedullary_differentiation: 'normal | poor | lost'
      }, 
      left: { 
        calculi_present: 'boolean', 
        size_normal: 'boolean', 
        cysts: [{ type: 'string', size_mm: 'number | null' }], 
        hydronephrosis: 'boolean', 
        hydronephrosis_grade: 'number | null',
        corticomedullary_differentiation: 'normal | poor | lost'
      } 
    },
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
