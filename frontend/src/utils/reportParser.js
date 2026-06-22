export function parsePatientMeta(rawOcrText) {
  if (!rawOcrText) return { name: '', age: '' };
  
  let name = '';
  let age = '';
  
  // Try to find Name
  const nameRegexes = [
    /(?:Patient\s+Name|Patient|Name)\s*[:\-]\s*([^\n\r\t:]+)/i,
    /(?:Patient\s+Name|Patient|Name)\s+([A-Za-z\s.-]{3,})/i
  ];
  for (const regex of nameRegexes) {
    const match = rawOcrText.match(regex);
    if (match && match[1]) {
      const parsedName = match[1].trim();
      const cleaned = parsedName.split(/(?:Age|Sex|Gender|Date|Ref|Dr\.|ID|Mr\.|Ms\.|Mrs\.)/i)[0].trim();
      const finalName = cleaned.replace(/[^a-zA-Z\s.-]/g, '').trim();
      if (finalName.length >= 2) {
        name = finalName;
        break;
      }
    }
  }

  // Try to find Age
  const ageRegexes = [
    /Age\s*[:\-]\s*(\d+)/i,
    /Age\s*\/?\s*Sex\s*[:\-]\s*(\d+)/i,
    /\b(\d+)\s*(?:Years|Yrs|Yr|Y)\b/i,
    /Age\s+(\d+)/i
  ];
  for (const regex of ageRegexes) {
    const match = rawOcrText.match(regex);
    if (match && match[1]) {
      const parsedAge = parseInt(match[1]);
      if (parsedAge >= 1 && parsedAge <= 120) {
        age = parsedAge;
        break;
      }
    }
  }

  return { name, age };
}

export function findExtractedParam(sections, canonical_name) {
  if (!sections) return null;
  for (const sectionKey of Object.keys(sections)) {
    const section = sections[sectionKey];
    if (section && section[canonical_name]) {
      return section[canonical_name];
    }
  }
  return null;
}

export function classifyOvarianReserve(amh, afc, ageNum) {
  const age = ageNum || 30;
  if (amh === undefined && afc === undefined) return null;
  
  let classAmh = null;
  if (amh !== undefined && amh !== null && !isNaN(amh)) {
    if (age < 30) {
      if (amh < 1.0) classAmh = 'Very Low';
      else if (amh <= 1.5) classAmh = 'Low';
      else if (amh <= 4.0) classAmh = 'Normal';
      else classAmh = 'High for age';
    } else if (age < 35) {
      if (amh < 0.8) classAmh = 'Very Low';
      else if (amh <= 1.2) classAmh = 'Low';
      else if (amh <= 3.5) classAmh = 'Normal';
      else classAmh = 'High for age';
    } else if (age < 40) {
      if (amh < 0.5) classAmh = 'Very Low';
      else if (amh <= 0.9) classAmh = 'Low';
      else if (amh <= 2.5) classAmh = 'Normal';
      else classAmh = 'High for age';
    } else {
      if (amh < 0.3) classAmh = 'Very Low';
      else if (amh <= 0.6) classAmh = 'Low';
      else if (amh <= 1.5) classAmh = 'Normal';
      else classAmh = 'High for age';
    }
  }

  let classAfc = null;
  if (afc !== undefined && afc !== null && !isNaN(afc)) {
    if (age < 30) {
      if (afc < 8) classAfc = 'Very Low';
      else if (afc <= 11) classAfc = 'Low';
      else if (afc <= 20) classAfc = 'Normal';
      else classAfc = 'High for age';
    } else if (age < 35) {
      if (afc < 6) classAfc = 'Very Low';
      else if (afc <= 9) classAfc = 'Low';
      else if (afc <= 18) classAfc = 'Normal';
      else classAfc = 'High for age';
    } else if (age < 40) {
      if (afc < 4) classAfc = 'Very Low';
      else if (afc <= 7) classAfc = 'Low';
      else if (afc <= 14) classAfc = 'Normal';
      else classAfc = 'High for age';
    } else {
      if (afc < 3) classAfc = 'Very Low';
      else if (afc <= 5) classAfc = 'Low';
      else if (afc <= 10) classAfc = 'Normal';
      else classAfc = 'High for age';
    }
  }

  const rank = { 'Very Low': 0, 'Low': 1, 'Normal': 2, 'High for age': 3 };
  if (classAmh && classAfc) {
    return rank[classAmh] < rank[classAfc] ? classAmh : classAfc;
  }
  return classAmh || classAfc || null;
}

