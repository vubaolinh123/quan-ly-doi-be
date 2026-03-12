import Report from '../models/Report.js';
import ConversationMessage from '../models/ConversationMessage.js';
import { messageBatchService } from './message-batch.service.js';
import { analyzeWithGemini } from './gemini.service.js';
import { sendFacebookTextMessage } from './facebook.service.js';
import { sendApprovalMessage, sendNoteUpdateMessage } from './telegram.service.js';
import { BASE_SYSTEM_PROMPT } from '../prompts/system/base-system.prompt.js';
import { buildCategoryClassifierPrompt } from '../prompts/classification/category-classifier.prompt.js';
import { INTAKE_FOLLOWUP_PROMPT } from '../prompts/conversation/intake-followup.prompt.js';
import { ADMIN_SUMMARY_PROMPT } from '../prompts/summary/admin-summary.prompt.js';
import SystemConfig from '../models/SystemConfig.js';

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

// ── Fast-path (filter OFF) ────────────────────────────────────────────────────
/**
 * Keywords that trigger immediate report creation when the AI filter is disabled.
 * NOTE: Keep this list in sync with the informational display in
 *       frontend/src/components/admin/modules/settings-module.tsx
 */
const FRAUD_KEYWORDS = [
  'lừa đảo', 'bị lừa', 'chuyển khoản', 'mất tiền',
  'lừa tiền', 'chiếm đoạt', 'lừa', 'scam'
];

/**
 * Returns true if any message text contains at least one fraud keyword.
 * Matching is case-insensitive (toLowerCase) — no diacritic normalisation needed
 * because Vietnamese fraud keywords are reliably written with diacritics.
 */
const hasFraudKeyword = (messages) => {
  const text = messages.map((m) => (m.text || '').toLowerCase()).join(' ');
  return FRAUD_KEYWORDS.some((kw) => text.includes(kw));
};

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
 *   3. ── BÁO CÁO ĐANG CHỜ DUYỆT ── (if sender already has a pending report)
 *      Informs AI about the open report so it can decide: supplement vs new incident
 *   4. ── TIN NHẮN MỚI CẦN PHÂN TÍCH ──
 *      Numbered list of messages in the current batch
 *   5. JSON output format spec
 *
 * Including history prevents the AI from repeating follow-up questions that
 * were already asked in an earlier batch window.
 */
const buildPrompt = ({ senderId, messages, history, openReport }) => {
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

  // ── Existing pending report section (if any) ─────────────────────────────
  const openReportLines = openReport
    ? [
        '',
        '=== BÁO CÁO ĐANG CHỜ DUYỆT CỦA NGƯỜI GỬI NÀY ===',
        `Mã báo cáo : ${openReport.reportCode}`,
        `Danh mục   : ${openReport.categoryCode}`,
        `Tóm tắt AI : ${openReport.aiAnalysis?.summary || '(chưa có)'}`,
        `Nội dung gốc: ${(openReport.content || '').slice(0, 400)}`,
        '=== HẾT THÔNG TIN BÁO CÁO ===',
        '',
        '⚠️ YÊU CẦU QUAN TRỌNG — BÁO CÁO ĐANG MỞ:',
        'Người gửi này đã có 1 báo cáo đang chờ duyệt (thông tin ở trên).',
        'Bạn PHẢI quyết định tin nhắn mới này thuộc trường hợp nào:',
        '  • reportAction = "supplement_existing_report"',
        '    → Nếu tin nhắn mới BỔ SUNG hoặc làm rõ thêm cho VỤ VIỆC ĐÃ BÁO CÁO ở trên.',
        '  • reportAction = "new_report"',
        '    → Nếu tin nhắn mới là VỤ VIỆC KHÁC HOÀN TOÀN (khác địa điểm, khác thời gian, khác loại tội phạm).',
        'Không được bỏ qua field reportAction khi có báo cáo đang mở.',
      ]
    : [
        '',
        '(Người gửi này chưa có báo cáo nào đang chờ duyệt. reportAction = "new_report".)',
      ];

  // ── JSON format spec ──────────────────────────────────────────────────────
  const reportActionNote = openReport
    ? '"reportAction":"new_report|supplement_existing_report",'
    : '';

  return [
    BASE_SYSTEM_PROMPT,
    buildCategoryClassifierPrompt(),
    INTAKE_FOLLOWUP_PROMPT,
    ADMIN_SUMMARY_PROMPT,
    ...historyLines,
    ...openReportLines,
    '',
    `senderId: ${senderId}`,
    'Tin nhắn mới cần phân tích:',
    transcript,
    '',
    'Lưu ý: Nếu lịch sử hội thoại cho thấy bạn đã hỏi thông tin này rồi, ' +
    'ĐỪNG hỏi lại — hãy chuyển sang bước tiếp theo hoặc xác nhận đã tiếp nhận.',
    '',
    'JSON output format:',
    `{"intent":"report_crime|ask_info|complaint|other","suggestedCategoryCode":"<CATEGORY_CODE>",` +
    `"confidence":0.0,"missingFields":["field1"],"followupMessage":"...","adminSummary":"...",` +
    `"noteSummary":"...",${reportActionNote}}`
  ].join('\n');
};

// ── Main orchestrator ─────────────────────────────────────────────────────────

