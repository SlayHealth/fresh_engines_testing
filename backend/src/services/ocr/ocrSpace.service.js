const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../../utils/logger');

class OcrSpaceService {
  async process(filePath) {
    const apiKey = process.env.OCR_API_KEY || process.env.OCR_SPACE_API_KEY;
    if (!apiKey) {
      throw new Error("OCR_API_KEY or OCR_SPACE_API_KEY is missing");
    }

    const formData = new FormData();
    formData.append('apikey', apiKey);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('isTable', 'true');
    formData.append('scale', 'true');
    formData.append('file', fs.createReadStream(filePath));

    try {
      logger.info(`Sending file to OCR.space: ${filePath}`);
      const response = await axios.post('https://api.ocr.space/parse/image', formData, {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 30000 // 30 second timeout
      });

      const data = response.data;
      if (data.IsErroredOnProcessing) {
        throw new Error(`OCR API Error: ${data.ErrorMessage ? data.ErrorMessage.join(', ') : 'Unknown error'}`);
      }

      // Format response to be consistent: [{page: 1, text: "..."}]
      const parsedResults = data.ParsedResults || [];
      return parsedResults.map((result, index) => ({
        page: index + 1,
        text: result.ParsedText
      }));

    } catch (error) {
      logger.error(`OCR.space API call failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new OcrSpaceService();
