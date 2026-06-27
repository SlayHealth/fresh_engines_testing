class NotificationProvider {
  /**
   * Send an OTP code to a recipient.
   * @param {string} to - Normalized recipient identifier (phone number or email).
   * @param {string} otp - The generated OTP code.
   * @param {Object} options - Additional options.
   * @returns {Promise<boolean>}
   */
  async sendOTP(to, otp, options = {}) {
    throw new Error("Method 'sendOTP' must be implemented by the provider subclass.");
  }
}

module.exports = NotificationProvider;
