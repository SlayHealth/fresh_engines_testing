require('dotenv').config();
const { initDB, db } = require('../../src/services/storage/postgres.service');
const otpService = require('../../src/services/auth/otp.service');
const jwtService = require('../../src/services/auth/jwt.service');
const logger = require('../../src/utils/logger');
const assert = require('assert');

async function runTests() {
  logger.info("Initializing PostgreSQL schema for tests...");
  await initDB();

  logger.info("Running Unit Tests...");

  // 1. Phone Normalization Tests
  logger.info("Testing Phone Normalization...");
  assert.strictEqual(otpService.normalizePhone('+919876543210'), '+919876543210');
  assert.strictEqual(otpService.normalizePhone('9876543210'), '+919876543210');
  assert.strictEqual(otpService.normalizePhone('919876543210'), '+919876543210');
  assert.strictEqual(otpService.normalizePhone('+1 (555) 123-4567'), '+15551234567');
  logger.info("✅ Phone normalization tests passed!");

  // 2. OTP Generation Tests
  logger.info("Testing OTP Generation...");
  const otp1 = otpService.generateOTP();
  const otp2 = otpService.generateOTP();
  assert.strictEqual(otp1.length, 6);
  assert.strictEqual(/^\d{6}$/.test(otp1), true);
  assert.notStrictEqual(otp1, otp2); // Very likely to be unique
  logger.info("✅ OTP generation tests passed!");

  // 3. OTP DB Invalidation & Inactive OTP Verification Tests
  logger.info("Testing OTP Storage & Invalidation...");
  const testPhone = "+919999999999";
  
  // Create first OTP request
  const firstOtp = await otpService.createOTPRequest(testPhone, 'login', 'TEST_CID_1');
  
  // Create second OTP request (should invalidate the first one)
  const secondOtp = await otpService.createOTPRequest(testPhone, 'login', 'TEST_CID_2');

  // Verify first OTP fails (should have been marked as used/invalidated)
  const firstVerification = await otpService.verifyOTPRequest(testPhone, firstOtp, 'login', 'TEST_CID_3');
  assert.strictEqual(firstVerification.verified, false);
  logger.info("✅ Verified: Previous OTPs are successfully invalidated.");

  // Verify second OTP succeeds
  const secondVerification = await otpService.verifyOTPRequest(testPhone, secondOtp, 'login', 'TEST_CID_4');
  assert.strictEqual(secondVerification.verified, true);
  logger.info("✅ Verified: Active OTP verifies successfully.");

  // 4. JWT & Session Tests
  logger.info("Testing JWT Generation & PostgreSQL Session Management...");
  const testUserId = "test-user-uuid-12345";
  
  // Insert test user to satisfy foreign key constraints
  await db.query(
    `INSERT INTO users (id, phone_number) 
     VALUES ($1, $2)
     ON CONFLICT (phone_number) DO UPDATE SET phone_number = EXCLUDED.phone_number`,
    [testUserId, testPhone]
  );

  const tokens = jwtService.generateTokens(testUserId, testPhone);
  
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);

  // Verify signature of access token
  const decodedAccess = jwtService.verifyAccessToken(tokens.accessToken);
  assert.strictEqual(decodedAccess.sub, testUserId);
  assert.strictEqual(decodedAccess.phone, testPhone);
  assert.strictEqual(decodedAccess.type, 'access');

  // Save session in Postgres
  const sessionId = await jwtService.saveSession(
    testUserId, 
    tokens.refreshToken, 
    'Mozilla/5.0 (Test Device)', 
    '127.0.0.1', 
    'TEST_CID_5'
  );

  // Find and validate session using plaintext token
  const session = await jwtService.findAndValidateSession(testUserId, tokens.refreshToken, 'TEST_CID_6');
  assert.ok(session);
  assert.strictEqual(session.id, sessionId);

  // Rotate Session
  const rotatedTokens = await jwtService.rotateSession(
    session.id,
    testUserId,
    testPhone,
    'Mozilla/5.0 (New Device)',
    '127.0.0.1',
    'TEST_CID_7'
  );

  assert.ok(rotatedTokens.accessToken);
  assert.ok(rotatedTokens.refreshToken);

  // Verify old session is revoked
  const oldSessionCheck = await db.query(
    'SELECT revoked_at FROM user_sessions WHERE id = $1',
    [sessionId]
  );
  assert.ok(oldSessionCheck.rows[0].revoked_at !== null);
  logger.info("✅ Verified: Session rotation revokes the old session correctly.");

  // Revoke new session
  const newSession = await jwtService.findAndValidateSession(testUserId, rotatedTokens.refreshToken, 'TEST_CID_8');
  assert.ok(newSession);
  await jwtService.revokeSession(newSession.id, 'TEST_CID_9');
  
  // Verify revoked session is invalid
  const revokedSessionCheck = await jwtService.findAndValidateSession(testUserId, rotatedTokens.refreshToken, 'TEST_CID_10');
  assert.strictEqual(revokedSessionCheck, null);
  // Clean up test user
  await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  logger.info("✅ Verified: Test user cleanup successful.");

  logger.info("🚀 ALL TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}

runTests().catch((err) => {
  logger.error("❌ Test run failed with error: ", err);
  process.exit(1);
});
