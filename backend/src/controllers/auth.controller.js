const { db } = require('../services/storage/postgres.service');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

async function loginUser(req, res, next) {
  try {
    const { phone_number } = req.body;
    if (!phone_number || typeof phone_number !== 'string' || phone_number.trim() === '') {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const cleanPhone = phone_number.trim();
    logger.info(`Login requested for phone number: ${cleanPhone}`);
    
    // For passwordless signup, we request verification.
    // In a real app we'd trigger SMS OTP. For this mock, we pretend OTP was sent.
    res.json({
      success: true,
      message: 'Mock OTP code sent successfully',
      phone_number: cleanPhone
    });
  } catch (error) {
    logger.error(`Error in loginUser: ${error.message}`);
    next(error);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { phone_number, otp } = req.body;
    if (!phone_number || !otp) {
      return res.status(400).json({ success: false, error: 'Phone number and OTP code are required' });
    }

    const cleanPhone = phone_number.trim();
    const cleanOtp = otp.trim();

    // Mock OTP verification rules (any 4-digit code works)
    if (!/^\d{4}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, error: 'Invalid OTP format. Must be a 4-digit code.' });
    }

    logger.info(`Verifying mock OTP for phone number: ${cleanPhone}`);

    // Check if user exists
    let userRes = await db.query('SELECT * FROM users WHERE phone_number = $1', [cleanPhone]);
    let user;

    if (userRes.rows.length === 0) {
      // Register new user
      const userId = uuidv4();
      logger.info(`Registering new user with ID: ${userId} for phone number: ${cleanPhone}`);
      
      const insertRes = await db.query(
        `INSERT INTO users (id, phone_number, runs_used, chats_used)
         VALUES ($1, $2, 0, 0)
         RETURNING *`,
        [userId, cleanPhone]
      );
      user = insertRes.rows[0];
    } else {
      user = userRes.rows[0];
      logger.info(`User logged in with ID: ${user.id}`);
    }

    res.json({
      success: true,
      user,
      message: 'Verification successful'
    });
  } catch (error) {
    logger.error(`Error in verifyOtp: ${error.message}`);
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { 
      id, name, gender, dob, city, 
      activity_level, daily_steps, occupation_style, 
      drinking_habits, smoking_habits, tobacco_habits, sleep_cycle,
      height, weight, waist
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    logger.info(`Updating profile for user ID: ${id}`);

    const result = await db.query(
      `UPDATE users
       SET name = $1, gender = $2, dob = $3, city = $4,
           activity_level = $5, daily_steps = $6, occupation_style = $7,
           drinking_habits = $8, smoking_habits = $9, tobacco_habits = $10, sleep_cycle = $11,
           height = $12, weight = $13, waist = $14
       WHERE id = $15
       RETURNING *`,
      [
        name || null, gender || null, dob || null, city || null,
        activity_level || null, daily_steps || null, occupation_style || null,
        drinking_habits || null, smoking_habits || null, tobacco_habits || null, sleep_cycle || null,
        height ? parseFloat(height) : null,
        weight ? parseFloat(weight) : null,
        waist ? parseFloat(waist) : null,
        id
      ]
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
    logger.error(`Error in updateProfile: ${error.message}`);
    next(error);
  }
}

async function resetQuota(req, res, next) {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    logger.info(`Resetting quota limits for user ID: ${id}`);
    
    const result = await db.query(
      `UPDATE users
       SET runs_used = 0, chats_used = 0
       WHERE id = $1
       RETURNING *`,
      [id]
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
    logger.error(`Error in resetQuota: ${error.message}`);
    next(error);
  }
}

async function getUserProfile(req, res, next) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
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
    logger.error(`Error in getUserProfile: ${error.message}`);
    next(error);
  }
}

module.exports = {
  loginUser,
  verifyOtp,
  updateProfile,
  resetQuota,
  getUserProfile
};
