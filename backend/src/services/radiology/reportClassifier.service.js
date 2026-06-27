const MODALITY_PATTERNS = [
  {
    key: 'USG_ABDOMEN',
    patterns: [
      /USG\s+(WHOLE\s+)?ABDOMEN/i,
      /ULTRASONOGRAPHY\s+OF\s+ABDOMEN/i,
      /USG\s+REPORT\s*[-–]\s*ABDOMEN/i
    ]
  },
  {
    key: 'USG_SCROTUM_DOPPLER',
    patterns: [
      /USG\s+SCROTUM/i,
      /SCROTAL\s+(ULTRASOUND|SONOGRAPHY)/i,
      /COLOR\s+DOPPLER.*SCROTUM/i,
      /TESTIS|TESTES|TESTICULAR/i
    ]
  },
  {
    key: 'USG_TVS',
    patterns: [
      /USG\s+TVS/i,
      /TRANSVAGINAL\s+(SONOGRAPHY|SCAN|ULTRASOUND)/i,
      /TVS\s+FINDINGS/i
    ]
  },
  {
    key: 'USG_PELVIS',
    patterns: [
      /USG\s+PELVIS(?!\s*&\s*ABDOMEN)/i,
      /ULTRASONOGRAPHY\s+OF\s+(THE\s+)?PELVIS/i,
      /USG\s+PELVIS\s*FINDINGS/i
    ]
  },
  {
    key: 'USG_ABDOMEN_PELVIS',
    patterns: [
      /USG\s+ABDOMEN\s*[&+]\s*PELVIS/i,
      /ABDOMEN\s+AND\s+PELVIS/i
    ]
  },
  {
    key: 'ECHO',
    patterns: [
      /ECHOCARDIOGRAPH/i,
      /2D\s+(ECHO|ECHOCARDIOGRAPH)/i,
      /LVEF/i,
      /LEFT\s+VENTRICULAR.*FUNCTION/i
    ]
  },
  {
    key: 'XRAY_CHEST',
    patterns: [
      /X[\s-]?RAY\s+CHEST/i,
      /CHEST\s+X[\s-]?RAY/i,
      /CHEST\s+(PA|AP)\s+VIEW/i
    ]
  },
  {
    key: 'USG_NECK',
    patterns: [
      /USG\s+NECK/i,
      /THYROID.*ULTRASOUND/i,
      /ULTRASOUND.*THYROID/i,
      /NECK\s+SONOGRAPHY/i
    ]
  },
  {
    key: 'DEXA',
    patterns: [
      /DEXA/i,
      /BONE\s+DENSITOMETRY/i,
      /BONE\s+MINERAL\s+DENSITY/i,
      /T[\s-]SCORE/i
    ]
  },
  {
    key: 'MRI_BRAIN',
    patterns: [
      /MRI\s+BRAIN/i,
      /MR\s+IMAGING.*BRAIN/i,
      /BRAIN\s+MRI/i
    ]
  },
  {
    key: 'MRA_BRAIN',
    patterns: [
      /MR[\s-]?ANGIOGRAPHY\s+(OF\s+)?BRAIN/i,
      /MRA\s+BRAIN/i,
      /CEREBRAL\s+ANGIOGRAPH/i
    ]
  },
  {
    key: 'MRI_RENAL',
    patterns: [
      /MRI\s+RENAL/i,
      /RENAL\s+(MRI|ANGIOGRAPH)/i,
      /MRI.*RENAL\s+ANGIOGRAPH/i
    ]
  },
  {
    key: 'MRA_AORTA',
    patterns: [
      /AORTA.*ANGIOGRAPH/i,
      /MRA.*AORTA/i,
      /THORAC(IC)?\s+(AND|&)\s+ABDOMINAL\s+AORTA/i
    ]
  }
];

class ReportClassifierService {
  classify(rawText) {
    if (!rawText) return [];
    const detected = [];

    for (const modality of MODALITY_PATTERNS) {
      for (const pattern of modality.patterns) {
        const match = pattern.exec(rawText);
        if (match) {
          detected.push({
            key: modality.key,
            matchIndex: match.index,
            matchText: match[0]
          });
          break; // one match per modality is enough
        }
      }
    }

    // Sort by position in document
    detected.sort((a, b) => a.matchIndex - b.matchIndex);

    // Merge USG_ABDOMEN + USG_PELVIS when found together
    // If USG_ABDOMEN_PELVIS is detected, remove standalone ABDOMEN and PELVIS entries
    const hasAbdomenPelvis = detected.some(d => d.key === 'USG_ABDOMEN_PELVIS');
    const filtered = hasAbdomenPelvis
      ? detected.filter(d => !['USG_ABDOMEN', 'USG_PELVIS'].includes(d.key))
      : detected;

    return filtered;
  }
}

module.exports = new ReportClassifierService();