export function parseMaleRadiology(rawOcrText) {
  if (!rawOcrText) return { 
    varicoceleGrade: '', 
    testicularVolume: '', 
    scrotalObstruction: '',
    prostateGrade: '',
    pvrVolume: '',
    fattyLiverGrade: ''
  };
  
  let varicoceleGrade = 'None';
  let testicularVolume = 'Normal';
  let scrotalObstruction = 'No';
  let prostateGrade = 'None';
  let pvrVolume = 'Normal';
  let fattyLiverGrade = 'None';

  // Varicocele detection
  if (/grade\s*3\s*varicocele/i.test(rawOcrText) || /severe\s*varicocele/i.test(rawOcrText)) {
    varicoceleGrade = 'Grade 3';
  } else if (/grade\s*2\s*varicocele/i.test(rawOcrText) || /moderate\s*varicocele/i.test(rawOcrText)) {
    varicoceleGrade = 'Grade 2';
  } else if (/grade\s*1\s*varicocele/i.test(rawOcrText) || /mild\s*varicocele/i.test(rawOcrText) || /varicocele/i.test(rawOcrText)) {
    varicoceleGrade = 'Grade 1';
  }

  // Testicular volume detection
  if (/testicular\s*atrophy/i.test(rawOcrText) || /reduced\s*testicular\s*volume/i.test(rawOcrText) || /small\s*testes/i.test(rawOcrText) || /volume\s*<\s*12\s*m[lL]/i.test(rawOcrText)) {
    testicularVolume = 'Low';
  }

  // Obstruction detection
  if (/epididymal\s*cyst/i.test(rawOcrText) || /epididymitis/i.test(rawOcrText) || /obstruction/i.test(rawOcrText) || /absence\s*of\s*vas\s*deferens/i.test(rawOcrText)) {
    scrotalObstruction = 'Yes';
  }

  // Prostate BPH Grade
  if (/prostatomegaly\s*(?:grade\s*3|gr-iii|severe)/i.test(rawOcrText) || /prostate\s*volume\s*>\s*50/i.test(rawOcrText)) {
    prostateGrade = 'Grade III';
  } else if (/prostatomegaly\s*(?:grade\s*2|gr-ii|moderate)/i.test(rawOcrText) || /prostate\s*(?:volume|weight)\s*(?:of\s*)?(?:[45]\d)\s*(?:cc|g)/i.test(rawOcrText)) {
    prostateGrade = 'Grade II';
  } else if (/prostatomegaly/i.test(rawOcrText) || /prostate\s*enlarged/i.test(rawOcrText) || /prostatomegaly\s*(?:grade\s*1|gr-i|mild)/i.test(rawOcrText)) {
    prostateGrade = 'Grade I';
  }

  // PVR Volume
  const pvrMatch = rawOcrText.match(/(?:post\s*void\s*residual|pvr)\s*(?:volume)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:cc|ml)/i);
  if (pvrMatch) {
    const vol = parseFloat(pvrMatch[1]);
    if (vol > 100) {
      pvrVolume = 'Significant';
    } else if (vol > 50) {
      pvrVolume = 'Borderline';
    }
  } else if (/significant\s*(?:post\s*void|pvr)/i.test(rawOcrText)) {
    pvrVolume = 'Significant';
  }

  // Fatty Liver Grade
  if (/fatty\s*liver\s*(?:grade\s*3|severe|gr-iii)/i.test(rawOcrText)) {
    fattyLiverGrade = 'Grade III';
  } else if (/fatty\s*liver\s*(?:grade\s*2|moderate|gr-ii)/i.test(rawOcrText)) {
    fattyLiverGrade = 'Grade II';
  } else if (/fatty\s*liver\s*(?:grade\s*1|mild|gr-i|infiltration)/i.test(rawOcrText) || /fatty\s*liver/i.test(rawOcrText)) {
    fattyLiverGrade = 'Grade I';
  }

  return { varicoceleGrade, testicularVolume, scrotalObstruction, prostateGrade, pvrVolume, fattyLiverGrade };
}

