const { db } = require('../storage/postgres.service');
const logger = require('../../utils/logger');

async function logOutbound({ to, messageType, templateName, bodyText, waMessageId, rawPayload }) {
  try {
    await db.query(
      `INSERT INTO whatsapp_messages (direction, phone_number, message_type, template_name, body_text, status, wa_message_id, raw_payload)
       VALUES ('outbound', $1, $2, $3, $4, 'sent', $5, $6)`,
      [to, messageType || null, templateName || null, bodyText || null, waMessageId || null, rawPayload ? JSON.stringify(rawPayload) : null]
    );
  } catch (err) {
    // Message logging must never block the actual send — log and move on.
    logger.error(`[WhatsAppMessageLog] Failed to log outbound message to ${to}: ${err.message}`);
  }
}

async function logInbound({ from, messageType, bodyText, waMessageId, rawPayload }) {
  try {
    await db.query(
      `INSERT INTO whatsapp_messages (direction, phone_number, message_type, body_text, status, wa_message_id, raw_payload)
       VALUES ('inbound', $1, $2, $3, 'received', $4, $5)`,
      [from, messageType || null, bodyText || null, waMessageId || null, rawPayload ? JSON.stringify(rawPayload) : null]
    );
  } catch (err) {
    logger.error(`[WhatsAppMessageLog] Failed to log inbound message from ${from}: ${err.message}`);
  }
}

async function updateStatusByWaMessageId(waMessageId, status) {
  if (!waMessageId) return;
  try {
    await db.query(
      `UPDATE whatsapp_messages SET status = $1, updated_at = NOW() WHERE wa_message_id = $2`,
      [status, waMessageId]
    );
  } catch (err) {
    logger.error(`[WhatsAppMessageLog] Failed to update status for ${waMessageId}: ${err.message}`);
  }
}

async function listMessages({ phone, limit = 50, before } = {}) {
  const conditions = [];
  const params = [];

  if (phone) {
    params.push(`%${phone}%`);
    conditions.push(`phone_number ILIKE $${params.length}`);
  }
  if (before) {
    params.push(before);
    conditions.push(`created_at < $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(Math.min(limit, 200));

  const result = await db.query(
    `SELECT * FROM whatsapp_messages ${whereClause} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return result.rows;
}

module.exports = {
  logOutbound,
  logInbound,
  updateStatusByWaMessageId,
  listMessages
};
