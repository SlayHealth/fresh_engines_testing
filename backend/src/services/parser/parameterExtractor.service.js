const sectionDetector = require('./sectionDetector.service');
const ontologyMapper = require('./ontologyMapper.service');
const logger = require('../../utils/logger');

// WS2-01: no conversion existed anywhere between extraction and scoring, so a value
// reported in a different (but clinically valid) unit than the scoring engines
// assume was consumed as a bare number — e.g. a normal fasting glucose of
// "5.5 mmol/L" (~99 mg/dL) scored as if it read 5.5 mg/dL, a critically-low value.
// Scoped to the four parameter families the deep review explicitly validated
// conversion factors for (glucose, cholesterol-family, creatinine, vitamin D) —
// not a general unit-inference system. Factors: glucose mg/dL = mmol/L x 18.0;
// cholesterol mg/dL = mmol/L x 38.67; creatinine mg/dL = umol/L / 88.4; 25-OH
// vitamin D ng/mL = nmol/L / 2.5.
const SI_UNIT_CONVERSIONS = {
  fasting_blood_glucose_fbg: { fromUnit: 'mmol/l', toUnit: 'mg/dl', convert: (v) => v * 18.0 },
  random_blood_sugar_rbs: { fromUnit: 'mmol/l', toUnit: 'mg/dl', convert: (v) => v * 18.0 },
  average_blood_glucose_abg: { fromUnit: 'mmol/l', toUnit: 'mg/dl', convert: (v) => v * 18.0 },
  estimated_average_glucose_eag: { fromUnit: 'mmol/l', toUnit: 'mg/dl', convert: (v) => v * 18.0 },
  total_cholesterol: { fromUnit: 'mmol/l', toUnit: 'mg/dl', convert: (v) => v * 38.67 },
  low_density_lipoprotein_cholesterol_ldl_c: { fromUnit: 'mmol/l', toUnit: 'mg/dl', convert: (v) => v * 38.67 },
  high_density_lipoprotein_cholesterol_hdl_c: { fromUnit: 'mmol/l', toUnit: 'mg/dl', convert: (v) => v * 38.67 },
  non_hdl_cholesterol: { fromUnit: 'mmol/l', toUnit: 'mg/dl', convert: (v) => v * 38.67 },
  serum_creatinine: { fromUnit: 'umol/l', toUnit: 'mg/dl', convert: (v) => v / 88.4 },
  vitamin_d_3_25_hydroxy: { fromUnit: 'nmol/l', toUnit: 'ng/ml', convert: (v) => v / 2.5 }
};

// Real reports spell the same unit several ways (case, spacing, u vs µ for micro).
function normalizeUnitToken(unit) {
  if (!unit) return null;
  return unit.toLowerCase().replace(/\s+/g, '').replace(/µ/g, 'u');
}

// WS2-02: strips thousands/lakh grouping commas ("1,50,000" / "150,000") and a
// trailing single-letter H(igh)/L(ow) flag or asterisk ("14.2 H", "92*") — both
// ubiquitous on real Indian lab reports. Without this, the real value token fails
// the plain-numeric test, the parameter is left "pending", and the columnar
// heuristic pops the NEXT value-shaped token — almost always the reference range —
// as if it were the result. A ferritin of 1,200 (iron overload) was silently read
// as 20 (the range's near-deficient lower bound): a clinical inversion, not a
// dropped value. Safe to run unconditionally: a token with no comma/flag (a
// qualitative word, a titre, a plain number) passes through byte-identical, since
// none of those end in a bare H/L/* or contain digit-grouping commas.
function stripValueNoise(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/,/g, '').replace(/\s*[HL*]\s*$/i, '').trim();
}