export function parseFemaleRadiology(rawOcrText) {
  if (!rawOcrText) return { 
    uterineLining: '', 
    fibroids: '', 
    tubalPatency: '',
    pcosMorphology: '',
    ovarianVolume: '',
    pelvicFluid: '',
    fattyLiverGrade: ''
  };

  let uterineLining = 'Normal';
  let fibroids = 'None';
  let tubalPatency = 'Both open';
  let pcosMorphology = 'None';
  let ovarianVolume = 'Normal';
  let pelvicFluid = 'No';
  let fattyLiverGrade = 'None';

  // Uterine lining (endometrial thickness)
  const endometrialMatch = rawOcrText.match(/endometrial\s*thickness\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mm/i);
  if (endometrialMatch) {
    const thickness = parseFloat(endometrialMatch[1]);
    if (thickness < 7) {
      uterineLining = 'Thin';
    } else if (thickness > 14) {
      uterineLining = 'Thick';
    }
  }

  // Fibroids detection
  if (/submucosal\s*fibroid/i.test(rawOcrText) || /submucous\s*fibroid/i.test(rawOcrText) || /uterine\s*polyp/i.test(rawOcrText)) {
    fibroids = 'Submucosal';
  } else if (/intramural\s*fibroid/i.test(rawOcrText)) {
    fibroids = 'Intramural';
  } else if (/subserosal\s*fibroid/i.test(rawOcrText)) {
    fibroids = 'Subserosal';
  } else if (/fibroid/i.test(rawOcrText)) {
    fibroids = 'Intramural'; // default fallback for unspecified fibroids
  }

  // Tubal patency detection (HSG)
  if (/bilateral\s*tubal\s*block/i.test(rawOcrText) || /both\s*tubes\s*blocked/i.test(rawOcrText) || /hydrosalpinx\s*bilateral/i.test(rawOcrText)) {
    tubalPatency = 'Both blocked';
  } else if (/unilateral\s*tubal\s*block/i.test(rawOcrText) || /one\s*tube\s*blocked/i.test(rawOcrText) || /spill\s*on\s*one\s*side/i.test(rawOcrText)) {
    tubalPatency = 'One blocked';
  } else if (/tubal\s*patency\s*intact/i.test(rawOcrText) || /both\s*tubes\s*patent/i.test(rawOcrText) || /free\s*spill/i.test(rawOcrText)) {
    tubalPatency = 'Both open';
  }

  // PCOS Morphology
  if (/bilateral\s*(?:polycystic|pcos|bcom)/i.test(rawOcrText) || /polycystic\s*ovaries\s*bilateral/i.test(rawOcrText)) {
    pcosMorphology = 'Bilateral';
  } else if (/unilateral\s*(?:polycystic|pcos|bcom)/i.test(rawOcrText) || /polycystic\s*ovary\s*unilateral/i.test(rawOcrText)) {
    pcosMorphology = 'Unilateral';
  } else if (/polycystic\s*ovarian\s*morphology|bcom|polycystic\s*ovaries/i.test(rawOcrText)) {
    pcosMorphology = 'Bilateral';
  }

  // Ovarian Volume
  const volMatches = [...rawOcrText.matchAll(/(?:volume|vol)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:cc|ml)/ig)];
  let hasEnlarged = false;
  for (const m of volMatches) {
    if (parseFloat(m[1]) > 10.0) {
      hasEnlarged = true;
      break;
    }
  }
  if (hasEnlarged || /bulky\s*ovaries|enlarged\s*ovaries|bulky\s*ovary/i.test(rawOcrText)) {
    ovarianVolume = 'Enlarged';
  }

  // Pelvic Free Fluid
  if (/free\s*fluid\s*(?:in\s*)?(?:pod|pouch\s*of\s*douglas|pelvis|pelvic)/i.test(rawOcrText) || /fluid\s*in\s*pelvis/i.test(rawOcrText)) {
    pelvicFluid = 'Yes';
  }

  // Fatty Liver Grade
  if (/fatty\s*liver\s*(?:grade\s*3|severe|gr-iii)/i.test(rawOcrText)) {
    fattyLiverGrade = 'Grade III';
  } else if (/fatty\s*liver\s*(?:grade\s*2|moderate|gr-ii)/i.test(rawOcrText)) {
    fattyLiverGrade = 'Grade II';
  } else if (/fatty\s*liver\s*(?:grade\s*1|mild|gr-i|infiltration)/i.test(rawOcrText) || /fatty\s*liver/i.test(rawOcrText)) {
    fattyLiverGrade = 'Grade I';
  }

  return { uterineLining, fibroids, tubalPatency, pcosMorphology, ovarianVolume, pelvicFluid, fattyLiverGrade };
}

