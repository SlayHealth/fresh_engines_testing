const express = require('express');
const { analyzeChronic } = require('../controllers/chronic.controller');
const { checkMatchQuota } = require('../middleware/quota');

const router = express.Router();

router.post('/analyze', checkMatchQuota, analyzeChronic);

module.exports = router;
