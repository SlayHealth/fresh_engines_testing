const { db } = require('../services/storage/postgres.service');
const { v4: uuidv4 } = require('uuid');
const otpService = require('../services/auth/otp.service');
const jwtService = require('../services/auth/jwt.service');
const notificationService = require('../services/notification/notification.service');
const logger = require('../utils/logger');

/**
 * Request an OTP via WhatsApp.
 */
async function loginUser(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  try {
    const { phone_number } = req.body;
    if (!phone_number || typeof phone_number !== 'string' || phone_number.trim() === '') {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // 1. Normalize Phone Number to E.164
    const cleanPhone = otpService.normalizePhone(phone_number);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }

    logger.info(`[Auth][CID: ${correlationId}] OTP requested for phone: ${cleanPhone}`);

    // 2. Check Rate Limits
    const rateLimit = await otpService.checkRateLimit(cleanPhone);
    if (!rateLimit.allowed) {
      logger.warn(`[Auth][CID: ${correlationId}] Rate limit hit for ${cleanPhone}. Reason: ${rateLimit.reason}`);
      return res.status(429).json({ success: false, error: rateLimit.reason });
    }

    // 3. Create OTP Request (handles invalidating old ones and saving new hash)
    const otp = await otpService.createOTPRequest(cleanPhone, 'login', correlationId);

    // 4. Send OTP via WhatsApp
    logger.info(`[Auth][CID: ${correlationId}] Triggering OTP WhatsApp delivery for ${cleanPhone}`);
    await notificationService.sendOTP(cleanPhone, otp, { correlationId });

    logger.info(`[Auth][CID: ${correlationId}] OTP successfully sent to WhatsApp for phone: ${cleanPhone}`);

    // Let the client know if this phone is brand-new (no account yet), so it can
    // collect name/relation/marriage-timeline before OTP entry for first-time users only.
    const existing = await db.query('SELECT id, name FROM users WHERE phone_number = $1', [cleanPhone]);
    const isNewUser = existing.rows.length === 0 || !existing.rows[0].name;

    res.json({
      success: true,
      message: 'OTP code sent successfully',
      phone_number: cleanPhone,
      is_new_user: isNewUser
    });
  } catch (error) {
    logger.error(`[Auth][CID: ${correlationId}] Error in loginUser: ${error.message}`);
    // Return structured server error instead of mock fallback
    res.status(500).json({ 
      success: false, 
      error: `Failed to request OTP: ${error.message}` 
    });
  }
}

/**
 * Verify OTP code and establish user session.
 */
