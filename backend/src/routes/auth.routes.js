const express = require('express');
const { loginUser, verifyOtp, updateProfile, resetQuota, getUserProfile } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', loginUser);
router.post('/verify', verifyOtp);
router.post('/profile', updateProfile);
router.post('/reset-quota', resetQuota);
router.get('/profile/:userId', getUserProfile);

module.exports = router;
