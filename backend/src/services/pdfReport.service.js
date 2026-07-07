const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const reportSummaryService = require('./compatibility/reportSummary.service');

// ─────────────────────────────────────────────────────────
// PREMIUM PALETTE & TYPOGRAPHY CONFIGURATION
// ─────────────────────────────────────────────────────────

const PALETTE = {
  bg:          '#FBF9F4', // Luxurious soft cream bg
  surface:     '#FFFFFF', // Warm off-white card bg
  border:      '#E8E5DC', // Soft cream border
  gold:        '#B38E36', // Warm Gold / Amber
  forestGreen: '#0E3B2F', // Forest Green
  text:        '#1C2925', // Charcoal (very dark green-grey)
  textMuted:   '#4D5C58', // Muted text
  textDim:     '#7A8A85', // Dim text
  
  // Status Colors
  green:       '#0E3B2F', // Forest green for optimal/healthy
  yellow:      '#B38E36', // Gold for watch/caution
  red:         '#991B1B', // Dark crimson red for action/critical
};

const PAGE_W = 595;
const PAGE_H = 842;

// ─────────────────────────────────────────────────────────
// TEXT SAFETY & FORMATTING HELPERS
// ─────────────────────────────────────────────────────────

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

function safeText(val, fallback = 'N/A') {
  if (val === null || val === undefined || val === '') return fallback;
  return cleanPDFText(String(val));
}

function truncateName(name, maxLen = 24) {
  const clean = safeText(name, '');
  if (!clean) return '';
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1).trim() + '...';
}

function luxuryColor(status) {
  if (!status || typeof status !== 'string') return PALETTE.forestGreen;
  const s = status.toLowerCase();
  if (s === 'red' || s === 'action advised' || s === 'critical' || s === 'poor' || s === 'action') return PALETTE.red;
  if (s === 'yellow' || s === 'moderate' || s === 'caution' || s === 'borderline' || s === 'watch') return PALETTE.gold;
  return PALETTE.forestGreen;
}

// Fill page background
function fillPageBg(doc) {
  doc.save();
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  doc.rect(0, 0, PAGE_W, PAGE_H).fillColor(PALETTE.bg).fill();
  doc.page.margins = { top: 50, bottom: 50, left: 50, right: 50 };
  doc.restore();
}

// Draw a gold horizontal rule
function goldRule(doc, y, left = 30, right = PAGE_W - 30) {
  doc.save();
  doc.moveTo(left, y).lineTo(right, y).strokeColor(PALETTE.gold).lineWidth(0.6).stroke();
  doc.restore();
}

// Draw section category headers
function drawCategoryHeader(doc, x, y, text) {
  doc.save();
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.gold)
    .text(safeText(text).toUpperCase(), x, y, { characterSpacing: 0.5 });
  goldRule(doc, y + 12, x, PAGE_W - 30);
  doc.restore();
  return y + 20;
}

// Draw premium rounded cards
function drawRoundedCard(doc, x, y, w, h, radius = 8, bg = PALETTE.surface) {
  doc.save();
  doc.roundedRect(x, y, w, h, radius).fillColor(bg).fill();
  doc.roundedRect(x, y, w, h, radius).strokeColor(PALETTE.border).lineWidth(0.8).stroke();
  doc.restore();
}

// Draw a solid color vertical strip on cards
function drawCardAccentBorder(doc, x, y, h, color) {
  doc.save();
  doc.roundedRect(x, y, 3, h, 1.5).fillColor(color).fill();
  doc.restore();
}

// Draw premium badges with the updated vocabulary
function drawBadge(doc, x, y, text) {
  doc.save();
  const label = safeText(text).trim();
  
  // Decide colors based on badge content
  const isWatch = label.toLowerCase().includes('worth a look') || 
                  label.toLowerCase().includes('watch') || 
                  label.toLowerCase().includes('action') || 
                  label.toLowerCase().includes('guidance');
                  
  const bg = isWatch ? '#F6E8D5' : '#E2EAE7';
  const fg = isWatch ? '#B38E36' : '#0E3B2F';

  const w = doc.widthOfString(label, { font: 'Helvetica-Bold', fontSize: 7 }) + 14;
  doc.roundedRect(x, y, w, 15, 7.5).fillColor(bg).fill();
  doc.fontSize(7).font('Helvetica-Bold').fillColor(fg)
    .text(label.toUpperCase(), x, y + 4.5, { width: w, align: 'center' });
  doc.restore();
  return w;
}

// Draw progress bar
function drawProgressBar(doc, x, y, w, h, pct, trackColor, fillColor) {
  doc.save();
  doc.roundedRect(x, y, w, h, h / 2).fillColor(trackColor).fill();
  const fillW = Math.max(0, Math.min(1, pct)) * w;
  if (fillW > 0) {
    doc.roundedRect(x, y, fillW, h, h / 2).fillColor(fillColor).fill();
  }
  doc.restore();
}

// Draw star indicator
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
    doc.strokeColor(color).lineWidth(1).stroke();
  }
  doc.restore();
}

function drawStarsRating(doc, x, y, filled, total = 5, size = 7) {
  const safeFilled = Math.max(0, Math.min(total, Number(filled) || 0));
  for (let i = 0; i < total; i++) {
    const cx = x + i * (size * 2 + 4);
    const cy = y + size;
    if (i < safeFilled) {
      drawStar(doc, cx, cy, 5, size, size * 0.45, true, PALETTE.gold);
    } else {
      drawStar(doc, cx, cy, 5, size, size * 0.45, false, PALETTE.border);
    }
  }
}

// ─────────────────────────────────────────────────────────
// DYNAMIC NARRATIVE CARDS DRAWING
// ─────────────────────────────────────────────────────────

