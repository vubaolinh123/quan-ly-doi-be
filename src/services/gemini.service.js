import env from '../config/env.js';
import { baseSystemPrompt } from '../prompts/system/base-system.prompt.js';
import { categoryClassifierPrompt } from '../prompts/classification/category-classifier.prompt.js';
import { validateAiAnalysis, fallbackAnalysis } from '../schemas/ai-analysis.schema.js';

export const analyzeMessages = async (messages) => {
  if (!env.geminiApiKey) {
    console.log('[GeminiService] No API key, using mock analysis');
    return {
      intent: 'report',
      suggestedCategoryCode: 'KHAC',
      confidence: 0.5,
      missingFields: [],
      followupMessage: null,
      adminSummary: '[Mock] Nội dung tố giác cần xem xét'
    };
  }

  const prompt = categoryClassifierPrompt(messages);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiApiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: baseSystemPrompt }] },
      contents: [{ parts: [{ text: prompt }] }]
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) throw new Error(`Gemini API error: ${resp.status}`);

    const result = await resp.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!validateAiAnalysis(parsed)) {
      console.error('[GeminiService] Schema validation failed, using fallback');
      return fallbackAnalysis;
    }

    return parsed;
  } catch (err) {
    console.error('[GeminiService] Error:', err.message);
    return fallbackAnalysis;
  }
};
