const openRouter = require('../llm/openrouter.service');
const logger = require('../../utils/logger');
const schemaRegistry = require('./schemaRegistry');
const { coerceAndValidate } = require('./schemaValidator');

const BASE_SYSTEM_PROMPT = `You are a specialized medical AI designed to extract structured JSON data
from radiology reports. Your output MUST be ONLY valid JSON matching the exact schema provided.
Do not include markdown, backticks, or preamble. Just the JSON string.

RULES:
1. Extract numerical values cleanly (e.g. "Volume: 32.8 cc" → 32.8).
2. If a field is not mentioned, set it to null (not false, unless you can infer absence).
3. If report explicitly says "No X" or "X is normal", set boolean flag to false/true accordingly.
4. Ignore data from other modality sections — focus ONLY on the section text provided.
5. All dates in ISO format if extractable.
6. NEVER hallucinate measurements not present in the text.`;

class RadiologyExtractorService {
  async extractSection(sectionText, modalityKey, patientName = null, sex = null, age = null) {
    const schema = schemaRegistry.get(modalityKey);
    if (!schema) {
      logger.warn(`No schema found for modality: ${modalityKey}`);
      return { modalityKey, extracted: null, error: 'unsupported_modality' };
    }

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (patientName) {
      systemPrompt += `\n\nTARGET PATIENT DETAILS:\n- Name: ${patientName}\n- Sex: ${sex || 'Not specified'}\n- Age: ${age || 'Not specified'}\n\nCRITICAL RULE: The text may contain reports for multiple patients (e.g., a combined couple report). You MUST extract findings ONLY for the target patient named "${patientName}". Ignore all findings, measurements, and details belonging to other patients.`;
    }

    systemPrompt += `\n\nMODALITY: ${schema.label}
ADDITIONAL EXTRACTION RULES FOR THIS MODALITY:
${schema.systemPromptAdditions || ''}

JSON SCHEMA TO FILL:
${JSON.stringify(schema.jsonSchema, null, 2)}`;

    const userPrompt = `Extract structured JSON from this ${schema.label} report section:\n\n${sectionText}`;

    // WS2-07: malformed JSON is often model non-determinism on a single turn — worth
    // one retry. Other failures (auth, network, timeout) won't be fixed by retrying,
    // so only LLM_MALFORMED_JSON gets a second attempt.
    let jsonResponse;
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        logger.info(`Extracting ${modalityKey} for ${patientName || 'unknown'}...${attempt > 0 ? ' (retry after malformed JSON)' : ''}`);
        jsonResponse = await openRouter.extractJSON(userPrompt, systemPrompt);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (err.code !== 'LLM_MALFORMED_JSON' || attempt === 1) break;
      }
    }

    if (lastErr) {
      logger.error(`Extraction failed for ${modalityKey}: ${lastErr.message}`);
      return { modalityKey, extracted: null, error: lastErr.message };
    }

    // Validate/coerce against the declared schema: drop invented fields, coerce
    // wrong-typed values (e.g. fatty_grade: "2" as a string), reject hallucinated
    // enum values not in the closed vocabulary a scorer actually checks against.
    const validated = coerceAndValidate(jsonResponse, schema.jsonSchema);
    return { modalityKey, extracted: validated, error: null };
  }

  // Parallel extraction of all sections
  async extractAll(sections, patientName = null, sex = null, age = null) {
    const promises = sections.map(section =>
      this.extractSection(section.rawSectionText, section.modalityKey, patientName, sex, age)
    );
    return Promise.all(promises);
  }
}

module.exports = new RadiologyExtractorService();
