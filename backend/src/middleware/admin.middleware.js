const logger = require('../utils/logger');

// No role/permission system exists on the users table — admin access is a small,
// explicit phone-number allowlist read from the environment, checked on top of the
// normal authenticateToken flow (so admins still log in through the regular phone+OTP
// flow, just with an extra gate on top). Must run after authenticateToken.
function requireAdmin(req, res, next) {
  const allowlist = (process.env.ADMIN_PHONE_NUMBERS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (!req.user || !allowlist.includes(req.user.phone)) {
    logger.warn(`[AdminMiddleware][CID: ${req.correlationId}] Denied admin access for ${req.user?.phone || 'unknown'} on route ${req.originalUrl}`);
    return res.status(403).json({ success: false, error: 'Forbidden: Admin access required.' });
  }

  next();
}

module.exports = { requireAdmin };
