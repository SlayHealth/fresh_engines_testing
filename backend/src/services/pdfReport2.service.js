const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const reportSummaryService = require('./compatibility/reportSummary.service');

// ─────────────────────────────────────────────────────────
// TEXT SAFETY
// ─────────────────────────────────────────────────────────

/**
 * Normalize punctuation PDFKit's base-14 fonts can't render, then strip
 * emojis and remaining non-ASCII glyphs. Dashes/quotes are mapped to ASCII
 * equivalents instead of being deleted, so "30-59" and "CONFIDENTIAL - X"
 * don't get mangled into "3059" / "CONFIDENTIAL X".
 */
function cleanPDFText(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[\u{1F300}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u2600-\u26FF]/g, '')
    .replace(/[\u2700-\u27BF]/g, '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u2012-\u2015\u2212]/g, '-')   // en/em dash, minus -> hyphen
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'") // curly single quotes
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"') // curly double quotes
    .replace(/[\u2026]/g, '...')               // ellipsis
    .replace(/[\u00A0]/g, ' ')                 // nbsp
    .replace(/[^\x00-\x7F]/g, '')              // strip remaining non-ASCII
    .replace(/\s+/g, ' ')
    .trim();
}

/** Safe string coercion + clean, for values that might not be strings. */
function safeText(val, fallback = 'N/A') {
  if (val === null || val === undefined || val === '') return fallback;
  return cleanPDFText(String(val));
}

/** Truncate a name to a max character length with ellipsis, word-aware. */
function truncateName(name, maxLen = 24) {
  const clean = safeText(name, '');
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1).trim() + '...';
}

// ─────────────────────────────────────────────────────────
// PREMIUM DESIGN SYSTEM
// ─────────────────────────────────────────────────────────

const LUXURY = {
  bg:          '#07090f',
  surface:     '#0d1526',
  surface2:    '#111d35',
  border:      '#1e2d4a',
  gold:        '#c9a84c',
  goldLight:   '#e8c96a',
  purple:      '#7c3aed',
  purpleLight: '#a78bfa',
  green:       '#10b981',
  yellow:      '#f59e0b',
  red:         '#ef4444',
  text:        '#f1f5f9',
  textMuted:   '#94a3b8',
  textDim:     '#475569',
};

const PAGE_W = 595;
const PAGE_H = 842;
const CONTENT_BOTTOM = 800; // safe bottom edge before footer band

// Map status strings to design colors. Accepts 'red'/'yellow'/'green' or
// semantic words like 'critical'/'good'/'moderate'.
function luxuryColor(status) {
  if (!status || typeof status !== 'string') return LUXURY.green;
  const s = status.toLowerCase();
  if (s === 'red' || s === 'action advised' || s === 'critical' || s === 'poor') return LUXURY.red;
  if (s === 'yellow' || s === 'moderate' || s === 'caution' || s === 'borderline') return LUXURY.yellow;
  return LUXURY.green;
}

function fillPageBg(doc) {
  doc.save();
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  doc.rect(0, 0, PAGE_W, PAGE_H).fillColor(LUXURY.bg).fill();
  doc.page.margins = { top: 50, bottom: 50, left: 50, right: 50 };
  doc.restore();
}

function goldRule(doc, y, left = 0, right = PAGE_W) {
  doc.save();
  doc.moveTo(left, y).lineTo(right, y).strokeColor(LUXURY.gold).lineWidth(0.6).stroke();
  doc.restore();
}

function sectionHeader(doc, x, y, text, width = 495) {
  doc.save();
  doc.rect(x, y, 3, 14).fillColor(LUXURY.gold).fill();
  doc.fontSize(10).font('Helvetica-Bold').fillColor(LUXURY.gold)
    .text(safeText(text).toUpperCase(), x + 10, y + 1, { width, characterSpacing: 0.5 });
  doc.restore();
  return y + 22;
}

