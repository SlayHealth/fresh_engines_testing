const express = require('express');
const { analyzeMfr } = require('../controllers/mfr.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/analyze', authenticateToken, analyzeMfr);

module.exports = router;
