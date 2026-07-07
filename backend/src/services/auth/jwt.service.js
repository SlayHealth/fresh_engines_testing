const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../storage/postgres.service');
const logger = require('../../utils/logger');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET)) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production — refusing to start with an insecure fallback secret.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_access_secret_key_12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_jwt_refresh_secret_key_12345';

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';

/**
 * Generate a new pair of Access and Refresh tokens.
 * @param {string} userId 
 * @param {string} phone 
 * @returns {Object} { accessToken, refreshToken }
 */
function generateTokens(userId, phone) {
  const accessToken = jwt.sign(
    { sub: userId, phone, type: 'access' },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { sub: userId, phone, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );

  return { accessToken, refreshToken };
}

/**
 * Verify an access token.
 * @param {string} token 
 * @returns {Object} Decoded payload
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (err) {
    logger.debug(`AccessToken verification failed: ${err.message}`);
    return null;
  }
}

/**
 * Verify a refresh token.
 * @param {string} token 
 * @returns {Object} Decoded payload
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (err) {
    logger.debug(`RefreshToken verification failed: ${err.message}`);
    return null;
  }
}

/**
 * Hash refresh token and save user session in Postgres.
 * @param {string} userId 
 * @param {string} refreshToken 
 * @param {string} deviceInfo 
 * @param {string} ipAddress 
 * @param {string} correlationId 
 * @returns {Promise<string>} sessionId
 */
async function saveSession(userId, refreshToken, deviceInfo, ipAddress, correlationId = 'N/A') {
  const sessionId = uuidv4();
  const saltRounds = 10;
  const hash = await bcrypt.hash(refreshToken, saltRounds);

  logger.info(`[JWT Service][CID: ${correlationId}] Saving new session ${sessionId} for user ${userId}`);
  
  await db.query(
    `INSERT INTO user_sessions (id, user_id, refresh_token_hash, device_info, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [sessionId, userId, hash, deviceInfo || null, ipAddress || null]
  );

  return sessionId;
}

/**
 * Find and validate database session matching the plaintext refresh token.
 * @param {string} userId 
 * @param {string} refreshToken 
 * @param {string} correlationId 
 * @returns {Promise<Object|null>} session record
 */
async function findAndValidateSession(userId, refreshToken, correlationId = 'N/A') {
  // Fetch active sessions for this user
  const result = await db.query(
    `SELECT * FROM user_sessions 
     WHERE user_id = $1 AND revoked_at IS NULL AND (created_at + INTERVAL '7 days') > NOW()`,
    [userId]
  );

  for (const session of result.rows) {
    const isMatch = await bcrypt.compare(refreshToken, session.refresh_token_hash);
    if (isMatch) {
      // Update last used timestamp
      await db.query(
        `UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1`,
        [session.id]
      );
      return session;
    }
  }

  logger.warn(`[JWT Service][CID: ${correlationId}] No matching session found or all sessions revoked for user ${userId}`);
  return null;
}

/**
 * Revoke session in Postgres.
 * @param {string} sessionId 
 * @param {string} correlationId 
 */
async function revokeSession(sessionId, correlationId = 'N/A') {
  logger.info(`[JWT Service][CID: ${correlationId}] Revoking session ${sessionId}`);
  await db.query(
    `UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`,
    [sessionId]
  );
}

/**
 * Rotate refresh session (Revokes current session, generates new tokens and session)
 * @param {string} oldSessionId 
 * @param {string} userId 
 * @param {string} phone 
 * @param {string} deviceInfo 
 * @param {string} ipAddress 
 * @param {string} correlationId 
 * @returns {Promise<Object>} { accessToken, refreshToken }
 */
async function rotateSession(oldSessionId, userId, phone, deviceInfo, ipAddress, correlationId = 'N/A') {
  logger.info(`[JWT Service][CID: ${correlationId}] Rotating session. Revoking ${oldSessionId}`);
  
  // Revoke old session
  await revokeSession(oldSessionId, correlationId);
  
  // Generate new tokens
  const tokens = generateTokens(userId, phone);
  
  // Save new session
  await saveSession(userId, tokens.refreshToken, deviceInfo, ipAddress, correlationId);
  
  return tokens;
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  saveSession,
  findAndValidateSession,
  revokeSession,
  rotateSession
};
