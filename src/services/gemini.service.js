import { GoogleGenerativeAI } from '@google/generative-ai';
import env from '../config/env.js';
import {
  AI_ANALYSIS_SCHEMA,
  createSafeAiFallback,
  validateAiAnalysis
} from '../schemas/ai-analysis.schema.js';

const parseJsonFromModelText = (text) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const getModelClient = () => {
  if (!env.geminiApiKey) {
    return null;
  }
  const client = new GoogleGenerativeAI(env.geminiApiKey);
  return client.getGenerativeModel({ model: env.geminiModel });
};

export const analyzeWithGemini = async (promptText) => {
  if (process.env.E2E_MOCK === 'true') {
    return {
      intent: 'report_crime',
      suggestedCategoryCode: 'TDD',
      confidence: 0.9,
      missingFields: [],
      followupMessage: '',
      adminSummary: 'E2E mock summary: nghi vấn liên quan ma túy, cần xác minh thực địa.',
      noteSummary: 'E2E mock note summary',
      reportAction: 'new_report',
      reportTitle: 'E2E Mock Report Title',
      extractedData: {
        reporterName: 'Nguyễn Văn A',
        reporterBirthYear: 1990,
        reporterIdNumber: '012345678901',
        reporterIdIssuedBy: 'Cục CSQLHC về TTXH',
        reporterIdIssuedDate: '2021-01-01',
        reporterPermanentAddress: 'Phường X, TP Nha Trang',
        reporterCurrentAddress: 'Phường Y, TP Nha Trang',
        suspectName: 'Trần Văn B',
        suspectCurrentAddress: 'Phường Z, TP Nha Trang',
        crimeType: 'Nghi vấn ma túy',
        crimeDescription: 'Tập trung đông người và có dấu hiệu mua bán trái phép chất ma túy',
        evidence: 'Ảnh chụp, video clip',
        recipientAuthority: 'Công an TP Nha Trang'
      },
      documentReady: true,
      currentStep: 'step_7'
    };
  }

  const model = getModelClient();
  if (!model) {
    console.warn('[gemini.service] Missing GEMINI_API_KEY, returning safe fallback');
    return createSafeAiFallback();
  }

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const text = result?.response?.text?.() || '';
    const parsed = parseJsonFromModelText(text);

    if (!parsed || !validateAiAnalysis(parsed)) {
      console.warn('[gemini.service] Invalid model JSON against schema', {
        schema: AI_ANALYSIS_SCHEMA,
        raw: text
      });
      return createSafeAiFallback();
    }

    return parsed;
  } catch (error) {
    console.error('[gemini.service] Gemini call failed', error.message);
    return createSafeAiFallback();
  }
};
