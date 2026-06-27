class ReportAggregatorService {
  aggregate(extractionResults) {
    const record = {
      modalities_detected: [],
      modalities_failed: [],
      unified: {}
    };

    for (const result of extractionResults) {
      if (result.error || !result.extracted) {
        record.modalities_failed.push({ key: result.modalityKey, reason: result.error });
        continue;
      }

      record.modalities_detected.push(result.modalityKey);
      record.unified[result.modalityKey] = result.extracted;
    }

    // Conflict resolution: MRI renal data overrides USG kidney size
    if (record.unified.MRI_RENAL && record.unified.USG_ABDOMEN) {
      // MRI kidney measurements are more accurate — flag in metadata
      record.unified._kidney_size_source = 'MRI_RENAL';
    }

    // If both USG_ABDOMEN and USG_ABDOMEN_PELVIS detected, use the more complete one
    if (record.unified.USG_ABDOMEN && record.unified.USG_ABDOMEN_PELVIS) {
      delete record.unified.USG_ABDOMEN; // pelvis version is superset
    }

    return record;
  }
}

module.exports = new ReportAggregatorService();
