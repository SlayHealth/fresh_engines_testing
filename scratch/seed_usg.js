const { db } = require('../backend/src/services/storage/sqlite.service');
const { v4: uuidv4 } = require('uuid');

const F_KARTIKAY = {
  patient: { patient_slay_id: 'KB_01', name: 'Kartikay Bajaj', age_years: 24, sex: 'Male', bmi: 33 },
  findings: {
    liver: { hepatomegaly: true, fatty_grade: 2 },
    gallbladder: { present: true, calculi_present: false },
    pancreas: { size_normal: true, echotexture_normal: true },
    spleen: { echotexture_normal: true },
    kidneys: { right: { size_normal: true, calculi_present: false }, left: { size_normal: true, calculi_present: false } },
    urinary_bladder: { wall_thickness_normal: true },
    prostate: { _applicable: true, size_normal: true, grade: 'normal' }
  }
};

const F_SIMRAN = {
  patient: { patient_slay_id: 'SIM_01', name: 'Ms. Simran', age_years: 23, sex: 'Female' },
  findings: {
    liver: { fatty_grade: 0 },
    uterus: { _applicable: true, size_normal: true },
    ovaries: { _applicable: true, right: { volume_cc: 10.1, morphology: 'polycystic' }, left: { volume_cc: 8.5, morphology: 'polycystic' }, pcos_morphology_bilateral: true }
  }
};

const { analyzeUsg } = require('../backend/src/controllers/usg.controller');
const runAnalysis = require('../backend/src/controllers/usg.controller').analyzeUsg; 
// Actually runAnalysis is not exported directly, but analyzeUsg is. 
// We can just use axios to hit localhost:3001
