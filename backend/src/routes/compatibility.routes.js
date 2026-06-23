const express = require('express');
const router = express.Router();
const compatibilityController = require('../controllers/compatibility.controller');

// POST /api/compatibility/analyze
router.post('/analyze', compatibilityController.analyzeCompatibility);

// GET /api/compatibility/matches
router.get('/matches', compatibilityController.listMatches);

// POST /api/compatibility/save-match
router.post('/save-match', compatibilityController.saveMatch);

module.exports = router;
