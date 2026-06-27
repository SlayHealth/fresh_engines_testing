const schemas = {
  USG_ABDOMEN:          require('./schemas/usg.abdomen.schema'),
  USG_ABDOMEN_PELVIS:   require('./schemas/usg.abdomen.schema'), // abdomen contains both
  USG_PELVIS:           require('./schemas/usg.pelvis.schema'),
  USG_TVS:              require('./schemas/usg.tvs.schema'),
  USG_SCROTUM_DOPPLER:  require('./schemas/usg.scrotum.schema'),
  ECHO:                 require('./schemas/echo.schema'),
  XRAY_CHEST:           require('./schemas/xray.chest.schema'),
  USG_NECK:             require('./schemas/usg.neck.schema'),
  DEXA:                 require('./schemas/dexa.schema'),
  MRI_BRAIN:            require('./schemas/mri.brain.schema'),
  MRA_BRAIN:            require('./schemas/mra.brain.schema'),
  MRI_RENAL:            require('./schemas/mri.renal.schema'),
  MRA_AORTA:            require('./schemas/mra.aorta.schema'),
};

// NuptiaScore weights (total radiology module = 30% of NuptiaScore)
const nuptiaWeights = {
  USG_ABDOMEN:          0.08,
  USG_ABDOMEN_PELVIS:   0.08,
  USG_SCROTUM_DOPPLER:  0.10,
  USG_TVS:              0.10,
  USG_PELVIS:           0.05,
  ECHO:                 0.05,
  XRAY_CHEST:           0.03,
  USG_NECK:             0.02,
  DEXA:                 0.02,
  MRI_BRAIN:            0.00, // informational
  MRA_BRAIN:            0.00,
  MRI_RENAL:            0.01,
  MRA_AORTA:            0.01,
};

module.exports = {
  get: (modalityKey) => schemas[modalityKey] || null,
  getWeight: (modalityKey) => nuptiaWeights[modalityKey] || 0,
  getSupportedKeys: () => Object.keys(schemas)
};
