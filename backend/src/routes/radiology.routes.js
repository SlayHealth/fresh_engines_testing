const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/radiology.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply auth middleware to all endpoints in this router
router.use(authenticateToken);

const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

router.post('/upload',         upload.single('pdf'), ctrl.uploadReport);
router.post('/analyze',        ctrl.analyze);
router.post('/report',         ctrl.saveReport);
router.get('/report/:id',      ctrl.getReport);
router.post('/couple',         ctrl.analyzeCouple);
router.post('/couple-summary', ctrl.getCoupleSummary);

module.exports = router;