export const processBatch = async ({ senderId, messages }) => {
  if (!messages?.length) return null;

  // ── Fast-path: report filter disabled ────────────────────────────────────
  // When an admin has disabled the AI filter, any message containing a fraud
  // keyword bypasses Gemini entirely and creates a Report immediately.
  // We still respect the dedup rule: if the sender already has a pending
  // report, we append a note rather than creating a duplicate.
  const sysConfig = await SystemConfig.getSingleton();
  if (!sysConfig.reportFilterEnabled && hasFraudKeyword(messages)) {
    console.info(
      '[ai-orchestrator] FAST-PATH — filter disabled, fraud keyword detected for sender=%s',
      senderId
    );

    // Dedup: check for existing pending report
    const existingReport = await findPendingReportForSender(senderId);
    if (existingReport) {
      const noteText = messages.map((m) => m.text).join(' ');
      await Report.findByIdAndUpdate(existingReport._id, {
        $push: { notes: { text: noteText, source: 'ai', createdAt: new Date() } }
      });
      try {
        await sendFacebookTextMessage(
          senderId,
          'Chúng tôi đã nhận thêm thông tin và bổ sung vào tố giác đang xử lý của bạn.'
        );
      } catch (err) {
        console.error('[ai-orchestrator] Facebook fast-path supplement reply failed:', err.message);
      }
      await saveToHistory(senderId, messages, null);
      return existingReport;
    }

    // No existing pending report — create a new one immediately
    const reportCode = await nextReportCode();
    const content = messages.map((m) => m.text).join('\n');

    const report = await Report.create({
      reportCode,
      channel: 'FACEBOOK',
      content,
      reporterInfo: { facebookId: senderId },
      categoryCode: 'LD',
      aiAnalysis: {
        summary: 'Tạo nhanh — bộ lọc AI đã tắt, phát hiện từ khóa lừa đảo',
        confidence: 1,
        extractedSignals: []
      },
      status: 'pending_approval'
    });

    // Telegram approval notification
    try {
      const telegramResult = await sendApprovalMessage(report);
      if (telegramResult?.result?.message_id) {
        report.decisionMessageId = String(telegramResult.result.message_id);
        await report.save();
      }
    } catch (err) {
      console.error('[ai-orchestrator] Telegram fast-path notification failed:', err.message);
    }

    // Facebook auto-reply to the reporter
    try {
      await sendFacebookTextMessage(
        senderId,
        'Cảm ơn bạn đã phản ánh. Chúng tôi đã tiếp nhận tố giác và sẽ xử lý sớm nhất có thể.'
      );
    } catch (err) {
      console.error('[ai-orchestrator] Facebook fast-path reply failed:', err.message);
    }

    await saveToHistory(senderId, messages, null);
    return report;
  }

  aiCallCounter += 1;

  // ── Step 1: Load conversation history for this sender ────────────────────
  // Fetch BEFORE saving current batch so the current messages are NOT in history
  // (they appear separately in the "new messages" section of the prompt).
  const history = await getConversationHistory(senderId);

  // ── Step 1.5: Check for an existing pending Report ───────────────────────
  // Must happen BEFORE calling Gemini so we can inject the open report's context
  // into the prompt and let the AI decide: supplement vs new incident.
  const openReport = await findPendingReportForSender(senderId);

  // Bail early if AI is disabled for this report
  if (openReport && openReport.aiEnabled === false) {
    console.info(
      '[ai-orchestrator] AI disabled for report %s — skipping reply for sender %s',
      openReport._id, senderId
    );
    return null;
  }

  console.info(
    '[ai-orchestrator] Processing batch for sender=%s | batch=%d msg(s) | history=%d msg(s) | openReport=%s',
    senderId, messages.length, history.length, openReport?._id ?? 'none'
  );

  // ── Step 2: Call Gemini with history-enriched prompt ─────────────────────
  const aiPrompt = buildPrompt({ senderId, messages, history, openReport });
  const analysis = await analyzeWithGemini(aiPrompt);

  // ── Step 3: Persist conversation (inbound batch + outbound AI reply) ──────
  // Done immediately after AI responds, BEFORE the classification gate, so even
  // non-report conversations accumulate context for future batches.
  await saveToHistory(senderId, messages, analysis.followupMessage || null);

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
  // Use AI's reportAction field to decide:
  //   "supplement_existing_report" → append note to the open report
  //   "new_report" (or absent)    → create a fresh report
  if (openReport && analysis.reportAction !== 'new_report') {
    console.info(
      '[ai-orchestrator] reportAction=%s — appending note to existing pending report %s for sender %s',
      analysis.reportAction ?? '(unset)', openReport._id, senderId
    );

    // noteSummary = delta of new info; adminSummary may be null for supplement turns
    const noteText = analysis.noteSummary || analysis.adminSummary || messages.map((m) => m.text).join(' ');

    await Report.findByIdAndUpdate(openReport._id, {
      $push: {
        notes: {
          text: noteText,
          source: 'ai',
          createdAt: new Date()
        }
      }
    });

    // ── Telegram: notify group that this report has a new supplement ──────────
    try {
      await sendNoteUpdateMessage(openReport, noteText);
    } catch (err) {
      console.error('[ai-orchestrator] Telegram note-update notification failed:', err.message);
    }

    try {
      if (analysis.followupMessage) {
        await sendFacebookTextMessage(senderId, analysis.followupMessage);
      }
    } catch (err) {
      console.error('[ai-orchestrator] Facebook followup (existing report) failed:', err.message);
    }

    return openReport;
  }

  // ── Step 5b: No existing report, or AI says this is a new incident ────────
  if (openReport) {
    console.info(
      '[ai-orchestrator] reportAction=new_report — creating new report despite open report %s for sender %s',
      openReport._id, senderId
    );
  }

  const reportCode = await nextReportCode();

  const report = await Report.create({
    reportCode,
    channel: 'FACEBOOK',
    content: messages.map((m) => m.text).join('\n'),
    reporterInfo: { facebookId: senderId },
    categoryCode: analysis.suggestedCategoryCode,
    aiAnalysis: {
      summary: analysis.adminSummary || analysis.noteSummary || '',
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
