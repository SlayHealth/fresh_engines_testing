const express = require('express');
const { analyzeChronic } = require('../controllers/chronic.controller');
const { checkMatchQuota } = require('../middleware/quota');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/analyze', authenticateToken, checkMatchQuota, analyzeChronic);

module.exports = router;
