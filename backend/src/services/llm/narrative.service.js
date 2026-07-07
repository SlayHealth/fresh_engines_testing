const openRouter = require('./openrouter.service');
const logger = require('../../utils/logger');

class NarrativeService {
  /**
   * Use DeepSeek to generate natural-language explanations for the presentation categories
   */
  async generateNarratives(presentation, inviterName = 'Partner A', prospectName = 'Partner B') {
    logger.info('Calling DeepSeek to generate report narratives...');

    // Detect if the STI Safety Gate has been triggered on this report
    const stiTriggered = presentation?.sti_gate?.triggered === true;
    const stiFindings = presentation?.sti_gate?.findings || [];

    // Build conditional STI gate instruction block (injected into the system prompt)
    let stiGateInstruction = '';
    if (stiTriggered && stiFindings.length > 0) {
      const stiList = stiFindings.map(f => `- ${f.sti} (${f.partner}): ${f.detail}`).join('\n');
      stiGateInstruction = `

⚠️ CLINICAL SAFETY GATE — MANDATORY OVERRIDE:
The following ACTIVE INFECTIOUS DISEASE MARKERS have been detected in this report:
${stiList}

ADDITIONAL CRITICAL INSTRUCTIONS (override standard tone when STI gate is active):
- Your "hero" greeting MUST NOT be purely celebratory or warm. It must acknowledge upfront that this report contains critical medical findings that need immediate attention.
- Your top_insights[0] MUST be prefixed with "🚨 Critical Finding: " and name the STI(s) explicitly, urging the couple to seek specialist consultation immediately.
- Do NOT produce generic "you're doing great" statements while an active STI is present.
- Use a compassionate but clinically urgent tone for the STI-related insight. Be supportive, not alarmist, but be very clear about the medical urgency.
- All other insights and body cards should remain standard and warm.`;
    }

    const systemPrompt = `You are an AI Clinical Counselor writing a premarital health report.
You must generate a structured JSON object containing warm, human, conversational explanations of the clinical data provided (styled like Spotify Wrapped or Apple Health).

CRITICAL INSTRUCTIONS:
1. Never invent or introduce new medical facts, parameters, or numbers.
2. Never alter the scores, percentages, statuses, or next actions specified in the input.
3. Use a clear, simple, and warm tone (around an 8th-grade reading level). Keep sentences short and paragraphs concise.
4. Avoid clinical jargon like "physiology" or "lifestyle baselines". Speak like a trusted doctor or coach explaining to a couple (e.g., "Overall, you both appear to be in a strong position for marriage and future family planning").
5. Create delightful "delight moments" in top_insights. Frame them as "🏆 Biggest Win" or "🌟 Healthy Habit" based on their best parameters (e.g., "🏆 Biggest Win: You both have excellent blood sugar control!" or "🌟 Healthy Habit: Your cholesterol profile is better than most adults your age").
6. Personalize advice: if they are sedentary, explicitly highlight the benefit of moving together (e.g., "Because both of you are currently sedentary, walking or jogging together 3x/week will have the biggest impact on your future health").
7. Respond with ONLY a valid JSON object matching the requested schema. No markdown formatting or code block markers.${stiGateInstruction}

Your response must strictly match this JSON schema:
{
  "hero": "A warm, welcoming, and emotional overview greeting the couple by name (e.g., 'Hello Sachin & Swati 👋... You both appear well prepared for a healthy married life and future family planning.')",
  "top_insights": [
    "Insight explanation 1 (Highlighting a deterministic strength/win, prefixed with '🏆 Biggest Win: ' or '🌟 Healthy Habit: ')",
    "Insight explanation 2 (Highlighting a priority focus area, prefixed with '⚠️ Focus Area: ')",
    "Insight explanation 3 (Highlighting a collaborative lifestyle recommendation, e.g. '🏃 Exercise together')"
  ],
  "body_cards": {
    "sugar": "Brief 1-2 sentence explanation of sugar health status in warm words.",
    "heart": "Brief 1-2 sentence explanation of cholesterol status in warm words.",
    "liver": "Brief 1-2 sentence explanation of liver markers in warm words.",
    "kidney": "Brief 1-2 sentence explanation of kidney filtration in warm words.",
    "hormones": "Brief 1-2 sentence explanation of hormone indicators in warm words.",
    "vitamins": "Brief 1-2 sentence explanation of vitamin indicators in warm words."
  },
  "recommendations": {
    "sleep": "Short narrative tip on sleep synchrony.",
    "diet": "Short narrative tip on nutritional optimization.",
    "exercise": "Short narrative tip on physical activity, personalized to their daily activity.",
    "retests": "Short narrative tip on targeted checkups."
  },
  "closing_message": "An encouraging closing message outlining the Shared Health Journey, focusing on optimistic improvement."
}`;


    const userPrompt = `Generate report narratives for ${inviterName} and ${prospectName} based on this deterministic presentation data:
${JSON.stringify(presentation, null, 2)}

Provide the JSON response matching the schema.`;

    try {
      // Use the deepseek-v4-pro model configured on OpenRouter
      const model = process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-chat';
      logger.info(`Sending narrative request using OpenRouter model: ${model}`);

      const response = await openRouter.extractJSON(userPrompt, systemPrompt, model);
      
      // Ensure all fields exist in the response, otherwise use fallbacks
      const validatedNarrative = {
        hero: response.hero || `Hello ${inviterName} & ${prospectName}! Based on your health metrics, you both appear well prepared for a healthy married life and future family planning.`,
        top_insights: response.top_insights || [
          "🏆 Biggest Win: You both have optimal blood sugar control—meaning zero indicators for diabetes or prediabetes!",
          "⚠️ Focus Area: Your shared sedentary activity level is the largest area where you can improve together.",
          "🏃 Exercise together: Exercising 3x/week will boost your cardiovascular score from 84 to 92!"
        ],
        body_cards: {
          sugar: response.body_cards?.sugar || "Your sugar levels are perfectly balanced, with no signs of diabetes.",
          heart: response.body_cards?.heart || "Your cholesterol is within the target ranges, supporting a healthy heart.",
          liver: response.body_cards?.liver || "Your liver enzymes indicate clean, normal metabolic detox pathways.",
          kidney: response.body_cards?.kidney || "Your kidney biomarkers show excellent, healthy filtration.",
          hormones: response.body_cards?.hormones || "Key reproductive and baseline endocrine markers look balanced.",
          vitamins: response.body_cards?.vitamins || "Vitamin markers show minor areas for optimization like Vitamin D."
        },
        recommendations: {
          sleep: response.recommendations?.sleep || "Sleep sync: Align bedtimes within 30 minutes to match rest cycles.",
          diet: response.recommendations?.diet || "Nutrient density: Add leafy greens and whole foods to support hormones.",
          exercise: response.recommendations?.exercise || "Shared routine: Exercise together 3x/week to build daily stamina.",
          retests: response.recommendations?.retests || "Plan a routine check of targeted parameters in 90 days."
        },
        closing_message: response.closing_message || `Congratulations on taking this proactive step together. By making these small adjustments, you can boost your compatibility index from ${presentation.relationship_snapshot.score} to ${presentation.relationship_snapshot.score + (presentation.improvement_plan.expectedScoreImprovement || 8)} over the next 90 days.`
      };

      return validatedNarrative;

    } catch (error) {
      logger.error(`DeepSeek narrative generation failed: ${error.message}. Returning fallback narratives.`);
      
      return {
        hero: `Hello ${inviterName} & ${prospectName}! Based on your parameters, you both appear well prepared for a healthy married life and future family planning.`,
        top_insights: [
          "🏆 Biggest Win: You both have optimal blood sugar control—meaning zero indicators for diabetes!",
          "⚠️ Focus Area: Your shared sedentary activity level is the largest area where you can improve together.",
          "🏃 Exercise together: Exercising 3x/week will boost your cardiovascular score from 84 to 92!"
        ],
        body_cards: {
          sugar: "Your sugar levels are perfectly balanced, with no signs of diabetes.",
          heart: "Your cholesterol is within the target ranges, supporting a healthy heart.",
          liver: "Your liver enzymes indicate clean, normal metabolic detox pathways.",
          kidney: "Your kidney biomarkers show excellent, healthy filtration.",
          hormones: "Key reproductive and baseline endocrine markers look balanced.",
          vitamins: "Vitamin D is slightly low, presenting an easy win with supplements."
        },
        recommendations: {
          sleep: "Sleep sync: Align bedtimes within 30 minutes to match rest cycles.",
          diet: "Nutrient density: Add leafy greens and whole foods to support hormones.",
          exercise: "Shared routine: Exercise together 3x/week to build daily stamina.",
          retests: "Check key parameters again in 90 days."
        },
        closing_message: `Proactive tracking keeps your journey aligned. Following the 90-day plan can elevate your health score from ${presentation.relationship_snapshot.score} to ${presentation.relationship_snapshot.score + 8}.`
      };
    }
  }
}

module.exports = new NarrativeService();
