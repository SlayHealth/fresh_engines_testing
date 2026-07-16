const axios = require('axios');
const logger = require('../../utils/logger');

class OpenRouterService {
  async extractJSON(prompt, systemInstruction, model = 'meta-llama/llama-3.3-70b-instruct') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is missing from environment variables.");
    }

    try {
      logger.info(`Sending request to OpenRouter (model: ${model})`);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'SlayHealth USG Engine',
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60s timeout for LLM
        }
      );

      const content = response.data.choices[0].message.content;
      
      // Clean potential markdown blocks like ```json ... ```
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.replace(/^```json/, '');
      if (cleanContent.startsWith('```')) cleanContent = cleanContent.replace(/^```/, '');
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.replace(/```$/, '');

      try {
        return JSON.parse(cleanContent.trim());
      } catch (parseErr) {
        // WS2-07: tagged distinctly from network/auth failures so callers can
        // retry a malformed-JSON turn (often model non-determinism) without
        // retrying errors a retry can't fix.
        const taggedErr = new Error(`LLM returned malformed JSON: ${parseErr.message}`);
        taggedErr.code = 'LLM_MALFORMED_JSON';
        throw taggedErr;
      }
    } catch (error) {
      logger.error(`OpenRouter API failed: ${error.message}`);
      if (error.response) {
        logger.error(`OpenRouter Error Details: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  async chatCompletion(messages, model = 'deepseek/deepseek-v4-flash') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is missing from environment variables.");
    }

    try {
      logger.info(`Sending chat completion request to OpenRouter model: ${model}`);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model,
          messages: messages
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
            'X-Title': 'SlayHealth AI Counselor',
            'Content-Type': 'application/json'
          },
          timeout: 45000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error(`OpenRouter Chat API failed for model ${model}: ${error.message}`);
      if (model !== 'deepseek/deepseek-chat') {
        logger.info('Attempting fallback to deepseek/deepseek-chat...');
        try {
          return await this.chatCompletion(messages, 'deepseek/deepseek-chat');
        } catch (fallbackError) {
          logger.error(`Fallback failed: ${fallbackError.message}`);
          throw fallbackError;
        }
      }
      throw error;
    }
  }
}

module.exports = new OpenRouterService();
