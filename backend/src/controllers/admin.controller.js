const logger = require('../utils/logger');
const whatsappMessageLog = require('../services/notification/whatsappMessageLog.service');

async function listWhatsAppMessages(req, res, next) {
  try {
    const { phone, before } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

    const messages = await whatsappMessageLog.listMessages({ phone, before, limit });
    res.json({ success: true, messages });
  } catch (error) {
    logger.error(`[Admin] Failed to list WhatsApp messages: ${error.message}`);
    next(error);
  }
}

module.exports = {
  listWhatsAppMessages
};
