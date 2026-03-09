import { analyzeMessages } from './gemini.service.js';
import { sendFacebookMessage } from './facebook.service.js';
import { intakeFollowupPrompt } from '../prompts/conversation/intake-followup.prompt.js';
import { formatAdminSummary } from '../prompts/summary/admin-summary.prompt.js';
import Report from '../models/Report.js';

const generateReportCode = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TG-${year}${month}-${rand}`;
};

export const processBatch = async ({ senderId, messages, facebookUserId }) => {
  console.log(`[AIOrchestrator] Processing batch for ${senderId}: ${messages.length} messages`);

  const analysis = await analyzeMessages(messages);

  if (analysis.intent !== 'report' || (analysis.missingFields && analysis.missingFields.length > 0)) {
    const followup = analysis.followupMessage || intakeFollowupPrompt(analysis.missingFields || []);
    await sendFacebookMessage(senderId, followup);
    return null;
  }

  const report = await Report.create({
    reportCode: generateReportCode(),
    channel: 'FACEBOOK',
    content: messages.join('\n'),
    reporterInfo: { facebookId: senderId },
    categoryCode: analysis.suggestedCategoryCode,
    aiAnalysis: {
      summary: analysis.adminSummary,
      confidence: analysis.confidence,
      extractedSignals: []
    },
    status: 'pending_approval'
  });

  const summary = formatAdminSummary(analysis, messages);
  console.log('[AIOrchestrator] Report created:', report.reportCode);
  console.log('[AIOrchestrator] Admin summary for Telegram:', summary);

  return { report, analysis, adminSummary: summary };
};
