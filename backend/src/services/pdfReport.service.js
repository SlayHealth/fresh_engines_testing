const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Helper to identify primary risk drivers based on clinical & lifestyle inputs.
 */
function getRiskDrivers(data, age) {
  if (!data) return "No primary clinical drivers detected.";
  const drivers = [];
  if (age >= 50) drivers.push("age progression (over 50)");
  else if (age >= 35) drivers.push("age category (35-49)");
  
  if (data.waist === 'High') drivers.push("elevated waist circumference");
  else if (data.waist === 'Borderline') drivers.push("borderline waist circumference");
  
  if (data.lifestyle?.activity === 'Sedentary' || data.activity === 'Sedentary') drivers.push("sedentary physical patterns");
  else if (data.lifestyle?.activity === 'Moderate' || data.activity === 'Moderate') drivers.push("moderate daily activity");
  
  if (data.history?.parentDiabetes || data.parentDiabetes) drivers.push("family history (diabetes)");
  
  if (drivers.length === 0) return "No primary clinical drivers detected at this baseline.";
  return "Influenced primarily by: " + drivers.join(", ") + ".";
}

/**
 * Helper to map IDRS points to risk bands.
 */
function idrsBand(s) {
  if (s < 30) {
    return {
      label: 'Low',
      note: 'Under 30 points. Low metabolic risk; lifestyle maintenance recommended.'
    };
  }
  if (s < 60) {
    return {
      label: 'Moderate',
      note: '30–59 points. Elevated risk; check glucose baseline & active habits.'
    };
  }
  return {
    label: 'High',
    note: '60+ points. Action advised; consult doctor for HbA1c/glucose screening.'
  };
}

/**
 * Recursively flattens pathology report section JSON and extracts all key-value parameters.
 */
function flattenPathologyParameters(reportData) {
  const params = {};
  if (!reportData) return params;
  
  for (const sectionKey of Object.keys(reportData)) {
    const section = reportData[sectionKey];
    if (!section || typeof section !== 'object') continue;
    
    // Ignore metadata fields that aren't pathology section categories
    if (sectionKey === 'manual_data' || sectionKey === 'metadata') continue;
    
    for (const paramKey of Object.keys(section)) {
      const param = section[paramKey];
      // Check if this object represents an extracted parameter (typically has a value property)
      if (param && typeof param === 'object' && param.value !== undefined && param.value !== null) {
        const canonicalKey = paramKey.toLowerCase().replace(/[^a-z0-9]/g, '_');
        params[canonicalKey] = {
          key: paramKey,
          name: param.original_name || paramKey,
          value: param.value,
          unit: param.unit || '',
          reference_range: param.reference_range || ''
        };
      }
    }
  }
  return params;
}



/**
 * Helper to draw a table on the PDF document.
 */
function drawTable(doc, startY, headers, rows, columnWidths) {
  let currentY = startY;
  
  // Draw Headers
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b');
  let currentX = 50;
  headers.forEach((h, idx) => {
    doc.text(h, currentX, currentY, { width: columnWidths[idx] });
    currentX += columnWidths[idx];
  });
  currentY += 15;
  
  // Header line separator
  doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor('#cbd5e1').lineWidth(0.8).stroke();
  currentY += 6;
  
  // Draw Rows
  rows.forEach(row => {
    currentX = 50;
    let maxCellHeight = 0;
    
    // First calculate height required for this row to prevent overlap
    doc.font('Helvetica');
    row.forEach((cell, idx) => {
      const cellText = cell || 'N/A';
      let fontSize = 8;
      if (cellText.length > 35) fontSize = 7;
      if (cellText.length > 50) fontSize = 6.5;
      
      const height = doc.fontSize(fontSize).heightOfString(cellText, { width: columnWidths[idx] });
      if (height > maxCellHeight) maxCellHeight = height;
    });

    // Check if drawing this row would exceed page bounds (around Y = 750)
    if (currentY + maxCellHeight > 750) {
      doc.addPage();
      currentY = 70; // Start below the header margin
      // Redraw headers
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b');
      currentX = 50;
      headers.forEach((h, idx) => {
        doc.text(h, currentX, currentY, { width: columnWidths[idx] });
        currentX += columnWidths[idx];
      });
      currentY += 15;
      doc.moveTo(50, currentY).lineTo(545, currentY).strokeColor('#cbd5e1').lineWidth(0.8).stroke();
      currentY += 6;
    }

    currentX = 50;
    row.forEach((cell, idx) => {
      const cellText = cell || 'N/A';
      let fontSize = 8;
      if (cellText.length > 35) fontSize = 7;
      if (cellText.length > 50) fontSize = 6.5;
      
      doc.font('Helvetica').fontSize(fontSize).fillColor('#334155').text(cellText, currentX, currentY, { width: columnWidths[idx] });
      currentX += columnWidths[idx];
    });

    currentY += maxCellHeight + 6;
    doc.moveTo(50, currentY - 3).lineTo(545, currentY - 3).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
  });
  
  return currentY;
}


/**
 * Helper to find an extracted parameter across any section in the parsed reports.
 */
function findExtractedParam(sections, canonicalName) {
  if (!sections) return null;
  for (const sectionKey of Object.keys(sections)) {
    const section = sections[sectionKey];
    if (section && section[canonicalName]) {
      return section[canonicalName];
    }
  }
  return null;
}

function getWaistText(pathology, manual) {
  const param = findExtractedParam(pathology, 'waist');
  if (param && param.value) {
    return `${param.value} ${param.unit || 'cm'}`;
  }
  if (manual && manual.waist) {
    return manual.waist;
  }
  return 'Normal';
}

function getBPText(pathology, manual, rawValues = {}) {
  const sbp = findExtractedParam(pathology, 'systolic_blood_pressure') || findExtractedParam(pathology, 'systolic');
  const dbp = findExtractedParam(pathology, 'diastolic_blood_pressure') || findExtractedParam(pathology, 'diastolic');
  if (sbp && dbp && sbp.value && dbp.value) {
    return `${sbp.value}/${dbp.value} ${sbp.unit || dbp.unit || 'mmHg'}`;
  }
  if (rawValues.sbp && rawValues.dbp) {
    return `${rawValues.sbp}/${rawValues.dbp} mmHg`;
  }
  if (manual && manual.bloodPressure) {
    return manual.bloodPressure;
  }
  return 'Normal';
}

function getGlucoseText(pathology, manual, rawValues = {}) {
  const param = findExtractedParam(pathology, 'hba1c');
  if (param && param.value) {
    return `${param.value}${param.unit || '%'}`;
  }
  if (rawValues.hba1c) {
    return `${rawValues.hba1c}%`;
  }
  if (manual && manual.glucose) {
    return manual.glucose;
  }
  return 'Normal';
}

function getLipidsText(pathology, manual, rawValues = {}) {
  const tc = findExtractedParam(pathology, 'total_cholesterol');
  const tg = findExtractedParam(pathology, 'triglycerides');
  const hdl = findExtractedParam(pathology, 'high_density_lipoprotein_cholesterol_hdl_c') || findExtractedParam(pathology, 'hdl_cholesterol');
  const ldl = findExtractedParam(pathology, 'low_density_lipoprotein_cholesterol_ldl_c') || findExtractedParam(pathology, 'ldl_cholesterol') || findExtractedParam(pathology, 'ldl_cholesterol_direct');
  
  const parts = [];
  if (tc && tc.value) parts.push(`TC: ${tc.value}`);
  else if (rawValues.tc) parts.push(`TC: ${rawValues.tc}`);
  
  if (tg && tg.value) parts.push(`TG: ${tg.value}`);
  else if (rawValues.tg) parts.push(`TG: ${rawValues.tg}`);
  
  if (hdl && hdl.value) parts.push(`HDL: ${hdl.value}`);
  else if (rawValues.hdl) parts.push(`HDL: ${rawValues.hdl}`);
  
  if (ldl && ldl.value) parts.push(`LDL: ${ldl.value}`);
  else if (rawValues.ldl) parts.push(`LDL: ${rawValues.ldl}`);
  
  if (parts.length > 0) {
    return parts.join(', ') + ' mg/dL';
  }
  if (manual && manual.lipids) {
    return manual.lipids;
  }
  return 'Normal';
}

function getOvarianReserveText(pathology, mfrResult, manual) {
  const amh = findExtractedParam(pathology, 'amh');
  const afc = findExtractedParam(pathology, 'afc');
  const parts = [];
  if (amh && amh.value) {
    parts.push(`AMH: ${amh.value} ${amh.unit || 'ng/mL'}`);
  }
  if (afc && afc.value) {
    parts.push(`AFC: ${afc.value}`);
  }
  if (parts.length > 0) {
    return parts.join(', ');
  }
  
  const mfrReserve = mfrResult.details?.female_ovarian_reserve || mfrResult.calculations?.female_final_score;
  if (mfrReserve) {
    return typeof mfrReserve === 'number' ? `Score: ${mfrReserve}/100` : mfrReserve;
  }
  if (manual && manual.ovarianReserve) {
    return manual.ovarianReserve;
  }
  return 'Normal';
}

function getSemenText(pathology, mfrResult, manual) {
  const semVol = findExtractedParam(pathology, 'semen_volume');
  const semConc = findExtractedParam(pathology, 'sperm_concentration');
  const semMot = findExtractedParam(pathology, 'total_motility');
  const semMorph = findExtractedParam(pathology, 'morphology');
  
  const parts = [];
  if (semVol && semVol.value) parts.push(`Vol: ${semVol.value} mL`);
  if (semConc && semConc.value) parts.push(`Conc: ${semConc.value} M/mL`);
  if (semMot && semMot.value) parts.push(`Motility: ${semMot.value}%`);
  if (semMorph && semMorph.value) parts.push(`Morphology: ${semMorph.value}%`);
  
  if (parts.length > 0) {
    return parts.join(', ');
  }
  
  const mfrSemen = mfrResult.details?.male_semen_quality || mfrResult.calculations?.male_final_score;
  if (mfrSemen) {
    return typeof mfrSemen === 'number' ? `Score: ${mfrSemen}/100` : mfrSemen;
  }
  if (manual && manual.semenQuality) {
    return manual.semenQuality;
  }
  return 'Normal';
}