export function parseMaleGenomics(rawOcrText) {
  if (!rawOcrText) return { yDeletion: '', maleKaryotype: '' };

  let yDeletion = 'None';
  let maleKaryotype = 'Normal 46,XY';

  // Y-chromosome microdeletion detection
  if (/\bAZFa\b/i.test(rawOcrText)) {
    yDeletion = 'AZFa';
  } else if (/\bAZFb\b/i.test(rawOcrText)) {
    yDeletion = 'AZFb';
  } else if (/\bAZFc\b/i.test(rawOcrText)) {
    yDeletion = 'AZFc';
  }

  // Karyotype detection
  if (/47\s*,\s*XXY/i.test(rawOcrText) || /Klinefelter/i.test(rawOcrText)) {
    maleKaryotype = 'Abnormal (47,XXY / other)';
  } else if (/abnormal\s*karyotype/i.test(rawOcrText)) {
    maleKaryotype = 'Abnormal (47,XXY / other)';
  }

  return { yDeletion, maleKaryotype };
}

export function parseFemaleGenomics(rawOcrText) {
  if (!rawOcrText) return { mthfr: '', femaleKaryotype: '', cftrCarrier: '' };

  let mthfr = 'None';
  let femaleKaryotype = 'Normal 46,XX';
  let cftrCarrier = 'No';

  // MTHFR mutations
  if (/homozygous\s*(?:for\s*)?MTHFR/i.test(rawOcrText) || /MTHFR\s*C677T\s*homozygous/i.test(rawOcrText)) {
    mthfr = 'Homozygous';
  } else if (/heterozygous\s*(?:for\s*)?MTHFR/i.test(rawOcrText) || /MTHFR\s*C677T\s*heterozygous/i.test(rawOcrText)) {
    mthfr = 'Heterozygous';
  }

  // Karyotype detection
  if (/45\s*,\s*X/i.test(rawOcrText) || /Turner/i.test(rawOcrText) || /abnormal\s*karyotype/i.test(rawOcrText)) {
    femaleKaryotype = 'Abnormal';
  }

  // CFTR carrier status
  if (/CFTR\s*mutation\s*detected/i.test(rawOcrText) || /CFTR\s*carrier/i.test(rawOcrText) || /F508del\b/i.test(rawOcrText)) {
    cftrCarrier = 'Yes';
  }

  return { mthfr, femaleKaryotype, cftrCarrier };
}
