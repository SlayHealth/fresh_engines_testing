const express = require('express');
const { analyzeMental } = require('../controllers/mental.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/analyze', authenticateToken, analyzeMental);

module.exports = router;