async function verifyOtp(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  try {
    const { phone_number, otp } = req.body;
    if (!phone_number || !otp) {
      return res.status(400).json({ success: false, error: 'Phone number and OTP code are required' });
    }

    // 1. Normalize Phone Number
    const cleanPhone = otpService.normalizePhone(phone_number);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }

    const cleanOtp = otp.trim();
    logger.info(`[Auth][CID: ${correlationId}] Verifying OTP for phone: ${cleanPhone}`);

    // 2. Verify OTP code
    const verification = await otpService.verifyOTPRequest(cleanPhone, cleanOtp, 'login', correlationId);
    if (!verification.verified) {
      logger.warn(`[Auth][CID: ${correlationId}] OTP verification failed for ${cleanPhone}. Reason: ${verification.reason}`);
      return res.status(400).json({ success: false, error: verification.reason });
    }

    // 3. Create or Fetch User (ON CONFLICT prevents race conditions)
    const newUserId = uuidv4();
    const userRes = await db.query(
      `INSERT INTO users (id, phone_number, runs_used, chats_used)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (phone_number) DO UPDATE SET phone_number = EXCLUDED.phone_number
       RETURNING *`,
      [newUserId, cleanPhone]
    );
    const user = userRes.rows[0];

    // 4. Generate JWT tokens
    const tokens = jwtService.generateTokens(user.id, cleanPhone);

    // 5. Save refresh session in database
    await jwtService.saveSession(
      user.id, 
      tokens.refreshToken, 
      req.headers['user-agent'], 
      req.ip, 
      correlationId
    );

    // 6. Set Refresh Token as Secure, HttpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    logger.info(`[Auth][CID: ${correlationId}] User ${user.id} logged in successfully for phone ${cleanPhone}`);

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
      message: 'Verification successful'
    });
  } catch (error) {
    logger.error(`[Auth][CID: ${correlationId}] Error in verifyOtp: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Rotate Access and Refresh Tokens using the HttpOnly cookie.
 */
async function refreshSession(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  try {
    let refreshToken = req.cookies.refreshToken;
    if (!refreshToken && req.body && req.body.refreshToken) {
      refreshToken = req.body.refreshToken;
    }
    if (!refreshToken && req.headers['x-refresh-token']) {
      refreshToken = req.headers['x-refresh-token'];
    }

    if (!refreshToken) {
      logger.warn(`[Auth][CID: ${correlationId}] Refresh token missing from cookies and body`);
      return res.status(401).json({ success: false, error: 'Unauthorized: Session expired.' });
    }

    // 1. Verify Refresh Token JWT signature
    const decoded = jwtService.verifyRefreshToken(refreshToken);
    if (!decoded) {
      logger.warn(`[Auth][CID: ${correlationId}] Refresh token verification failed`);
      return res.status(401).json({ success: false, error: 'Unauthorized: Session expired.' });
    }

    // 2. Validate session in Postgres database
    const session = await jwtService.findAndValidateSession(decoded.sub, refreshToken, correlationId);
    if (!session) {
      logger.warn(`[Auth][CID: ${correlationId}] Session invalid or revoked in database`);
      return res.status(401).json({ success: false, error: 'Unauthorized: Session expired.' });
    }

    // 3. Rotate session (Revokes old and generates new pair)
    const tokens = await jwtService.rotateSession(
      session.id,
      session.user_id,
      decoded.phone,
      req.headers['user-agent'],
      req.ip,
      correlationId
    );

    // 4. Set new HttpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Retrieve latest user details
    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [session.user_id]);
    const user = userRes.rows[0];

    logger.info(`[Auth][CID: ${correlationId}] Tokens successfully rotated for user ${session.user_id}`);

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user
    });
  } catch (error) {
    logger.error(`[Auth][CID: ${correlationId}] Error in refreshSession: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Log out and revoke session.
 */
async function logoutUser(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  try {
    let refreshToken = req.cookies.refreshToken;
    if (!refreshToken && req.body && req.body.refreshToken) {
      refreshToken = req.body.refreshToken;
    }
    if (!refreshToken && req.headers['x-refresh-token']) {
      refreshToken = req.headers['x-refresh-token'];
    }

    if (refreshToken) {
      const decoded = jwtService.verifyRefreshToken(refreshToken);
      if (decoded) {
        const session = await jwtService.findAndValidateSession(decoded.sub, refreshToken, correlationId);
        if (session) {
          await jwtService.revokeSession(session.id, correlationId);
        }
      }
    }

    // Clear HttpOnly cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    logger.info(`[Auth][CID: ${correlationId}] User logged out successfully`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error(`[Auth][CID: ${correlationId}] Error in logoutUser: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function updateProfile(req, res, next) {
  const correlationId = req.correlationId || uuidv4();
  try {
    const targetUserId = req.body.id || req.user.id;
    
    // Authorization check: users can only update their own profile
    if (req.user.id !== targetUserId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify another user\'s profile' });
    }

    // Partial update: only columns actually present in the request body are written.
    // This used to unconditionally SET every column (missing ones falling back to
    // `field || null`), so any caller sending a partial payload — e.g. login.js's
    // completeSignup(), which only sends { id, name } — silently wiped every other
    // saved profile field (gender/dob/city/lifestyle/body metrics) back to null.
    const numericFields = new Set(['height', 'weight', 'waist']);
    const allowedFields = ['name', 'gender', 'dob', 'city', 'activity_level', 'drinking_habits', 'smoking_habits', 'sleep_cycle', 'height', 'weight', 'waist'];

    const setClauses = [];
    const values = [];
    allowedFields.forEach((field) => {
      if (req.body[field] === undefined) return;
      let value = req.body[field];
      if (numericFields.has(field)) {
        value = value === '' || value === null ? null : parseFloat(value);
      }
      values.push(value);
      setClauses.push(`${field} = $${values.length}`);
    });

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No profile fields provided to update' });
    }

    logger.info(`[Auth][CID: ${correlationId}] Updating profile for user ID: ${targetUserId} (fields: ${allowedFields.filter((f) => req.body[f] !== undefined).join(', ')})`);

    values.push(targetUserId);
    const result = await db.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: result.rows[0],
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error(`[Auth][CID: ${correlationId}] Error in updateProfile: ${error.message}`);
    next(error);
  }
}

async function resetQuota(req, res, next) {
  const correlationId = req.correlationId || uuidv4();
  try {
    const targetUserId = req.body.id || req.user.id;

    if (req.user.id !== targetUserId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify another user\'s quota' });
    }

    logger.info(`[Auth][CID: ${correlationId}] Resetting quota limits for user ID: ${targetUserId}`);
    
    const result = await db.query(
      `UPDATE users
       SET runs_used = 0, chats_used = 0
       WHERE id = $1
       RETURNING *`,
      [targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: result.rows[0],
      message: 'Quota limits reset successfully (Premium Demo Upgrade Active)'
    });
  } catch (error) {
    logger.error(`[Auth][CID: ${correlationId}] Error in resetQuota: ${error.message}`);
    next(error);
  }
}

async function getUserProfile(req, res, next) {
  const correlationId = req.correlationId || uuidv4();
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot access another user\'s profile' });
    }

    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    logger.error(`[Auth][CID: ${correlationId}] Error in getUserProfile: ${error.message}`);
    next(error);
  }
}

module.exports = {
  loginUser,
  verifyOtp,
  refreshSession,
  logoutUser,
  updateProfile,
  resetQuota,
  getUserProfile
};
