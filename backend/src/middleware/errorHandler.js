const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  logger.error(`[Global Error] ${req.method} ${req.url} - ${err.message}`);
  
  if (err.stack) {
    logger.error(err.stack);
  }

  // Handle specific known error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON payload'
    });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 && process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = errorHandler;
