const express = require('express');
const router = express.Router();
const compatibilityController = require('../controllers/compatibility.controller');
const { authenticateToken, authenticateOrShareToken } = require('../middleware/auth.middleware');

// GET /api/compatibility/matches/:matchId/pdf
// Registered ahead of the blanket authenticateToken below: this route accepts EITHER
// a normal session (header/?token=) OR a short-lived, match-scoped ?shareToken= minted
// by createShareLink — so it needs its own auth check instead of the blanket one.
router.get('/matches/:matchId/pdf', authenticateOrShareToken, compatibilityController.generatePDFReport);

// Apply auth middleware to all remaining endpoints in this router
router.use(authenticateToken);

// GET /api/compatibility/matches
router.get('/matches', compatibilityController.listMatches);

// POST /api/compatibility/save-match
router.post('/save-match', compatibilityController.saveMatch);

// POST /api/compatibility/matches/:matchId/share-link
router.post('/matches/:matchId/share-link', compatibilityController.createShareLink);

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
