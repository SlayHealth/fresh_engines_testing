const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const redis = require('../storage/redis.service');
const { db } = require('../storage/postgres.service');
const logger = require('../../utils/logger');

// Expiry and Lockout durations
const OTP_EXPIRY_MINUTES = 5;
const LOCKOUT_SECONDS = 900; // 15 minutes
const MINUTE_LIMIT = 3;
const HOUR_LIMIT = 5;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Normalize phone numbers to E.164 format.
 * @param {string} phone 
 * @returns {string} E.164 phone number
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let clean = phone.replace(/[\s\-\(\)]/g, ''); // strip spaces, dashes, parentheses
  
  if (clean.startsWith('+')) {
    return '+' + clean.replace(/\D/g, '');
  }
  // Default to +91 (India) if exactly 10 digits
  if (/^\d{10}$/.test(clean)) {
    return '+91' + clean;
  }
  // If it starts with 91 (India country code) and is 12 digits
  if (clean.startsWith('91') && clean.length === 12) {
    return '+' + clean;
  }
  return '+' + clean.replace(/\D/g, '');
}

/**
 * Generate a cryptographically secure 6-digit OTP.
 * @returns {string} 6-digit OTP
 */
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Check rate limit and lockout state in Redis.
 * @param {string} phone - Normalized E.164 phone.
 * @returns {Promise<Object>} { allowed: boolean, reason?: string }
 */
async function checkRateLimit(phone) {
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return { allowed: true };
  }
  if (!redis) {
    // If Redis is down/unavailable, fail open or closed depending on requirements.
    // For local resilience, we log a warning and allow.
    logger.warn('[OTP Service] Redis is unavailable. Skipping rate limit check.');
    return { allowed: true };
  }

  const lockoutKey = `otp:lockout:${phone}`;
  const minKey = `otp:limit:min:${phone}`;
  const hourKey = `otp:limit:hour:${phone}`;

  // 1. Check Lockout
  const isLocked = await redis.get(lockoutKey);
  if (isLocked) {
    return { 
      allowed: false, 
      reason: 'Temporary lockout active due to repeated requests. Please try again in 15 minutes.' 
    };
  }

  // 2. Minute Rate Limit (Max 3/min)
  const minCount = await redis.incr(minKey);
  if (minCount === 1) {
    await redis.expire(minKey, 60);
  }
  if (minCount > MINUTE_LIMIT) {
    await redis.set(lockoutKey, '1', { ex: LOCKOUT_SECONDS });
    return { 
      allowed: false, 
      reason: `Too many requests. Max ${MINUTE_LIMIT} OTP requests per minute. Locked for 15 minutes.` 
    };
  }

  // 3. Hour Rate Limit (Max 5/hour)
  const hourCount = await redis.incr(hourKey);
  if (hourCount === 1) {
    await redis.expire(hourKey, 3600);
  }
  if (hourCount > HOUR_LIMIT) {
    await redis.set(lockoutKey, '1', { ex: LOCKOUT_SECONDS });
    return { 
      allowed: false, 
      reason: `Too many requests. Max ${HOUR_LIMIT} OTP requests per hour. Locked for 15 minutes.` 
    };
  }

  return { allowed: true };
}

/**
 * Create a new OTP request, invalidating any previous active OTPs.
 * @param {string} phone - Normalized E.164 phone.
 * @param {string} purpose - Purpose, defaults to 'login'.
 * @param {string} correlationId - Debug trace ID.
 * @returns {Promise<string>} Plaintext OTP
 */
async function createOTPRequest(phone, purpose = 'login', correlationId = 'N/A') {
  const otp = generateOTP();
  const saltRounds = 10;
  const otpHash = await bcrypt.hash(otp, saltRounds);

  logger.info(`[OTP Service][CID: ${correlationId}] Invalidating previous active OTPs for ${phone}`);
  // Invalidate previous active OTPs
  await db.query(
    `UPDATE otp_requests SET used_at = NOW() WHERE phone = $1 AND used_at IS NULL`,
    [phone]
  );

  const id = uuidv4();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  logger.info(`[OTP Service][CID: ${correlationId}] Storing hashed OTP in DB for ${phone}. Expiry: ${expiresAt.toISOString()}`);
  await db.query(
    `INSERT INTO otp_requests (id, phone, otp_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, phone, otpHash, purpose, expiresAt]
  );

  return otp;
}

/**
 * Verify OTP code against the latest unverified request.
 * @param {string} phone - Normalized E.164 phone.
 * @param {string} otp - Plaintext OTP.
 * @param {string} purpose - Purpose, defaults to 'login'.
 * @param {string} correlationId - Debug trace ID.
 * @returns {Promise<Object>} { verified: boolean, reason?: string }
 */
async function verifyOTPRequest(phone, otp, purpose = 'login', correlationId = 'N/A') {
  if (redis && process.env.DISABLE_RATE_LIMIT !== 'true') {
    const lockoutKey = `otp:lockout:${phone}`;
    const isLocked = await redis.get(lockoutKey);
    if (isLocked) {
      return { verified: false, reason: 'Phone number is locked. Please wait before trying again.' };
    }
  }

  // Find latest active OTP for this phone
  const otpRes = await db.query(
    `SELECT * FROM otp_requests 
     WHERE phone = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose]
  );

  if (otpRes.rows.length === 0) {
    logger.warn(`[OTP Service][CID: ${correlationId}] No active, unexpired OTP found for ${phone}`);
    return { verified: false, reason: 'Invalid or expired OTP code.' };
  }

  const otpRecord = otpRes.rows[0];

  // Compare hashed OTP
  const isMatch = await bcrypt.compare(otp, otpRecord.otp_hash);

  if (!isMatch) {
    // Increment verification failure attempts in Redis
    let attempts = 1;
    if (redis) {
      const attemptsKey = `otp:attempts:${phone}`;
      attempts = await redis.incr(attemptsKey);
      if (attempts === 1) {
        await redis.expire(attemptsKey, OTP_EXPIRY_MINUTES * 60);
      }
      
      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        logger.warn(`[OTP Service][CID: ${correlationId}] Max verification attempts (${MAX_VERIFY_ATTEMPTS}) reached for ${phone}. Locking.`);
        // Invalidate OTP in DB
        await db.query(
          `UPDATE otp_requests SET used_at = NOW() WHERE id = $1`,
          [otpRecord.id]
        );
        // Lockout phone in Redis
        await redis.set(`otp:lockout:${phone}`, '1', { ex: LOCKOUT_SECONDS });
        return { 
          verified: false, 
          reason: 'Too many invalid attempts. Your number has been locked for 15 minutes.' 
        };
      }
    }

    // Increment attempts count in database as well
    await db.query(
      `UPDATE otp_requests SET attempts = attempts + 1 WHERE id = $1`,
      [otpRecord.id]
    );

    logger.warn(`[OTP Service][CID: ${correlationId}] Verification failed for ${phone}. Attempts: ${attempts}`);
    return { verified: false, reason: `Incorrect OTP. ${MAX_VERIFY_ATTEMPTS - attempts} attempts remaining.` };
  }

  // Mark OTP as used
  await db.query(
    `UPDATE otp_requests SET used_at = NOW() WHERE id = $1`,
    [otpRecord.id]
  );

  // Clear verification attempts on successful login
  if (redis) {
    await redis.del(`otp:attempts:${phone}`);
  }

  logger.info(`[OTP Service][CID: ${correlationId}] OTP successfully verified for ${phone}`);
  return { verified: true };
}

module.exports = {
  normalizePhone,
  generateOTP,
  checkRateLimit,
  createOTPRequest,
  verifyOTPRequest
};