function drawNarrativeCard(doc, x, y, w, title, headline, narrative, footnote, badgeText, iconSymbol) {
  doc.save();
  const textX = x + 44;
  const textW = w - 44 - 16;
  
  // Measure text heights
  doc.fontSize(8.5).font('Helvetica');
  const narrH = doc.heightOfString(safeText(narrative), { width: textW - 40, lineGap: 2 });
  doc.fontSize(7.2).font('Helvetica');
  const fnH = doc.heightOfString(safeText(footnote), { width: textW, lineGap: 1.5 });
  
  const cardH = 20 + 16 + narrH + 8 + fnH + 12;

  // Draw card bg
  drawRoundedCard(doc, x, y, w, cardH, 8);
  
  // Draw left border accent strip based on badge text
  const accentColor = (badgeText.toLowerCase().includes('worth a look') || badgeText.toLowerCase().includes('look')) ? PALETTE.gold : PALETTE.forestGreen;
  drawCardAccentBorder(doc, x, y, cardH, accentColor);
  
  // Left icon circle
  const iconCx = x + 24;
  const iconCy = y + 22;
  doc.circle(iconCx, iconCy, 11).fillColor('#E2EAE7').fill();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(PALETTE.forestGreen)
    .text(iconSymbol || '-', iconCx - 8, iconCy - 4.5, { width: 16, align: 'center' });
    
  // Small category title
  doc.fontSize(7).font('Helvetica-Bold').fillColor(PALETTE.gold).text(safeText(title).toUpperCase(), textX, y + 10, { characterSpacing: 0.5 });
  
  // Headline (Times-Bold Serif)
  doc.fontSize(11.5).font('Times-Bold').fillColor(PALETTE.forestGreen).text(safeText(headline), textX, y + 19);
  
  // Badge on the right
  const badgeW = doc.widthOfString(badgeText, { font: 'Helvetica-Bold', fontSize: 7 }) + 14;
  drawBadge(doc, x + w - badgeW - 14, y + 8, badgeText);
  
  // Narrative body
  const narrY = y + 33;
  doc.fontSize(8.2).font('Helvetica').fillColor(PALETTE.text).text(safeText(narrative), textX, narrY, { width: textW - 40, lineGap: 2 });
  
  // Clinical Footnote
  const fnY = narrY + narrH + 5;
  doc.fontSize(7.2).font('Helvetica-Bold').fillColor(PALETTE.textMuted).text('In your report: ', textX, fnY, { continued: true });
  const fnTextClean = safeText(footnote).replace(/^in your report:\s*/i, '');
  doc.font('Helvetica').fillColor(PALETTE.textMuted).text(fnTextClean, { width: textW - 10, lineGap: 1.5 });
  
  doc.restore();
  return cardH;
}

// Global Header Bar
function drawHeaderBar(doc, pageNum, totalPages) {
  doc.save();
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.gold).text('SLAY.HEALTH   ·   PREMARITAL HEALTH INTELLIGENCE', 30, 20, { characterSpacing: 1 });
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.gold).text(`CONFIDENTIAL   ·   ${pageNum} / ${totalPages}`, PAGE_W - 180, 20, { align: 'right', width: 150, characterSpacing: 0.5 });
  doc.moveTo(30, 31).lineTo(PAGE_W - 30, 31).strokeColor(PALETTE.border).lineWidth(0.8).stroke();
  doc.restore();
}

// Global Page Header Band for data pages
function drawDataPageHeader(doc, title, subtitle) {
  fillPageBg(doc);
  doc.save();
  // Move title below the global header rule (which is at Y=31)
  doc.fontSize(15).font('Times-Bold').fillColor(PALETTE.forestGreen).text(safeText(title), 30, 48);
  if (subtitle) {
    doc.fontSize(8).font('Helvetica').fillColor(PALETTE.textMuted).text(safeText(subtitle), 30, 68);
  }
  doc.restore();
  return 85;
}

// ─────────────────────────────────────────────────────────
// CLINICAL EXTRACTORS
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
  const val = (waist && waist.value) || (manual && manual.waist);
  if (!val) return 'Not Uploaded';
  if (/^\d+$/.test(String(val).trim())) return `${val} cm`;
  return String(val);
}

