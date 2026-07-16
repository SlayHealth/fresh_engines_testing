const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const {
  createInvite,
  logSelfEntryConsent,
  streamInviteStatus,
  getInvites,
  validateToken,
  updateConsent,
  submitQuestionnaire,
  revokeInvite,
  runInviteMatch,
  handleWhatsAppWebhook
} = require('../controllers/invite.controller');

const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer for PDF uploads
const uploadDir = path.resolve(__dirname, '../temp/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

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

// Secure routes (Require authentication token)
router.post('/send', authenticateToken, createInvite);
router.post('/self-entry-consent', authenticateToken, logSelfEntryConsent);
router.get('/status', authenticateToken, getInvites);
router.get('/stream', authenticateToken, streamInviteStatus);
router.post('/revoke/:id', authenticateToken, revokeInvite);
router.post('/run-match/:id', authenticateToken, runInviteMatch);

// Public routes (For prospect onboarding and webhook delivery notifications)
router.get('/validate/:token', validateToken);
router.post('/consent', updateConsent);
router.post('/submit', upload.fields([
  { name: 'pathologyReport', maxCount: 1 },
  { name: 'radiologyReport', maxCount: 1 }
]), submitQuestionnaire);

// WhatsApp incoming webhook routes
router.get('/webhook/whatsapp', handleWhatsAppWebhook);
router.post('/webhook/whatsapp', handleWhatsAppWebhook);

module.exports = router;