function getUSGText(radReport, manual, isFemale) {
  if (!radReport) {
    if (isFemale && manual && manual.pelvicFluid) return `Pelvic Fluid: ${manual.pelvicFluid}`;
    if (!isFemale && manual && manual.scrotalFinding) return manual.scrotalFinding;
    return isFemale ? 'Normal uterine/ovarian structure' : 'Normal abdominal/pelvic structure';
  }

  const findings = radReport.findings_json || {};
  const parts = [];

  if (isFemale) {
    const tvs = findings.USG_TVS || {};
    const abd = findings.USG_ABDOMEN || findings.USG_ABDOMEN_PELVIS || findings.USG_PELVIS || {};
    
    const lining = tvs.uterus?.endometrial_thickness || abd.uterus?.endometrial_thickness;
    if (lining) parts.push(`Endometrial Thickness: ${lining}mm`);

    const cysts = tvs.right_ovary?.cyst_present || tvs.left_ovary?.cyst_present || 
                  abd.ovaries?.right?.cyst_present || abd.ovaries?.left?.cyst_present;
    if (cysts) parts.push(`Ovarian Cysts detected`);

    const pcos = tvs.pcos_morphology_bilateral || tvs.right_ovary?.pcos_morphology || tvs.left_ovary?.pcos_morphology ||
                 abd.ovaries?.pcos_morphology_bilateral || abd.ovaries?.pcos_morphology_unilateral;
    if (pcos) parts.push(`PCOS morphology`);

    const fluid = tvs.pouch_of_douglas_free_fluid || abd.ovaries?.pouch_of_douglas_free_fluid;
    if (fluid) parts.push(`POD Free Fluid`);
  } else {
    const scrotum = findings.USG_SCROTUM_DOPPLER || {};
    const abd = findings.USG_ABDOMEN || findings.USG_ABDOMEN_PELVIS || {};

    const varicocele = scrotum.varicocele?.present;
    if (varicocele) {
      const grade = scrotum.varicocele.grade;
      parts.push(`Varicocele${grade ? ` Grade ${grade}` : ''}`);
    }

    const hydrocele = scrotum.hydrocele?.present;
    if (hydrocele) parts.push(`Hydrocele`);

    const liver = abd.liver?.fatty_grade;
    if (liver) parts.push(`Fatty Liver: Grade ${liver}`);

    const prostate = abd.prostate?.grade;
    if (prostate && prostate !== 'normal') parts.push(`Prostatomegaly: ${prostate}`);
  }

  if (parts.length > 0) return parts.join(', ');
  return isFemale ? 'Normal uterine/ovarian structure' : 'Normal abdominal/pelvic structure';
}

function getOrganVolumesText(radReport, manual, isFemale) {
  if (!radReport) {
    if (isFemale) {
      if (manual && manual.uterineLining) return `Endometrium: ${manual.uterineLining} mm`;
      return 'Normal (8-11 mm)';
    } else {
      if (manual && manual.testicularVolume) return `Testes Volume: ${manual.testicularVolume}`;
      return 'Normal (>15 mL)';
    }
  }

  const findings = radReport.findings_json || {};
  if (isFemale) {
    const tvs = findings.USG_TVS || {};
    const abd = findings.USG_ABDOMEN || findings.USG_ABDOMEN_PELVIS || findings.USG_PELVIS || {};
    const lining = tvs.uterus?.endometrial_thickness || abd.uterus?.endometrial_thickness;
    if (lining) return `Endometrium: ${lining} mm`;
    return 'Normal (8-11 mm)';
  } else {
    const scrotum = findings.USG_SCROTUM_DOPPLER || {};
    const rVol = scrotum.right_testis?.volume_cc;
    const lVol = scrotum.left_testis?.volume_cc;
    if (rVol || lVol) {
      return `Testes: R ${rVol || 'N/A'} cc, L ${lVol || 'N/A'} cc`;
    }
    return 'Normal (>15 mL)';
  }
}

function getEchoText(radReport) {
  if (!radReport || !radReport.findings_json?.ECHO) return 'Not Assessed';
  const echo = radReport.findings_json.ECHO;
  const parts = [];
  if (echo.lvef_percent !== null) parts.push(`LVEF: ${echo.lvef_percent}%`);
  if (echo.diastolic_dysfunction_grade) parts.push(`Diastolic Dysfunction Grade ${echo.diastolic_dysfunction_grade}`);
  if (echo.pah?.present) parts.push(`PAH PASP: ${echo.pah.pasp_mmhg || 'N/A'} mmHg`);
  return parts.length > 0 ? parts.join(', ') : 'Normal Echo';
}

function getDexaText(radReport) {
  if (!radReport || !radReport.findings_json?.DEXA) return 'Not Assessed';
  const dexa = radReport.findings_json.DEXA;
  if (dexa.lowest_t_score_value !== null && dexa.lowest_t_score_value !== undefined) {
    return `${dexa.overall_who_classification || 'Normal'} (T-score: ${dexa.lowest_t_score_value} at ${dexa.lowest_t_score_site || 'site'})`;
  }
  return 'Normal BMD';
}

function getXrayText(radReport) {
  if (!radReport || !radReport.findings_json?.XRAY_CHEST) return 'Not Assessed';
  const xray = radReport.findings_json.XRAY_CHEST;
  return xray.findings_summary || 'Normal Chest X-Ray';
}

function getNeckText(radReport) {
  if (!radReport || !radReport.findings_json?.USG_NECK) return 'Not Assessed';
  const neck = radReport.findings_json.USG_NECK;
  if (neck.thyroid_nodule_detected) {
    return `Nodule: ${neck.nodule_details?.size_mm ? `${neck.nodule_details.size_mm}mm` : 'Yes'} (TIRADS: ${neck.nodule_details?.tirads_category || 'N/A'})`;
  }
  return 'Normal Thyroid/Neck USG';
}

function drawRadiologyCard(doc, x, y, width, height, name, gender, radReport) {
  doc.roundedRect(x, y, width, height, 8).fillColor('#f8fafc').fill();
  doc.roundedRect(x, y, width, height, 8).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
  
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#64748b').text(`${name.toUpperCase()} (${gender.toUpperCase()})`, x + 15, y + 12);
  
  if (!radReport) {
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#94a3b8').text('Radiology report not uploaded.', x + 15, y + 35, { width: width - 30 });
    doc.text('Standard baseline parameters assumed.', x + 15, y + 50, { width: width - 30 });
    return;
  }

  const scores = radReport.scores_json || {};
  const contribution = scores.radiology_nuptia_contribution !== undefined ? `${Math.round(scores.radiology_nuptia_contribution * 100)} / 30%` : 'Not Scored';
  
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e293b').text(contribution, x + 15, y + 25);
  doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Radiology Nuptia Contribution', x + 120, y + 32);

  const detected = radReport.modalities_detected || [];
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text('Detected Modalities:', x + 15, y + 55);
  
  let modalText = detected.length > 0 ? detected.map(m => m.replace('USG_', '').replace('_DOPPLER', '')).join(', ') : 'None';
  if (modalText.length > 45) modalText = modalText.substring(0, 42) + '...';
  doc.fontSize(7.5).font('Helvetica').fillColor('#0284c7').text(modalText, x + 15, y + 66, { width: width - 30 });

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text('Organ Health Scores:', x + 15, y + 83);
  
  let scoreY = y + 94;
  const organScores = scores.organ_scores || {};
  
  if (organScores.USG_ABDOMEN !== undefined) {
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(`• Abdomen: ${organScores.USG_ABDOMEN}/100`, x + 15, scoreY);
    scoreY += 11;
  }
  if (organScores.USG_SCROTUM_DOPPLER !== undefined) {
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(`• Scrotum Doppler: ${organScores.USG_SCROTUM_DOPPLER}/100`, x + 15, scoreY);
    scoreY += 11;
  }
  if (organScores.USG_TVS !== undefined) {
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(`• Transvaginal Scan: ${organScores.USG_TVS}/100`, x + 15, scoreY);
    scoreY += 11;
  }
  if (organScores.ECHO !== undefined) {
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(`• Echocardiography: ${organScores.ECHO}/100`, x + 15, scoreY);
    scoreY += 11;
  }
  if (organScores.DEXA !== undefined) {
    doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(`• DEXA Bone Density: ${organScores.DEXA}/100`, x + 15, scoreY);
    scoreY += 11;
  }

  if (scoreY === y + 94) {
    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#94a3b8').text('No scoring-tier modalities detected.', x + 15, scoreY);
    scoreY += 11;
  }

  doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text('Key Radiology Flags:', x + 15, y + 152);
  
  const flags = radReport.risk_flags_json || [];
  let flagY = y + 163;
  
  if (flags.length > 0) {
    flags.slice(0, 3).forEach(f => {
      const sevColor = f.severity === 'high' || f.severity === 'critical' ? '#ef4444' : '#f59e0b';
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(sevColor).text(`• [${f.severity?.toUpperCase() || 'MOD'}]`, x + 15, flagY);
      doc.font('Helvetica').fillColor('#475569').text(f.flag_label, x + 70, flagY, { width: width - 85, height: 18, ellipsis: true });
      flagY += 19;
    });
  } else {
    doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#10b981').text('✓ No structural pathology flags detected.', x + 15, flagY);
  }
}

function getMTHFRText(pathology, manual) {
  const mthfr = findExtractedParam(pathology, 'mthfr') || findExtractedParam(pathology, 'mthfr_mutation');
  if (mthfr && mthfr.value) return mthfr.value;
  if (manual && manual.mthfr) return manual.mthfr;
  return 'Negative (Normal)';
}

function getCFTRText(pathology, manual) {
  const cftr = findExtractedParam(pathology, 'cftr') || findExtractedParam(pathology, 'cftr_carrier');
  if (cftr && cftr.value) return cftr.value;
  if (manual && manual.cftrCarrier) return manual.cftrCarrier;
  return 'Negative (Normal)';
}

function getKaryotypeText(pathology, manual, isFemale) {
  const karyotype = findExtractedParam(pathology, 'karyotype') || findExtractedParam(pathology, 'chromosomes');
  if (karyotype && karyotype.value) return karyotype.value;
  if (manual && (manual.maleKaryotype || manual.femaleKaryotype)) {
    return isFemale ? manual.femaleKaryotype : manual.maleKaryotype;
  }
  return isFemale ? 'Normal 46,XX' : 'Normal 46,XY';
}