function darkCard(doc, x, y, w, h, radius = 10, bg = LUXURY.surface) {
  doc.save();
  doc.roundedRect(x, y, w, h, radius).fillColor(bg).fill();
  doc.roundedRect(x, y, w, h, radius).strokeColor(LUXURY.border).lineWidth(0.5).stroke();
  doc.restore();
}

function accentBorder(doc, x, y, h, color) {
  doc.save();
  doc.roundedRect(x, y, 4, h, 2).fillColor(color).fill();
  doc.restore();
}

function statusPill(doc, x, y, text, color, textColor = '#ffffff') {
  doc.save();
  const label = safeText(text).toUpperCase();
  const w = Math.min(doc.widthOfString(label, { font: 'Helvetica-Bold', fontSize: 7 }) + 16, 130);
  doc.roundedRect(x, y, w, 16, 8).fillColor(color).fill();
  doc.fontSize(7).font('Helvetica-Bold').fillColor(textColor)
    .text(label, x, y + 4.5, { width: w, align: 'center', ellipsis: true });
  doc.restore();
  return w;
}

function valueBar(doc, x, y, w, h, pct, color) {
  doc.save();
  doc.roundedRect(x, y, w, h, h / 2).fillColor(LUXURY.border).fill();
  const fillW = Math.max(0, Math.min(1, pct)) * w;
  if (fillW > h) { // avoid a degenerate rounded-rect thinner than its own radius
    doc.roundedRect(x, y, fillW, h, h / 2).fillColor(color).fill();
  } else if (fillW > 0) {
    doc.circle(x + h / 2, y + h / 2, h / 2).fillColor(color).fill();
  }
  doc.restore();
}

/**
 * Draw a real proportional progress ring (not a full circle regardless of
 * value). Approximates the arc with short line segments since PDFKit has
 * no native partial-arc stroke primitive.
 */
function drawScoreRing(doc, cx, cy, radius, lineWidth, pct, trackColor, fillColor) {
  doc.save();
  doc.circle(cx, cy, radius).lineWidth(lineWidth).strokeColor(trackColor).stroke();
  const clamped = Math.max(0, Math.min(1, pct));
  if (clamped > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * clamped;
    const steps = Math.max(2, Math.round(72 * clamped));
    doc.lineWidth(lineWidth).strokeColor(fillColor).lineCap('round');
    doc.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle));
    for (let i = 1; i <= steps; i++) {
      const a = startAngle + (endAngle - startAngle) * (i / steps);
      doc.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a));
    }
    doc.stroke();
  }
  doc.restore();
}

function drawLuxuryScoreRing(doc, cx, cy, score, status, opts = {}) {
  const color = luxuryColor(status);
  const max = opts.max || 100;
  const pct = Math.max(0, Math.min(1, (Number(score) || 0) / max));
  doc.save();
  doc.circle(cx, cy, 62).lineWidth(1).strokeColor(LUXURY.border).stroke();
  drawScoreRing(doc, cx, cy, 52, 10, pct, LUXURY.surface2, color);
  doc.circle(cx, cy, 38).lineWidth(1).strokeColor(color).opacity(0.3).stroke();
  doc.opacity(1);
  const scoreLabel = safeText(score, '-');
  doc.fontSize(28).font('Helvetica-Bold').fillColor(LUXURY.text)
    .text(scoreLabel, cx - 30, cy - 18, { width: 60, align: 'center' });
  doc.fontSize(8).font('Helvetica-Bold').fillColor(LUXURY.textMuted)
    .text(`/ ${max}`, cx - 20, cy + 12, { width: 40, align: 'center' });
  doc.restore();
}

function drawStar(doc, cx, cy, spikes, outerRadius, innerRadius, filled, color) {
  doc.save();
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  doc.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerRadius;
    let y = cy + Math.sin(rot) * outerRadius;
    doc.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    doc.lineTo(x, y);
    rot += step;
  }
  doc.lineTo(cx, cy - outerRadius);
  doc.closePath();
  if (filled) {
    doc.fillColor(color).fill();
  } else {
    doc.strokeColor(color).lineWidth(1.5).stroke();
  }
  doc.restore();
}