class ParameterExtractorService {
  /**
   * Extracts parameters from raw text pages
   * @param {Array<{page: number, text: string}>} pages 
   * @returns {Object} Structured data grouped by sections
   */
  extract(pages) {
    const extractedData = {};
    let currentSection = null;

    /**
     * Recognizes if a string token is a clinical "value" (not a parameter name or header).
     * Handles:
     *  - Numerics: 14, 5.1, <40, >90, < 40, > 90
     *  - Ranges (double-sided): 0-5, 0.4-4.0
     *  - Titer formats: 1:16, 1 : 8
     *  - Qualitative results: Reactive, Non-Reactive, Detected, Not Detected, Immune, Non-Immune, Absent, Normal, etc.
     *  - Blood groups: A, B, AB, O
     *  - Semen interpretation: Normozoospermia, Oligozoospermia
     */
    const isValueStr = (str) => {
      if (!str) return false;
      // Strip grouping commas / a trailing H/L/* flag before the numeric tests —
      // a no-op for qualitative words, titres, and already-clean numbers (WS2-02).
      const cleaned = stripValueNoise(str);
      // Numeric with optional leading comparator
      if (/^[<>]?\s*\d+(?:\.\d+)?$/.test(cleaned)) return true;
      // Numeric ranges like 0-5 or 0.4-4.0
      if (/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(cleaned)) return true;
      // Blood-pressure-style slash pair: 130.0/80.0, 120/80
      if (/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(cleaned)) return true;
      // Titer formats: 1:16, 1 : 4 — critical for Syphilis RPR titre
      if (/^\d+\s*:\s*\d+$/.test(cleaned)) return true;
      // Qualitative clinical terms. "Non-Reactive"/"Non-Immune" use `[-\s]` (not a
      // literal hyphen) because real rapid-card reports commonly print these as two
      // space-separated words ("NON REACTIVE") rather than hyphenated — the hyphen-only
      // version silently failed to recognize the real result as a value at all, leaving
      // the parameter still "pending" until a stray "Reactive"/"Non Reactive" token
      // later in the page's legend/explanation text got mistaken for the real result.
      if (/^(Clear|Absent|Present|Positive|Negative|Reactive|Non[-\s]Reactive|Detected|Not\s+Detected|Immune|Non[-\s]Immune|Normal|Abnormal|Rare|Pale\s+Yellow|Pale|Not\s+Applicable)$/i.test(str)) return true;
      // Blood groups
      if (/^(A|B|AB|O)$/.test(str)) return true;
      // Semen interpretation categories
      if (/^(Normozoospermia|Oligozoospermia|Azoospermia|Asthenozoospermia|Teratozoospermia)$/i.test(str)) return true;
      return false;
    };

    /**
     * Writes an extracted value into extractedData, with one special case: a
     * "blood_pressure_combined" mapping (from a report that prints BP as a single
     * "130.0/80.0" cell rather than separate systolic/diastolic rows) gets split into
     * the two canonical fields the chronic engine actually reads
     * (systolic_blood_pressure / diastolic_blood_pressure) instead of being stored
     * as one unusable combined string.
     */
    const writeParam = (section, mapping, rawValue, unit, referenceRange, confidence, originalName) => {
      if (!extractedData[section]) extractedData[section] = {};
      if (mapping.canonical_name === 'blood_pressure_combined' && typeof rawValue === 'string' && /^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(rawValue)) {
        const [sysRaw, diaRaw] = rawValue.split('/').map((s) => s.trim());
        const sys = parseFloat(sysRaw);
        const dia = parseFloat(diaRaw);
        if (!isNaN(sys)) {
          extractedData[section].systolic_blood_pressure = { original_name: originalName, value: sys, unit: unit || 'mmHg', reference_range: referenceRange, confidence };
        }
        if (!isNaN(dia)) {
          extractedData[section].diastolic_blood_pressure = { original_name: originalName, value: dia, unit: unit || 'mmHg', reference_range: referenceRange, confidence };
        }
        return;
      }
      // WS2-02: clean grouping commas / a trailing H/L/* flag before the numeric
      // coercion — "1,50,000" and "14.2 H" both fail a bare Number() otherwise and
      // would fall through to being stored as the literal noisy string.
      const cleanedRawValue = stripValueNoise(rawValue);
      let value = isNaN(Number(cleanedRawValue)) ? rawValue : Number(cleanedRawValue);
      let resolvedUnit = unit;

      // WS2-01: convert a known SI-unit variant to the unit the scoring engines
      // assume, so a value like "5.5 mmol/L" glucose is stored as ~99 (mg/dL), not
      // consumed downstream as the bare number 5.5. Only fires for a recognized
      // canonical + a unit that actually matches its known "from" unit — an
      // unrecognized or already-correct unit passes through unchanged.
      const conversion = SI_UNIT_CONVERSIONS[mapping.canonical_name];
      if (conversion && typeof value === 'number' && normalizeUnitToken(unit) === conversion.fromUnit) {
        value = parseFloat(conversion.convert(value).toFixed(2));
        resolvedUnit = conversion.toUnit;
      }

      extractedData[section][mapping.canonical_name] = {
        original_name: originalName,
        value,
        unit: resolvedUnit,
        reference_range: referenceRange,
        confidence
      };
    };

    for (const page of pages) {
      const rawLines = page.text.split('\n');

      // --- Bounded Vertical Line-Join Preprocessor ---
      // Fuses parameter names that are split across adjacent lines (e.g. TSH/VDRL wrapped across two lines).
      //
      // Fusion triggers (any one sufficient):
      //   A) STRUCTURAL: current line ends with '/' OR '(' — clear continuation indicator
      //   B) STRUCTURAL: next line starts with '(' and ends with ')' — bracketed suffix
      //   C) ONTOLOGY: combined text matches an ontology alias
      //
      // Bounded: max 1 line lookahead to prevent runaway merging.
      const processedLines = [];
      let preprocessSection = null; // track section during preprocessor pass
      let pi = 0;
      while (pi < rawLines.length) {
        const line = rawLines[pi];
        const cells = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);

        // Update section context during preprocessing
        if (cells.length === 1) {
          const detectedSec = sectionDetector.detectSection(cells[0]);
          if (detectedSec) preprocessSection = detectedSec;
        }

        // Only consider fusion for single-cell, non-value lines
        if (cells.length === 1 && !isValueStr(cells[0]) && pi + 1 < rawLines.length) {
          const nextLine = rawLines[pi + 1];
          const nextCells = nextLine.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);

          // A: next cell is NOT a value string — check for parameter name fusion
          if (nextCells.length === 1 && !isValueStr(nextCells[0])) {
            const cur = cells[0];
            const nxt = nextCells[0];
            const combined = `${cur} ${nxt}`;

            // A1) Structural: current line ends with '/' (clearly mid-phrase)
            const endsWithSlash = /\/$/.test(cur.trim());
            // A2) Structural: next line is a bracketed suffix like "(TSH / uTSH)"
            const nextIsBracketedSuffix = /^\(.*\)$/.test(nxt.trim());
            // A3) Ontology: combined text matches a known parameter alias
            const mapping = ontologyMapper.mapParameter(combined, preprocessSection);
            const ontologyMatch = !!(mapping && combined.length > 5 && isNaN(Number(combined)));
            // A4) Value fusion: combined text is a valid clinical value string
            //     e.g. "Non-" + "Reactive" = "Non-Reactive", "Not" + "Applicable" = "Not Applicable"
            const combinedIsValue = isValueStr(combined);

            if (endsWithSlash || nextIsBracketedSuffix || ontologyMatch || combinedIsValue) {
              processedLines.push(combined);
              pi += 2;
              continue;
            }
          }

          // B: next cell IS a value string — check for split-value case only
          //    e.g. "Non-" (non-value) + "Reactive" (value) = "Non-Reactive" (fused value)
          //    Note: for dash-ending prefixes, join WITHOUT a space to preserve hyphenation.
          if (nextCells.length === 1 && isValueStr(nextCells[0])) {
            const joinChar = cells[0].endsWith('-') ? '' : ' ';
            const combined = `${cells[0]}${joinChar}${nextCells[0]}`;
            if (isValueStr(combined)) {
              processedLines.push(combined);
              pi += 2;
              continue;
            }
          }
        }
        processedLines.push(line);
        pi++;
      }

