import env from '../config/env.js';
import { CATEGORY_CODES } from '../constants/domain.constants.js';

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

const buildApprovalMessage = (report) => {
  return [
    '📌 Báo cáo mới chờ duyệt',
    `Mã: ${report.reportCode}`,
    `Nguồn: ${report.channel}`,
    `Người gửi: ${getReporterLabel(report)}`,
    `Nội dung: ${report.content}`,
    `Phân tích AI: ${report.aiAnalysis?.summary || 'Không có'}`,
    `Nhóm đề xuất: ${report.finalCategoryCode || report.categoryCode || 'KHXM'}`
  ].join('\n');
};

const buildInlineKeyboard = (reportId) => {
  const categoryEntries = Object.keys(CATEGORY_CODES);
  const categoryRows = [];

  for (let i = 0; i < categoryEntries.length; i += 2) {
    const leftCode = categoryEntries[i];
    const rightCode = categoryEntries[i + 1];
    const row = [
      {
        text: leftCode,
        callback_data: buildCallback('change_category', reportId, leftCode)
      }
    ];

    if (rightCode) {
      row.push({
        text: rightCode,
        callback_data: buildCallback('change_category', reportId, rightCode)
      });
    }

    categoryRows.push(row);
  }

  return [
    [
      { text: '✅ Approve', callback_data: buildCallback('approve', reportId) },
      { text: '❌ Reject', callback_data: buildCallback('reject', reportId) },
      { text: '🤖 Tắt AI', callback_data: buildCallback('toggle_ai', reportId) }
    ],
    ...categoryRows
  ];
};

export const sendApprovalMessage = async (report) => {
  if (!env.telegramChatId) {
    return { skipped: true, reason: 'missing_chat_id' };
  }

  const targetCategory = report.finalCategoryCode || report.categoryCode;

  return telegramRequest('sendMessage', {
    chat_id: env.telegramChatId,
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
