const { execFileSync } = require('child_process');
const path = require('path');
const ocrSpaceService = require('./ocrSpace.service');
const ocrMockService = require('./ocrMock.service');
const logger = require('../../utils/logger');

class OcrProvider {
  constructor() {
    const apiKey = process.env.OCR_API_KEY || process.env.OCR_SPACE_API_KEY;
    this.useMock = !apiKey || process.env.USE_MOCK_OCR === 'true';
    if (this.useMock) {
      logger.info('OCR Provider initialized in MOCK mode.');
    } else {
      logger.info('OCR Provider initialized in REAL mode (OCR.space).');
    }
  }

  /**
   * Process a PDF or Image file and return extracted text per page.
   * @param {string} filePath - Absolute path to the uploaded file.
   * @returns {Promise<Array<{page: number, text: string}>>}
   */
  async process(filePath) {
    // Attempt local Python PyMuPDF extraction first
    try {
      const scriptPath = path.resolve(__dirname, 'extract_pdf_text.py');
      logger.info(`Attempting local PyMuPDF extraction for file: ${filePath}`);
      
      const stdout = execFileSync('python3', [scriptPath, filePath], { encoding: 'utf8', timeout: 10000 });
      const result = JSON.parse(stdout);
      
      if (result.success && result.pages && result.pages.length > 0) {
        const totalTextLength = result.pages.reduce((acc, p) => acc + (p.text || '').length, 0);
        if (totalTextLength > 100) {
          logger.info(`Successfully extracted ${totalTextLength} characters locally via PyMuPDF.`);
          return result.pages;
        } else {
          logger.info(`PyMuPDF extracted too little text (${totalTextLength} chars). PDF might be scanned. Falling back to OCR.`);
        }
      } else {
        logger.warn(`PyMuPDF execution failed or returned no pages: ${result.error || 'unknown error'}`);
      }
    } catch (error) {
      logger.warn(`Local PyMuPDF extraction failed or python3/fitz not found. Falling back to OCR. Error: ${error.message}`);
    }

    // Fall back to OCR space (real mode) or Mock OCR (explicit mock/dev mode only).
    // A real OCR failure (timeout, quota, bad scan) must NOT silently become mock
    // canned text — that would let a "completed" report actually contain someone
    // else's placeholder lab values with nothing marking it as fake. Let it throw
    // so the caller can mark the report as genuinely failed and ask the user to retry.
    if (this.useMock) {
      return await ocrMockService.process(filePath);
    }
    return await ocrSpaceService.process(filePath);
  }
}

module.exports = new OcrProvider();
