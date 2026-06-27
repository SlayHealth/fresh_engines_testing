const express = require('express');
const router = express.Router();
const compatibilityController = require('../controllers/compatibility.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Apply auth middleware to all endpoints in this router
router.use(authenticateToken);

// POST /api/compatibility/analyze
router.post('/analyze', compatibilityController.analyzeCompatibility);

// GET /api/compatibility/matches
router.get('/matches', compatibilityController.listMatches);

// POST /api/compatibility/save-match
router.post('/save-match', compatibilityController.saveMatch);

// GET /api/compatibility/matches/:matchId/pdf
router.get('/matches/:matchId/pdf', compatibilityController.generatePDFReport);

// GET /api/compatibility/matches/:matchId/radiology
router.get('/matches/:matchId/radiology', compatibilityController.getMatchRadiology);

module.exports = router;
