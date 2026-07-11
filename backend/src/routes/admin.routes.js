const express = require('express');
const { listWhatsAppMessages } = require('../controllers/admin.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireAdmin } = require('../middleware/admin.middleware');

const router = express.Router();

router.get('/whatsapp/messages', authenticateToken, requireAdmin, listWhatsAppMessages);

module.exports = router;
