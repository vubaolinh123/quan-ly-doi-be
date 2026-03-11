import Report from '../models/Report.js';
import ConversationMessage from '../models/ConversationMessage.js';
import { messageBatchService } from './message-batch.service.js';
import { analyzeWithGemini } from './gemini.service.js';
import { sendFacebookTextMessage } from './facebook.service.js';
import { sendApprovalMessage } from './telegram.service.js';
import { BASE_SYSTEM_PROMPT } from '../prompts/system/base-system.prompt.js';
import { buildCategoryClassifierPrompt } from '../prompts/classification/category-classifier.prompt.js';
import { INTAKE_FOLLOWUP_PROMPT } from '../prompts/conversation/intake-followup.prompt.js';
import { ADMIN_SUMMARY_PROMPT } from '../prompts/summary/admin-summary.prompt.js';

let aiCallCounter = 0;

// ── Config ────────────────────────────────────────────────────────────────────
const REPORT_INTENT        = 'report_crime';
const CONFIDENCE_THRESHOLD = 0.5;   // minimum AI confidence to persist a Report

/**
 * How many recent conversation messages to fetch per sender.
 * Fetching more gives the AI better context but increases prompt size.
 *   - 15 covers roughly 3-5 batch windows of back-and-forth, which is enough
 *     for most conversations without blowing the context window.
 */
const HISTORY_LIMIT = 15;

// ── Helpers ───────────────────────────────────────────────────────────────────

const nextReportCode = async () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seed = Math.floor(Math.random() * 9000) + 1000;

  for (let index = 0; index < 10; index += 1) {
    const code = `FB-${datePrefix}-${seed + index}`;
    const exists = await Report.exists({ reportCode: code });
    if (!exists) return code;
  }

  return `FB-${datePrefix}-${Date.now()}`;
};

/**
 * Retrieve the N most recent conversation messages for a sender, oldest first.
 * Returns an empty array when the sender has no prior history.
 */
const getConversationHistory = async (senderId) => {
  const docs = await ConversationMessage
    .find({ senderId })
    .sort({ createdAt: -1 })   // newest first so we can limit efficiently
    .limit(HISTORY_LIMIT)
    .lean();

  return docs.reverse(); // oldest → newest so the AI reads them in order
};

/**
 * Find an existing pending Report for this Facebook sender.
 * Returns null if none found.
 */
const findPendingReportForSender = async (senderId) => {
  return Report.findOne({
    'reporterInfo.facebookId': senderId,
    status: 'pending_approval'
  }).lean();
};

/**
 * Persist the current inbound batch and (optionally) the outbound AI reply
 * to the conversation log so future batches can read them as history.
 */
const saveToHistory = async (senderId, messages, outboundText) => {
  try {
    const inbound = messages.map((m) => ({
      senderId,
      text: m.text,
      direction: 'inbound',
      createdAt: new Date(m.timestamp || m.receivedAt || Date.now())
    }));

    if (inbound.length) {
      await ConversationMessage.insertMany(inbound, { ordered: false });
    }

    if (outboundText) {
      await ConversationMessage.create({ senderId, text: outboundText, direction: 'outbound' });
    }
  } catch (err) {
    // Non-fatal — history saves failing should not break the main flow
    console.error('[ai-orchestrator] saveToHistory failed:', err.message);
  }
};

/**
 * Build the full AI prompt.
 *
 * Structure:
 *   1. System-level instructions (persona, task, category codes, …)
 *   2. ── LỊCH SỬ HỘI THOẠI ── (if any prior messages exist for this sender)
 *      Each line: [ISO timestamp] USER|AI: <text>
 *   3. ── TIN NHẮN MỚI CẦN PHÂN TÍCH ──
 *      Numbered list of messages in the current batch
 *   4. JSON output format spec
 *
 * Including history prevents the AI from repeating follow-up questions that
 * were already asked in an earlier batch window.
 */
const buildPrompt = ({ senderId, messages, history }) => {
  // ── Current batch transcript ──────────────────────────────────────────────
  const transcript = messages
    .map((m, idx) =>
      `${idx + 1}. [${new Date(m.timestamp || m.receivedAt).toISOString()}] ${m.text}`
    )
    .join('\n');

  // ── Conversation history section ──────────────────────────────────────────
  const historyLines = history.length > 0
    ? [
        '',
        `=== LỊCH SỬ HỘI THOẠI GẦN ĐÂY (${history.length} tin nhắn cuối) ===`,
        ...history.map(
          (m) =>
            `[${new Date(m.createdAt).toISOString()}] ${m.direction === 'inbound' ? 'USER' : 'AI'}: ${m.text}`
        ),
        '=== HẾT LỊCH SỬ — chỉ trả lời tin nhắn mới bên dưới ===',
      ]
    : [
        '',
        '(Không có lịch sử hội thoại — đây là tin nhắn đầu tiên từ người dùng này.)',
      ];

  return [
    BASE_SYSTEM_PROMPT,
    buildCategoryClassifierPrompt(),
    INTAKE_FOLLOWUP_PROMPT,
    ADMIN_SUMMARY_PROMPT,
    ...historyLines,
    '',
    `senderId: ${senderId}`,
    'Tin nhắn mới cần phân tích:',
    transcript,
    '',
    'Lưu ý: Nếu lịch sử hội thoại cho thấy bạn đã hỏi thông tin này rồi, ' +
    'ĐỪNG hỏi lại — hãy chuyển sang bước tiếp theo hoặc xác nhận đã tiếp nhận.',
    '',
    'JSON output format:',
    '{"intent":"report_crime|ask_info|complaint|other","suggestedCategoryCode":"<CATEGORY_CODE>",' +
    '"confidence":0.0,"missingFields":["field1"],"followupMessage":"...","adminSummary":"...","noteSummary":"..."}'
  ].join('\n');
};

