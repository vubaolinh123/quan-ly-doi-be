import env from '../config/env.js';
import { CATEGORY_CODES } from '../constants/domain.constants.js';

const CHANNEL_LABEL = {
  HOTLINE:   'Đường dây nóng',
  FACEBOOK:  'Facebook',
  ZALO:      'Zalo',
  EMAIL:     'Email',
  WEBSITE:   'Website',
  TRUC_TIEP: 'Trực tiếp',
};

const TELEGRAM_API_BASE = 'https://api.telegram.org';

const telegramRequest = async (method, payload) => {
  if (process.env.E2E_MOCK === 'true') {
    if (method === 'sendMessage') {
      return {
        ok: true,
        result: {
          message_id: 900001,
          chat: { id: payload?.chat_id ?? 0 }
        }
      };
    }

    if (method === 'editMessageText') {
      return {
        ok: true,
        result: {
          message_id: Number(payload?.message_id || 0),
          chat: { id: payload?.chat_id ?? 0 },
          text: payload?.text || ''
        }
      };
    }

    if (method === 'answerCallbackQuery') {
      return { ok: true, result: true };
    }

    return { ok: true, result: {} };
  }

  if (!env.telegramBotToken) {
    return { skipped: true, reason: 'missing_bot_token' };
  }

  const response = await fetch(`${TELEGRAM_API_BASE}/bot${env.telegramBotToken}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram ${method} failed: ${response.status} ${errorText}`);
  }

  return response.json();
};

const buildCallback = (action, reportId, categoryCode = null) => {
  if (categoryCode) {
    return `${action}|${reportId}|${categoryCode}`;
  }

  return `${action}|${reportId}`;
};

const getReporterLabel = (report) => {
  return (
    report?.reporterInfo?.fullName ||
    report?.reporterInfo?.facebookId ||
    report?.reporterInfo?.phone ||
    'Ẩn danh'
  );
};

/**
 * Build a Messenger conversation URL for a Facebook Page-Scoped ID.
 * The URL opens the conversation in facebook.com/messages so page admins
 * can read the full chat and reply directly.
 */
const getFacebookConversationUrl = (facebookId) => {
  if (!facebookId) return null;
  return `https://www.facebook.com/messages/t/${facebookId}`;
};

const buildApprovalMessage = (report) => {
  const reporter  = report.reporterInfo || {};
  const catCode   = report.finalCategoryCode || report.categoryCode || 'KHXM';
  const catName   = CATEGORY_CODES[catCode] || catCode;
  const channel   = CHANNEL_LABEL[report.channel] || report.channel || '—';

  // Truncate raw content so the message stays within Telegram's 4 096-char limit
  const rawContent = String(report.content || '');
  const content    = rawContent.length > 350
    ? rawContent.slice(0, 350) + '…'
    : rawContent;

  // ── Reporter block ────────────────────────────────────────────────────────
  const reporterLines = [];
  if (reporter.fullName)     reporterLines.push(`  • Họ tên  : ${reporter.fullName}`);
  if (reporter.phone)        reporterLines.push(`  • SĐT    : ${reporter.phone}`);
  if (reporter.age)          reporterLines.push(`  • Tuổi   : ${reporter.age}`);
  if (reporter.facebookId) {
    const fbUrl = getFacebookConversationUrl(reporter.facebookId);
    reporterLines.push(`  • Facebook: ${fbUrl || reporter.facebookId}`);
  }
  if (!reporterLines.length) reporterLines.push('  • Ẩn danh / chưa xác định');

  // ── AI summary block ──────────────────────────────────────────────────────
  const aiSummary = String(report.aiAnalysis?.summary || '').trim();

  const parts = [
    '🔔 BÁO CÁO MỚI — CHỜ DUYỆT',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '📋 THÔNG TIN CHUNG',
    `  • Mã BC  : ${report.reportCode}`,
    `  • Kênh   : ${channel}`,
    '',
    '👤 NGƯỜI TỐ GIÁC',
    ...reporterLines,
    '',
    '📝 NỘI DUNG TỐ GIÁC',
    content,
    '',
  ];

  if (aiSummary) {
    parts.push('🤖 PHÂN TÍCH AI');
    parts.push(aiSummary);
    parts.push('');
  }

  parts.push(`🏷️  PHÂN LOẠI: ${catCode} — ${catName}`);

  return parts.join('\n');
};