function drawLuxuryStars(doc, x, y, filled, total = 5, size = 9) {
  const safeFilled = Math.max(0, Math.min(total, Number(filled) || 0));
  for (let i = 0; i < total; i++) {
    const cx = x + i * (size * 2 + 4);
    const cy = y + size;
    if (i < safeFilled) {
      drawStar(doc, cx, cy, 5, size, size * 0.45, true, LUXURY.gold);
    } else {
      drawStar(doc, cx, cy, 5, size, size * 0.45, false, LUXURY.border);
    }
  }
}

/** Empty-state placeholder card so missing data reads as intentional, not broken. */
function emptyStateCard(doc, x, y, w, h, message) {
  doc.save();
  doc.roundedRect(x, y, w, h, 8).fillColor(LUXURY.surface).fill();
  doc.roundedRect(x, y, w, h, 8).strokeColor(LUXURY.border).lineWidth(0.5).dash(3, { space: 3 }).stroke();
  doc.undash();
  doc.fontSize(7.5).font('Helvetica').fillColor(LUXURY.textDim)
    .text(safeText(message), x + 14, y + h / 2 - 5, { width: w - 28, align: 'center' });
  doc.restore();
}

/**
 * Draws a header band (used on every content page after the cover) and
 * returns the y-coordinate content should start at.
 */
function pageHeader(doc, title, subtitle, opts = {}) {
  fillPageBg(doc);
  doc.rect(0, 0, PAGE_W, 55).fillColor(LUXURY.surface).fill();
  goldRule(doc, 55);
  doc.fontSize(16).font('Helvetica-Bold').fillColor(LUXURY.text).text(safeText(title), 30, 15);
  if (subtitle) {
    doc.fontSize(8.5).font('Helvetica').fillColor(LUXURY.textMuted).text(safeText(subtitle), 30, 36);
  }
  if (opts.badge) {
    const badgeW = doc.widthOfString(opts.badge.text.toUpperCase(), { font: 'Helvetica-Bold', fontSize: 7 }) + 16;
    statusPill(doc, PAGE_W - 30 - badgeW, 20, opts.badge.text, opts.badge.color);
  }
  return 64;
}

/**
 * Adds a fresh continuation page with the same header band, used when a
 * dynamic list would otherwise overflow the bottom margin. Prevents the
 * "silently drop the last row" bug from the previous version.
 */
function continuePage(doc, title, subtitle) {
  doc.addPage({ size: 'A4', margin: 0 });
  return pageHeader(doc, title, subtitle);
}

// ─────────────────────────────────────────────────────────
// CLINICAL VALUE EXTRACTION
// ─────────────────────────────────────────────────────────

