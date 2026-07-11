const axios = require('axios');
const NotificationProvider = require('./notification.provider');
const logger = require('../../utils/logger');
const messageLog = require('./whatsappMessageLog.service');

class WhatsAppProvider extends NotificationProvider {
  constructor() {
    super();
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'slay_otp_authentication';
    this.supportNumber = process.env.WHATSAPP_SUPPORT_NUMBER || '+91 92172 46727';
  }

  /**
   * Send OTP via WhatsApp Cloud API.
   * @param {string} to - Normalized phone number in E.164 format.
   * @param {string} otp - Cryptographically secure OTP.
   * @param {Object} options - Custom options (e.g. correlationId)
   * @returns {Promise<boolean>}
   */
  async sendOTP(to, otp, options = {}) {
    const correlationId = options.correlationId || 'N/A';
    
    if (!this.phoneNumberId || !this.accessToken) {
      const errorMsg = 'WhatsApp credentials missing (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)';
      logger.error(`[WhatsAppProvider][CID: ${correlationId}] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const url = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "template",
      template: {
        name: this.templateName,
        language: {
          code: "en_US"
        },
        components: [
          {
            "type": "body",
            "parameters": [
              {
                "type": "text",
                "text": otp
              },
              {
                "type": "text",
                "text": this.supportNumber
              }
            ]
          },
          {
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [
              {
                "type": "text",
                "text": otp
              }
            ]
          }
        ]
      }
    };

    logger.info(`[WhatsAppProvider][CID: ${correlationId}] Sending OTP template '${this.templateName}' to ${to}`);

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && (response.data.messages || response.data.success)) {
        const waMessageId = response.data.messages ? response.data.messages[0].id : null;
        logger.info(`[WhatsAppProvider][CID: ${correlationId}] OTP sent successfully to ${to}. Message ID: ${waMessageId || 'N/A'}`);
        // The live OTP itself must not linger in a readable log table (even admin-only)
        // beyond its 5-minute validity window, so it's redacted from both the summary
        // text and the stored copy of the request payload.
        const redactedPayload = JSON.parse(JSON.stringify(payload));
        redactedPayload.template.components.forEach((c) => {
          c.parameters?.forEach((p) => { if (p.type === 'text') p.text = '[redacted]'; });
        });
        await messageLog.logOutbound({
          to,
          messageType: 'template',
          templateName: this.templateName,
          bodyText: 'OTP authentication code (redacted)',
          waMessageId,
          rawPayload: redactedPayload
        });
        return true;
      } else {
        throw new Error(`Unexpected API response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      const responseData = error.response ? JSON.stringify(error.response.data) : 'No response data';
      logger.error(`[WhatsAppProvider][CID: ${correlationId}] Failed to send OTP to ${to}. Status: ${error.response ? error.response.status : 'N/A'}, Error: ${error.message}, Response: ${responseData}`);
      throw new Error(`WhatsApp delivery failed: ${error.message}. API details: ${responseData}`);
    }
  }
}

module.exports = WhatsAppProvider;