      const lines = processedLines;
      let pendingParams = [];

      for (const line of lines) {
        // Split line into cells by tabs or multiple spaces
        const cells = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];

          // 1. Detect Section
          const detectedSection = sectionDetector.detectSection(cell);
          // Only treat this as entering a NEW section if it's actually different from
          // the one we're already in. Many real reports repeat a near-identical string
          // as both the section header AND the first parameter's own name (e.g. section
          // "Erythrocyte Sedimentation Rate (ESR)" followed by a parameter row literally
          // named "ESR - Erythrocyte Sedimentation Rate") — without this guard, the
          // parameter name re-triggers "section detected", wipes pendingParams again,
          // and the value that follows has nothing left to attach to and gets dropped.
          if (detectedSection && detectedSection !== currentSection) {
            currentSection = detectedSection;
            if (!extractedData[currentSection]) extractedData[currentSection] = {};
            pendingParams = []; // reset pending on new section
            // Section headers ALWAYS skip parameter mapping — they set context only.
            // This prevents section title strings like "THYROID STIMULATING HORMONE (TSH)"
            // from also being queued as parameter entries and consuming value tokens.
            continue;
          }

          // Skip column headers and the "Interpretation:" marker. The latter fuzzy-matches
          // a real ontology parameter (interpretation_diagnosis) closely enough to get
          // queued as a pending name — and since every report page ends with an
          // "Interpretation:" marker followed by free-text explanation (which often
          // illustrates both possible results, e.g. "Reactive ... Non-Reactive ..." as a
          // legend, not the actual result), that queued entry then steals whichever
          // qualitative word appears next in the explanation as if it were the real
          // result. Confirmed this was inverting real NON-REACTIVE HBsAg/HIV results to
          // "Reactive" in extracted_json on real reports.
          if (/^(Parameter|Result|Reference|Unit|Interpretation):?$/i.test(cell)) continue;

