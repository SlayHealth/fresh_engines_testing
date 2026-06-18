const express = require('express');
const pathologyController = require('../controllers/pathology.controller');

const router = express.Router();

// Real PDF extraction endpoint
router.post('/extract', pathologyController.upload.single('pdf'), pathologyController.extractPathology);

// Mock extraction for testing frontend UI without a PDF
router.get('/mock-extract', pathologyController.mockExtract);

module.exports = router;
