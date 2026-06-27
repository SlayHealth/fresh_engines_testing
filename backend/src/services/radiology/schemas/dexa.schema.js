module.exports = {
  modalityKey: 'DEXA',
  label: 'DEXA Bone Densitometry',
  systemPromptAdditions: `
    Extract T-score and Z-score as floating point numbers (e.g. "-2.3" → -2.3).
    WHO Classification: if T-score >= -1 → "normal", -1 to -2.5 → "osteopenia",
    <= -2.5 → "osteoporosis".
    Identify the site with the LOWEST T-score as the clinical decision site.
  `,
  jsonSchema: {
    sites: {
      lumbar_spine: {
        region: 'string | null',
        bmd_g_cm2: 'number | null',
        t_score: 'number | null',
        z_score: 'number | null',
        who_classification: 'normal | osteopenia | osteoporosis | null'
      },
      left_hip: {
        bmd_g_cm2: 'number | null',
        t_score: 'number | null',
        z_score: 'number | null',
        who_classification: 'normal | osteopenia | osteoporosis | null'
      },
      right_hip: {
        bmd_g_cm2: 'number | null',
        t_score: 'number | null',
        z_score: 'number | null',
        who_classification: 'normal | osteopenia | osteoporosis | null'
      },
      forearm: {
        side: 'left | right | null',
        region: 'string | null',
        bmd_g_cm2: 'number | null',
        t_score: 'number | null',
        z_score: 'number | null',
        who_classification: 'normal | osteopenia | osteoporosis | null'
      }
    },
    lowest_t_score_site: 'string | null',
    lowest_t_score_value: 'number | null',
    overall_who_classification: 'normal | osteopenia | osteoporosis'
  }
};
