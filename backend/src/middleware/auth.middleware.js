const { v4: uuidv4 } = require('uuid');
const jwtService = require('../services/auth/jwt.service');
const logger = require('../utils/logger');

/**
 * Express middleware to inject Correlation ID and verify JWT Access Token.
 */
function authenticateToken(req, res, next) {
  // 1. Establish Correlation ID
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  // 2. Extract Authorization Header or Query Parameter
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    logger.warn(`[AuthMiddleware][CID: ${correlationId}] Missing authorization token for route ${req.originalUrl}`);
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Access token is required.' 
    });
  }

  // 3. Verify Access Token
  const decoded = jwtService.verifyAccessToken(token);
  if (!decoded) {
    logger.warn(`[AuthMiddleware][CID: ${correlationId}] Invalid or expired access token for route ${req.originalUrl}`);
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: Invalid or expired access token.',
      code: 'TOKEN_EXPIRED'
    });
  }

  // 4. Attach User Context
  req.user = {
    id: decoded.sub,
    phone: decoded.phone
  };

  logger.info(`[AuthMiddleware][CID: ${correlationId}] User ${req.user.id} authenticated for route ${req.originalUrl}`);
  next();
}

/**
 * Like authenticateToken, but also accepts a match-scoped `shareToken` query param
 * as an alternative credential — used only by routes that mint their own signed,
 * expiring share links (e.g. the PDF route). A valid shareToken bypasses the normal
 * session check entirely (req.user is never set for that path) but only unlocks the
 * one matchId it was minted for; it never grants access to any other route.
 */
function authenticateOrShareToken(req, res, next) {
  const shareToken = req.query.shareToken;
  if (!shareToken) {
    return authenticateToken(req, res, next);
  }

  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  const decoded = jwtService.verifyShareToken(shareToken);
  if (!decoded || decoded.matchId !== req.params.matchId) {
    logger.warn(`[AuthMiddleware][CID: ${correlationId}] Invalid or expired share token for route ${req.originalUrl}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired share link.'
    });
  }

  req.viaShareLink = true;
  logger.info(`[AuthMiddleware][CID: ${correlationId}] Match ${decoded.matchId} accessed via share link for route ${req.originalUrl}`);
  next();
}

module.exports = {
  authenticateToken,
  authenticateOrShareToken
};
