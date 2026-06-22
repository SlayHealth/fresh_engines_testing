const express = require('express');
const { createChatSession, getChatHistory, sendChatMessage } = require('../controllers/chat.controller');
const { checkChatQuota } = require('../middleware/quota');

const router = express.Router();

router.post('/session', createChatSession);
router.get('/session/:sessionId/history', getChatHistory);
router.post('/message', checkChatQuota, sendChatMessage);

module.exports = router;
