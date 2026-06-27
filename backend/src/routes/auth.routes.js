const express = require('express');
const { 
  loginUser, 
  verifyOtp, 
  refreshSession, 
  logoutUser, 
  updateProfile, 
  resetQuota, 
  getUserProfile 
} = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/login', loginUser);
router.post('/verify', verifyOtp);
router.post('/refresh', refreshSession);
router.post('/logout', logoutUser);

// Secure routes
router.post('/profile', authenticateToken, updateProfile);
router.post('/reset-quota', authenticateToken, resetQuota);
router.get('/profile/:userId', authenticateToken, getUserProfile);

module.exports = router;
