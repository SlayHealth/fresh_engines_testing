const axios = require('axios');
const logger = require('../../utils/logger');

class WhatsAppInviteService {
  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.templateName = process.env.WHATSAPP_INVITE_TEMPLATE_NAME || 'slay_prospect_invite';
  }

  /**
   * Send a prospect invite link via WhatsApp.
   * @param {string} to - Normalised phone number (E.164)
   * @param {string} prospectName - Name of the prospect
   * @param {string} inviterName - Name of the user sending the invite
   * @param {string} inviteToken - Secure random 32-byte token
   * @returns {Promise<string>} - The WhatsApp Message ID if successful
   */
  async sendInvite(to, prospectName, inviterName, inviteToken) {
    if (!this.phoneNumberId || !this.accessToken) {
      const errorMsg = 'WhatsApp credentials missing (WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)';
      logger.error(`[WhatsAppInviteService] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const url = `https://graph.facebook.com/v22.0/${this.phoneNumberId}/messages`;

    const isOtpTemplate = this.templateName === 'slay_otp_authentication';

    const components = isOtpTemplate
      ? [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: inviteToken
              },
              {
                type: "text",
                text: "+91 92172 46727"
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: inviteToken
              }
            ]
          }
        ]
      : [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: prospectName
              },
              {
                type: "text",
                text: inviterName
              },
              {
                type: "text",
                text: `${process.env.APP_URL || 'http://localhost:3000'}/invite/${inviteToken}`
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: inviteToken
              }
            ]
          }
        ];

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "template",
      template: {
        name: this.templateName,
        language: {
          code: this.templateName === 'slay_otp_authentication' ? 'en_US' : 'en'
        },
        components
      }
    };

    logger.info(`[WhatsAppInviteService] Sending invite template '${this.templateName}' to ${to}`);

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.messages && response.data.messages.length > 0) {
        const messageId = response.data.messages[0].id;
        logger.info(`[WhatsAppInviteService] Invite sent successfully. Message ID: ${messageId}`);
        return messageId;
      } else {
        throw new Error(`Unexpected API response: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      const responseData = error.response ? JSON.stringify(error.response.data) : 'No response data';
      logger.error(`[WhatsAppInviteService] Failed to send invite to ${to}. Error: ${error.message}, Response: ${responseData}`);
      throw new Error(`WhatsApp delivery failed: ${error.message}. API details: ${responseData}`);
    }
  }
}

module.exports = new WhatsAppInviteService();
