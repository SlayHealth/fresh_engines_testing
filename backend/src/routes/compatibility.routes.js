const express = require('express');
const router = express.Router();
const compatibilityController = require('../controllers/compatibility.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Apply auth middleware to all endpoints in this router
router.use(authenticateToken);

// GET /api/compatibility/matches
router.get('/matches', compatibilityController.listMatches);

// POST /api/compatibility/save-match
router.post('/save-match', compatibilityController.saveMatch);

// GET /api/compatibility/matches/:matchId/pdf
router.get('/matches/:matchId/pdf', compatibilityController.generatePDFReport);

// GET /api/compatibility/matches/:matchId/ai-pdf
// Generates a PDF where the visual layout (colors, statuses, stars, priorities) is driven by DeepSeek AI
router.get('/matches/:matchId/ai-pdf', compatibilityController.generateAIPDFReport);


// GET /api/compatibility/matches/:matchId/radiology
router.get('/matches/:matchId/radiology', compatibilityController.getMatchRadiology);

// GET /api/compatibility/matches/:matchId
router.get('/matches/:matchId', compatibilityController.getMatch);

// POST /api/compatibility/matches/:matchId/infographics-data
router.post('/matches/:matchId/infographics-data', compatibilityController.compileInfographicsData);

module.exports = router;