          // ── CRITICAL VALUE-FIRST GUARD ──────────────────────────────────────────────
          // If this cell is a recognized clinical value token (Reactive, Non-Reactive,
          // 1:16, Immune, Not Detected, etc.), route it DIRECTLY to the columnar
          // heuristic. NEVER send it to the ontology mapper first.
          // Rationale: fuzzy matching incorrectly maps short value strings to unrelated
          // parameters (e.g. "Reactive" → hs_crp at score 0.12), poisoning pendingParams.
          // ─────────────────────────────────────────────────────────────────────────────
          if (!isValueStr(cell)) {
            // 2. Map Parameter (only for non-value cells)
            const mapping = ontologyMapper.mapParameter(cell, currentSection);
            // Trust the ontology mapper's own confidence-scored matching rather than
            // re-gating on raw string length here — a `> 5` floor silently dropped
            // extremely common short lab abbreviations entirely (PCV, MCV, MCH, TLC,
            // Hb, Na, K...) on every real-world report tested. Just guard against a
            // bare number being mistaken for a name.
            if (mapping && cell.length >= 2 && isNaN(Number(cell))) {
              let value = null;
              let referenceRange = null;
              let unit = null;

              // Look ahead for inline value (same-line column layout)
              if (i + 1 < cells.length && isValueStr(cells[i + 1])) {
                value = cells[i + 1];
                i++;

                // Look ahead for reference range or unit
                if (i + 1 < cells.length) {
                  const nextCell = cells[i + 1];
                  // Reference range: starts with digit or < > comparator
                  if (/^[<>]?\s*\d/.test(nextCell) || /^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(nextCell)) {
                    referenceRange = nextCell;
                    i++;

                    // Look ahead for unit
                    if (i + 1 < cells.length) {
                      const unitCell = cells[i + 1];
                      if (/^[a-zA-Z/%µ]+$/.test(unitCell) || (mapping.expected_units && mapping.expected_units.includes(unitCell.toLowerCase()))) {
                        unit = unitCell;
                        i++;
                      }
                    }
                  } else if (/^[a-zA-Z/%µ]+$/.test(nextCell)) {
                    unit = nextCell;
                    i++;
                  }
                }
              }

              if (value !== null) {
                const section = currentSection || mapping.section || 'general';
                writeParam(section, mapping, value, unit, referenceRange, mapping.match_score, cell);
              } else {
                // No inline value — queue for columnar matching. Some real reports repeat
                // a test's name twice in a row (e.g. a mini section-style line followed by
                // the actual row name) before the method/value — without deduping, the
                // second occurrence sits in the queue and later steals whatever value-shaped
                // token comes next (often the reference range itself), clobbering the
                // correct value that was already assigned to the first occurrence.
                const alreadyPending = pendingParams.some(p => p.mapping.canonical_name === mapping.canonical_name);
                if (!alreadyPending) {
                  pendingParams.push({ mapping, original_name: cell });
                }
              }
              continue;
            }
          }

          // 3. Columnar Heuristic
          // Triggered when: (a) cell is a value string, OR (b) cell matched nothing above.
          // Pops the earliest pending parameter and assigns this cell as its value.
          if (pendingParams.length > 0 && isValueStr(cell)) {
            const param = pendingParams.shift();
            const section = currentSection || param.mapping.section || 'general';
            writeParam(section, param.mapping, cell, null, null, parseFloat((param.mapping.match_score * 0.9).toFixed(2)), param.original_name);
          }

        } // end for (let i < cells.length)
      } // end for (const line of lines)
    } // end for (const page of pages)

    return extractedData;
  }
}

module.exports = new ParameterExtractorService();
