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
  "hero": "A warm, welcoming, and emotional overview greeting the couple by their first names, followed by a wave emoji (e.g. 'Hello, {PartnerA} & {PartnerB} 👋... You both appear well prepared for a healthy married life and future family planning.') — always substitute their actual first names, never a placeholder or example name.",
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

    // Safe, generic copy used whenever the AI narrative couldn't be generated (missing/
    // malformed response, or the API call failing outright). This must never assert
    // anything specific about the couple's actual clinical data — the presentation
    // panels below already show their real, computed results; this text just points
    // there instead of inventing a clinical claim that could be flatly wrong.
    const safeFallback = {
      hero: `Hello ${inviterName} & ${prospectName}! Your detailed results are ready below.`,
      top_insights: [
        "Your personalized summary is being finalized — see the detailed panels below for your specific results.",
        "Each section below reflects your own computed data, not a generic template.",
        "Check the recommendations section for your next steps."
      ],
      body_cards: {
        sugar: "See the detailed panel below for your specific blood sugar results.",
        heart: "See the detailed panel below for your specific cardiovascular results.",
        liver: "See the detailed panel below for your specific liver results.",
        kidney: "See the detailed panel below for your specific kidney results.",
        hormones: "See the detailed panel below for your specific hormonal results.",
        vitamins: "See the detailed panel below for your specific vitamin and micronutrient results."
      },
      recommendations: {
        sleep: "See your personalized recommendations below.",
        diet: "See your personalized recommendations below.",
        exercise: "See your personalized recommendations below.",
        retests: "See your personalized recommendations below."
      },
      closing_message: "Your full results and next steps are shown in detail below."
    };

    try {
      // Use the deepseek-v4-pro model configured on OpenRouter
      const model = process.env.DEEPSEEK_MODEL || 'deepseek/deepseek-chat';
      logger.info(`Sending narrative request using OpenRouter model: ${model}`);

      const response = await openRouter.extractJSON(userPrompt, systemPrompt, model);

      // Track whether any field had to be patched with fallback copy, so a caller can
      // tell "fully AI-generated" apart from "partially degraded" rather than the two
      // being silently indistinguishable.
      let usedFallback = false;
      const pick = (val, fallbackVal) => {
        if (val === undefined || val === null || val === '') {
          usedFallback = true;
          return fallbackVal;
        }
        return val;
      };

      const validatedNarrative = {
        hero: pick(response.hero, safeFallback.hero),
        top_insights: pick(response.top_insights, safeFallback.top_insights),
        body_cards: {
          sugar: pick(response.body_cards?.sugar, safeFallback.body_cards.sugar),
          heart: pick(response.body_cards?.heart, safeFallback.body_cards.heart),
          liver: pick(response.body_cards?.liver, safeFallback.body_cards.liver),
          kidney: pick(response.body_cards?.kidney, safeFallback.body_cards.kidney),
          hormones: pick(response.body_cards?.hormones, safeFallback.body_cards.hormones),
          vitamins: pick(response.body_cards?.vitamins, safeFallback.body_cards.vitamins)
        },
        recommendations: {
          sleep: pick(response.recommendations?.sleep, safeFallback.recommendations.sleep),
          diet: pick(response.recommendations?.diet, safeFallback.recommendations.diet),
          exercise: pick(response.recommendations?.exercise, safeFallback.recommendations.exercise),
          retests: pick(response.recommendations?.retests, safeFallback.recommendations.retests)
        },
        closing_message: pick(response.closing_message, safeFallback.closing_message),
        narrative_generation_failed: usedFallback
      };

      return validatedNarrative;

    } catch (error) {
      logger.error(`DeepSeek narrative generation failed: ${error.message}. Returning safe fallback narrative (flagged, not clinical claims).`);
      return { ...safeFallback, narrative_generation_failed: true };
    }
  }
}

module.exports = new NarrativeService();
