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
// WS2-08: previously accepted any file type/size at all — pathology.controller.js
// already enforces PDF-only + 25MB for the equivalent upload; matched here so the
// two upload paths behave consistently instead of one silently accepting
// arbitrary files the downstream pipeline was never built to handle.
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max size
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

router.post('/upload',         upload.single('pdf'), ctrl.uploadReport);
router.post('/analyze',        ctrl.analyze);
router.post('/report',         ctrl.saveReport);
router.get('/report/:id',      ctrl.getReport);
router.post('/couple',         ctrl.analyzeCouple);
router.post('/couple-summary', ctrl.getCoupleSummary);

module.exports = router;
