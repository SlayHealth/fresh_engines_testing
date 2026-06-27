const express = require('express');
const pathologyController = require('../controllers/pathology.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply auth middleware to all endpoints in this router
router.use(authenticateToken);

// Real PDF extraction endpoint
router.post('/extract', pathologyController.upload.single('pdf'), pathologyController.extractPathology);

// Mock extraction for testing frontend UI without a PDF
router.get('/mock-extract', pathologyController.mockExtract);

module.exports = router;
