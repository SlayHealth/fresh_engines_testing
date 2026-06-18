const axios = require('axios');
const logger = require('../../utils/logger');

class OpenRouterService {
  async extractJSON(prompt, systemInstruction) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY is missing from environment variables.");
    }

    try {
      logger.info(`Sending request to OpenRouter (meta-llama/llama-3.3-70b-instruct)`);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'meta-llama/llama-3.3-70b-instruct',
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000', 
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
      
      return JSON.parse(cleanContent.trim());
    } catch (error) {
      logger.error(`OpenRouter API failed: ${error.message}`);
      if (error.response) {
        logger.error(`OpenRouter Error Details: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }
}

module.exports = new OpenRouterService();