function flattenPathologyParameters(reportData) {
  const params = {};
  if (!reportData) return params;
  for (const sectionKey of Object.keys(reportData)) {
    const section = reportData[sectionKey];
    if (!section || typeof section !== 'object') continue;
    if (sectionKey === 'manual_data' || sectionKey === 'metadata') continue;
    for (const paramKey of Object.keys(section)) {
      const param = section[paramKey];
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

function findExtractedParam(pathology, name) {
  if (!pathology) return null;
  const flat = flattenPathologyParameters(pathology);
  const canonicalName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return flat[canonicalName] || null;
}

function getWaistText(pathology, manual) {
  const waist = findExtractedParam(pathology, 'waist_circumference') || findExtractedParam(pathology, 'waist');
  if (waist && waist.value) return `${waist.value} cm`;
  if (manual && manual.waist) return `${manual.waist} cm`;
  return 'Not Uploaded';
}

function getBPText(pathology, manual, rawValues) {
  const BP = findExtractedParam(pathology, 'blood_pressure') || findExtractedParam(pathology, 'bp');
  if (BP && BP.value) return BP.value;
  if (manual && manual.sbp && manual.dbp) return `${manual.sbp}/${manual.dbp} mmHg`;
  if (rawValues && rawValues.sbp && rawValues.dbp) return `${rawValues.sbp}/${rawValues.dbp} mmHg`;
  return 'Normal (Target)';
}

function getGlucoseText(pathology, manual, rawValues) {
  const hba1c = findExtractedParam(pathology, 'hba1c');
  if (hba1c && hba1c.value) return `${hba1c.value}% (HbA1c)`;
  if (manual && manual.glucose) return manual.glucose;
  if (rawValues && rawValues.glucoseValue) return `${rawValues.glucoseValue}%`;
  return 'Normal';
}

function getLipidsText(pathology, manual, rawValues) {
  const ldl = findExtractedParam(pathology, 'ldl_cholesterol') || findExtractedParam(pathology, 'ldl');
  if (ldl && ldl.value) return `LDL: ${ldl.value} mg/dL`;
  if (manual && manual.cholesterol) return manual.cholesterol;
  if (rawValues && rawValues.ldl) return `LDL: ${rawValues.ldl}`;
  return 'Normal';
}

function getOvarianReserveText(pathology, mfr, femaleM) {
  const amh = findExtractedParam(pathology, 'amh') || findExtractedParam(pathology, 'anti_mullerian_hormone');
  if (amh && amh.value) return `AMH: ${amh.value} ng/mL`;
  if (femaleM && femaleM.ovarianReserve) return femaleM.ovarianReserve;
  return mfr?.details?.female_ovarian_reserve || 'Normal';
}

function getSemenText(pathology, mfr, maleM) {
  const conc = findExtractedParam(pathology, 'sperm_concentration');
  if (conc && conc.value) return `Sperm Conc: ${conc.value} M/ml`;
  if (maleM && maleM.semenQuality) return maleM.semenQuality;
  return mfr?.details?.male_semen_quality || 'Normal';
}

function getUSGText(radiology, manual, isFemale) {
  if (radiology) {
    const modalities = radiology.modalities_detected || [];
    return modalities.length ? modalities.join(', ') : 'Normal Baseline';
  }
  if (manual) {
    if (isFemale) return manual.uterineLining || 'Normal USG';
    return manual.varicocele || 'Normal Scrotal USG';
  }
  return 'Normal Baseline';
}

function getOrganVolumesText(radiology, manual, isFemale) {
  if (radiology) return 'Standard organ size';
  if (manual) {
    if (isFemale) return manual.ovarianVolume || 'Normal';
    return manual.testicularVolume || 'Normal';
  }
  return 'Normal';
}

function getEchoText(radiology) {
  if (radiology && radiology.findings_json?.ECHO) return 'Normal LVEF';
  return 'Normal Cardiac Baseline';
}

function getDexaText(radiology) {
  if (radiology && radiology.findings_json?.DEXA) {
    const dexa = radiology.findings_json.DEXA;
    return `${dexa.overall_who_classification || 'Normal'} (T-score: ${dexa.lowest_t_score_value ?? 'N/A'} at ${dexa.lowest_t_score_site || 'site'})`;
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

/** IDRS (Indian Diabetic Risk Score) band classification - now surfaced in the report. */
function idrsBand(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return { label: 'Unavailable', note: 'Insufficient data to calculate risk score.', color: LUXURY.textDim };
  if (s < 30) return { label: 'Low Risk', note: 'Under 30 points. Low metabolic risk - maintain current lifestyle.', color: LUXURY.green };
  if (s < 60) return { label: 'Moderate Risk', note: '30-59 points. Elevated risk - monitor glucose baseline and stay active.', color: LUXURY.yellow };
  return { label: 'High Risk', note: '60+ points. Consult a physician for HbA1c and glucose screening.', color: LUXURY.red };
}

/** Simple BMI band classification for the metabolic KPI panel. */
function bmiBand(bmi) {
  const b = Number(bmi);
  if (!Number.isFinite(b)) return { label: 'Unavailable', color: LUXURY.textDim };
  if (b < 18.5) return { label: 'Underweight', color: LUXURY.yellow };
  if (b < 23) return { label: 'Normal', color: LUXURY.green };
  if (b < 27.5) return { label: 'Overweight', color: LUXURY.yellow };
  return { label: 'Obese', color: LUXURY.red };
}

// ─────────────────────────────────────────────────────────
// MAIN REPORT GENERATOR
// ─────────────────────────────────────────────────────────

function generatePDFReportStream(matchData) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

  let analysis = matchData.analysis_json || {};
  if (typeof analysis === 'string') {
    try { analysis = JSON.parse(analysis); } catch (e) { logger.warn('pdfReport: failed to parse analysis_json'); analysis = {}; }
  }
  const chronic = analysis.chronicResult || {};
  const mfr = analysis.mfrResult || {};
  const mental = analysis.mentalResult || {};
  const details = analysis.details || {};

  let partnerAName = safeText(details.male_manual_data?.name || chronic.partner_A?.name, 'Partner A');
  let partnerBName = safeText(details.female_manual_data?.name || chronic.partner_B?.name, 'Partner B');

  const dateStr = new Date(matchData.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const logoPath = path.resolve(__dirname, '../../../frontend/assets/logo (1).png');

  let presentation = matchData.presentation_json;
  let aiNarrative = matchData.ai_narrative;

  if (!presentation || !aiNarrative) {
    let mapping;
    try {
      mapping = reportSummaryService.mapPresentation(chronic, mfr, mental, {
        male_data: chronic.details?.male_data || {},
        female_data: chronic.details?.female_data || {},
        male_manual_data: details.male_manual_data || {},
        female_manual_data: details.female_manual_data || {},
        shared_lifestyle: details.shared_lifestyle || {},
        radiology_report_id: matchData.female_report_id || null
      });
    } catch (e) {
      logger.warn('pdfReport: mapPresentation failed, using empty fallback', e);
      mapping = { presentation: {} };
    }
    presentation = mapping.presentation || {};
    aiNarrative = {
      hero: `Hello ${partnerAName} & ${partnerBName}! Here is your complete premarital health and compatibility profile.`,
      top_insights: [], body_cards: {}, recommendations: {}, closing_message: ''
    };
  } else {
    if (typeof presentation === 'string') { try { presentation = JSON.parse(presentation); } catch (e) { presentation = {}; } }
    if (typeof aiNarrative === 'string') { try { aiNarrative = JSON.parse(aiNarrative); } catch (e) { aiNarrative = {}; } }
  }

  const snapshot = presentation.relationship_snapshot || { score: 0, status: 'Pending', color: 'yellow', confidence: 'Low' };
  const fp = presentation.family_planning || { stars: 0, rating: 'Pending', annualChance: 0, monthsToConceive: 'N/A', details: {} };
  const bh = presentation.body_health || {};
  const stiGate = presentation.sti_gate || { triggered: false, findings: [] };
  if (!Array.isArray(stiGate.findings)) stiGate.findings = [];
  const snapshotColor = luxuryColor(snapshot.color || snapshot.status);

  // Gender-alignment: derive from actual sex fields only, no name heuristics.
  const isA_Female = chronic.partner_A?.sex === 'F' || chronic.partner_B?.sex === 'M';
  const maleM = isA_Female ? (details.female_manual_data || {}) : (details.male_manual_data || {});
  const femaleM = isA_Female ? (details.male_manual_data || {}) : (details.female_manual_data || {});
  const malePathology = isA_Female ? (chronic.details?.female_data || null) : (chronic.details?.male_data || null);
  const femalePathology = isA_Female ? (chronic.details?.male_data || null) : (chronic.details?.female_data || null);
  const maleHeaderName = isA_Female ? partnerBName : partnerAName;
  const femaleHeaderName = isA_Female ? partnerAName : partnerBName;
  const maleRaw = isA_Female ? (chronic.partner_B?.rawValues || {}) : (chronic.partner_A?.rawValues || {});
  const femaleRaw = isA_Female ? (chronic.partner_A?.rawValues || {}) : (chronic.partner_B?.rawValues || {});
  const maleNameShort = truncateName(maleHeaderName, 20);
  const femaleNameShort = truncateName(femaleHeaderName, 20);

  // ════════════════════════════════════════════════════════
  // PAGE 1 - COVER
  // ════════════════════════════════════════════════════════
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  fillPageBg(doc);

  doc.rect(0, 0, PAGE_W, 4).fillColor(LUXURY.gold).fill();
  doc.rect(0, 0, 230, PAGE_H).fillColor(LUXURY.surface).fill();
  doc.rect(230, 0, 1, PAGE_H).fillColor(LUXURY.border).fill();

  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 20, 20, { width: 90 }); } catch (e) { logger.warn('pdfReport: logo failed to load'); }
  }

  doc.fontSize(7).font('Helvetica-Bold').fillColor(LUXURY.gold).text('SLAYHEALTH', 20, 58, { characterSpacing: 3 });
  doc.fontSize(6.5).font('Helvetica').fillColor(LUXURY.textDim).text('PREMARITAL HEALTH INTELLIGENCE', 20, 68, { characterSpacing: 1 });

  goldRule(doc, 85, 20, 210);

  // Partner names - truncated + auto-sized so long names never overflow the panel.
  const nameA = truncateName(partnerAName, 26);
  const nameB = truncateName(partnerBName, 26);
  const nameAFontSize = nameA.length > 18 ? 13 : 16;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(LUXURY.textMuted).text('PREPARED FOR', 20, 100, { characterSpacing: 2 });
  doc.fontSize(nameAFontSize).font('Helvetica-Bold').fillColor(LUXURY.text).text(nameA, 20, 114, { width: 190 });
  doc.fontSize(9).font('Helvetica').fillColor(LUXURY.gold).text('& ' + nameB, 20, 114 + (nameAFontSize > 14 ? 22 : 18), { width: 190 });

  goldRule(doc, 152, 20, 210);

  drawLuxuryScoreRing(doc, 115, 260, snapshot.score, snapshot.color || snapshot.status);

  doc.fontSize(8).font('Helvetica-Bold').fillColor(LUXURY.textMuted).text('COMPATIBILITY INDEX', 20, 322, { width: 190, align: 'center' });
  doc.fontSize(11).font('Helvetica-Bold').fillColor(snapshotColor).text(safeText(snapshot.status).toUpperCase(), 20, 338, { width: 190, align: 'center' });

  goldRule(doc, 360, 20, 210);

  const leftStats = [
    { label: 'Conception Chance', value: `${fp.annualChance ?? 0}%` },
    { label: 'Fertility Rating', value: safeText(fp.rating, 'Pending') },
    { label: 'Report Confidence', value: safeText(snapshot.confidence, 'Medium') },
    { label: 'Assessment Date', value: dateStr },
  ];
  let statY = 375;
  leftStats.forEach(s => {
    doc.fontSize(7).font('Helvetica').fillColor(LUXURY.textDim).text(s.label.toUpperCase(), 20, statY, { characterSpacing: 0.5 });
    doc.fontSize(9.5).font('Helvetica-Bold').fillColor(LUXURY.text).text(safeText(s.value), 20, statY + 10, { width: 190 });
    statY += 32;
  });

  goldRule(doc, statY + 5, 20, 210);

  doc.fontSize(7).font('Helvetica').fillColor(LUXURY.textDim).text('FERTILITY STARS', 20, statY + 15, { characterSpacing: 0.5 });
  drawLuxuryStars(doc, 20, statY + 27, fp.stars);

  // Right side - title block
  doc.fontSize(9).font('Helvetica-Bold').fillColor(LUXURY.gold).text('PREMARITAL HEALTH REPORT', 255, 78, { characterSpacing: 1.5 });
  goldRule(doc, 96, 245, 580);

  doc.fontSize(32).font('Helvetica-Bold').fillColor(LUXURY.text).text('Health &', 255, 108);
  doc.fontSize(32).font('Helvetica-Bold').fillColor(LUXURY.purpleLight).text('Compatibility', 255, 143);
  doc.fontSize(32).font('Helvetica-Bold').fillColor(LUXURY.text).text('Profile', 255, 178);

  const heroText = safeText(aiNarrative.hero, `A comprehensive premarital health and alignment assessment for ${partnerAName} & ${partnerBName}.`);
  doc.fontSize(10).font('Helvetica').fillColor(LUXURY.textMuted).text(heroText, 255, 222, { width: 315, lineGap: 4 });
  const heroHeight = doc.heightOfString(heroText, { width: 315, lineGap: 4 });

  // Key findings - height is measured, so the STI banner below never collides with it.
  const insights = Array.isArray(aiNarrative.top_insights) ? aiNarrative.top_insights.filter(Boolean) : [];
  let insY = 222 + heroHeight + 20;
  goldRule(doc, insY - 8, 245, 580);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(LUXURY.gold).text('KEY FINDINGS', 255, insY, { characterSpacing: 1.5 });
  insY += 14;

  const maxInsights = stiGate.triggered ? 3 : 4;
  if (insights.length === 0) {
    doc.fontSize(8).font('Helvetica').fillColor(LUXURY.textDim).text('Detailed findings are available in the following sections.', 255, insY, { width: 310 });
    insY += 20;
  } else {
    insights.slice(0, maxInsights).forEach((ins) => {
      const insText = safeText(ins);
      const insHeight = Math.max(30, doc.heightOfString(insText, { width: 300, lineGap: 2 }) + 8);
      doc.save();
      doc.rect(255, insY, 4, insHeight - 4).fillColor(LUXURY.purple).fill();
      doc.fontSize(8.5).font('Helvetica').fillColor(LUXURY.text).text(insText, 265, insY, { width: 310, lineGap: 2, ellipsis: true, height: insHeight - 4 });
      doc.restore();
      insY += insHeight + 8;
    });
  }

  // STI gate alert - position now derived from actual content above it, sized to fit findings.
  if (stiGate.triggered && stiGate.findings.length > 0) {
    const findingsText = safeText(stiGate.findings.map(f => `${safeText(f.sti, 'Finding')} (${safeText(f.partner, 'Partner')})`).join(' | '));
    const findingsHeight = doc.heightOfString(findingsText, { width: 320, fontSize: 7.5 });
    const bannerH = 34 + findingsHeight;
    insY += 6;
    doc.rect(245, insY, 340, bannerH).fillColor('#2a0a0a').fill();
    doc.rect(245, insY, 4, bannerH).fillColor(LUXURY.red).fill();
    doc.rect(245, insY, 340, bannerH).strokeColor(LUXURY.red).lineWidth(0.8).stroke();
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(LUXURY.red).text('CLINICAL ALERT - REVIEW REQUIRED', 255, insY + 8, { width: 320 });
    doc.fontSize(7.5).font('Helvetica').fillColor('#fca5a5').text(findingsText, 255, insY + 22, { width: 320 });
    doc.fontSize(7).font('Helvetica').fillColor(LUXURY.textDim).text('Consult a specialist before proceeding.', 255, insY + 22 + findingsHeight + 4);
    insY += bannerH + 10;
  }

  doc.fontSize(7).font('Helvetica').fillColor(LUXURY.textDim).text(`REPORT ID: ${safeText(matchData.id, 'N/A')}`, 255, 800, { lineBreak: false });
  doc.rect(0, 836, PAGE_W, 4).fillColor(LUXURY.gold).fill();

  doc.end();
  return doc;
}

module.exports = { generatePDFReportStream };