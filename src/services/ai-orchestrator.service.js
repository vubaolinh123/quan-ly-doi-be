import Report from '../models/Report.js';
import { messageBatchService } from './message-batch.service.js';
import { analyzeWithGemini } from './gemini.service.js';
import { sendFacebookTextMessage } from './facebook.service.js';
import { sendApprovalMessage } from './telegram.service.js';
import { BASE_SYSTEM_PROMPT } from '../prompts/system/base-system.prompt.js';
import { buildCategoryClassifierPrompt } from '../prompts/classification/category-classifier.prompt.js';
import { INTAKE_FOLLOWUP_PROMPT } from '../prompts/conversation/intake-followup.prompt.js';
import { ADMIN_SUMMARY_PROMPT } from '../prompts/summary/admin-summary.prompt.js';

let aiCallCounter = 0;

const nextReportCode = async () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seed = Math.floor(Math.random() * 9000) + 1000;

  for (let index = 0; index < 10; index += 1) {
    const code = `FB-${datePrefix}-${seed + index}`;
    const exists = await Report.exists({ reportCode: code });
    if (!exists) {
      return code;
    }
  }

  return `FB-${datePrefix}-${Date.now()}`;
};

const buildPrompt = ({ senderId, messages }) => {
  const transcript = messages
    .map((item, idx) => `${idx + 1}. [${new Date(item.timestamp || item.receivedAt).toISOString()}] ${item.text}`)
    .join('\n');

  return [
    BASE_SYSTEM_PROMPT,
    buildCategoryClassifierPrompt(),
    INTAKE_FOLLOWUP_PROMPT,
    ADMIN_SUMMARY_PROMPT,
    '',
    `senderId: ${senderId}`,
    'batchedMessages:',
    transcript,
    '',
    'JSON output format:',
    '{"intent":"report_crime|ask_info|complaint|other","suggestedCategoryCode":"<CATEGORY_CODE>","confidence":0.0,"missingFields":["field1"],"followupMessage":"...","adminSummary":"..."}'
  ].join('\n');
};

export const processBatch = async ({ senderId, messages }) => {
  if (!messages?.length) {
    return null;
  }

  aiCallCounter += 1;
  const aiPrompt = buildPrompt({ senderId, messages });
  const analysis = await analyzeWithGemini(aiPrompt);
  const reportCode = await nextReportCode();

  const report = await Report.create({
    reportCode,
    channel: 'FACEBOOK',
    content: messages.map((item) => item.text).join('\n'),
    reporterInfo: {
      facebookId: senderId
    },
    categoryCode: analysis.suggestedCategoryCode,
    aiAnalysis: {
      summary: analysis.adminSummary,
      confidence: analysis.confidence,
      extractedSignals: analysis.missingFields
    },
    status: 'pending_approval'
  });

  try {
    const telegramResult = await sendApprovalMessage(report);

    if (telegramResult?.result?.message_id) {
      report.decisionMessageId = String(telegramResult.result.message_id);
      await report.save();
    }
  } catch (error) {
    console.error('[ai-orchestrator] Telegram summary failed', error.message);
  }

  try {
    if (analysis.followupMessage) {
      await sendFacebookTextMessage(senderId, analysis.followupMessage);
    }
  } catch (error) {
    console.error('[ai-orchestrator] Facebook followup failed', error.message);
  }

  return report;
};

messageBatchService.onBatchReady(processBatch);

export const getAiCallCounter = () => aiCallCounter;

export const resetAiCallCounter = () => {
  aiCallCounter = 0;
};
