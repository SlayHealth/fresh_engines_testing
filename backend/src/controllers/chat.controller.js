const { db } = require('../services/storage/postgres.service');
const openRouter = require('../services/llm/openrouter.service');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Only reached if the LLM call itself fails (no API key, network error,
// malformed JSON) — the real suggestions are always generated fresh per
// request by generateSuggestions() below, grounded in this specific
// couple's actual report data and conversation so far, not this static list.
// This is a premarital health platform — every question here is framed
// around what a finding means for the marriage/couple/family-planning
// decision in front of them, not generic "explain my lab result" curiosity
// (that framing is enforced on the LLM-generated path too, see
// generateSuggestions' system instruction below).
const SUGGESTION_FALLBACKS = {
  chronic: [
    "Could this affect our life together long-term?",
    "What should we both work on before the wedding?",
    "Does this change how we should plan having kids?",
    "Is this something to fix before we get married?"
  ],
  mfr: [
    "Does this change when we should plan to have kids?",
    "How can we improve our chances together?",
    "What do our fertility markers mean for starting a family?",
    "Should we act on this before waiting any longer?"
  ],
  usg: [
    "Does this finding affect our future together?",
    "Should we be concerned about this before marriage?",
    "What do these findings mean for our life together?",
    "What should we change together, not just alone?"
  ]
};

function engineNameFor(engineType) {
  if (engineType === 'chronic') return 'Chronic Health Risk and Compatibility';
  if (engineType === 'mfr') return 'Fertility & Fecundability (MFR)';
  if (engineType === 'usg') return 'Abdominal Ultrasound (USG)';
  return 'Premarital Health';
}

function transcriptToText(messages) {
  return messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
}

// The engines' full result objects carry raw double-precision intermediates
// (odds ratios, probability chains, etc.) alongside their properly-rounded
// display fields — e.g. a real bug this guards against: chronic.controller.js
// once merged an unrounded partner_A.pathologyScore like 92.52239170382555
// right next to already-rounded sibling fields. That specific field is now
// fixed at the source, but this whole metadata blob (chronicResult/mfrResult/
// mentalResult, in full) gets JSON.stringify'd straight into every LLM
// prompt below — any other not-yet-rounded intermediate anywhere in any
// engine's response is one lucky "ground this in a real number" LLM
// generation away from becoming the same kind of absurdly-precise, obviously-
// internal value shown to a user. Rounding every number here, right before
// it enters a prompt, closes that off at the boundary instead of chasing
// down every individual field across three separate scoring engines.
function roundNumbersForPrompt(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : value;
  }
  if (Array.isArray(value)) {
    return value.map(roundNumbersForPrompt);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = roundNumbersForPrompt(value[key]);
    }
    return out;
  }
  return value;
}

// Generates the "Suggested Questions" chips shown under the chat — the whole
// point of this call (as opposed to just reusing SUGGESTION_FALLBACKS) is
// that these must be grounded in THIS couple's real report numbers/findings
// and must never repeat a question already asked, so they stay genuinely
// useful (and tap-worthy) as the conversation moves forward rather than
// showing the same 4 generic chips forever.
async function generateSuggestions({ metadata, transcriptMessages, engineType }) {
  const engineName = engineNameFor(engineType);
  const hasTranscript = Array.isArray(transcriptMessages) && transcriptMessages.length > 0;

  const systemInstruction = `You write short "suggested question" chips for SlayHealth, a PREMARITAL health platform's ${engineName} section. These are NOT things the assistant says — they are questions the USER (someone actively planning their marriage, evaluating this finding as part of that decision) could tap to ask, written in their own first-person voice, as a full natural sentence a real person would actually say out loud.

Rules:
1. Ground every question in a REAL, SPECIFIC value or finding from the report JSON you're given — never a generic question like "What does my report mean?" or "Tell me more". Name the actual metric, organ, or number.
2. Every question must be framed around the MARRIAGE/COUPLE/FAMILY decision in front of them, not generic personal health curiosity — this is the single most important rule. Ask what a finding means for the two of them, their marriage timeline, having kids, or what they should do about it together, not what it means for "me" in isolation.
   - Bad (generic personal-health curiosity, no premarital angle): "What does a risk of 4.9 mean for me?"
   - Bad (clinical but still not about the marriage decision): "Is a pathology score of 95 normal?"
   - Good (same finding, framed as a marriage/couple decision): "Should we fix my risk score before the wedding?"
   - Good: "Does my glucose of 118 change how soon we should plan kids?"
3. Write natural, complete, tempting sentences — not clipped keyword fragments. Keep the subject and verb; don't strip words just to save space.
   - Bad (keyword fragment, not a real sentence): "Why 118 glucose?"
   - Good (specific + a real sentence + creates stakes): "Should we be worried my glucose is 118 before we get married?"
4. Aim for roughly 6-14 words — long enough to read as a real question, short enough to sit on one tappable chip.
5. Never invent a data point that isn't present in the JSON provided.
6. ${hasTranscript ? 'A conversation transcript is included below. Every question must be a genuinely NEW angle — never repeat or lightly reword anything already asked in it.' : 'No conversation has happened yet — these are the opening chips, so lead with whatever in the data is most likely to make someone want an explanation immediately.'}
7. When citing a number, round it the way a person would say it out loud (e.g. "118", "92.5") — never repeat a long raw decimal straight from the JSON.
8. Return ONLY valid JSON, no markdown, in exactly this shape: {"suggestions": ["...", "...", "..."]} with exactly 3 items.`;

  const prompt = `Report data:\n${JSON.stringify(roundNumbersForPrompt(metadata), null, 2)}${hasTranscript ? `\n\nConversation so far:\n${transcriptToText(transcriptMessages)}` : ''}`;

  try {
    const result = await openRouter.extractJSON(prompt, systemInstruction);
    const suggestions = Array.isArray(result?.suggestions)
      ? result.suggestions.filter((s) => typeof s === 'string' && s.trim()).slice(0, 3)
      : [];
    if (suggestions.length > 0) return suggestions;
  } catch (err) {
    logger.error(`[Chat] Suggestion generation failed, using static fallback: ${err.message}`);
  }
  return SUGGESTION_FALLBACKS[engineType] || [];
}

