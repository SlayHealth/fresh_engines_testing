const WhatsAppProvider = require('./whatsapp.provider');
const logger = require('../../utils/logger');

// Instantiate default provider. Can extend to select dynamically based on configuration or input.
const defaultProvider = new WhatsAppProvider();

/**
 * Send OTP via the active provider.
 * @param {string} to - Normalised recipient.
 * @param {string} otp - OTP string.
 * @param {Object} options - Provider/correlation options.
 * @returns {Promise<boolean>}
 */
async function sendOTP(to, otp, options = {}) {
  // Currently, we default to the WhatsApp provider.
  return defaultProvider.sendOTP(to, otp, options);
}

module.exports = {
  sendOTP
};
