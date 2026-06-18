const express = require('express');
const { analyzeChronic } = require('../controllers/chronic.controller');

const router = express.Router();

router.post('/analyze', analyzeChronic);

module.exports = router;
