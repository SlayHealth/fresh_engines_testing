const logger = require('../../utils/logger');

class OcrMockService {
  async process(filePath) {
    logger.info(`Mock OCR processing file: ${filePath}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return a mock payload that mimics what a blood test OCR would produce
    const mockText = `
      COMPLETE BLOOD COUNT
      Hemoglobin (Hb) 16.0 13.5-17.5 g/dL
      Total RBC Count 4.5 4.5-5.5 mill/uL
      White Blood Cells 6500 4000-11000 cells/cmm

      LIVER FUNCTION TEST
      Serum Bilirubin Total 0.8 0.2-1.2 mg/dL
      ALT (SGPT) 25 5-40 U/L
    `;

    return [
      {
        page: 1,
        text: mockText
      }
    ];
  }
}

module.exports = new OcrMockService();
