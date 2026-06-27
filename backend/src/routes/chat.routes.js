const express = require('express');
const { createChatSession, getChatHistory, sendChatMessage } = require('../controllers/chat.controller');
const { checkChatQuota } = require('../middleware/quota');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply auth middleware to all endpoints in this router
router.use(authenticateToken);

router.post('/session', createChatSession);
router.get('/session/:sessionId/history', getChatHistory);
router.post('/message', checkChatQuota, sendChatMessage);

module.exports = router;
