const sectionDetector = require('./sectionDetector.service');
const ontologyMapper = require('./ontologyMapper.service');
const logger = require('../../utils/logger');

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
      // Numeric with optional leading comparator
      if (/^[<>]?\s*\d+(?:\.\d+)?$/.test(str)) return true;
      // Numeric ranges like 0-5 or 0.4-4.0
      if (/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(str)) return true;
      // Titer formats: 1:16, 1 : 4 — critical for Syphilis RPR titre
      if (/^\d+\s*:\s*\d+$/.test(str)) return true;
      // Qualitative clinical terms
      if (/^(Clear|Absent|Present|Positive|Negative|Reactive|Non-Reactive|Detected|Not\s+Detected|Immune|Non-Immune|Normal|Abnormal|Rare|Pale\s+Yellow|Pale|Not\s+Applicable)$/i.test(str)) return true;
      // Blood groups
      if (/^(A|B|AB|O)$/.test(str)) return true;
      // Semen interpretation categories
      if (/^(Normozoospermia|Oligozoospermia|Azoospermia|Asthenozoospermia|Teratozoospermia)$/i.test(str)) return true;
      return false;
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
          if (detectedSection) {
            currentSection = detectedSection;
            if (!extractedData[currentSection]) extractedData[currentSection] = {};
            pendingParams = []; // reset pending on new section
            // Section headers ALWAYS skip parameter mapping — they set context only.
            // This prevents section title strings like "THYROID STIMULATING HORMONE (TSH)"
            // from also being queued as parameter entries and consuming value tokens.
            continue;
          }

          // Skip column headers
          if (/^(Parameter|Result|Reference|Unit)$/i.test(cell)) continue;

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
            if (mapping && cell.length > 5 && isNaN(Number(cell))) {
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
                if (!extractedData[section]) extractedData[section] = {};
                extractedData[section][mapping.canonical_name] = {
                  original_name: cell,
                  value: isNaN(Number(value)) ? value : Number(value),
                  unit: unit,
                  reference_range: referenceRange,
                  confidence: mapping.match_score
                };
              } else {
                // No inline value — queue for columnar matching
                pendingParams.push({ mapping, original_name: cell });
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
            if (!extractedData[section]) extractedData[section] = {};
            extractedData[section][param.mapping.canonical_name] = {
              original_name: param.original_name,
              value: isNaN(Number(cell)) ? cell : Number(cell),
              unit: null,
              reference_range: null,
              confidence: parseFloat((param.mapping.match_score * 0.9).toFixed(2))
            };
          }

        } // end for (let i < cells.length)
      } // end for (const line of lines)
    } // end for (const page of pages)

    return extractedData;
  }
}

module.exports = new ParameterExtractorService();
