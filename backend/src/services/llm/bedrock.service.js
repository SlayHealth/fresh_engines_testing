const logger = require('../../utils/logger');

// AWS Bedrock provider — talks to the standard bedrock-runtime Converse API using
// a Bedrock API key as a plain Bearer token (no SigV4 / AWS SDK needed). Selected
// by LLM_PROVIDER=bedrock; the OpenRouter clients delegate here when it's set.
//
// Kimi K2.5 is served on Converse (moonshotai.kimi-k2.5) in ap-south-1 (Mumbai),
// us-east-1, and others — NOT on the Anthropic "Mantle" /anthropic/v1/messages
// path. Bare "moonshotai.kimi-k2" is not a valid Bedrock id; k2.5 is the current
// K2-line model (k2-thinking is the reasoning variant). Override the model/region
// via BEDROCK_MODEL_ID / BEDROCK_REGION.
const REGION = process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-south-1';
const DEFAULT_MODEL = process.env.BEDROCK_MODEL_ID || 'moonshotai.kimi-k2.5';

function apiKey() {
  return process.env.BEDROCK_API_KEY;
}

function isConfigured() {
  return !!apiKey();
}

// Converts OpenAI-style chat messages ([{ role, content }]) into the Converse
// shape: a top-level `system` array plus `messages` with per-turn content blocks.
// Converse requires the conversation to start with a user turn and to alternate
// roles, so system turns are hoisted out and consecutive same-role turns merged.
function toConverse(messages) {
  const systemParts = [];
  const convMessages = [];

  for (const m of messages || []) {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    // Converse rejects a blank ContentBlock ("The text field in the ContentBlock
    // object is blank"), so drop empty/whitespace-only turns of ANY role rather
    // than emit { text: '' }. The merge logic and the leading-user placeholder
    // below still keep the remaining turns alternating and user-first.
    if (!text || !text.trim()) continue;
    if (m.role === 'system') {
      systemParts.push(text);
      continue;
    }
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const last = convMessages[convMessages.length - 1];
    if (last && last.role === role) {
      last.content[0].text += '\n\n' + text;
    } else {
      convMessages.push({ role, content: [{ text }] });
    }
  }

  // Converse rejects a conversation that doesn't begin with a user turn.
  if (convMessages.length === 0 || convMessages[0].role !== 'user') {
    convMessages.unshift({ role: 'user', content: [{ text: '.' }] });
  }

  return {
    system: systemParts.length ? [{ text: systemParts.join('\n\n') }] : undefined,
    messages: convMessages
  };
}

// Low-level Converse call. Returns the assistant's plain text (skipping any
// reasoningContent blocks that thinking-variant models emit). Throws on non-2xx
// or timeout so callers can fall back / retry.
async function converse({ messages, model = DEFAULT_MODEL, maxTokens = 1024, temperature }, timeoutMs = 60000) {
  if (!isConfigured()) {
    throw new Error('BEDROCK_API_KEY is missing from environment variables.');
  }

  const { system, messages: convMessages } = toConverse(messages);
  const inferenceConfig = { maxTokens };
  if (typeof temperature === 'number') {
    // Converse temperature is 0..1.
    inferenceConfig.temperature = Math.max(0, Math.min(1, temperature));
  }

  const url = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(model)}/converse`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: convMessages,
        ...(system ? { system } : {}),
        inferenceConfig
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Bedrock Converse error ${res.status}: ${errText.slice(0, 400)}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const blocks = data && data.output && data.output.message && data.output.message.content;
    const textBlock = Array.isArray(blocks) ? blocks.find((b) => typeof b.text === 'string' && b.text.trim()) : null;
    const text = (textBlock ? textBlock.text : '').trim();
    // A reasoning-only response (thinking-variant models) or a truncation with no
    // text block yields ''. Treat that as a failure so callers fall back instead
    // of returning/storing an empty reply — an empty assistant turn would also
    // poison the next request (blank ContentBlock -> ValidationException).
    if (!text) {
      const err = new Error('Bedrock Converse returned no text content (empty or reasoning-only response).');
      err.code = 'LLM_EMPTY_RESPONSE';
      throw err;
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Adapters mirroring the OpenRouter client's public method signatures, so
// those clients can delegate here without any consumer changes. ----

// Mirrors openRouterService.chatCompletion(messages, model) -> string.
async function chatCompletion(messages, model = DEFAULT_MODEL) {
  const useModel = looksLikeBedrockModel(model) ? model : DEFAULT_MODEL;
  logger.info(`[Bedrock] chatCompletion via Converse (model: ${useModel}, region: ${REGION})`);
  return converse({ messages, model: useModel, maxTokens: 2048 }, 45000);
}

// Mirrors openRouterService.extractJSON(prompt, systemInstruction, model) -> object.
// Converse has no response_format=json_object, so JSON is enforced by instruction
// and then parsed (with the same LLM_MALFORMED_JSON contract callers already handle).
async function extractJSON(prompt, systemInstruction, model = DEFAULT_MODEL) {
  const useModel = looksLikeBedrockModel(model) ? model : DEFAULT_MODEL;
  logger.info(`[Bedrock] extractJSON via Converse (model: ${useModel}, region: ${REGION})`);
  const messages = [
    {
      role: 'system',
      content: `${systemInstruction || ''}\n\nRespond with ONLY a single valid JSON object — no markdown, no code fences, no commentary.`
    },
    { role: 'user', content: prompt }
  ];

  const raw = await converse({ messages, model: useModel, maxTokens: 8192, temperature: 0 }, 60000);

  let clean = raw.trim();
  if (clean.startsWith('```json')) clean = clean.replace(/^```json/, '');
  if (clean.startsWith('```')) clean = clean.replace(/^```/, '');
  if (clean.endsWith('```')) clean = clean.replace(/```$/, '');
  clean = clean.trim();

  try {
    return JSON.parse(clean);
  } catch (parseErr) {
    const taggedErr = new Error(`LLM returned malformed JSON: ${parseErr.message}`);
    taggedErr.code = 'LLM_MALFORMED_JSON';
    throw taggedErr;
  }
}

// For llm.service.generateInsight delegation: returns raw assistant text.
// llm.service passes OpenRouter model ids (e.g. "openai/gpt-4o-mini") that are
// meaningless on Bedrock, so those are ignored in favour of the configured model.
async function generateChat(messages, options = {}) {
  const model = looksLikeBedrockModel(options.model) ? options.model : DEFAULT_MODEL;
  // Mirror llm.service's original OpenRouter defaults (temp 0.3 for clinical
  // consistency, 300-token cap) so switching providers doesn't change output
  // length/determinism unless the caller explicitly overrides them.
  return converse({
    messages,
    model,
    maxTokens: options.max_tokens ?? 300,
    temperature: options.temperature ?? 0.3
  }, 60000);
}

function looksLikeBedrockModel(m) {
  // Bedrock ids look like "moonshotai.kimi-k2.5"; OpenRouter ids look like
  // "vendor/model". A slash means it's an OpenRouter id, not a Bedrock one.
  return typeof m === 'string' && m.length > 0 && !m.includes('/');
}

module.exports = {
  isConfigured,
  converse,
  chatCompletion,
  extractJSON,
  generateChat,
  DEFAULT_MODEL,
  REGION
};
