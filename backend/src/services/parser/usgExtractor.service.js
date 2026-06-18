const openRouter = require('../llm/openrouter.service');
const logger = require('../../utils/logger');

class UsgExtractorService {
  async extract(rawText) {
    const systemInstruction = `You are a specialized medical AI designed to extract structured JSON data from Ultrasound (USG) Abdomen/Pelvis reports. 
Your output MUST be ONLY valid JSON matching the exact schema provided. Do not include markdown blocks, just the JSON string.

RULES:
1. Extract numerical values cleanly (e.g. "Volume: 32.8 cc" -> 32.8).
2. For prostate mapping: map text like "Prostatomegaly (Gr-I)" or "BPH Grade I" to grade: "Grade_I".
3. Ignore non-USG sections (e.g. if a blood report is mixed in).
4. If an organ is not mentioned or removed, set _applicable: false or present: false.
5. All dates should be ISO format if possible.

SCHEMA EXPECTED:
{
  "patient": {
    "patient_slay_id": "string",
    "name": "string",
    "age_years": "number",
    "sex": "Male | Female",
    "bmi": "number | null"
  },
  "findings": {
    "liver": { "fatty_grade": "number", "hepatomegaly": "boolean", "focal_lesions": [{ "type": "string", "size_mm": {} }] },
    "gallbladder": { "present": "boolean", "calculi_present": "boolean", "polyp_present": "boolean", "wall_thickness_normal": "boolean" },
    "pancreas": { "size_normal": "boolean", "echotexture_normal": "boolean", "focal_lesion": "boolean", "calcifications": "boolean" },
    "spleen": { "size_normal": "boolean", "size_category": "string", "focal_lesion": "boolean" },
    "kidneys": { 
      "right": {"calculi_present": "boolean", "size_normal": "boolean", "cysts": [{"type": "string"}], "hydronephrosis": "boolean", "hydronephrosis_grade": "number | null" }, 
      "left": {"calculi_present": "boolean", "size_normal": "boolean", "cysts": [{"type": "string"}], "hydronephrosis": "boolean", "hydronephrosis_grade": "number | null" } 
    },
    "urinary_bladder": { "wall_thickness_normal": "boolean", "calculi_present": "boolean", "post_void_residual_cc": "number", "mass_present": "boolean" },
    "prostate": { "_applicable": "boolean", "size_normal": "boolean", "grade": "string", "volume_cc": "number", "weight_grams": "number | null" },
    "uterus": { "_applicable": "boolean", "size_normal": "boolean", "fibroid_present": "boolean", "collection_in_cavity": "boolean" },
    "ovaries": { 
      "_applicable": "boolean", 
      "pcos_morphology_bilateral": "boolean", 
      "pcos_morphology_unilateral": "boolean",
      "right": { "volume_cc": "number | null", "cyst_present": "boolean" },
      "left": { "volume_cc": "number | null", "cyst_present": "boolean" },
      "pouch_of_douglas_free_fluid": "boolean",
      "vaginal_cyst_collection": "boolean"
    }
  }
}`;

    const prompt = `Extract the structured JSON from the following USG report text:\n\n${rawText}`;
    
    try {
      logger.info('Starting LLM extraction via OpenRouter...');
      const jsonResponse = await openRouter.extractJSON(prompt, systemInstruction);
      return jsonResponse;
    } catch (err) {
      logger.error('Extraction failed: ' + err.message);
      throw new Error('Failed to extract USG report using LLM');
    }
  }
}

module.exports = new UsgExtractorService();
