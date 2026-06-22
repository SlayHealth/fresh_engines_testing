const { db } = require('../services/storage/postgres.service');
const logger = require('../utils/logger');

async function checkMatchQuota(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    
    // If no userId is supplied, let the request proceed (fail-safe / developer testing)
    if (!userId) {
      return next();
    }

    const userRes = await db.query('SELECT runs_used FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }

    const user = userRes.rows[0];
    if (user.runs_used >= 1) {
      return res.status(403).json({
        success: false,
        error: 'Quota exceeded. You have used your 1 free compatibility match run. Please upgrade to Premium.'
      });
    }

    // Increment runs used
    await db.query('UPDATE users SET runs_used = runs_used + 1 WHERE id = $1', [userId]);
    next();
  } catch (error) {
    logger.error(`Error in checkMatchQuota: ${error.message}`);
    next(error);
  }
}

async function checkChatQuota(req, res, next) {
  try {
    const userId = req.headers['x-user-id'] || req.body.userId;
    
    // If no userId is supplied, let the request proceed
    if (!userId) {
      return next();
    }

    const userRes = await db.query('SELECT chats_used FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return next();
    }

    const user = userRes.rows[0];
    if (user.chats_used >= 5) {
      return res.status(403).json({
        success: false,
        error: 'Quota exceeded. You have used your 5 free AI counselor messages. Please upgrade to Premium.'
      });
    }

    // Increment chats used
    await db.query('UPDATE users SET chats_used = chats_used + 1 WHERE id = $1', [userId]);
    next();
  } catch (error) {
    logger.error(`Error in checkChatQuota: ${error.message}`);
    next(error);
  }
}

module.exports = {
  checkMatchQuota,
  checkChatQuota
};
