const express = require('express');
const router = express.Router();
const compatibilityController = require('../controllers/compatibility.controller');

// POST /api/compatibility/analyze
router.post('/analyze', compatibilityController.analyzeCompatibility);

module.exports = router;