// ── Main orchestrator ─────────────────────────────────────────────────────────

export const processBatch = async ({ senderId, messages }) => {
  if (!messages?.length) return null;

  aiCallCounter += 1;

  // ── Step 1: Load conversation history for this sender ────────────────────
  // Fetch BEFORE saving current batch so the current messages are NOT in history
  // (they appear separately in the "new messages" section of the prompt).
  const history = await getConversationHistory(senderId);

  console.info(
    '[ai-orchestrator] Processing batch for sender=%s | batch=%d msg(s) | history=%d msg(s)',
    senderId, messages.length, history.length
  );

  // ── Step 2: Call Gemini with history-enriched prompt ─────────────────────
  const aiPrompt = buildPrompt({ senderId, messages, history });
  const analysis = await analyzeWithGemini(aiPrompt);

  // ── Step 3: Persist conversation (inbound batch + outbound AI reply) ──────
  // Done immediately after AI responds, BEFORE the classification gate, so even
  // non-report conversations accumulate context for future batches.
  await saveToHistory(senderId, messages, analysis.followupMessage || null);

  // ── Step 3.5: Bail if this sender has a pending Report with AI disabled ───
  // We must check BEFORE doing anything else so we don't create duplicate Reports
  // or send AI replies when the admin has intentionally silenced the bot.
  const openReport = await findPendingReportForSender(senderId);
  if (openReport && openReport.aiEnabled === false) {
    console.info(
      '[ai-orchestrator] AI disabled for report %s — skipping reply for sender %s',
      openReport._id, senderId
    );
    return null;
  }

  // ── Step 4: Classification gate ──────────────────────────────────────────
  // Only persist a Report when the AI is confident this is a real crime report.
  if (analysis.intent !== REPORT_INTENT || (analysis.confidence ?? 0) < CONFIDENCE_THRESHOLD) {
    console.info(
      '[ai-orchestrator] NON-report (intent=%s, confidence=%s) — skipping Report persistence',
      analysis.intent, analysis.confidence ?? 'N/A'
    );

    try {
      if (analysis.followupMessage) {
        await sendFacebookTextMessage(senderId, analysis.followupMessage);
      }
    } catch (err) {
      console.error('[ai-orchestrator] Facebook followup (non-report) failed:', err.message);
    }

    return null;
  }

  // ── Step 5: Append to existing pending Report OR create a new one ─────────
  // If there is already an open pending Report for this sender (and AI is still
  // enabled — checked above), we append AI-derived context as a note instead of
  // creating a duplicate Report.
  if (openReport) {
    console.info(
      '[ai-orchestrator] Appending note to existing pending report %s for sender %s',
      openReport._id, senderId
    );

    await Report.findByIdAndUpdate(openReport._id, {
      $push: {
        notes: {
          // Use noteSummary (delta of new info) when available; fall back to adminSummary
          text: analysis.noteSummary || analysis.adminSummary || messages.map((m) => m.text).join(' '),
          source: 'ai',
          createdAt: new Date()
        }
      }
    });

    try {
      if (analysis.followupMessage) {
        await sendFacebookTextMessage(senderId, analysis.followupMessage);
      }
    } catch (err) {
      console.error('[ai-orchestrator] Facebook followup (existing report) failed:', err.message);
    }

    return openReport;
  }

  // ── Step 5b: No existing report — create a new one ───────────────────────
  const reportCode = await nextReportCode();

  const report = await Report.create({
    reportCode,
    channel: 'FACEBOOK',
    content: messages.map((m) => m.text).join('\n'),
    reporterInfo: { facebookId: senderId },
    categoryCode: analysis.suggestedCategoryCode,
    aiAnalysis: {
      summary: analysis.adminSummary,
      confidence: analysis.confidence,
      extractedSignals: analysis.missingFields
    },
    status: 'pending_approval'
  });

  // ── Step 6: Telegram approval notification ────────────────────────────────
  try {
    const telegramResult = await sendApprovalMessage(report);
    if (telegramResult?.result?.message_id) {
      report.decisionMessageId = String(telegramResult.result.message_id);
      await report.save();
    }
  } catch (err) {
    console.error('[ai-orchestrator] Telegram approval notification failed:', err.message);
  }

  // ── Step 7: Facebook follow-up to the reporter ────────────────────────────
  try {
    if (analysis.followupMessage) {
      await sendFacebookTextMessage(senderId, analysis.followupMessage);
    }
  } catch (err) {
    console.error('[ai-orchestrator] Facebook followup (report) failed:', err.message);
  }

  return report;
};

messageBatchService.onBatchReady(processBatch);

export const getAiCallCounter  = () => aiCallCounter;
export const resetAiCallCounter = () => { aiCallCounter = 0; };
