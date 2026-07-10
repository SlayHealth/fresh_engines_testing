// Use native Node.js fetch (Node 18+)
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

// Using a fast model for real-time inference
const DEFAULT_MODEL = "openai/gpt-4o-mini"; 

const redis = require('./storage/redis.service');

/**
 * Generate a dynamic clinical insight using OpenRouter.
 * Includes a mandatory fallback mechanism and Redis caching.
 * 
 * @param {Array} messages - Array of message objects { role, content }
 * @param {String} fallbackText - Safe static text to return if the LLM fails
 * @param {Object} options - Options (temperature, max_tokens, cacheKey)
 * @returns {String} Generated text or fallback text
 */
async function generateInsight(messages, fallbackText, options = {}) {
  if (!OPENROUTER_API_KEY) {
    console.warn("[LLM Service] No OPENROUTER_API_KEY found, using fallback text.");
    return fallbackText;
  }

  // 1. Check Redis Cache
  if (redis && options.cacheKey) {
    try {
      const cachedResponse = await redis.get(options.cacheKey);
      if (cachedResponse) {
        console.log(`[LLM Service] Cache HIT for key: ${options.cacheKey}`);
        return cachedResponse;
      }
    } catch (err) {
      console.error(`[LLM Service] Redis get error for ${options.cacheKey}:`, err.message);
    }
  }

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://slayhealth.com", // Optional, required by some openrouter providers
        "X-Title": "SlayHealth Compatibility" // Optional
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_MODEL,
        messages: messages,
        temperature: options.temperature ?? 0.3, // Low temp for clinical consistency
        max_tokens: options.max_tokens ?? 300
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM Service] OpenRouter API Error: ${response.status} - ${errorText}`);
      return fallbackText;
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      const generatedText = data.choices[0].message.content.trim();
      
      // 2. Set Redis Cache (TTL: 30 days = 2592000 seconds)
      if (redis && options.cacheKey) {
        try {
          // Fire and forget caching
          redis.setex(options.cacheKey, 2592000, generatedText).catch(e => 
            console.error(`[LLM Service] Redis set error for ${options.cacheKey}:`, e.message)
          );
        } catch (err) {
          console.error(`[LLM Service] Redis set error for ${options.cacheKey}:`, err.message);
        }
      }

      return generatedText;
    } else {
      console.warn("[LLM Service] Unexpected response structure from OpenRouter:", JSON.stringify(data));
      return fallbackText;
    }
  } catch (error) {
    console.error("[LLM Service] Inference failed, using fallback. Error:", error.message);
    return fallbackText;
  }
}

/**
 * Generates structured JSON from the LLM. 
 * Falls back to the provided fallbackObj.
 */
async function generateStructuredInsight(messages, fallbackObj, options = {}) {
  // If cacheKey is provided, check Redis before hitting OpenRouter
  if (redis && options.cacheKey) {
    try {
      const cachedResponse = await redis.get(options.cacheKey);
      if (cachedResponse) {
        console.log(`[LLM Service] JSON Cache HIT for key: ${options.cacheKey}`);
        // Upstash Redis automatically parses JSON if it was stored as an object,
        // but let's be safe and handle stringified vs parsed
        return typeof cachedResponse === 'string' ? JSON.parse(cachedResponse) : cachedResponse;
      }
    } catch (err) {
      console.error(`[LLM Service] Redis JSON get error for ${options.cacheKey}:`, err.message);
    }
  }

  const jsonMessages = [
    ...messages,
    { role: "system", content: "You MUST respond with ONLY a valid JSON object. Do not include markdown formatting like ```json or any conversational text." }
  ];

  // Tags a returned fallback so callers (and anything rendering it to a user) can tell
  // "this is a real AI-generated result" apart from "the AI call failed/was malformed
  // and this is safe static filler" — previously indistinguishable, which let fallback
  // content (sometimes containing specific clinical-sounding claims) pass as real output.
  const asFallback = (obj) => (obj && typeof obj === 'object' && !Array.isArray(obj))
    ? { ...obj, _llm_fallback: true }
    : obj;

  // We don't pass the cacheKey down to generateInsight here because we want to cache
  // the parsed JSON object directly in generateStructuredInsight instead of the raw text string.
  const rawText = await generateInsight(jsonMessages, null, { ...options, cacheKey: null });
  if (!rawText) return asFallback(fallbackObj);

  try {
    // Strip markdown blocks if the LLM accidentally included them
    const cleanedText = rawText.replace(/```json\n?|```/g, '').trim();
    const parsedObj = JSON.parse(cleanedText);

    // Set JSON Cache (TTL: 30 days)
    if (redis && options.cacheKey) {
      try {
        redis.setex(options.cacheKey, 2592000, parsedObj).catch(e =>
          console.error(`[LLM Service] Redis JSON set error for ${options.cacheKey}:`, e.message)
        );
      } catch (err) {
        console.error(`[LLM Service] Redis JSON set error for ${options.cacheKey}:`, err.message);
      }
    }

    return parsedObj;
  } catch (e) {
    console.error("[LLM Service] Failed to parse JSON response:", rawText);
    return asFallback(fallbackObj);
  }
}

module.exports = {
  generateInsight,
  generateStructuredInsight
};