async function createChatSession(req, res, next) {
  try {
    const { report_id, partner_report_id, engine_type, context_metadata } = req.body;

    if (!engine_type) {
      return res.status(400).json({ success: false, error: 'engine_type is required' });
    }

    // Check if a session already exists
    const existingRes = await db.query(
      `SELECT id FROM chat_sessions 
       WHERE (report_id = $1 OR report_id IS NULL) 
         AND (partner_report_id = $2 OR partner_report_id IS NULL) 
         AND engine_type = $3
       ORDER BY created_at DESC LIMIT 1`,
      [report_id || null, partner_report_id || null, engine_type]
    );

    const metadataForSuggestions = context_metadata && typeof context_metadata === 'object' ? context_metadata : {};

    if (existingRes.rows.length > 0) {
      const suggestions = await generateSuggestions({ metadata: metadataForSuggestions, transcriptMessages: [], engineType: engine_type });
      return res.status(200).json({
        success: true,
        sessionId: existingRes.rows[0].id,
        message: 'Resumed existing chat session',
        suggestions
      });
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

    const suggestions = await generateSuggestions({ metadata: metadataForSuggestions, transcriptMessages: [], engineType: engine_type });

    res.status(201).json({
      success: true,
      sessionId,
      message: 'Chat session initialized successfully',
      suggestions
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
    const session = sessionRes.rows[0];
    let metadata = {};
    try {
      metadata = JSON.parse(session.context_metadata || '{}');
    } catch (e) {
      metadata = {};
    }

    const messagesRes = await db.query(
      'SELECT role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY id ASC',
      [sessionId]
    );

    // Reopening a session with real history should suggest genuinely NEW
    // questions, grounded in what's already been asked — not the same
    // opening chips every time the drawer is reopened.
    const suggestions = await generateSuggestions({
      metadata,
      transcriptMessages: messagesRes.rows,
      engineType: session.engine_type
    });

    res.json({
      success: true,
      messages: messagesRes.rows,
      suggestions
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
    const engineName = engineNameFor(engineType);

    const systemPrompt = `You are a friendly, highly empathetic, and human-like premarital health counselor for SlayHealth, specializing in explaining results for the ${engineName} engine. You are talking to a couple (or an individual) planning their life together.

Your goal is to explain clinical findings to them in a warm, conversational, and highly specific manner, just like a real human counselor sitting across from them.
Here is the client's report and analysis data in JSON format:
${JSON.stringify(roundNumbersForPrompt(metadata), null, 2)}

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
8. When citing a number, round it the way a person would say it out loud (e.g. "118", "92.5") — never repeat a long raw decimal straight from the JSON.

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

    // 8. Refresh the suggested-question chips so they build on what was just
    // discussed instead of showing the same static list all conversation
    // long — grounded in the real report data plus this exchange.
    const suggestions = await generateSuggestions({
      metadata,
      transcriptMessages: [...slidingWindow, { role: 'assistant', content: reply }],
      engineType
    });

    // 9. Return response
    res.json({
      success: true,
      reply,
      suggestions
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
