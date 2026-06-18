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

    const isValueStr = (str) => {
      if (!str) return false;
      if (/^[<>]?\s*\d+(?:\.\d+)?$/.test(str)) return true; // Numbers like 14, 5.1, < 40, > 90
      if (/^\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?$/.test(str)) return true; // Ranges like 0-5
      if (/^(Clear|Absent|Present|Positive|Negative|Reactive|Non-Reactive|Normal|A|B|AB|O|Rare|Pale Yellow|Pale)$/i.test(str)) return true;
      return false;
    };

    for (const page of pages) {
      const lines = page.text.split('\n');
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
            
            // Only continue (skip parameter mapping) if this cell is NOT also a valid parameter name
            const isParameter = ontologyMapper.mapParameter(cell, currentSection);
            if (!isParameter) {
              continue;
            }
          }

          // Skip headers like "Parameter", "Result", "Reference", "Unit"
          if (/^(Parameter|Result|Reference|Unit)$/i.test(cell)) continue;

          // 2. Map Parameter
          const mapping = ontologyMapper.mapParameter(cell, currentSection);
          if (mapping && cell.length > 5 && isNaN(Number(cell))) {
            let value = null;
            let referenceRange = null;
            let unit = null;

            // Look ahead for inline value
            if (i + 1 < cells.length && isValueStr(cells[i + 1])) {
              value = cells[i + 1];
              i++;

              // Look ahead for reference range or unit
              if (i + 1 < cells.length) {
                const nextCell = cells[i + 1];
                if (nextCell.includes('-') || /^[\d.]+$/.test(nextCell) || /^[<>]/.test(nextCell)) {
                  referenceRange = nextCell;
                  i++;

                  // Look ahead for unit
                  if (i + 1 < cells.length) {
                    const unitCell = cells[i + 1];
                    if (/^[a-zA-Z/%]+$/.test(unitCell) || (mapping.expected_units && mapping.expected_units.includes(unitCell.toLowerCase()))) {
                      unit = unitCell;
                      i++;
                    }
                  }
                } else if (/^[a-zA-Z/%]+$/.test(nextCell)) {
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
              // No inline value found, store it for columnar matching
              pendingParams.push({ mapping, original_name: cell });
            }
            continue;
          }

          // 3. Columnar Heuristic (if no inline value found previously)
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
        }
      }
    }

    return extractedData;
  }
}

module.exports = new ParameterExtractorService();
