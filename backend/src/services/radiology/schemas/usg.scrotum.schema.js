module.exports = {
  modalityKey: 'USG_SCROTUM_DOPPLER',
  label: 'USG Scrotum with Color Doppler',
  systemPromptAdditions: `
    Map varicocele grades: Grade I = palpable only, Grade II = palpable + visible,
    Grade III = visible without palpation. Extract testis dimensions in mm.
    Compute volume if not stated: V = 0.523 × L × W × H.
    If "No evidence of varicocele" → varicocele.present: false.
  `,
  jsonSchema: {
    right_testis: {
      length_mm: 'number | null',
      width_mm: 'number | null',
      height_mm: 'number | null',
      volume_cc: 'number | null',
      echopattern_normal: 'boolean',
      focal_lesion: 'boolean',
      vascularity_normal: 'boolean'
    },
    left_testis: {
      length_mm: 'number | null',
      width_mm: 'number | null',
      height_mm: 'number | null',
      volume_cc: 'number | null',
      echopattern_normal: 'boolean',
      focal_lesion: 'boolean',
      vascularity_normal: 'boolean'
    },
    right_epididymis: {
      normal: 'boolean',
      thickened: 'boolean',
      cyst_present: 'boolean'
    },
    left_epididymis: {
      normal: 'boolean',
      thickened: 'boolean',
      cyst_present: 'boolean'
    },
    varicocele: {
      present: 'boolean',
      side: 'bilateral | right | left | none',
      grade: 'null | 1 | 2 | 3'
    },
    hydrocele: {
      present: 'boolean',
      side: 'bilateral | right | left | none',
      significant: 'boolean'
    },
    spermatic_cord_normal: 'boolean',
    inguinal_hernia: 'boolean',
    impression_normal: 'boolean',
    impression_text: 'string'
  }
};