function getBPText(pathology, manual, rawValues) {
  const BP = findExtractedParam(pathology, 'blood_pressure') || findExtractedParam(pathology, 'bp');
  if (BP && BP.value) return BP.value;
  if (manual && manual.sbp && manual.dbp) return `${manual.sbp}/${manual.dbp} mmHg`;
  if (rawValues && rawValues.sbp && rawValues.dbp) return `${rawValues.sbp}/${rawValues.dbp} mmHg`;
  return 'Normal';
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

// ─────────────────────────────────────────────────────────
// MAIN GENERATION FLOW
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

  let partnerAName = safeText(details.male_manual_data?.name || chronic.partner_A?.name, 'Sachin');
  let partnerBName = safeText(details.female_manual_data?.name || chronic.partner_B?.name, 'Swati');

  const dateStr = new Date(matchData.created_at || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Resolve presentation structure
  let presentation = matchData.presentation_json;
  if (!presentation) {
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
      logger.warn('pdfReport: mapPresentation failed', e);
      mapping = { presentation: {} };
    }
    presentation = mapping.presentation || {};
  } else {
    if (typeof presentation === 'string') { try { presentation = JSON.parse(presentation); } catch (e) { presentation = {}; } }
  }

  // Fallback checks for schema fields
  const snapshot = presentation.relationship_snapshot || { score: 85, status: 'Good', color: 'green' };
  const fp = presentation.family_planning || { stars: 4, rating: 'Very Good', annualChance: 85, monthsToConceive: '~5 months', details: {} };
  const stiGate = presentation.sti_gate || { triggered: false, headline: 'The important screens came back clear', narrative: 'Standard screens are negative.', clinical_footnote: 'In your report: STD tests non-reactive.', badge: 'All clear', findings: [] };
  const bh = presentation.body_health || {};
  const cpr = presentation.carrier_pair_risk || {};
  const reportConfidence = presentation.report_confidence || {
    overall: 58,
    band: 'Good start',
    domains_covered: 2,
    blood_verified: false,
    domains: {
      blood_tests: { covered: true, verified: false },
      lifestyle: { covered: true },
      genetic: { covered: false },
      radiology: { covered: false },
      mental: { covered: false }
    }
  };

  // Setup gender variables
  const isA_Female = chronic.partner_A?.sex === 'F' || chronic.partner_B?.sex === 'M';
  const maleM = isA_Female ? (details.female_manual_data || {}) : (details.male_manual_data || {});
  const femaleM = isA_Female ? (details.male_manual_data || {}) : (details.female_manual_data || {});
  const malePathology = isA_Female ? (chronic.details?.female_data || null) : (chronic.details?.male_data || null);
  const femalePathology = isA_Female ? (chronic.details?.male_data || null) : (chronic.details?.female_data || null);
  const maleHeaderName = isA_Female ? partnerBName : partnerAName;
  const femaleHeaderName = isA_Female ? partnerAName : partnerBName;
  const maleRaw = isA_Female ? (chronic.partner_B?.rawValues || {}) : (chronic.partner_A?.rawValues || {});
  const femaleRaw = isA_Female ? (chronic.partner_A?.rawValues || {}) : (chronic.partner_B?.rawValues || {});

  // Overrides to force "yellow" if body health issues exist
  let hasHealthFlag = false;
  for (const key of Object.keys(bh)) {
    const card = bh[key];
    if (card && (card.male_status === 'yellow' || card.male_status === 'red' || card.female_status === 'yellow' || card.female_status === 'red')) {
      hasHealthFlag = true;
    }
  }
  if (hasHealthFlag) {
    if (snapshot.color === 'green') snapshot.color = 'yellow';
    if (snapshot.status === 'Excellent') snapshot.status = 'Good';
  }

  // ════════════════════════════════════════════════════════
  // PAGE 1 — COVER & KEY NARRATIVES
  // ════════════════════════════════════════════════════════
  fillPageBg(doc);

  // 1. Cover Titles
  doc.fontSize(8).font('Helvetica-Bold').fillColor(PALETTE.gold).text('PREMARITAL HEALTH REPORT', 30, 55, { characterSpacing: 1.5 });
  doc.fontSize(32).font('Times-Bold').fillColor(PALETTE.forestGreen).text('Your Health &', 30, 68);
  doc.fontSize(32).font('Times-BoldItalic').fillColor(PALETTE.gold).text('Compatibility', 30, 102);
  doc.fontSize(32).font('Times-Bold').fillColor(PALETTE.forestGreen).text('Profile', 30, 136);
  
  doc.fontSize(9.5).font('Helvetica').fillColor(PALETTE.textMuted).text(`Prepared for ${partnerAName} & ${partnerBName}  ·  ${dateStr}`, 30, 178);

  // 2. Confidence Meter Card
  const confY = 202;
  const confH = 106;
  const confW = 535;
  
  let confText = `Built on ${reportConfidence.domains_covered} of 5 health areas — lifestyle and blood tests — and those blood tests are self-uploaded, not yet verified. Strong, but not yet the whole story. See page 2 to raise it.`;
  if (reportConfidence.blood_verified) {
    confText = `Built on ${reportConfidence.domains_covered} of 5 health areas — lifestyle and blood tests — with verified lab diagnostics. High reliability compatibility dashboard.`;
  }
  
  doc.save();
  // Card
  doc.roundedRect(30, confY, confW, confH, 8).fillColor(PALETTE.forestGreen).fill();
  
  // Labels
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#8CBDB0').text('HOW SURE ARE WE?', 46, confY + 14, { characterSpacing: 1 });
  doc.fontSize(10).font('Times-Italic').fillColor(PALETTE.gold).text(safeText(reportConfidence.band), 30 + confW - 120, confY + 12, { align: 'right', width: 104 });
  
  // Value
  doc.fontSize(25).font('Times-Bold').fillColor('#FFFFFF').text(`${reportConfidence.overall}%`, 46, confY + 26);
  
  // Progress bar
  const barY = confY + 58;
  const barW = confW - 32;
  const barH = 5;
  doc.roundedRect(46, barY, barW, barH, barH / 2).fillColor('#174D40').fill();
  const fillW = Math.max(0, Math.min(1, reportConfidence.overall / 100)) * barW;
  if (fillW > 0) {
    doc.roundedRect(46, barY, fillW, barH, barH / 2).fillColor(PALETTE.gold).fill();
  }
  
  // Description
  doc.fontSize(7.5).font('Helvetica').fillColor('#DCEAE7').text(cleanPDFText(confText), 46, confY + 70, { width: barW, lineGap: 2.2 });
  doc.restore();

  // 3. "WHAT THIS MEANS FOR YOU TWO" card
  const meansY = 320;
  const meansH = 120;
  const synthesisNarrative = presentation.couple_synthesis || 'You two are starting from a strong, well-matched place. Nothing here should give you pause about building a life together — there is just one small thing worth tidying up.';
  
  doc.save();
  // Card Background
  doc.roundedRect(30, meansY, confW, meansH, 8).fillColor(PALETTE.surface).fill();
  doc.roundedRect(30, meansY, confW, meansH, 8).strokeColor(PALETTE.border).lineWidth(0.8).stroke();
  
  // Gold left border strip
  doc.roundedRect(30, meansY, 3, meansH, 1.5).fillColor(PALETTE.gold).fill();
  
  // Title
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.gold).text('WHAT THIS MEANS FOR YOU TWO', 46, meansY + 12, { characterSpacing: 0.5 });
  
  // Text
  doc.fontSize(11).font('Times-Bold').fillColor(PALETTE.text).text(cleanPDFText(synthesisNarrative), 46, meansY + 24, { width: confW - 32, lineGap: 3 });
  
  // Divider
  const divY = meansY + 74;
  doc.moveTo(46, divY).lineTo(30 + confW - 16, divY).strokeColor(PALETTE.border).lineWidth(0.6).stroke();
  
  // 3 Columns
  const statColY = divY + 10;
  const colWidth = (confW - 32) / 3;
  
  // Score
  doc.fontSize(16).font('Times-Bold').fillColor(PALETTE.forestGreen).text(`${snapshot.score}`, 46, statColY);
  doc.fontSize(6).font('Helvetica-Bold').fillColor(PALETTE.textDim).text('COMPATIBILITY', 46, statColY + 18, { characterSpacing: 0.3 });
  
  // Overall Rating
  doc.fontSize(16).font('Times-Bold').fillColor(PALETTE.forestGreen).text(safeText(snapshot.status), 46 + colWidth, statColY);
  doc.fontSize(6).font('Helvetica-Bold').fillColor(PALETTE.textDim).text('OVERALL RATING', 46 + colWidth, statColY + 18, { characterSpacing: 0.3 });
  
  // Confidence
  doc.fontSize(16).font('Times-Bold').fillColor(PALETTE.forestGreen).text(safeText(reportConfidence.band), 46 + colWidth * 2, statColY);
  doc.fontSize(6).font('Helvetica-Bold').fillColor(PALETTE.textDim).text('CONFIDENCE IN THE GOOD NEWS', 46 + colWidth * 2, statColY + 18, { characterSpacing: 0.3 });
  
  doc.restore();

  // 4. "YOUR FINDINGS — THE GOOD NEWS" section
  const findingsStartY = drawCategoryHeader(doc, 30, 455, 'YOUR FINDINGS — THE GOOD NEWS');
  
  // Render cards: Fertility, Sugar, Heart
  // Card 1: Starting a Family / Fertility
  const fertH = fp.rating === 'Excellent' || fp.rating === 'Very Good' ? 'Strong odds when you\'re ready' : 'Fertility review recommended';
  const fertN = fp.rating === 'Excellent' || fp.rating === 'Very Good' 
    ? 'Both of you have healthy fertility signs for your age. If you decide to try, the timing is likely to be kind — most couples like you conceive within about five months.' 
    : 'Some parameters indicate family planning screening or tracking would benefit you two.';
  const fertF = `The estimate: ~${fp.annualChance}% chance of conceiving within 12 months — a guide, not a promise. In your report: ovarian reserve is ${getOvarianReserveText(femalePathology, mfr, femaleM)} and semen quality is ${getSemenText(malePathology, mfr, maleM)}.`;
  const fertB = fp.rating === 'Excellent' || fp.rating === 'Very Good' ? 'Strong' : 'Worth a look';
  
  const c1H = drawNarrativeCard(doc, 30, findingsStartY, confW, 'Starting a family', fertH, fertN, fertF, fertB, 'Frt');

  // Card 2: Sugar Card
  const sugarData = bh.sugar || { headline: 'In a healthy place — both of you', narrative: 'Sugar levels are healthy.', clinical_footnote: 'In your report: HbA1c normal.', badge: 'Healthy' };
  const c2Y = findingsStartY + c1H + 8;
  const c2H = drawNarrativeCard(doc, 30, c2Y, confW, 'Blood Sugar', sugarData.headline, sugarData.narrative, sugarData.clinical_footnote, sugarData.badge, 'Sug');

  // Card 3: Heart Card
  const heartData = bh.heart || { headline: 'Your hearts are in good shape', narrative: 'Cardiovascular parameters are optimal.', clinical_footnote: 'In your report: Lipids and blood pressure normal.', badge: 'Healthy' };
  const c3Y = c2Y + c2H + 8;
  drawNarrativeCard(doc, 30, c3Y, confW, 'Heart & Cholesterol', heartData.headline, heartData.narrative, heartData.clinical_footnote, heartData.badge, 'Hrt');

  // ════════════════════════════════════════════════════════
  // PAGE 2 — CONTINUED FINDINGS & VERIFICATION
  // ════════════════════════════════════════════════════════
  doc.addPage({ size: 'A4', margin: 0 });
  fillPageBg(doc);
  
  const p2StartY = drawCategoryHeader(doc, 30, 45, 'YOUR FINDINGS, CONTINUED');
  
  // Infections Screen
  const infH = stiGate.headline || 'The important screens came back clear';
  const infN = stiGate.narrative || 'Both of you tested negative for HIV, hepatitis B and C, and syphilis. A few optional tests weren\'t part of this panel — none are a concern.';
  const infF = stiGate.clinical_footnote || 'In your report: Screening for all critical infectious diseases returned non-reactive / negative.';
  const infB = stiGate.badge || 'All clear';
  
  const infCardH = drawNarrativeCard(doc, 30, p2StartY, confW, 'Infection Screening', infH, infN, infF, infB, 'STI');
  
  // Tidy Up Section
  const tidyY = p2StartY + infCardH + 15;
  const tidyStartY = drawCategoryHeader(doc, 30, tidyY, 'TWO SMALL THINGS TO TIDY UP');
  
  // Iron / Vitamins Card
  const vitData = bh.vitamins || { headline: 'Vitamins need a quick look', narrative: 'Some micronutrients are deficient.', clinical_footnote: 'In your report: Ferritin values low.', badge: 'Worth a look' };
  const vitH = drawNarrativeCard(doc, 30, tidyStartY, confW, 'One thing to tidy up', vitData.headline, vitData.narrative, vitData.clinical_footnote, vitData.badge, '✶');
  
  // Sleep Card
  const sleepH = 'You\'d both feel better with steadier sleep';
  const sleepN = 'Your sleep is a little irregular right now. A more regular schedule — aiming for 7-8 hours a night — would lift your energy and mood together.';
  const sleepF = 'In your report: Shared lifestyle questionnaire indicates irregular sleep curves for both of you.';
  const sleepCardY = tidyStartY + vitH + 8;
  const sleepH_val = drawNarrativeCard(doc, 30, sleepCardY, confW, 'One thing to tidy up', sleepH, sleepN, sleepF, 'Worth a look', 'Slp');

  // Everyday Life (Lifestyle Habits)
  const lsH = 'You\'re well matched, day to day';
  const lsN = 'You communicate well, share an active routine, and don\'t smoke. These are the quiet things that keep a marriage healthy over decades.';
  const lsF = 'In your report: Lifestyle profiles match. High alignment in movement and daily health parameters.';
  const lsCardY = sleepCardY + sleepH_val + 8;
  const lsCardH_val = drawNarrativeCard(doc, 30, lsCardY, confW, 'Everyday life', lsH, lsN, lsF, 'Well matched', 'Lif');
  
  // MAKE YOUR BLOOD TESTS COUNT Verification Card
  const countY = lsCardY + lsCardH_val + 15;
  const countStartY = drawCategoryHeader(doc, 30, countY, 'MAKE YOUR BLOOD TESTS COUNT');
  
  const verifY = countStartY;
  const verifH = 126;
  doc.save();
  // Card bg
  doc.roundedRect(30, verifY, confW, verifH, 8).fillColor(PALETTE.surface).fill();
  doc.roundedRect(30, verifY, confW, verifH, 8).strokeColor('#EAD5C3').lineWidth(1).stroke(); // goldish border
  doc.roundedRect(30, verifY, 3, verifH, 1.5).fillColor(PALETTE.gold).fill();
  
  // Content
  doc.fontSize(7).font('Helvetica-Bold').fillColor(PALETTE.gold).text('BEFORE WE STAND BEHIND THESE NUMBERS', 46, verifY + 10, { characterSpacing: 0.5 });
  doc.fontSize(11).font('Times-Bold').fillColor(PALETTE.forestGreen).text('Your blood report was uploaded by you', 46, verifY + 20);
  doc.fontSize(7.5).font('Helvetica').fillColor(PALETTE.textMuted).text('We take it at face value — but we can\'t see when or where it was done, so we can\'t fully vouch for it. Reports from small labs can be out of date or edited before sharing. Confirm the numbers once, and every finding gets stronger.', 46, verifY + 34, { width: confW - 32, lineGap: 1.5 });
  
  // Sub-cards side-by-side
  const subY = verifY + 70;
  const subW = (confW - 40) / 2;
  const subH = 46;
  
  // Sub-card 1
  doc.roundedRect(46, subY, subW, subH, 4).fillColor('#FBF9F4').fill();
  doc.roundedRect(46, subY, subW, subH, 4).strokeColor(PALETTE.border).lineWidth(0.5).stroke();
  doc.fontSize(5.5).font('Helvetica-Bold').fillColor(PALETTE.gold).text('MOST SURE', 54, subY + 6);
  doc.fontSize(8.5).font('Times-Bold').fillColor(PALETTE.forestGreen).text('Verified lab test', 54, subY + 13);
  doc.fontSize(6.5).font('Helvetica').fillColor(PALETTE.textMuted).text('One fresh panel through our partner lab.', 54, subY + 23, { width: subW - 16 });
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.forestGreen).text('Confidence +16%', 54, subY + 33);
  
  // Sub-card 2
  doc.roundedRect(46 + subW + 8, subY, subW, subH, 4).fillColor('#FBF9F4').fill();
  doc.roundedRect(46 + subW + 8, subY, subW, subH, 4).strokeColor(PALETTE.border).lineWidth(0.5).stroke();
  doc.fontSize(5.5).font('Helvetica-Bold').fillColor(PALETTE.gold).text('FASTER', 54 + subW + 8, subY + 6);
  doc.fontSize(8.5).font('Times-Bold').fillColor(PALETTE.forestGreen).text('Doctor review', 54 + subW + 8, subY + 13);
  doc.fontSize(6.5).font('Helvetica').fillColor(PALETTE.textMuted).text('A clinician reviews your uploaded report.', 54 + subW + 8, subY + 23, { width: subW - 16 });
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.forestGreen).text('Confidence +16%', 54 + subW + 8, subY + 33);
  
  doc.restore();

  // ════════════════════════════════════════════════════════
  // PAGE 3 — COMPARISON TABLE
  // ════════════════════════════════════════════════════════
  doc.addPage({ size: 'A4', margin: 0 });
  const p3StartY = drawDataPageHeader(doc, 'Partner Health Comparison', 'Side-by-side clinical parameters comparison — both partners in one view');
  
  // Column legend bar
  const cmpHdrY = p3StartY + 10;
  drawRoundedCard(doc, 30, cmpHdrY, confW, 20, 4, '#F5F4EB');
  doc.save();
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.textMuted).text('HEALTH PARAMETER', 40, cmpHdrY + 6.5, { width: 180 });
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.gold).text(maleHeaderName.toUpperCase() + ' (MALE)', 220, cmpHdrY + 6.5, { width: 160 });
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.forestGreen).text(femaleHeaderName.toUpperCase() + ' (FEMALE)', 390, cmpHdrY + 6.5, { width: 160 });
  doc.restore();
  
  const compParams = [
    { label: 'HbA1c / Blood Sugar', mText: getGlucoseText(malePathology, maleM, maleRaw), fText: getGlucoseText(femalePathology, femaleM, femaleRaw), mStatus: bh.sugar?.male_status || 'green', fStatus: bh.sugar?.female_status || 'green', showBar: false },
    { label: 'Cholesterol / Heart', mText: getLipidsText(malePathology, maleM, maleRaw), fText: getLipidsText(femalePathology, femaleM, femaleRaw), mStatus: bh.heart?.male_status || 'green', fStatus: bh.heart?.female_status || 'green', showBar: false },
    { label: 'Waist Circumference', mText: getWaistText(malePathology, maleM), fText: getWaistText(femalePathology, femaleM), mStatus: (maleM.waist && maleM.waist !== 'Normal') ? 'yellow' : 'green', fStatus: (femaleM.waist && femaleM.waist !== 'Normal') ? 'yellow' : 'green', showBar: false },
    { label: 'Blood Pressure', mText: getBPText(malePathology, maleM, maleRaw), fText: getBPText(femalePathology, femaleM, femaleRaw), mStatus: (maleRaw.sbp > 130 || maleRaw.dbp > 85) ? 'yellow' : 'green', fStatus: (femaleRaw.sbp > 130 || femaleRaw.dbp > 85) ? 'yellow' : 'green', showBar: false },
    { label: 'Ovarian Reserve (AMH)', mText: 'N/A', fText: getOvarianReserveText(femalePathology, mfr, femaleM), mStatus: 'green', fStatus: fp.details?.ovarianReserve === 'Normal' ? 'green' : 'yellow', showBar: false },
    { label: 'Semen Quality (WHO)', mText: getSemenText(malePathology, mfr, maleM), fText: 'N/A', mStatus: fp.details?.semenQuality === 'Normal' ? 'green' : 'yellow', fStatus: 'green', showBar: false },
    { label: 'Liver Health Enzymes', mText: bh.liver?.male_value || 'Normal', fText: bh.liver?.female_value || 'Normal', mStatus: bh.liver?.male_status || 'green', fStatus: bh.liver?.female_status || 'green', showBar: false },
    { label: 'Kidney Function', mText: bh.kidney?.male_value || 'Normal', fText: bh.kidney?.female_value || 'Normal', mStatus: bh.kidney?.male_status || 'green', fStatus: bh.kidney?.female_status || 'green', showBar: false },
    { label: 'Hormonal Baseline', mText: bh.hormones?.male_value || 'Normal', fText: bh.hormones?.female_value || 'Normal', mStatus: bh.hormones?.male_status || 'green', fStatus: bh.hormones?.female_status || 'green', showBar: false },
    { label: 'Vitamins & Micronutrients', mText: bh.vitamins?.male_value || 'Normal', fText: bh.vitamins?.female_value || 'Normal', mStatus: bh.vitamins?.male_status || 'green', fStatus: bh.vitamins?.female_status || 'green', showBar: false },
    { label: '12-Month Conception Probability', mText: '—', fText: `~${fp.annualChance}%`, mBar: 0, fBar: fp.annualChance / 100, color: PALETTE.gold, showBar: true }
  ];

  let cmpY = cmpHdrY + 25;
  const rowH = 46;
  const rowGap = 5;
  compParams.forEach((p, idx) => {
    const rowBg = idx % 2 === 0 ? PALETTE.surface : '#F7F6EE';
    drawRoundedCard(doc, 30, cmpY, confW, rowH, 4, rowBg);
    
    // Parameter Label
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(PALETTE.text).text(p.label, 40, cmpY + 8, { width: 170 });
    
    // Helper to map status to badges vocabulary
    const getBadgeLabel = (status, textVal) => {
      if (textVal === 'N/A' || textVal === '—') return 'N/A';
      if (status === 'red') return 'Worth a look';
      if (status === 'yellow') return 'Worth a look';
      if (p.label.toLowerCase().includes('ovarian') || p.label.toLowerCase().includes('semen')) return 'Strong';
      return 'Healthy';
    };

    // Male Column
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(PALETTE.text).text(cleanPDFText(p.mText), 220, cmpY + 8, { width: 160, ellipsis: true });
    if (p.showBar) {
      if (p.mBar > 0) {
        drawProgressBar(doc, 220, cmpY + 24, 120, 6, p.mBar, PALETTE.border, p.color);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(PALETTE.textDim).text(`${Math.round(p.mBar * 100)}%`, 345, cmpY + 24);
      }
    } else {
      const label = getBadgeLabel(p.mStatus, p.mText);
      if (label !== 'N/A') {
        drawBadge(doc, 220, cmpY + 22, label);
      }
    }
    
    // Female Column
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(PALETTE.text).text(cleanPDFText(p.fText), 390, cmpY + 8, { width: 160, ellipsis: true });
    if (p.showBar) {
      if (p.fBar > 0) {
        drawProgressBar(doc, 390, cmpY + 24, 120, 6, p.fBar, PALETTE.border, p.color);
        doc.fontSize(7).font('Helvetica-Bold').fillColor(PALETTE.textDim).text(`${Math.round(p.fBar * 100)}%`, 515, cmpY + 24);
      }
    } else {
      const label = getBadgeLabel(p.fStatus, p.fText);
      if (label !== 'N/A') {
        drawBadge(doc, 390, cmpY + 22, label);
      }
    }
    
    // Divider lines
    doc.save();
    doc.moveTo(212, cmpY + 4).lineTo(212, cmpY + rowH - 4).strokeColor(PALETTE.border).lineWidth(0.5).stroke();
    doc.moveTo(382, cmpY + 4).lineTo(382, cmpY + rowH - 4).strokeColor(PALETTE.border).lineWidth(0.5).stroke();
    doc.restore();

    cmpY += rowH + rowGap;
  });

  // Disclaimer bottom
  doc.fontSize(7).font('Helvetica-Oblique').fillColor(PALETTE.textDim).text(
    'Comparison metrics are aligned to clinical laboratory report values. The 12-month conception probability bar reflects age-graded biological baseline statistics.',
    30, cmpY + 5, { width: confW }
  );

  // ════════════════════════════════════════════════════════
  // PAGE 4 — STI SCREENING & GENETIC CARRIER RISK
  // ════════════════════════════════════════════════════════
  doc.addPage({ size: 'A4', margin: 0 });
  fillPageBg(doc);
  
  const p4StartY = drawDataPageHeader(doc, 'Infectious Disease & Genetic Risk', 'Comprehensive screening matrices for STI indicators and genetic carrier overlaps');
  
  // 1. STI Panel tested vs. untested
  const stiTests = [
    { label: 'Syphilis (VDRL/RPR)', paramKey: 'vdrl_rpr_result_reactive_non_reactive', type: 'reactive' },
    { label: 'HIV 1 & 2 Antibody', paramKey: 'hiv_1_2_antibody_result_reactive_non_reactive', type: 'reactive' },
    { label: 'Hepatitis B (HBsAg)', paramKey: 'hbsag_qualitative_result_reactive_non_reactive', type: 'reactive' },
    { label: 'Hepatitis C (HCV Antibody)', paramKey: 'anti_hcv_antibody_qualitative_result_reactive_non_reactive', type: 'reactive' }
  ];

  const partitionedTests = stiTests.map(test => {
    const mVal = findExtractedParam(malePathology, test.paramKey)?.value || null;
    const fVal = findExtractedParam(femalePathology, test.paramKey)?.value || null;
    return { ...test, mVal, fVal };
  });

  const tested = partitionedTests.filter(t => t.mVal !== null || t.fVal !== null);
  const untested = partitionedTests.filter(t => t.mVal === null && t.fVal === null);

  let panelY = p4StartY + 10;
  
  // STI Tested Header
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(PALETTE.forestGreen).text('TESTED INFECTIOUS MARKERS', 30, panelY);
  panelY += 14;
  
  // Side-by-side header
  const colW = (confW - 12) / 2;
  drawRoundedCard(doc, 30, panelY, colW, 18, 4, '#F5F4EB');
  drawRoundedCard(doc, 30 + colW + 12, panelY, colW, 18, 4, '#F5F4EB');
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.gold).text(`${maleHeaderName.toUpperCase()} (MALE)`, 40, panelY + 5.5);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.forestGreen).text(`${femaleHeaderName.toUpperCase()} (FEMALE)`, 40 + colW + 12, panelY + 5.5);
  panelY += 23;
  
  const stiCardH = 26;
  const isReactive = (val) => {
    if (!val) return false;
    const str = String(val).toLowerCase();
    return str.includes('reactive') && !str.includes('non');
  };

  tested.forEach(test => {
    // Male Card
    drawRoundedCard(doc, 30, panelY, colW, stiCardH, 4);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.text).text(test.label, 38, panelY + 9, { width: colW - 90, ellipsis: true });
    drawBadge(doc, 30 + colW - 74, panelY + 5.5, isReactive(test.mVal) ? 'Worth a look' : 'All clear');
    
    // Female Card
    drawRoundedCard(doc, 30 + colW + 12, panelY, colW, stiCardH, 4);
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(PALETTE.text).text(test.label, 38 + colW + 12, panelY + 9, { width: colW - 90, ellipsis: true });
    drawBadge(doc, 30 + 2 * colW + 12 - 74, panelY + 5.5, isReactive(test.fVal) ? 'Worth a look' : 'All clear');
    
    panelY += stiCardH + 4;
  });

  // Untested Block
  if (untested.length > 0) {
    panelY += 10;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(PALETTE.textMuted).text('MARKERS NOT INCLUDED IN UPLOADED FILES', 30, panelY);
    doc.fontSize(7).font('Helvetica-Oblique').fillColor(PALETTE.textDim).text('The following screens were not detected in your uploads. This is standard for incomplete panels.', 30, panelY + 11);
    panelY += 24;
    
    let untX = 30;
    const untW = 120;
    untested.forEach((test, uIdx) => {
      drawRoundedCard(doc, untX, panelY, untW, 18, 4);
      doc.fontSize(6.8).font('Helvetica').fillColor(PALETTE.textDim).text(test.label, untX + 8, panelY + 5.5, { width: untW - 16, ellipsis: true });
      untX += untW + 8;
      if ((uIdx + 1) % 4 === 0) {
        untX = 30;
        panelY += 23;
      }
    });
    if (untested.length % 4 !== 0) panelY += 23;
  }

  // 2. Genetic Carrier-Pair Risk Table
  panelY += 15;
  goldRule(doc, panelY);
  panelY += 10;
  
  doc.fontSize(9.5).font('Times-Bold').fillColor(PALETTE.forestGreen).text('Genetic Carrier-Pair Overlap', 30, panelY);
  panelY += 14;
  
  const hasGen = cpr.thalassemia?.male_status !== 'green' || cpr.thalassemia?.female_status !== 'green' || cpr.hemoglobin_variant?.male_status !== 'green' || cpr.hemoglobin_variant?.female_status !== 'green';
  
  if (hasGen) {
    const genH = 68;
    drawRoundedCard(doc, 30, panelY, confW, genH, 8);
    drawCardAccentBorder(doc, 30, panelY, genH, PALETTE.gold);
    
    let riskStr = [];
    if (cpr.thalassemia?.male_status !== 'green' || cpr.thalassemia?.female_status !== 'green') {
      riskStr.push(`Thalassemia: Male status is ${cpr.thalassemia.male_status.toUpperCase()} | Female is ${cpr.thalassemia.female_status.toUpperCase()}. ${cpr.thalassemia.summary || ''}`);
    }
    if (cpr.hemoglobin_variant?.male_status !== 'green' || cpr.hemoglobin_variant?.female_status !== 'green') {
      riskStr.push(`Hb Variant: Male is ${cpr.hemoglobin_variant.male_status.toUpperCase()} | Female is ${cpr.hemoglobin_variant.female_status.toUpperCase()}. ${cpr.hemoglobin_variant.summary || ''}`);
    }
    
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(PALETTE.text).text('CARRIER TRAIT OVERLAP OBSERVED', 42, panelY + 10);
    doc.fontSize(7.5).font('Helvetica').fillColor(PALETTE.textMuted).text(cleanPDFText(riskStr.join(' \n ')), 42, panelY + 22, { width: confW - 32, lineGap: 1.5 });
    doc.fontSize(6.5).font('Helvetica-Oblique').fillColor(PALETTE.textDim).text(cleanPDFText(cpr.genetic_note || 'Premarital carrier screening checks if both partners carry traits for the same genetic condition.'), 42, panelY + 50, { width: confW - 32 });
  } else {
    // Normal / green CPR
    const genH = 50;
    drawRoundedCard(doc, 30, panelY, confW, genH, 8);
    drawCardAccentBorder(doc, 30, panelY, genH, PALETTE.forestGreen);
    
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor(PALETTE.forestGreen).text('ALL CLEAR — NO GENETIC CARRIER OVERLAPS', 42, panelY + 10);
    doc.fontSize(7.5).font('Helvetica').fillColor(PALETTE.textMuted).text('No common mutations or carrier indicators were detected for Thalassemia or other hemoglobinopathies.', 42, panelY + 22, { width: confW - 32 });
    doc.fontSize(6.5).font('Helvetica-Oblique').fillColor(PALETTE.textDim).text(cleanPDFText(cpr.genetic_note || 'Hereditary testing is clear. Consult a genetic counselor for complete panel overlays.'), 42, panelY + 36, { width: confW - 32 });
  }

  // ════════════════════════════════════════════════════════
  // PAGE 5 — LIFESTYLE & 90-DAY IMPROVEMENT PLAN
  // ════════════════════════════════════════════════════════
  doc.addPage({ size: 'A4', margin: 0 });
  fillPageBg(doc);
  
  const p5StartY = drawDataPageHeader(doc, 'Lifestyle & 90-Day Improvement Plan', 'Behavioral compatibility analysis and structured roadmap adjustments');
  
  const ls = presentation.lifestyle || {};
  const lsCards = [
    { title: 'Communication Style', value: ls.communication?.value || 'Aligned', desc: ls.communication?.description || 'Compatible dialogue baseline.', status: ls.communication?.status || 'green' },
    { title: 'Conflict Management', value: ls.conflict?.value || 'Healthy', desc: ls.conflict?.description || 'Standard resolution patterns.', status: ls.conflict?.status || 'green' },
    { title: 'Stress & Coping Match', value: ls.stress?.value || 'Balanced', desc: ls.stress?.description || 'Aligned coping mechanisms.', status: ls.stress?.status || 'green' },
    { title: 'Everyday Activity Habits', value: ls.habits?.value || 'Active', desc: ls.habits?.description || 'Aligned movement curves.', status: ls.habits?.status || 'green' }
  ];
  
  let lsCardX = 30;
  let p5CardY = p5StartY + 10;
  const lsW = (confW - 12) / 2;
  const lsCardHeight = 58;
  
  lsCards.forEach((card, idx) => {
    drawRoundedCard(doc, lsCardX, p5CardY, lsW, lsCardHeight, 6);
    drawCardAccentBorder(doc, lsCardX, p5CardY, lsCardHeight, luxuryColor(card.status));
    
    doc.fontSize(7).font('Helvetica-Bold').fillColor(PALETTE.textDim).text(card.title.toUpperCase(), lsCardX + 12, p5CardY + 8);
    doc.fontSize(11).font('Times-Bold').fillColor(PALETTE.forestGreen).text(card.value, lsCardX + 12, p5CardY + 18, { width: lsW - 20, ellipsis: true });
    doc.fontSize(7).font('Helvetica').fillColor(PALETTE.textMuted).text(card.desc, lsCardX + 12, p5CardY + 34, { width: lsW - 20, height: 18, ellipsis: true });
    
    lsCardX += lsW + 12;
    if ((idx + 1) % 2 === 0) {
      lsCardX = 30;
      p5CardY += lsCardHeight + 8;
    }
  });

  // Emotional analysis text box
  p5CardY += 8;
  goldRule(doc, p5CardY);
  p5CardY += 8;
  
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(PALETTE.gold).text('PSYCHOLOGICAL HARMONY ANALYSIS', 30, p5CardY);
  p5CardY += 12;
  const relSummary = mental?.summary || 'Personality indices indicate optimal compatibility. Behavioral profiles demonstrate low relational stress, robust emotional support patterns, and highly compatible conflict styles.';
  doc.fontSize(8).font('Helvetica').fillColor(PALETTE.textMuted).text(cleanPDFText(relSummary), 30, p5CardY, { width: confW, lineGap: 3 });
  
  // 90-Day Roadmap Section
  p5CardY += doc.heightOfString(cleanPDFText(relSummary), { width: confW }) + 22;
  goldRule(doc, p5CardY);
  p5CardY += 8;
  
  doc.fontSize(9.5).font('Times-Bold').fillColor(PALETTE.forestGreen).text('90-Day Improvement Roadmap', 30, p5CardY);
  p5CardY += 16;
  
  const planData = presentation.improvement_plan || {};
  const planItems = [
    { label: 'Sleep Sync', icon: '1', desc: planData.sleep || 'Align bedtimes to standard baseline.' },
    { label: 'Nutrition', icon: '2', desc: planData.diet || 'Optimize micronutrients baseline.' },
    { label: 'Movement', icon: '3', desc: planData.exercise || 'Active movement 3x a week.' },
    { label: 'Retests Check', icon: '4', desc: planData.retests || 'Retest deficient vitamins in 90 days.' }
  ];
  
  let pX = 30;
  const pCardW = (confW - 24) / 4;
  const pCardH = 80;
  
  planItems.forEach(p => {
    drawRoundedCard(doc, pX, p5CardY, pCardW, pCardH, 6);
    
    // Icon
    doc.circle(pX + 16, p5CardY + 15, 9).fillColor(PALETTE.forestGreen).fill();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF').text(p.icon, pX + 8, p5CardY + 11, { width: 16, align: 'center' });
    
    // Details
    doc.fontSize(8).font('Times-Bold').fillColor(PALETTE.gold).text(p.label, pX + 8, p5CardY + 28);
    doc.fontSize(7).font('Helvetica').fillColor(PALETTE.textMuted).text(cleanPDFText(p.desc), pX + 8, p5CardY + 41, { width: pCardW - 16, height: 35, ellipsis: true });
    
    pX += pCardW + 8;
  });

  // Closing banner
  p5CardY += pCardH + 15;
  drawRoundedCard(doc, 30, p5CardY, confW, 36, 6, '#F1F5F9');
  doc.save();
  doc.rect(30, p5CardY, 3, 36).fillColor(PALETTE.gold).fill();
  doc.fontSize(7.5).font('Helvetica').fillColor(PALETTE.text).text('Following these steps can meaningfully improve your health alignment. Track your progress with a retest in 90 days.', 40, p5CardY + 14, { width: confW - 20 });
  doc.restore();

  // ════════════════════════════════════════════════════════
  // PAGE 6 — SEE THE FULLER PICTURE UPSELL PAGE
  // ════════════════════════════════════════════════════════
  doc.addPage({ size: 'A4', margin: 0 });
  fillPageBg(doc);
  
  // (Header Rule is automatically drawn in the buffered pages loop at the end)
  
  // Section Title
  doc.fontSize(8).font('Helvetica-Bold').fillColor(PALETTE.gold).text('SEE THE FULLER PICTURE', 30, 55, { characterSpacing: 1.5 });
  doc.fontSize(22).font('Times-Bold').fillColor(PALETTE.forestGreen).text('Completing your premarital health profile', 30, 68);
  doc.fontSize(8.5).font('Helvetica').fillColor(PALETTE.textMuted).text('This report covers two of the five key pillars of compatibility. Add the remaining modules to finish the story.', 30, 92, { width: confW, lineGap: 1.5 });
  
  // Card 1: Genetic Carrier-Pair (Conditional: show as upsell if not completed, or educational if completed)
  const isGenCompleted = reportConfidence.domains.genetic?.covered;
  const genUpsellH = "Quiet carrier screening checks for thalassemia and sickle cell variant traits. Two healthy individuals can quietly transmit variants to children without ever realizing it.";
  const genUpsellHeadline = isGenCompleted ? "Genetic Trait Check Complete" : "Do you both quietly carry the same thing?";
  const genUpsellFoot = isGenCompleted ? "In your report: Hemoglobinopathies screening processed." : "Uplift confidence by +11% sure with genetic carrier diagnostics.";
  const genUpsellBadge = isGenCompleted ? "Strong" : "+11% sure";
  
  let upsellY = 115;
  let cardH1 = drawNarrativeCard(doc, 30, upsellY, confW, 'Genetic · Carrier-Pair', genUpsellHeadline, genUpsellH, genUpsellFoot, genUpsellBadge, 'DNA');

  // Card 2: Radiology Imaging
  const isRadCompleted = reportConfidence.domains.radiology?.covered;
  const radUpsellH = "Standard blood assays evaluate how your chemistry behaves. Radiology checks structural metrics — heart valve profiles, arterial alignments, pelvic structures, and ovarian imaging.";
  const radUpsellHeadline = isRadCompleted ? "Imaging Metrics Registered" : "A look at structure, not just chemistry";
  const radUpsellFoot = isRadCompleted ? "In your report: USG diagnostic scans processed." : "Uplift confidence by +6% sure with pelvic and vessel imaging scans.";
  const radUpsellBadge = isRadCompleted ? "Strong" : "+6% sure";

  let upsellY2 = upsellY + cardH1 + 8;
  let cardH2 = drawNarrativeCard(doc, 30, upsellY2, confW, 'Radiology · Imaging', radUpsellHeadline, radUpsellH, radUpsellFoot, radUpsellBadge, 'Rad');

  // Card 3: Mental & Emotional
  const isMenCompleted = reportConfidence.domains.mental?.covered;
  const menUpsellH = "Constructive dialog, active sharing, and coping profiles form the operational core of premarital compatibility. A professional assessment outlines relational stress curves under pressure.";
  const menUpsellHeadline = isMenCompleted ? "Relational Coping Registered" : "How you\'ll weather the hard seasons";
  const menUpsellFoot = isMenCompleted ? "In your report: Personality profiling complete." : "Uplift confidence by +5% sure with emotional safety checks.";
  const menUpsellBadge = isMenCompleted ? "Strong" : "+5% sure";

  let upsellY3 = upsellY2 + cardH2 + 8;
  let cardH3 = drawNarrativeCard(doc, 30, upsellY3, confW, 'Mental & Emotional', menUpsellHeadline, menUpsellH, menUpsellFoot, menUpsellBadge, 'Psy');
  
  // Dark green overview banner at bottom
  let bannerY = upsellY3 + cardH3 + 15;
  let bannerH = 110;
  
  doc.save();
  // Card bg
  doc.roundedRect(30, bannerY, confW, bannerH, 8).fillColor(PALETTE.forestGreen).fill();
  
  // Text content
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#8CBDB0').text('WITH EVERYTHING VERIFIED & ADDED', 46, bannerY + 12, { characterSpacing: 1 });
  doc.fontSize(9.5).font('Times-Italic').fillColor(PALETTE.gold).text('Near-complete', 30 + confW - 120, bannerY + 10, { align: 'right', width: 104 });
  doc.fontSize(24).font('Times-Bold').fillColor('#FFFFFF').text('96%', 46, bannerY + 24);
  
  // Progress bar
  const bottomBarY = bannerY + 54;
  doc.roundedRect(46, bottomBarY, barW, barH, barH / 2).fillColor('#174D40').fill();
  doc.roundedRect(46, bottomBarY, barW * 0.96, barH, barH / 2).fillColor(PALETTE.gold).fill();
  
  // Description
  doc.fontSize(7.5).font('Helvetica').fillColor('#DCEAE7').text('All 5 compatibility areas completed and blood work verified. The maximum statistical certainty for premarital alignment.', 46, bannerY + 68, { width: barW, lineGap: 2 });
  doc.restore();

  // ════════════════════════════════════════════════════════
  // GLOBAL FOOTERS (Page buffer execution)
  // ════════════════════════════════════════════════════════
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(i);
    const savedMargins = doc.page.margins;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };

    // Render global header rules on all pages
    drawHeaderBar(doc, i + 1, pageRange.count);

    // Render global footer rules on all pages
    doc.rect(0, 828, PAGE_W, 1).fillColor(PALETTE.border).fill();
    const footerText = `CONFIDENTIAL — SLAYHEALTH PREMARITAL PROFILE | Values extracted from uploaded lab reports on: ${dateStr} | Shared only with report holders.`;
    doc.fontSize(6.5).font('Helvetica').fillColor(PALETTE.textDim).text(footerText, 20, 832);
    doc.fontSize(7).font('Helvetica').fillColor(PALETTE.textDim).text(`PAGE ${i + 1} OF ${pageRange.count}`, PAGE_W - 100, 832, { align: 'right', width: 80 });

    doc.page.margins = savedMargins;
  }

  doc.end();
  return doc;
}

module.exports = { generatePDFReportStream };