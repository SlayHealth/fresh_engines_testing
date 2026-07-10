module.exports = {
  modalityKey: 'ECG',
  label: 'Electrocardiogram (ECG)',
  systemPromptAdditions: `
    Heart rate: extract number only in bpm (e.g. "AR: 69bpm" or "Average Heart Rate: 83 bpm" → 69 / 83).
    Rhythm: "sinus" if "Sinus Rhythm" is stated, "atrial_fibrillation" if AFib/atrial fibrillation is mentioned,
      "other" for any other named arrhythmia, null if not stated.
    QTc interval: extract number in ms from any of "QTcB", "QTc Interval", "Corrected QT" (e.g. "QTcB: 412ms" → 412).
    QRS duration: extract number in ms from "QRSD", "QRS Complex", "QRS Duration" (e.g. "QRSD: 96ms" → 96).
    PR interval: extract number in ms from "PRI", "PR Interval", "P-R Interval" (e.g. "PRI: 172ms" → 172).
    Axis: "normal", "left_deviation", or "right_deviation" from "QRS Axis" or similar; null if not stated.
    LVH voltage criteria: true if the report mentions "voltage criteria for LVH" or suspected/possible LVH,
      false if LVH is explicitly ruled out, null if not mentioned at all.
    Baseline artefact: true if "baseline artefact" or "baseline wandering" is mentioned.
    impression_normal: true ONLY if the overall interpretation is unambiguously normal with nothing flagged
      for clinical correlation.
  `,
  jsonSchema: {
    heart_rate_bpm: 'number | null',
    rhythm: 'sinus | atrial_fibrillation | other | null',
    qtc_ms: 'number | null',
    qrs_ms: 'number | null',
    pr_ms: 'number | null',
    axis: 'normal | left_deviation | right_deviation | null',
    lvh_voltage_criteria: 'boolean | null',
    baseline_artefact: 'boolean | null',
    impression_normal: 'boolean',
    impression_text: 'string'
  }
};
