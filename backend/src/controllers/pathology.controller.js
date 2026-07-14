const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const ocrProvider = require('../services/ocr/ocrProvider');
const parameterExtractor = require('../services/parser/parameterExtractor.service');
const { computeTestCoverage } = require('../services/pathology/testCoverage.service');
const logger = require('../utils/logger');
const { db } = require('../services/storage/postgres.service');

// Configure Multer for file uploads
const uploadDir = path.resolve(__dirname, '../temp/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max size
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

/**
 * Handle PDF extraction request
 */
async function extractPathology(req, res, next) {
  const startTime = Date.now();
  const reportId = uuidv4();

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
    }

    const filePath = req.file.path;
    logger.info(`Starting extraction for report ${reportId}, file: ${req.file.originalname}`);

    // Insert initial report record
    await db.query(`
      INSERT INTO reports (id, file_name, processing_status, confidence_score) 
      VALUES ($1, $2, $3, $4)
    `, [reportId, req.file.originalname, 'processing', 0.0]);

    // 1. OCR Step
    logger.info(`Extracting text via OCR for ${reportId}`);
    const ocrPages = await ocrProvider.process(filePath);

    // Save OCR text to DB
    if (ocrPages.length > 0) {
      const values = [];
      const valuePlaceholders = [];
      ocrPages.forEach((page, idx) => {
        values.push(reportId, page.page, page.text);
        const offset = idx * 3;
        valuePlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
      });
      await db.query(`
        INSERT INTO ocr_pages (report_id, page_number, raw_text)
        VALUES ${valuePlaceholders.join(', ')}
      `, values);
    }

    // 2. Parsing Step
    logger.info(`Parsing parameters for ${reportId}`);
    const extractedData = parameterExtractor.extract(ocrPages);

    let totalParams = 0;
    let totalConfidence = 0;
    
    // Calculate total confidence directly from data array
    for (const section of Object.keys(extractedData)) {
      for (const paramKey of Object.keys(extractedData[section])) {
        const param = extractedData[section][paramKey];
        totalParams++;
        totalConfidence += param.confidence;
      }
    }

    const averageConfidence = totalParams > 0 ? parseFloat((totalConfidence / totalParams).toFixed(2)) : 0.0;
    const processingTime = Date.now() - startTime;
    
    // Update DB status and store JSON array
    await db.query(`
      UPDATE reports SET processing_status = $1, confidence_score = $2, extracted_json = $3 WHERE id = $4
    `, ['completed', averageConfidence, JSON.stringify(extractedData), reportId]);

    // 3. Return JSON Response Contract
    const responseData = {
      success: true,
      report_metadata: {
        report_id: reportId,
        processing_time_ms: processingTime,
        parameters_extracted: totalParams,
        confidence_score: averageConfidence,
        raw_ocr_text: ocrPages.map(p => p.text).join('\n\n--- PAGE BREAK ---\n\n')
      },
      sections: extractedData,
      // Which named tests this specific upload actually contains vs. doesn't,
      // and what each missing one means for the eventual report — not just a
      // raw parameter count.
      testCoverage: computeTestCoverage(extractedData)
    };

    logger.info(`Finished extraction for report ${reportId} in ${processingTime}ms`);
    return res.json(responseData);

  } catch (error) {
    logger.error(`Extraction failed for report ${reportId}: ${error.message}`);

    // Update DB status on error
    try {
      await db.query(`
        UPDATE reports SET processing_status = $1 WHERE id = $2
      `, ['failed', reportId]);
    } catch(e) {
      logger.error(`Could not update report status: ${e.message}`);
    }

    next(error);
  } finally {
    // The extracted data is already persisted to Postgres above — the raw upload
    // is single-use, so clean it up rather than letting it accumulate on disk.
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* best-effort cleanup */ }
    }
  }
}

/**
 * Health check endpoint
 */
function healthCheck(req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}

/**
 * Mock Extraction endpoint (for testing API contract without uploading)
 */
async function mockExtract(req, res, next) {
  try {
    const reportId = uuidv4();
    // Real ontology canonical_names (see ontologyMapper.service.js) so this mock's
    // testCoverage result is meaningful rather than showing every test missing.
    const extractedData = {
      cbc: {
        hemoglobin_hb: { value: 16.0, unit: 'g/dL', reference_range: '13.5-17.5', confidence: 0.98 },
        total_red_blood_cell_count_rbc: { value: 4.5, unit: 'mill/uL', reference_range: '4.5-5.5', confidence: 0.94 }
      }
    };

    // Insert mock report into DB, explicitly flagged so it's never mistaken for a real
    // uploaded/OCR'd report by downstream matching logic.
    await db.query(`
      INSERT INTO reports (id, file_name, processing_status, confidence_score, extracted_json, is_mock)
      VALUES ($1, $2, $3, $4, $5, TRUE)
    `, [reportId, 'mock_report.pdf', 'completed', 0.96, JSON.stringify(extractedData)]);

    res.json({
      success: true,
      report_metadata: {
        report_id: reportId,
        processing_time_ms: 120,
        parameters_extracted: 2,
        confidence_score: 0.96,
        raw_ocr_text: "COMPLETE BLOOD COUNT\nHemoglobin (Hb)\t16.0\t13.5-17.5\tg/dL\nTotal RBC Count\t4.5\t4.5-5.5\tmill/uL\n\n--- PAGE BREAK ---\n\nMock page 2 text..."
      },
      sections: extractedData,
      testCoverage: computeTestCoverage(extractedData)
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  upload,
  extractPathology,
  healthCheck,
  mockExtract
};
