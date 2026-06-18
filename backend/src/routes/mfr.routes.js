const express = require('express');
const { analyzeMfr } = require('../controllers/mfr.controller');

const router = express.Router();

router.post('/analyze', analyzeMfr);

module.exports = router;
