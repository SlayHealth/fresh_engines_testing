const { db } = require('../services/storage/postgres.service');
const openRouter = require('../services/llm/openrouter.service');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

async function createChatSession(req, res, next) {
  try {
    const { report_id, partner_report_id, engine_type, context_metadata } = req.body;

    if (!engine_type) {
      return res.status(400).json({ success: false, error: 'engine_type is required' });
    }

    const sessionId = uuidv4();
    const contextMetadataStr = typeof context_metadata === 'object' 
      ? JSON.stringify(context_metadata) 
      : (context_metadata || '{}');

    await db.query(
      `INSERT INTO chat_sessions (id, report_id, partner_report_id, engine_type, context_metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, report_id || null, partner_report_id || null, engine_type, contextMetadataStr]
    );

    res.status(201).json({
      success: true,
      sessionId,
      message: 'Chat session initialized successfully'
    });
  } catch (error) {
    logger.error(`Error creating chat session: ${error.message}`);
    next(error);
  }
}

async function getChatHistory(req, res, next) {
  try {
    const { sessionId } = req.params;

    const sessionRes = await db.query('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chat session not found' });
    }

    const messagesRes = await db.query(
      'SELECT role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY id ASC',
      [sessionId]
    );

    res.json({
      success: true,
      messages: messagesRes.rows
    });
  } catch (error) {
    logger.error(`Error retrieving chat history: ${error.message}`);
    next(error);
  }
}

async function sendChatMessage(req, res, next) {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, error: 'sessionId and a non-empty message string are required' });
    }

    // 1. Verify session exists
    const sessionRes = await db.query('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chat session not found' });
    }

    const session = sessionRes.rows[0];
    const engineType = session.engine_type;
    let metadata = {};
    try {
      metadata = JSON.parse(session.context_metadata || '{}');
    } catch (e) {
      metadata = { raw: session.context_metadata };
    }

    // 2. Save user message to database
    await db.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', message.trim()]
    );

    // 3. Get all past messages in order to construct the sliding window
    const messagesRes = await db.query(
      'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY id ASC',
      [sessionId]
    );

    // 4. Implement sliding window of last 10 messages
    const fullHistory = messagesRes.rows;
    const slidingWindow = fullHistory.slice(-10); // Take last 10 messages

    // 5. Construct the system prompt using the metadata and persona instructions
    let engineName = 'Premarital Health';
    if (engineType === 'chronic') engineName = 'Chronic Health Risk and Compatibility';
    if (engineType === 'mfr') engineName = 'Fertility & Fecundability (MFR)';
    if (engineType === 'usg') engineName = 'Abdominal Ultrasound (USG)';

    const systemPrompt = `You are a friendly, highly empathetic, and human-like premarital health counselor for SlayHealth, specializing in explaining results for the ${engineName} engine. You are talking to a couple (or an individual) planning their life together.

Your goal is to explain clinical findings to them in a warm, conversational, and highly specific manner, just like a real human counselor sitting across from them.
Here is the client's report and analysis data in JSON format:
${JSON.stringify(metadata, null, 2)}

Strict Guidelines for your Persona and Responses:
1. **Always Be Positive but Nuanced Regarding Marriage**: If the users ask "Should we get married?" or anything similar, handle it carefully based on their health:
   - If they are completely healthy (green flags): Enthusiastically say yes!
   - If there are minor issues: Say yes, but gently suggest they work on fixing these minor health tweaks as they plan their marriage.
   - If there are severe/major flaws: Do NOT explicitly say yes or no. Handle it very diplomatically by warmly advising them that they have some significant health challenges to address first, and encourage them to tackle these together as a supportive team before finalizing major life decisions. NEVER advise against marriage.
2. **Human-like & Conversational**: Do NOT sound like an AI. Use natural, everyday language. Avoid generic or vague statements. Reference their specific names, ages, or exact data points from the report naturally.
3. **Specific & Actionable**: Provide specific, actionable next steps based on their exact biomarkers, rather than vague "eat healthy" advice. 
4. **Clear & Plain Language**: Avoid heavy, scary, or complex medical jargon. Explain medical terms simply.
5. **Short & Concise**: Keep your replies brief. Aim for 2 to 3 short, friendly sentences. Do NOT dump the entire report or list out findings unless explicitly asked.
6. **NO EM DASHES ("—")**: Do NOT use the em dash character "—" under any circumstances.
7. Do NOT make up any medical values not present in the JSON.

Please respond to the user's message now, keeping these rules in mind.`;

    // Combine system prompt with the sliding window of messages
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...slidingWindow
    ];

    // 6. Invoke OpenRouter
    logger.info(`Invoking AI Counselor chat completion for session: ${sessionId} using deepseek/deepseek-v4-flash`);
    const reply = await openRouter.chatCompletion(apiMessages);

    // 7. Save assistant's reply to database
    await db.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'assistant', reply]
    );

    // 8. Return response
    res.json({
      success: true,
      reply
    });
  } catch (error) {
    logger.error(`Error in sendChatMessage: ${error.message}`);
    next(error);
  }
}

module.exports = {
  createChatSession,
  getChatHistory,
  sendChatMessage
};