const buildInlineKeyboard = (reportId) => {
  // Keep it minimal — AI already suggests a category; admins only need to approve/reject/toggle AI.
  return [
    [
      { text: '✅ Duyệt',   callback_data: buildCallback('approve',    reportId) },
      { text: '❌ Từ chối', callback_data: buildCallback('reject',     reportId) },
      { text: '🤖 Tắt AI', callback_data: buildCallback('toggle_ai',  reportId) }
    ]
  ];
};

export const sendApprovalMessage = async (report) => {
  if (!env.telegramGroupChatId) {
    return { skipped: true, reason: 'missing_group_chat_id' };
  }

  const targetCategory = report.finalCategoryCode || report.categoryCode;

  // Gửi vào nhóm chat chung — mọi thành viên trong nhóm đều thấy và thao tác được
  return telegramRequest('sendMessage', {
    chat_id: env.telegramGroupChatId,
    text: buildApprovalMessage(report),
    reply_markup: {
      inline_keyboard: buildInlineKeyboard(String(report._id), targetCategory)
    }
  });
};

export const editMessageAfterDecision = async (messageId, decision) => {
  if (!decision?.chatId || !messageId) {
    return { skipped: true, reason: 'missing_chat_or_message_id' };
  }

  const payload = {
    chat_id: decision.chatId,
    message_id: Number(messageId),
    text: decision.text
  };

  // For non-final actions (like toggle_ai) keep the keyboard active so
  // admins can still approve / reject without re-finding the message.
  if (!decision.keepKeyboard) {
    payload.reply_markup = { inline_keyboard: [] };
  }

  return telegramRequest('editMessageText', payload);
};

/**
 * Register (or update) the Telegram Bot webhook.
 * Must be called once after deployment so Telegram knows where to deliver
 * callback_query and message updates.
 *
 * @param {string} webhookUrl  Public HTTPS URL of the backend webhook endpoint.
 *   Example: https://api.example.com/api/webhooks/telegram
 */
export const setupWebhook = async (webhookUrl) => {
  if (!webhookUrl) throw new Error('webhookUrl is required');

  const payload = { url: webhookUrl };

  // Attach the secret token so the backend can verify requests are from Telegram.
  if (env.telegramWebhookSecret) {
    payload.secret_token = env.telegramWebhookSecret;
  }

  return telegramRequest('setWebhook', payload);
};

/**
 * Fetch current webhook info from Telegram so the admin UI can display
 * whether the webhook is properly registered.
 */
export const getWebhookInfo = async () => {
  return telegramRequest('getWebhookInfo', {});
};

/**
 * Acknowledge a Telegram callback query to dismiss the loading indicator on
 * the button.  Must be called within 10 s of receiving the callback.
 * Optionally pass a short `text` to show a toast notification to the user.
 */
export const answerCallbackQuery = async (callbackQueryId, text = '') => {
  if (!callbackQueryId) return { skipped: true, reason: 'missing_callback_query_id' };

  return telegramRequest('answerCallbackQuery', {
    callback_query_id: String(callbackQueryId),
    ...(text ? { text, show_alert: false } : {})
  });
};

/**
 * Notify the group that an existing pending report has received a new
 * supplement note from the reporter.  Replies to the original approval
 * message (thread) using reply_to_message_id so admins can follow the
 * conversation chain without searching.
 */
export const sendNoteUpdateMessage = async (report, noteText) => {
  if (!env.telegramGroupChatId) {
    return { skipped: true, reason: 'missing_group_chat_id' };
  }

  const fbUrl = getFacebookConversationUrl(report?.reporterInfo?.facebookId);

  const parts = [
    '📬 BỔ SUNG BÁO CÁO — CẦN XEM LẠI',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `📋 Mã BC  : ${report.reportCode}`,
    '',
    '📝 NỘI DUNG BỔ SUNG TỪ NGƯỜI TỐ GIÁC',
    noteText,
    '',
  ];

  if (fbUrl) {
    parts.push(`💬 Xem chat Facebook: ${fbUrl}`);
  }

  const payload = {
    chat_id: env.telegramGroupChatId,
    text: parts.join('\n'),
  };

  // Reply to the original approval message so this supplement appears
  // in the same thread (admins don't need to search for the original).
  if (report.decisionMessageId) {
    payload.reply_to_message_id = Number(report.decisionMessageId);
  }

  return telegramRequest('sendMessage', payload);
};