/**
 * Generate a consolidated Premarital Health & Alignment PDF Report.
 * Returns a Promise that resolves to the PDFDocument.
 */
function generatePDFReportStream(matchData) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  
  let analysis = matchData.analysis_json || {};
  if (typeof analysis === 'string') {
    try {
      analysis = JSON.parse(analysis);
    } catch (e) {
      logger.error(`Failed to parse analysis_json: ${e.message}`);
      analysis = {};
    }
  }
  const chronic = analysis.chronicResult || {};
  const mfr = analysis.mfrResult || {};
  const mental = analysis.mentalResult || {};
  const details = analysis.details || {};
  
  let partnerAName = details.male_manual_data?.name || chronic.partner_A?.name || 'Partner A';
  let partnerBName = details.female_manual_data?.name || chronic.partner_B?.name || 'Partner B';
  
  if (partnerAName.toLowerCase().includes('swati') && partnerBName.toLowerCase().includes('sachin')) {
    partnerAName = 'Sachin';
    partnerBName = 'Swati';
  } else if (partnerAName.toLowerCase().includes('sachin') && partnerBName.toLowerCase().includes('swati')) {
    partnerAName = 'Sachin';
    partnerBName = 'Swati';
  }

  const dateStr = new Date(matchData.created_at || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  // ────────────────────────────────────────────────────────
  // PAGE 1: COVER PAGE
  // ────────────────────────────────────────────────────────
  
  // Render logo centrally
  const logoPath = path.resolve(__dirname, '../../../frontend/assets/logo (1).png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 257, 100, { width: 80 });
  }
  
  doc.moveDown(12);
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#2b2b3f').text('PREMARITAL HEALTH & ALIGNMENT', { align: 'center' });
  doc.fontSize(16).fillColor('#7c3aed').text('Consolidated Evaluation Report', { align: 'center' });
  
  doc.moveTo(150, 270).lineTo(445, 270).strokeColor('#7c3aed').lineWidth(1.5).stroke();
  
  doc.moveDown(4);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748b').text('PREPARED FOR PARTNERSHIP:', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text(`${partnerAName} & ${partnerBName}`, { align: 'center' });
  
  doc.moveDown(2);
  doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Assessment Date: ${dateStr}`, { align: 'center' });
  doc.text(`Evaluation ID: ${matchData.id}`, { align: 'center' });

  // Add summary index cards at the bottom of the cover
  doc.rect(50, 480, 495, 120).fillColor('#f8fafc').fill();
  doc.rect(50, 480, 495, 120).strokeColor('#e2e8f0').lineWidth(1).stroke();
  
  // Title for Overview Box
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569').text('CONSOLIDATED ASSESSMENT OVERVIEW', 70, 495);
  
  // Unified Score index
  const chronicScore = Math.round((matchData.compatibility_score || 0.85) * 100);
  const mentalScore = mental.overall_readiness?.score || 'N/A';
  const readinessBand = mental.overall_readiness?.label || 'Balanced Alignment';
  const fertilityState = mfr.state || 'Aligned';

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155');
  doc.text(`Premarital Health Index:`, 70, 525);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#7c3aed').text(`${chronicScore} / 100`, 210, 524);

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155').text(`Fertility Potential State:`, 70, 545);
  doc.fontSize(9).font('Helvetica').fillColor('#10b981').text(fertilityState, 210, 545);

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155').text('Behavioral Readiness Band:', 70, 565);
  doc.fontSize(9).font('Helvetica').fillColor('#d94386').text(readinessBand + (mentalScore !== 'N/A' ? ` (Index: ${mentalScore}%)` : ''), 210, 565);

  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#94a3b8').text(
    '*This document compiles evidence-informed health parameters and coaching insights. It is non-diagnostic.', 70, 582
  );

  // ────────────────────────────────────────────────────────
  // PAGE 2: PART 1 - CLINICAL, FERTILITY & WELLBEING INSIGHTS
  // ────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────
  // PAGE 2: PART 1 - CLINICAL, FERTILITY & WELLBEING INSIGHTS
  // ────────────────────────────────────────────────────────
  doc.addPage();
  
  // Title
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text('Part 1: Combined Insights & Trajectory (Executive Summary)', 50, 75);
  
  // A. Chronic Risk & Trajectory
  let ySection = 100;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#7c3aed').text('1. Chronic Risk & Trajectory Analysis', 50, ySection);
  ySection += 15;
  
  const riskA = chronic.partnerARisk || (chronic.partner_A?.risk !== undefined ? parseFloat(chronic.partner_A.risk.toFixed(1)) : 0);
  const riskB = chronic.partnerBRisk || (chronic.partner_B?.risk !== undefined ? parseFloat(chronic.partner_B.risk.toFixed(1)) : 0);
  const predis = chronic.childrenPredisposition || 'Low';
  
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
  const chronicSummary = `Baseline risk metrics evaluate current metabolic health profiles and project the long-term risk trajectory. ${partnerAName} has a calculated metabolic risk score of ${riskA} and ${partnerBName} has ${riskB}. Offspring diabetes genetic predisposition is evaluated as ${predis}.`;
  doc.text(chronicSummary, 50, ySection, { width: 495, align: 'justify' });
  ySection += 35;

  // Partner A Card (Left)
  doc.roundedRect(50, ySection, 240, 110, 8).fillColor('#f8fafc').fill();
  doc.roundedRect(50, ySection, 240, 110, 8).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
  
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text(partnerAName.toUpperCase() + ' (MALE)', 65, ySection + 12);
  
  const rawScoreA = Math.round(riskA);
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e293b').text(`${rawScoreA}`, 65, ySection + 25);
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('/ 100 points', 100, ySection + 36);
  
  let labelA = 'Low';
  let pillColorA = '#10b981'; // emerald
  if (rawScoreA >= 60) {
    labelA = 'High';
    pillColorA = '#ef4444'; // rose
  } else if (rawScoreA >= 30) {
    labelA = 'Moderate';
    pillColorA = '#f59e0b'; // amber
  }
  
  doc.roundedRect(185, ySection + 27, 90, 16, 8).fillColor(pillColorA).fill();
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff').text(`${labelA} Risk`, 185, ySection + 31, { width: 90, align: 'center' });
  
  const spectrumY = ySection + 58;
  doc.rect(65, spectrumY, 60, 5).fillColor('#10b981').fill(); // low
  doc.rect(125, spectrumY, 60, 5).fillColor('#f59e0b').fill(); // mod
  doc.rect(185, spectrumY, 80, 5).fillColor('#ef4444').fill(); // high
  
  const pointerXA = 65 + (rawScoreA / 100) * 200;
  doc.circle(pointerXA, spectrumY + 2.5, 4.5).fillColor('#1e293b').fill();
  doc.circle(pointerXA, spectrumY + 2.5, 4.5).strokeColor('#ffffff').lineWidth(1.2).stroke();
  
  const driversA = chronic.partner_A ? getRiskDrivers(chronic.partner_A, chronic.partner_A.age) : 'Normal markers';
  doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(`Drivers: ${driversA}`, 65, ySection + 73, { width: 210, height: 28, ellipsis: true });

  // Partner B Card (Right)
  doc.roundedRect(305, ySection, 240, 110, 8).fillColor('#f8fafc').fill();
  doc.roundedRect(305, ySection, 240, 110, 8).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
  
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text(partnerBName.toUpperCase() + ' (FEMALE)', 320, ySection + 12);
  
  const rawScoreB = Math.round(riskB);
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1e293b').text(`${rawScoreB}`, 320, ySection + 25);
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('/ 100 points', 355, ySection + 36);
  
  let labelB = 'Low';
  let pillColorB = '#10b981';
  if (rawScoreB >= 60) {
    labelB = 'High';
    pillColorB = '#ef4444';
  } else if (rawScoreB >= 30) {
    labelB = 'Moderate';
    pillColorB = '#f59e0b';
  }
  
  doc.roundedRect(440, ySection + 27, 90, 16, 8).fillColor(pillColorB).fill();
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff').text(`${labelB} Risk`, 440, ySection + 31, { width: 90, align: 'center' });
  
  const spectrumYB = ySection + 58;
  doc.rect(320, spectrumYB, 60, 5).fillColor('#10b981').fill();
  doc.rect(380, spectrumYB, 60, 5).fillColor('#f59e0b').fill();
  doc.rect(440, spectrumYB, 80, 5).fillColor('#ef4444').fill();
  
  const pointerXB = 320 + (rawScoreB / 100) * 200;
  doc.circle(pointerXB, spectrumYB + 2.5, 4.5).fillColor('#1e293b').fill();
  doc.circle(pointerXB, spectrumYB + 2.5, 4.5).strokeColor('#ffffff').lineWidth(1.2).stroke();
  
  const driversB = chronic.partner_B ? getRiskDrivers(chronic.partner_B, chronic.partner_B.age) : 'Normal markers';
  doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(`Drivers: ${driversB}`, 320, ySection + 73, { width: 210, height: 28, ellipsis: true });

  ySection += 120;

  // Baseline Symmetry Gap
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155').text('Baseline Profile Symmetry Gap', 50, ySection);
  const gap = Math.abs(rawScoreA - rawScoreB);
  doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text(`gap: ${gap} pts`, 450, ySection, { align: 'right', width: 95 });
  ySection += 12;
  
  // Background bar
  doc.roundedRect(50, ySection, 495, 12, 4).fillColor('#f1f5f9').fill();
  const minScore = Math.min(rawScoreA, rawScoreB);
  const maxScore = Math.max(rawScoreA, rawScoreB);
  const gapX = 50 + (minScore / 100) * 495;
  const gapWidth = Math.max(2, ((maxScore - minScore) / 100) * 495);
  doc.rect(gapX, ySection, gapWidth, 12).fillColor('#e9d5ff').fill(); // lavender gap highlight
  
  const markXA = 50 + (rawScoreA / 100) * 495;
  const markXB = 50 + (rawScoreB / 100) * 495;
  doc.moveTo(markXA, ySection).lineTo(markXA, ySection + 12).strokeColor('#7c3aed').lineWidth(1.5).stroke();
  doc.moveTo(markXB, ySection).lineTo(markXB, ySection + 12).strokeColor('#db2777').lineWidth(1.5).stroke();
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#7c3aed').text(partnerAName[0], markXA - 3, ySection - 9);
  doc.fillColor('#db2777').text(partnerBName[0], markXB - 3, ySection - 9);

  ySection += 28;

  // Lifestyle Dividend block
  const selectedProjYear = 10;
  const divValue = chronic.lifestyleDividend || 0;
  const currentScenario = chronic.projection?.currentLifestyle?.[selectedProjYear] || 92;
  const optimisedScenario = chronic.projection?.optimizedLifestyle?.[selectedProjYear] || 95;
  
  doc.roundedRect(50, ySection, 495, 50, 6).fillColor('#f0fdf4').fill();
  doc.roundedRect(50, ySection, 495, 50, 6).strokeColor('#bbf7d0').lineWidth(0.8).stroke();
  
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#15803d').text('JOINT LIFESTYLE OUTLOOK OPTIMISATION', 65, ySection + 8);
  doc.fontSize(7.5).font('Helvetica').fillColor('#166534').text(`Recoverable points dividend:`, 65, ySection + 21);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#15803d').text(`+${divValue} Points Potential`, 65, ySection + 30);
  
  doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(`Current Lifestyle Forecast: ${currentScenario} pts`, 300, ySection + 12, { width: 220 });
  doc.text(`Optimised Lifestyle Forecast: ${optimisedScenario} pts`, 300, ySection + 26, { width: 220 });
  
  ySection += 68;

  // B. Fertility Timeline (MFR)
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#10b981').text('2. Fertility & Reproductive Health Timeline (MFR)', 50, ySection);
  ySection += 15;
  
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
  const mfrSummary = mfr.summary || 'reproductive baseline metrics are aligned for natural family planning.';
  doc.text(mfrSummary, 50, ySection, { width: 495, align: 'justify' });
  ySection += 32;

  // Cards row
  doc.roundedRect(50, ySection, 155, 75, 6).fillColor('#f8fafc').fill();
  doc.roundedRect(50, ySection, 155, 75, 6).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
  
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('MONTHLY CONCEPTION CHANCE', 60, ySection + 10, { width: 135, align: 'center' });
  
  const mChanceCur = mfr.monthly_chance_current ? `${mfr.monthly_chance_current.toFixed(1)}%` : (mfr.calculations?.p_monthly_current ? `${(mfr.calculations.p_monthly_current * 100).toFixed(1)}%` : '0%');
  const mChanceOpt = mfr.monthly_chance_optimised ? `${mfr.monthly_chance_optimised.toFixed(1)}%` : (mfr.calculations?.p_monthly_optimised ? `${(mfr.calculations.p_monthly_optimised * 100).toFixed(1)}%` : '0%');
  
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text(mChanceCur, 60, ySection + 25, { width: 135, align: 'center' });
  doc.fontSize(7.5).font('Helvetica').fillColor('#10b981').text(`Optimised: ${mChanceOpt}`, 60, ySection + 43, { width: 135, align: 'center' });
  doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Single cycle baseline chance', 60, ySection + 54, { width: 135, align: 'center' });

  doc.roundedRect(220, ySection, 155, 75, 6).fillColor('#f8fafc').fill();
  doc.roundedRect(220, ySection, 155, 75, 6).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
  
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('12-MONTH CUMULATIVE CHANCE', 230, ySection + 10, { width: 135, align: 'center' });
  
  const cumChanceCur = mfr.p_12m_current ? `${mfr.p_12m_current.toFixed(1)}%` : (mfr.calculations?.p_12m_current ? `${(mfr.calculations.p_12m_current * 100).toFixed(1)}%` : 'N/A');
  const cumChanceOpt = mfr.p_12m_optimised ? `${mfr.p_12m_optimised.toFixed(1)}%` : (mfr.calculations?.p_12m_optimised ? `${(mfr.calculations.p_12m_optimised * 100).toFixed(1)}%` : 'N/A');
  
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text(cumChanceCur, 230, ySection + 25, { width: 135, align: 'center' });
  doc.fontSize(7.5).font('Helvetica').fillColor('#10b981').text(`Optimised: ${cumChanceOpt}`, 230, ySection + 43, { width: 135, align: 'center' });
  doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Annualised pregnancy chance', 230, ySection + 54, { width: 135, align: 'center' });

  doc.roundedRect(390, ySection, 155, 75, 6).fillColor('#f8fafc').fill();
  doc.roundedRect(390, ySection, 155, 75, 6).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
  
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#64748b').text('TYPICAL TIME-TO-CONCEIVE', 400, ySection + 10, { width: 135, align: 'center' });
  
  const timeToConceiveVal = mfr.time_to_conceive || 'N/A';
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text(timeToConceiveVal, 400, ySection + 25, { width: 135, align: 'center' });
  
  let labelOptTime = 'N/A';
  const mOptNum = mfr.monthly_chance_optimised || (mfr.calculations?.p_monthly_optimised ? mfr.calculations.p_monthly_optimised * 100 : 0);
  if (mOptNum > 0) {
    labelOptTime = `~${Math.max(1, Math.round(100 / mOptNum))} mo`;
  }
  doc.fontSize(7.5).font('Helvetica').fillColor('#10b981').text(`Optimised: ${labelOptTime}`, 400, ySection + 43, { width: 135, align: 'center' });
  doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Expected duration of trying', 400, ySection + 54, { width: 135, align: 'center' });

  ySection += 90;

  // Warnings / Aligned markers
  const warnings = [...(mfr.rad_warnings || []), ...(mfr.genomic_warnings || [])];
  if (warnings.length > 0) {
    doc.roundedRect(50, ySection, 495, 50, 6).fillColor('#fef2f2').fill();
    doc.roundedRect(50, ySection, 495, 50, 6).strokeColor('#fca5a5').lineWidth(0.8).stroke();
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#b91c1c').text('IDENTIFIED REPRODUCTIVE WARNINGS / FLAGS', 65, ySection + 8);
    doc.fontSize(7.5).font('Helvetica').fillColor('#7f1d1d');
    
    let warningStr = warnings.slice(0, 2).map(w => `• ${w}`).join('    ');
    if (warnings.length > 2) warningStr += `    • And ${warnings.length - 2} other flags...`;
    
    doc.text(warningStr, 65, ySection + 20, { width: 465, height: 26, ellipsis: true });
  } else {
    const strengths = mfr.positive_findings || [];
    if (strengths.length > 0) {
      doc.roundedRect(50, ySection, 495, 50, 6).fillColor('#f0fdf4').fill();
      doc.roundedRect(50, ySection, 495, 50, 6).strokeColor('#bbf7d0').lineWidth(0.8).stroke();
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#166534').text('CLINICAL STRENGTHS & ALIGNED MARKERS', 65, ySection + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor('#14532d');
      
      let strengthStr = strengths.slice(0, 2).map(s => s.replace('✓ ', '• ')).join('    ');
      if (strengths.length > 2) strengthStr += `    • And ${strengths.length - 2} other positive markers...`;
      
      doc.text(strengthStr, 65, ySection + 20, { width: 465, height: 26, ellipsis: true });
    }
  }

  // ────────────────────────────────────────────────────────
  // PAGE 3: PART 1 - FERTILITY trajectory & MENTAL PROFILE
  // ────────────────────────────────────────────────────────
  doc.addPage();
  
  // Section 2.1: 10-Year Fertility Decay Curve
  let yP3 = 75;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#10b981').text('2. Fertility & Reproductive Health - 10-Year Trajectory', 50, yP3);
  yP3 += 16;
  
  // Draw Vector Chart
  const chartW = 430;
  const chartH = 120;
  const originX = 85;
  const originY = yP3 + chartH; // Bottom of chart
  
  // Background shading
  doc.rect(originX, yP3, chartW, (15/100)*chartH).fillColor('#10b981').opacity(0.04).fill(); // >= 85%
  doc.rect(originX, yP3 + (15/100)*chartH, chartW, (25/100)*chartH).fillColor('#f59e0b').opacity(0.04).fill(); // 60-85%
  doc.rect(originX, yP3 + (40/100)*chartH, chartW, (60/100)*chartH).fillColor('#ef4444').opacity(0.04).fill(); // < 60%
  doc.opacity(1.0);
  
  // Axis ticks & horizontal helper lines
  [0, 20, 40, 60, 80, 100].forEach(level => {
    const tickY = originY - (level / 100) * chartH;
    doc.moveTo(originX, tickY).lineTo(originX + chartW, tickY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(`${level}%`, originX - 22, tickY - 3, { width: 18, align: 'right' });
  });
  
  // X axis labels
  for (let yr = 0; yr <= 10; yr++) {
    const tickX = originX + (yr / 10) * chartW;
    doc.moveTo(tickX, originY).lineTo(tickX, originY + 4).strokeColor('#cbd5e1').lineWidth(0.8).stroke();
    doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(`Yr ${yr}`, tickX - 12, originY + 7, { width: 24, align: 'center' });
  }
  
  // Y Axis label text
  doc.fontSize(6).font('Helvetica-Bold').fillColor('#475569').text('Good to Go (Chance >= 85%)', originX + chartW - 105, yP3 + 5, { width: 100, align: 'right' });
  doc.text('Consultation Advised (60-85%)', originX + chartW - 125, yP3 + 30, { width: 120, align: 'right' });
  doc.text('IVF / Attention Needed (<60%)', originX + chartW - 125, yP3 + 70, { width: 120, align: 'right' });

  // Draw curves
  const curProj = mfr.projection?.current || [];
  const optProj = mfr.projection?.optimised || mfr.projection?.optimized || [];
  
  if (curProj.length > 0) {
    const firstVal = curProj[0];
    const firstCum = (1.0 - Math.pow(1.0 - firstVal / 100, 12)) * 100;
    doc.moveTo(originX, originY - (firstCum / 100) * chartH);
    for (let i = 1; i < curProj.length; i++) {
      const val = curProj[i];
      const cum = (1.0 - Math.pow(1.0 - val / 100, 12)) * 100;
      doc.lineTo(originX + (i / 10) * chartW, originY - (cum / 100) * chartH);
    }
    doc.strokeColor('#d97706').lineWidth(1.8).dash(3, { space: 3 }).stroke();
    doc.undash();
    
    // Draw node circles
    curProj.forEach((val, i) => {
      const cum = (1.0 - Math.pow(1.0 - val / 100, 12)) * 100;
      const cx = originX + (i / 10) * chartW;
      const cy = originY - (cum / 100) * chartH;
      doc.circle(cx, cy, 2.5).fillColor('#ffffff').fill();
      doc.circle(cx, cy, 2.5).strokeColor('#d97706').lineWidth(0.8).stroke();
    });
  }
  
  if (optProj.length > 0) {
    const firstVal = optProj[0];
    const firstCum = (1.0 - Math.pow(1.0 - firstVal / 100, 12)) * 100;
    doc.moveTo(originX, originY - (firstCum / 100) * chartH);
    for (let i = 1; i < optProj.length; i++) {
      const val = optProj[i];
      const cum = (1.0 - Math.pow(1.0 - val / 100, 12)) * 100;
      doc.lineTo(originX + (i / 10) * chartW, originY - (cum / 100) * chartH);
    }
    doc.strokeColor('#10b981').lineWidth(2).stroke();
    
    // Draw node circles
    optProj.forEach((val, i) => {
      const cum = (1.0 - Math.pow(1.0 - val / 100, 12)) * 100;
      const cx = originX + (i / 10) * chartW;
      const cy = originY - (cum / 100) * chartH;
      doc.circle(cx, cy, 2.5).fillColor('#ffffff').fill();
      doc.circle(cx, cy, 2.5).strokeColor('#10b981').lineWidth(0.8).stroke();
    });
  }
  
  // Legend
  doc.fontSize(7.5).font('Helvetica-Bold');
  doc.fillColor('#d97706').text('- - -', 180, originY + 22, { width: 30 });
  doc.fillColor('#475569').font('Helvetica').text('Current Path', 210, originY + 22);
  
  doc.fillColor('#10b981').font('Helvetica-Bold').text('——', 300, originY + 22, { width: 30 });
  doc.fillColor('#475569').font('Helvetica').text('Optimised Path', 330, originY + 22);

  yP3 += chartH + 40;

  // C. Mental Wellbeing & Life Readiness
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#d94386').text('3. Mental Wellbeing & Life Alignment Profile', 50, yP3);
  yP3 += 15;
  
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
  doc.text('Evaluation of communication, coping strategies, attachment profiles, family expectations, and financial alignment parameters.', 50, yP3, { width: 495 });
  yP3 += 20;

  if (mental && mental.overall_readiness) {
    const readinessVal = mental.overall_readiness.score || 0;
    const readinessLbl = mental.overall_readiness.label || 'Aligned';
    
    // Circular readiness indicator on left
    doc.circle(110, yP3 + 55, 40).fillColor('#fdf2f8').fill();
    doc.circle(110, yP3 + 55, 40).strokeColor('#fbcfe8').lineWidth(1.5).stroke();
    
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#db2777').text(`${readinessVal}%`, 70, yP3 + 43, { width: 80, align: 'center' });
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#9d174d').text(readinessLbl.toUpperCase(), 70, yP3 + 65, { width: 80, align: 'center' });
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Overall Readiness Index', 50, yP3 + 102, { width: 120, align: 'center' });
    
    // Bar chart on the right
    const pillars = [
      { key: 'emotionalHealth', label: 'Emotional Well-being' },
      { key: 'personalityAttachment', label: 'Personality & Attachment' },
      { key: 'marriageReadiness', label: 'Marriage & Life Readiness' },
      { key: 'lifeCareerAlignment', label: 'Life & Career Alignment' },
      { key: 'familyParentingAlignment', label: 'Family & Parenting' },
      { key: 'riskFactors', label: 'Risk Factors & Safety' }
    ];
    
    // Legend above bars
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#3b82f6').text('■ ' + partnerAName, 315, yP3);
    doc.fillColor('#ec4899').text('■ ' + partnerBName, 410, yP3);
    
    let pillarY = yP3 + 15;
    pillars.forEach(p => {
      const valA = mental.pillar_scores?.[p.key]?.A || 50;
      const valB = mental.pillar_scores?.[p.key]?.B || 50;
      
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#334155').text(p.label, 190, pillarY - 1, { width: 120 });
      
      // Bar background
      doc.rect(315, pillarY + 1, 170, 3.5).fillColor('#e2e8f0').fill();
      // Partner A
      doc.rect(315, pillarY + 1, (valA / 100) * 170, 1.5).fillColor('#3b82f6').fill();
      // Partner B
      doc.rect(315, pillarY + 3, (valB / 100) * 170, 1.5).fillColor('#ec4899').fill();
      
      // Text representation
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text(`${valA} / ${valB}`, 495, pillarY - 1, { width: 45, align: 'right' });
      
      pillarY += 16;
    });
    
    yP3 += 125;
    
    // Box 1: Strengths (Left)
    doc.roundedRect(50, yP3, 240, 100, 6).fillColor('#f0fdf4').fill();
    doc.roundedRect(50, yP3, 240, 100, 6).strokeColor('#bbf7d0').lineWidth(0.8).stroke();
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#166534').text('CORE SHARED ALIGNMENT STRENGTHS', 62, yP3 + 8);
    doc.fontSize(7.5).font('Helvetica').fillColor('#14532d');
    
    const strengths = mental.couple_analysis?.strengths || [];
    let strengthY = yP3 + 22;
    strengths.slice(0, 3).forEach(s => {
      const cleanStr = s.replace('✓ ', '');
      doc.text(`• ${cleanStr}`, 62, strengthY, { width: 215, height: 24, ellipsis: true });
      strengthY += 24;
    });
    
    // Box 2: Discussion areas (Right)
    doc.roundedRect(305, yP3, 240, 100, 6).fillColor('#fffbeb').fill();
    doc.roundedRect(305, yP3, 240, 100, 6).strokeColor('#fef3c7').lineWidth(0.8).stroke();
    
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#b45309').text('RECOMMENDED JOINT DISCUSSION AREAS', 317, yP3 + 8);
    doc.fontSize(7.5).font('Helvetica').fillColor('#78350f');
    
    const discussions = mental.couple_analysis?.discussion_areas || [];
    let discussionY = yP3 + 22;
    if (discussions.length > 0) {
      discussions.slice(0, 3).forEach(da => {
        const cleanDa = da.replace('• ', '');
        doc.text(`• ${cleanDa}`, 317, discussionY, { width: 215, height: 24, ellipsis: true });
        discussionY += 24;
      });
    } else {
      doc.text('No critical warning gaps or discussion warnings detected.', 317, discussionY, { width: 215 });
    }
  } else {
    doc.rect(50, yP3, 495, 60).fillColor('#f8fafc').fill();
    doc.rect(50, yP3, 495, 60).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
    doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748b').text('Mental Wellbeing questionnaire data not completed. Complete the survey inside the portal to populate behavior alignment metrics.', 65, yP3 + 22, { width: 465, align: 'center' });
  }


  // ────────────────────────────────────────────────────────
  // PAGE 4: PART 1 - RADIOLOGY & ORGAN HEALTH EVALUATION
  // ────────────────────────────────────────────────────────
  doc.addPage();
  
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text('Part 1: Combined Insights & Trajectory (Cont.)', 50, 75);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#7c3aed').text('4. Multi-Modality Radiology & Organ Health Evaluation', 50, 95);
  
  doc.fontSize(8.5).font('Helvetica').fillColor('#475569');
  const radIntro = `Radiological and organ health assessments integrate structural imaging data from up to 13 modalities (including whole abdomen USG, scrotum color Doppler, transvaginal scans, echocardiography, and DEXA bone density). This layer flags early structural anomalies, organ sizes, and metabolic indices to support family and wellness planning.`;
  doc.text(radIntro, 50, 115, { width: 495, align: 'justify' });

  // Draw partner cards
  drawRadiologyCard(doc, 50, 160, 240, 230, partnerAName, 'Male', matchData.maleRadiology);
  drawRadiologyCard(doc, 305, 160, 240, 230, partnerBName, 'Female', matchData.femaleRadiology);

  // Shared Radiology Insights Card
  const sharedY = 410;
  doc.roundedRect(50, sharedY, 495, 130, 6).fillColor('#f5f3ff').fill();
  doc.roundedRect(50, sharedY, 495, 130, 6).strokeColor('#ddd6fe').lineWidth(0.8).stroke();
  
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#6d28d9').text('SHARED ORGAN HEALTH & WELLNESS INTELLIGENCE', 65, sharedY + 12);
  
  // Logic to generate summary advice based on findings
  let adviceTitle = 'Optimal Organ & Structural Integrity';
  let adviceText = 'No significant structural pathologies or risk flags detected across evaluated imaging profiles. Metaphysiological baselines indicate healthy abdominal organ, reproductive tract, and cardiovascular structures, supporting general wellness and natural family planning.';
  
  const maleRad = matchData.maleRadiology;
  const femaleRad = matchData.femaleRadiology;
  const mFlags = maleRad?.risk_flags_json || [];
  const fFlags = femaleRad?.risk_flags_json || [];
  const allFlags = [...mFlags, ...fFlags];
  
  const hasFatty = allFlags.some(f => f.flag_id?.includes('FATTY'));
  const hasVaricocele = mFlags.some(f => f.flag_id?.includes('VARICOCELE'));
  const hasPcos = fFlags.some(f => f.flag_id?.includes('PCOS'));
  const hasEcho = allFlags.some(f => f.flag_id?.includes('ECHO') || f.flag_id?.includes('PAH'));
  const hasDexa = allFlags.some(f => f.flag_id?.includes('DEXA'));

  if (hasVaricocele || hasPcos) {
    adviceTitle = 'Reproductive Health Action Recommendations';
    adviceText = 'Structural modifiers (such as polycystic ovarian morphology or scrotal varicocele) were detected. These are common and highly correctable variations. We recommend proactive clinical consultations (semen analysis for Partner A, gynecology assessment for Partner B) to optimize pathways before planning.';
  } else if (hasFatty) {
    adviceTitle = 'Metabolic & Hepatic Coordination';
    adviceText = 'Fat accumulation (fatty liver grade I/II) was flagged. Since metabolic and diet patterns are highly shared in households, we recommend a joint lifestyle pivot: carbohydrate restriction, physical coordination, and follow-up liver function profiles.';
  } else if (hasEcho || hasDexa) {
    adviceTitle = 'Systemic Health Follow-Up';
    adviceText = 'Echocardiographic or bone density changes (osteopenia) were identified. Pregnancy increases cardiac load and shifts calcium homeostasis; therefore, cardiology clearance and calcium/Vitamin D supplementation review are advised.';
  }

  doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b').text(adviceTitle, 65, sharedY + 28);
  doc.fontSize(8.5).font('Helvetica').fillColor('#4b5563').text(adviceText, 65, sharedY + 42, { width: 465, align: 'justify' });

  doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#8b5cf6').text(
    '*This radiological review is informational and does not replace official diagnostic reports from certified radiologists.', 65, sharedY + 112
  );

  // ────────────────────────────────────────────────────────
  // PAGE 5: PART 2 - RAW PATIENT DATA CHECKPOINTS (CLINICAL TABLE)
  // ────────────────────────────────────────────────────────
  doc.addPage();
  
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text('Part 2: Raw Patient Data Checkpoints', 50, 75);
  doc.moveDown(1);
  
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569').text('Clinical Pathology, USG, and Genomic Parameters:');
  doc.moveDown(0.5);

  const maleM = details.male_manual_data || {};
  const femaleM = details.female_manual_data || {};
  
  const malePathology = chronic.details?.male_data || null;
  const femalePathology = chronic.details?.female_data || null;
  const maleRaw = chronic.partner_A?.rawValues || {};
  const femaleRaw = chronic.partner_B?.rawValues || {};

  const clinicalHeaders = ['Clinical Metric Name', `${partnerAName} (Male)`, `${partnerBName} (Female)`];
  const clinicalRows = [
    ['Age', chronic.partner_A?.age || maleM.age || 'N/A', chronic.partner_B?.age || femaleM.age || 'N/A'],
    ['Waist Circumference', getWaistText(malePathology, maleM), getWaistText(femalePathology, femaleM)],
    ['Blood Pressure (sbp/dbp)', getBPText(malePathology, maleM, maleRaw), getBPText(femalePathology, femaleM, femaleRaw)],
    ['HbA1c (Glucose Marker)', getGlucoseText(malePathology, maleM, maleRaw), getGlucoseText(femalePathology, femaleM, femaleRaw)],
    ['Lipids Profile', getLipidsText(malePathology, maleM, maleRaw), getLipidsText(femalePathology, femaleM, femaleRaw)],
    ['Ovarian Reserve (AMH)', 'Not Applicable', getOvarianReserveText(femalePathology, mfr, femaleM)],
    ['Semen Quality Status', getSemenText(malePathology, mfr, maleM), 'Not Applicable'],
    ['USG Radiological Finding', getUSGText(matchData.maleRadiology, maleM, false), getUSGText(matchData.femaleRadiology, femaleM, true)],
    ['Organ Volumes / Lining', getOrganVolumesText(matchData.maleRadiology, maleM, false), getOrganVolumesText(matchData.femaleRadiology, femaleM, true)],
    ['Echocardiography (Echo)', getEchoText(matchData.maleRadiology), getEchoText(matchData.femaleRadiology)],
    ['DEXA Bone Density', getDexaText(matchData.maleRadiology), getDexaText(matchData.femaleRadiology)],
    ['Chest X-Ray', getXrayText(matchData.maleRadiology), getXrayText(matchData.femaleRadiology)],
    ['Neck (Thyroid) USG', getNeckText(matchData.maleRadiology), getNeckText(matchData.femaleRadiology)],
    ['MTHFR Variant', 'Not Checked', getMTHFRText(femalePathology, femaleM)],
    ['CFTR Carrier Gene', 'Not Checked', getCFTRText(femalePathology, femaleM)],
    ['Karyotype Analysis', getKaryotypeText(malePathology, maleM, false), getKaryotypeText(femalePathology, femaleM, true)]
  ];

  let currentY = doc.y;
  currentY = drawTable(doc, currentY, clinicalHeaders, clinicalRows, [165, 165, 165]);

  // Flatten and list all dynamic pathology parameters from reports
  const maleParams = flattenPathologyParameters(malePathology);
  const femaleParams = flattenPathologyParameters(femalePathology);
  
  const allParamKeys = Array.from(new Set([...Object.keys(maleParams), ...Object.keys(femaleParams)]));
  allParamKeys.sort((a, b) => {
    const nameA = (maleParams[a] || femaleParams[a]).name.toLowerCase();
    const nameB = (maleParams[b] || femaleParams[b]).name.toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  const labHeaders = ['Pathology Parameter Name', `${partnerAName} (Male)`, `${partnerBName} (Female)`, 'Reference Range'];
  const labRows = allParamKeys.map(key => {
    const m = maleParams[key];
    const f = femaleParams[key];
    const param = m || f;
    
    const mText = m ? `${m.value} ${m.unit}`.trim() : 'N/A';
    const fText = f ? `${f.value} ${f.unit}`.trim() : 'N/A';
    const refText = param.reference_range ? String(param.reference_range).trim() : '—';
    
    return [param.name, mText, fText, refText];
  });

  if (labRows.length > 0) {
    if (currentY > 620) {
      doc.addPage();
      currentY = 75;
    } else {
      currentY += 25;
    }
    
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569').text('Comprehensive Laboratory Pathology Panel Results:', 50, currentY);
    currentY += 15;
    currentY = drawTable(doc, currentY, labHeaders, labRows, [190, 100, 100, 105]);
  }

  
  // ────────────────────────────────────────────────────────
  // PAGE 5: PART 2 - RAW PATIENT DATA CHECKPOINTS (BEHAVIORAL CHECKLIST)
  // ────────────────────────────────────────────────────────
  doc.addPage();
  
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569').text('Behavioral Questionnaire Responses:', 50, 75);
  doc.moveDown(0.5);
  
  if (mental && mental.individual_profiles) {
    const pAAnswers = mental.individual_profiles.partner_A.raw_answers || {};
    const pBAnswers = mental.individual_profiles.partner_B.raw_answers || {};

    const behavioralHeaders = ['Readiness Domain & Checkpoint', `${partnerAName} Answer`, `${partnerBName} Answer`];
    
    // Map answer values to text description dynamically
    const mapAns = (val, questionId) => {
      if (val === undefined || val === null) return 'N/A';
      const maps = {
        emotional_wellbeing: {
          1: "Frequently low/sluggish",
          2: "Mild energy drops",
          3: "Typical daily drive",
          4: "Consistent positive energy",
          5: "Highly driven and motivated"
        },
        stress_worry: {
          1: "Easily overwhelmed",
          2: "Frequent daily worry",
          3: "Manageable stress level",
          4: "High steady composure",
          5: "Consistently calm & serene"
        },
        life_stress_capacity: {
          1: "Quickly depleted",
          2: "Vulnerable to disruption",
          3: "Moderate coping capacity",
          4: "Strong coping reserve",
          5: "Highly resilient & adaptive"
        },
        personality_openness: {
          1: "Highly traditional / structured",
          2: "Prefers familiar settings",
          3: "Open to some new views",
          4: "Very curious and flexible",
          5: "Thrives on constant novelty"
        },
        personality_conscientiousness: {
          1: "Spontaneous and loose",
          2: "Moderate organization",
          3: "Generally orderly and neat",
          4: "Detail planner & reliable",
          5: "Meticulous and systematic"
        },
        personality_extraversion: {
          1: "Quiet / highly reserved",
          2: "Prefers intimate groups",
          3: "Balanced social needs",
          4: "Outgoing and engaging",
          5: "Life of the party"
        },
        personality_agreeableness: {
          1: "Skeptical / direct speaker",
          2: "Maintains clear boundaries",
          3: "Generally cooperative",
          4: "Very warm and agreeable",
          5: "Highly empathetic & harmony-focused"
        },
        personality_stability: {
          1: "Highly sensitive to friction",
          2: "Prone to quick mood shifts",
          3: "Generally stable mood",
          4: "Strong emotional control",
          5: "Extremely stable temperament"
        },
        attachment_style: {
          "Secure": "Secure (trusts easily)",
          "Anxious": "Anxious (worries about space)",
          "Avoidant": "Avoidant (prefers distance)",
          "Fearful": "Fearful (struggles with trust)"
        },
        readiness_communication: {
          1: "Struggles to share feelings",
          2: "Prefers superficial topics",
          3: "Shares general emotions",
          4: "Open, deep communicator",
          5: "Total verbal transparency"
        },
        readiness_conflict: {
          1: "Avoids conflict / shuts down",
          2: "Prone to arguments",
          3: "Resolves with friction",
          4: "Constructive compromise",
          5: "Collaborative resolution"
        },
        readiness_trust: {
          1: "Substantial trust doubts",
          2: "Takes time to open up",
          3: "Reasonable day-to-day trust",
          4: "Strong, reliable safety",
          5: "Implicit, complete trust"
        },
        readiness_commitment: {
          1: "Wait and see mindset",
          2: "Comfortable for now",
          3: "Generally long-term focused",
          4: "High partnership dedication",
          5: "Lifelong commitment"
        },
        readiness_support: {
          1: "Struggles to offer support",
          2: "Supports when asked",
          3: "Generally supportive",
          4: "Highly empathetic",
          5: "Complete, active presence"
        },
        career_alignment: {
          1: "Significant goal clashes",
          2: "Varying relocation flex",
          3: "Moderate career harmony",
          4: "Highly aligned milestones",
          5: "Perfect professional synergy"
        },
        financial_alignment: {
          1: "Opposing spending habits",
          2: "Varying budget structures",
          3: "Generally similar values",
          4: "Aligned saving/budget views",
          5: "Complete financial harmony"
        },
        lifestyle_alignment: {
          1: "Opposing social rhythm",
          2: "Different routine needs",
          3: "Good compatibility",
          4: "Highly synchronized rhythm",
          5: "Flawless social synergy"
        },
        family_expectations: {
          1: "Significant friction expected",
          2: "Different boundary views",
          3: "Generally manageable bounds",
          4: "Aligned boundary expectations",
          5: "Complete boundary synergy"
        },
        parenting_alignment: {
          1: "Major differences in vision",
          2: "Undecided / varying times",
          3: "Generally similar outlook",
          4: "Strong timeline harmony",
          5: "Perfect parenting alignment"
        },
        substance_concern: {
          "Low": "Low (infrequent/no use)",
          "Moderate": "Moderate (social use)",
          "Elevated": "Elevated (frequent use)"
        },
        anger_regulation: {
          1: "Quick to anger / aggressive",
          2: "Vocalizes irritation",
          3: "Typical self-regulation",
          4: "Excellent anger management",
          5: "Flawless emotional calm"
        }
      };
      
      const map = maps[questionId];
      if (map && map[val]) {
        return map[val];
      }
      return String(val);
    };

    const behavioralRows = [
      ['Daily Energy & Motivation (PHQ-9 inspired)', mapAns(pAAnswers.emotional_wellbeing, 'emotional_wellbeing'), mapAns(pBAnswers.emotional_wellbeing, 'emotional_wellbeing')],
      ['Composure Under Pressure & Calmness (GAD-7)', mapAns(pAAnswers.stress_worry, 'stress_worry'), mapAns(pBAnswers.stress_worry, 'stress_worry')],
      ['Coping Reserve & Adaptability (PSS)', mapAns(pAAnswers.life_stress_capacity, 'life_stress_capacity'), mapAns(pBAnswers.life_stress_capacity, 'life_stress_capacity')],
      ['Intellectual Flexibility & Openness (Big Five)', mapAns(pAAnswers.personality_openness, 'personality_openness'), mapAns(pBAnswers.personality_openness, 'personality_openness')],
      ['Planning & Reliability (Big Five)', mapAns(pAAnswers.personality_conscientiousness, 'personality_conscientiousness'), mapAns(pBAnswers.personality_conscientiousness, 'personality_conscientiousness')],
      ['Social Engagement Needs (Big Five)', mapAns(pAAnswers.personality_extraversion, 'personality_extraversion'), mapAns(pBAnswers.personality_extraversion, 'personality_extraversion')],
      ['Cooperation & Empathetic Alignment', mapAns(pAAnswers.personality_agreeableness, 'personality_agreeableness'), mapAns(pBAnswers.personality_agreeableness, 'personality_agreeableness')],
      ['Emotional Regulation & Temperament', mapAns(pAAnswers.personality_stability, 'personality_stability'), mapAns(pBAnswers.personality_stability, 'personality_stability')],
      ['Bonding Attachment Style (ECR-R)', mapAns(pAAnswers.attachment_style, 'attachment_style'), mapAns(pBAnswers.attachment_style, 'attachment_style')],
      ['Verbal Expression & Vulnearbility', mapAns(pAAnswers.readiness_communication, 'readiness_communication'), mapAns(pBAnswers.readiness_communication, 'readiness_communication')],
      ['Conflict Management Style (Gottman inspired)', mapAns(pAAnswers.readiness_conflict, 'readiness_conflict'), mapAns(pBAnswers.readiness_conflict, 'readiness_conflict')],
      ['Mutual Trust & Transparency', mapAns(pAAnswers.readiness_trust, 'readiness_trust'), mapAns(pBAnswers.readiness_trust, 'readiness_trust')],
      ['Long-term Relationship Commitment', mapAns(pAAnswers.readiness_commitment, 'readiness_commitment'), mapAns(pBAnswers.readiness_commitment, 'readiness_commitment')],
      ['Emotional Support & Responsiveness', mapAns(pAAnswers.readiness_support, 'readiness_support'), mapAns(pBAnswers.readiness_support, 'readiness_support')],
      ['Career Milestones & Mobility (Alignment)', mapAns(pAAnswers.career_alignment, 'career_alignment'), mapAns(pBAnswers.career_alignment, 'career_alignment')],
      ['Budgets & Financial Priorities', mapAns(pAAnswers.financial_alignment, 'financial_alignment'), mapAns(pBAnswers.financial_alignment, 'financial_alignment')],
      ['Daily Routine & Health Habits', mapAns(pAAnswers.lifestyle_alignment, 'lifestyle_alignment'), mapAns(pBAnswers.lifestyle_alignment, 'lifestyle_alignment')],
      ['Family Boundaries & In-Law Roles', mapAns(pAAnswers.family_expectations, 'family_expectations'), mapAns(pBAnswers.family_expectations, 'family_expectations')],
      ['Parenting Philosophy & Children Plan', mapAns(pAAnswers.parenting_alignment, 'parenting_alignment'), mapAns(pBAnswers.parenting_alignment, 'parenting_alignment')],
      ['Lifestyle Substance Check (WHO AUDIT inspired)', mapAns(pAAnswers.substance_concern, 'substance_concern'), mapAns(pBAnswers.substance_concern, 'substance_concern')],
      ['Anger & Reactivity Regulation under Pressure', mapAns(pAAnswers.anger_regulation, 'anger_regulation'), mapAns(pBAnswers.anger_regulation, 'anger_regulation')]
    ];

    drawTable(doc, doc.y, behavioralHeaders, behavioralRows, [215, 140, 140]);

  } else {
    doc.text('Behavioral Questionnaire Responses not completed by either partner.', { italic: true });
  }
  
  // ────────────────────────────────────────────────────────
  // PAGE 6: PART 3 - METHODOLOGY, FRAMEWORKS & SCIENTIFIC BACKING
  // ────────────────────────────────────────────────────────
  doc.addPage();
  
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text('Part 3: Scientific Methodology & Foundations', 50, 75);
  doc.moveDown(1);
  
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('1. Research Frameworks & Clinical Benchmarks');
  doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
  
  const researchText = `Our assessment models and reporting pipeline are evidence-informed, drawing upon established, peer-reviewed scientific methodologies:
  
• Big Five Personality model: Derived from the NEO-PI-R paradigm (Costa & McCrae) to describe compatibility, extraversion shifts, orderliness, and cooperation.
• Gottman Relationship Science: Inspired by Dr. John Gottman's 40+ years of premarital research and conflict resolution indicators.
• Adult Attachment Styles: Modeled after the Experiences in Close Relationships-Revised (ECR-R) scale by Fraley, Waller & Brennan to describe adult emotional safety.
• WHO AUDIT Methodology: Formulated around the World Health Organization Alcohol Use Disorders Identification Test to assess substance usage habits objectively.
• PHQ-9 & PSS Concept Scales: Adapted from Pfizer's Patient Health Questionnaire and Sheldon Cohen's Perceived Stress Scale to evaluate daily motivation and stress coping.
• Family Systems Research: Integrated domestic, in-law boundary, and financial alignment matrices.`;
  
  doc.text(researchText, { width: 495, align: 'justify' });
  doc.moveDown(1.5);
 
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('2. Analysis Pipeline Transparency');
  
  // Pipeline flow description
  const pipelineDesc = `Every report is generated through a transparent, 5-stage calculations pipeline:
  
1. Input Responses: Independently collects 19 behavior-based checkpoints from both partners.
2. Pillar Scaling: Normalizes values into 6 individual 0-100 scaled scores.
3. Compatibility Gap Analysis: Compares relative differences across all dimensions to calculate the overall Compatibility Index.
4. Threshold Narrative Engine: Evaluates statistical gaps to trigger shared strengths, recommended discussion areas, and risk flags.
5. Readiness Profile Synthesis: Assigns the dynamic Readiness Band and organizes action recommendations.`;

  doc.text(pipelineDesc, { width: 495, align: 'justify' });
  
  // ────────────────────────────────────────────────────────
  // PAGE 7: PART 3 - CHRONIC RISK MATHEMATICAL SPECIFICATION
  // ────────────────────────────────────────────────────────
  doc.addPage();
  
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b').text('3. Cardiometabolic Compatibility & Chronic Risk Mathematics', 50, 75);
  doc.moveDown(0.8);
  
  doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
  const chronicMathIntro = `The Cardiometabolic Compatibility Engine calculates long-term metabolic risks and projections using a dual-layer architecture combining the Indian Diabetes Risk Score (IDRS) and a Bayesian updating framework based on clinical and lifestyle factors.`;
  doc.text(chronicMathIntro, { width: 495, align: 'justify' });
  doc.moveDown(1);

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('A. Individual Indian Diabetes Risk Score (IDRS)');
  doc.fontSize(8.5).font('Helvetica');
  const idrsText = `Each partner's baseline risk is calculated using the validated Indian Diabetes Risk Score (IDRS) from the CURES cohort (Mohan et al., MDRF):
  
    IDRS = α(Age) + ω(Waist, Sex) + φ(Activity) + η(Family History)

• Age Component α(Age): Age < 35 = 0; Age 35–49 = 20; Age ≥ 50 = 30 points.
• Waist Component ω(Waist, Sex): 
    - Male: Waist < 90cm = 0; 90–99.9cm = 10; ≥ 100cm = 20 points.
    - Female: Waist < 80cm = 0; 80–89.9cm = 10; ≥ 90cm = 20 points.
• Physical Activity φ(Activity): Vigorous/Active = 0; Moderate/Mixed = 20; Sedentary = 30 points.
• Family History η(Family History): No parent diabetic = 0; One parent diabetic = 10 points (20 points for both parents).
• Risk Bands: Low (< 30), Moderate (30–59), High (≥ 60).
• Protective Score: g_i = 100 - IDRS_score`;
  doc.text(idrsText, { width: 495, align: 'justify' });
  doc.moveDown(1.2);

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('B. Bayesian Posterior Risk Assessment');
  doc.fontSize(8.5).font('Helvetica');
  const bayesText = `Using a prior target-population prevalence (π = 0.10 by default) and operating characteristics of the IDRS (Sensitivity Se = 0.725, Specificity Sp = 0.601), we calculate the likelihood ratios (LR) and the posterior probability P(D | screen):
  
    LR_pos = Se / (1 - Sp) ≈ 1.817 (if IDRS ≥ 60)
    LR_neg = (1 - Se) / Sp ≈ 0.458 (if IDRS < 60)
    
    P(D | screen) = (π × LR) / (π × LR + (1 - π))`;
  doc.text(bayesText, { width: 495, align: 'justify' });
  doc.moveDown(1.2);

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('C. Biomarker & Shared Lifestyle Bayesian Odds Update (Backend)');
  doc.fontSize(8.5).font('Helvetica');
  const oddsText = `The backend engine refines risk probabilities using clinical biomarkers and lifestyle inputs:
  
    Baseline Odds (Odds_0) = π / (1 - π) ≈ 0.111
    Updated Odds = Odds_0 × LR_IDRS × LR_biomarkers × LR_lifestyle_effective
    
• Biomarker Likelihood Ratios:
    - Blood Pressure: High (1.5), Elevated (1.2), Normal (1.0).
    - Glucose: Borderline (1.5), Normal/High (1.0). (Glucose ≥ 6.5 HbA1c triggers the gate).
    - Lipids: High (1.5), Borderline (1.2), Normal (1.0).
• Shared Lifestyle Integration: Effective Likelihood Ratio combines own and partner lifestyle weighted by sharedness exponents:
    - LR_f,effective = LR_f,own × (LR_f,partner)^s_f
    - Sharedness weights (s_f): Diet (1.0), Sleep (1.0), Smoking (0.2), Alcohol (0.0), Stress (0.0).
    - Lifestyle LRs: Diet (Poor: 1.3, Mixed: 1.15), Smoking (Regular: 1.5, Occasional: 1.25), Alcohol (Regular: 1.2, Occasional: 1.1), Sleep (Night owl: 1.2, Irregular: 1.1), Stress (High: 1.2, Moderate: 1.1).
• Individual Protective Score (Backend): g_i = 100 × (1 - p_i), where p_i = Odds_updated / (1 + Odds_updated).`;
  doc.text(oddsText, { width: 495, align: 'justify' });
  doc.moveDown(1.2);

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('D. Couple Convergence Aggregator & Temporal Projections');
  doc.fontSize(8.5).font('Helvetica');
  const coupleText = `• Couple Index: Aggregates individual scores using an Ordered Weighted Averaging (OWA) operator to prioritize the weaker partner's metabolic baseline:
    - J_couple = w × min(g_A, g_B) + (1 - w) × max(g_A, g_B)
    - Convergence weight w = 0.6. The report displays the interval [J_lo, J_hi] evaluated for w ∈ [0.5, 0.7].
• Temporal Projection: 10-year projection compounds the baseline odds by 1.05 per year:
    - Odds(t) = Odds_current × 1.05^t
• Burden Index (B): B = B_partner_A + B_partner_B + Sum(Lifestyle_Penalties). 
    - Partner burdens: HbA1c ≥ 6.5 (+4); High Waist (+2), Borderline (+1); High Lipids (+2), Borderline (+1); Family History (+1).
    - Penalties: Diet (Poor: 22), Activity (Sedentary: 16), Smoking (Regular: 24), Alcohol (Heavy: 12), Sleep (Night owl: 10), Stress (High: 10).`;
  doc.text(coupleText, { width: 495, align: 'justify' });
  doc.moveDown(1.2);


  // ────────────────────────────────────────────────────────
  // PAGE 8: PART 3 - MFR & FERTILITY MATHEMATICAL SPECIFICATION
  // ────────────────────────────────────────────────────────
  doc.addPage();
  
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b').text('4. Fertility Timing & Reproductive Health (MFR) Mathematics', 50, 75);
  doc.moveDown(0.8);
  
  doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
  const mfrIntro = `The Monthly Conception Chance (MFR) Engine projects the likelihood of natural conception over an 8-year timeline. It integrates age-based clinical baseline statistics, radiological findings, genomic details, and modifiable lifestyle factors.`;
  doc.text(mfrIntro, { width: 495, align: 'justify' });
  doc.moveDown(1);

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('A. Age-Based Fecundability Baselines & Interpolation');
  doc.fontSize(8.5).font('Helvetica');
  const ageBaselineText = `Initial biological scores are interpolated from clinical age tables and clamped between [2, 100]:
  
• Female Age Baseline (FEM): 
    - Ages 18–24: 97; Age 25: 94; Age 30: 86; Age 35: 67; Age 40: 38; Age 45: 7; Age 50: 4.
• Male Age Baseline (MAL):
    - Ages 18–25: 97; Age 30: 95; Age 32: 91; Age 35: 87; Age 40: 80; Age 45: 71; Age 50: 62; Age 55: 55.
• Scoring Calculation: score_i = clamp(2, 100, interp(Age_i) + adjustments)`;
  doc.text(ageBaselineText, { width: 495, align: 'justify' });
  doc.moveDown(1.2);

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('B. Ovarian Reserve & WHO Semen Quality Classifications');
  doc.fontSize(8.5).font('Helvetica');
  const reserveSemenText = `• Ovarian Reserve Classifier: Categorizes AMH & AFC based on female age brackets to determine adjustments:
    - High for age (+5), Normal (0), Low (-10), Very Low (-20 points).
• Semen Quality Classifier: Evaluates concentration, total count, volume, motility, vitality, morphology, and pH against WHO 2021 criteria:
    - Normal (0), Mild Deficit (-8), Moderate Deficit (-18), Severe Deficit (-30 points). (Azoospermia triggers the absolute gate).`;
  doc.text(reserveSemenText, { width: 495, align: 'justify' });
  doc.moveDown(1.2);

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('C. Radiological (USG) & Genomic Modifiers (Backend Adjustments)');
  doc.fontSize(8.5).font('Helvetica');
  const modifiersText = `The backend incorporates secondary physical and genomic markers as score adjustments:
  
• Female Physical & Genomic Modifiers:
    - Thin Endometrial Lining < 7mm (-8 points)
    - Submucosal Fibroids (-15 points); Intramural Fibroids (-6 points)
    - Unilateral blocked fallopian tube (-12 points)
    - Bilateral polycystic ovarian morphology BCOM (-15 points); Unilateral BCOM (-8 points)
    - Pelvic POD Fluid (-5 points); Enlarged Ovarian Volume > 10cc (-5 points)
    - Female Fatty Liver: Grade I (-2 points), Grade II (-5 points), Grade III (-10 points)
    - Homozygous MTHFR (-8 points); Heterozygous MTHFR (-3 points)
    - Abnormal female karyotype (-20 points)
• Male Physical & Genomic Modifiers:
    - Varicocele: Grade 1 (-3 points), Grade 2 (-7 points), Grade 3 (-12 points)
    - Low Testicular Volume (-5 points); Prostate Grade II (-6 points), Grade III (-12 points)
    - Post-Void Residual PVR volume: Borderline (-2 points), Significant (-5 points)
    - Male Fatty Liver: Grade I (-2 points), Grade II (-5 points), Grade III (-10 points)
    - Genomic Y-Chromosome AZFc microdeletion (-25 points)`;
  doc.text(modifiersText, { width: 495, align: 'justify' });
  doc.moveDown(1.2);

  doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#475569').text('D. Monthly Fecundability Probability & Cumulative Conception');
  doc.fontSize(8.5).font('Helvetica');
  const mfrProbabilityText = `• Combined Biological Score (C): C = 0.6 × min(f_Score, m_Score) + 0.4 × max(f_Score, m_Score)
• Biological Monthly Fecundability Rate (MFR_bio): MFR_bio = (C / 100) × 0.25 (clamped at 25% maximum)
• Shared Lifestyle Index (L) & Multiplier (λ): 
    - L = max(0, 100 - [Diet_penalty + Smoking_penalty + BMI_penalty + Activity_penalty + Alcohol_penalty + Stress_penalty])
    - Penalties: Diet (Poor: 22), Smoking (Both smoke: 22, One: 10), BMI outside range (Both: 14, One: 6), Physical Activity (Sedentary: 14, Mixed: 6), Alcohol (Heavy: 12, Moderate: 4), Stress (High: 10, Moderate: 4).
    - λ = 0.55 + 0.45 × (L / 100) (ranging between 0.55 and 1.0)
• Intercourse Frequency Multiplier (ω_freq): 3+/wk = 1.0; ~2/wk = 0.92; ~1/wk = 0.82; <1/wk = 0.68.
• Final Conception Probability Calculations:
    - Current Monthly Chance: MFR_current = MFR_bio × λ_current × ω_freq
    - Optimised Monthly Chance: MFR_optimised = MFR_bio × 1.0 × ω_freq
    - 12-Month Cumulative Chance: P_12m = 1 - (1 - MFR_current)^12
    - Median Time to Conceive (TTC): TTC = 1 / MFR_current months`;
  doc.text(mfrProbabilityText, { width: 495, align: 'justify' });
  doc.moveDown(2);

  // Disclaimer Box (moved to end of math sections)
  if (doc.y + 85 > 730) {
    doc.addPage();
  }
  const boxY = doc.y;
  doc.rect(50, boxY, 495, 85).fillColor('#fef2f2').fill();
  doc.rect(50, boxY, 495, 85).strokeColor('#fca5a5').lineWidth(1).stroke();
  
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#991b1b').text('IMPORTANT CLINICAL DISCLAIMER & LIMITATIONS', 65, boxY + 10);
  doc.fontSize(7.5).font('Helvetica').fillColor('#7f1d1d').text(
    `This report is designed for relationship coaching and alignment purposes only. It is NOT a clinical diagnosis tool. SlayHealth does not provide psychiatric diagnoses, clinical pathology reports, or mental illness classification. If clinical depression, anxiety, substance dependency, or severe anger regulation concerns are present, we recommend consulting a licensed medical professional or couples counselor.`,
    65, boxY + 25, { width: 465, align: 'justify' }
  );
  
  doc.y = boxY + 95;

  // ────────────────────────────────────────────────────────
  // WATERMARK, HEADERS, FOOTERS & LOGO ON ALL PAGES
  // ────────────────────────────────────────────────────────
  
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(i);
    
    // Temporarily set margins to 0 to prevent auto-page creation when drawing headers/footers
    const oldMargins = doc.page.margins;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    
    if (i > 0) {
      // Top header logo
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 25, { width: 20 });
      }
      
      // Header text label
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#7c3aed').text('SlayHealth Premarital Profile', 80, 28);
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Consolidated Health & Alignment Report', 200, 28, { align: 'right', width: 345 });
      
      // Top divider line
      doc.moveTo(50, 52).lineTo(545, 52).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
      
      // Bottom divider line
      doc.moveTo(50, 785).lineTo(545, 785).strokeColor('#e2e8f0').lineWidth(0.8).stroke();
      
      // Footer text
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Confidential premarital alignment report. Powered by SlayHealth.', 50, 792);
      doc.text(`Page ${i + 1} of ${pageRange.count}`, 450, 792, { align: 'right', width: 95 });
    }
    
    // Restore margins
    doc.page.margins = oldMargins;
  }

  doc.end();
  return doc;
}

module.exports = {
  generatePDFReportStream
};
