const express = require('express');
const multer = require('multer');
const path = require('path');
const { analyzeUsg, persistReport, getReport, analyzeCouple, getCoupleSummary, uploadReport } = require('../controllers/usg.controller');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.post('/upload', upload.single('pdf'), uploadReport);
router.post('/analyze', analyzeUsg);
router.post('/report', persistReport);
router.get('/report/:id', getReport);
router.post('/couple', analyzeCouple);
router.post('/couple-summary', getCoupleSummary);

module.exports = router;
