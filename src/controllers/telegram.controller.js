import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';
import {
  approveReport,
  changeCategoryAndApprove,
  rejectReport
} from '../services/report-approval.service.js';
import { answerCallbackQuery, editMessageAfterDecision } from '../services/telegram.service.js';
import Report from '../models/Report.js';

const parseCallbackData = (raw) => {
  const [action, reportId, categoryCode] = String(raw || '').split('|');
  return { action, reportId, categoryCode };
};

const buildDecisionText = ({ reportCode, resultStatus, action, categoryCode, aiEnabled }) => {
  if (resultStatus === 'already_processed') {
    return `ℹ️ Báo cáo ${reportCode} đã được xử lý trước đó.\nCác nút bấm không còn hiệu lực.`;
  }
  if (action === 'reject') {
    return `❌ Báo cáo ${reportCode} đã bị từ chối.`;
  }
  if (action === 'toggle_ai') {
    return `🤖 AI đã ${aiEnabled ? 'bật' : 'tắt'} cho báo cáo ${reportCode}.`;
  }
  if (action === 'change_category') {
    return `✅ Báo cáo ${reportCode} đã duyệt với nhóm ${categoryCode}.`;
  }
  return `✅ Báo cáo ${reportCode} đã được duyệt.`;
};

// ── Dismiss the Telegram button loading indicator (fire-and-forget) ──────────
const ackCallback = async (queryId) => {
  try {
    await answerCallbackQuery(queryId);
  } catch (err) {
    console.error('[telegram.controller] answerCallbackQuery failed', err.message);
  }
};

// ── Edit the Telegram message and optionally remove the keyboard ──────────────
const updateMessage = async (msgId, chatId, text, keepKeyboard = false) => {
  try {
    await editMessageAfterDecision(msgId, { chatId, text, keepKeyboard });
  } catch (err) {
    console.error('[telegram.controller] editMessageAfterDecision failed', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
export const receiveTelegramWebhook = asyncHandler(async (req, res) => {
  const callbackQuery = req.body?.callback_query;

  if (!callbackQuery?.data) {
    return successResponse({ res, message: 'Ignored telegram update', data: { ignored: true } });
  }

  const { action, reportId, categoryCode } = parseCallbackData(callbackQuery.data);
  const msgId   = callbackQuery.message?.message_id;
  const chatId  = callbackQuery.message?.chat?.id;
  const queryId = callbackQuery.id;

  // Always acknowledge first — Telegram shows a loading spinner until we do.
  await ackCallback(queryId);

  // ── Ignore unrecognised or UI-only actions ───────────────────────────────
  if (action === 'change_category_menu') {
    return successResponse({ res, message: 'Telegram callback processed', data: { status: 'category_menu_opened' } });
  }

  const SUPPORTED = ['approve', 'reject', 'change_category', 'toggle_ai'];
  if (!SUPPORTED.includes(action)) {
    return successResponse({ res, message: 'Unsupported callback action', data: { ignored: true } });
  }

  // ── Guard: fetch report early so we can handle deleted / processed states ──
  const report = await Report.findById(reportId);

  if (!report) {
    // Report was deleted after the Telegram message was sent
    await updateMessage(
      msgId, chatId,
      '🗑️ Báo cáo này đã bị xóa khỏi hệ thống.\nCác nút bấm bên trên không còn hiệu lực.'
    );
    return successResponse({ res, message: 'Telegram callback processed', data: { status: 'report_deleted' } });
  }

  if (report.status !== 'pending_approval') {
    // Report was already handled (possibly by another admin via web or another Telegram click)
    const statusLabel = report.status === 'approved' ? '✅ đã được duyệt' : '❌ đã bị từ chối';
    await updateMessage(
      msgId, chatId,
      `ℹ️ Báo cáo ${report.reportCode} ${statusLabel} từ trước.\nCác nút bấm bên trên không còn hiệu lực.`
    );
    return successResponse({ res, message: 'Telegram callback processed', data: { status: 'already_processed' } });
  }

  // ── Process action (report is guaranteed to be pending here) ────────────
  const telegramData = { from: callbackQuery.from, messageId: msgId, updateId: queryId };

  let outcome;
  try {
    if (action === 'approve') {
      outcome = await approveReport(reportId, null, telegramData);
    } else if (action === 'reject') {
      outcome = await rejectReport(reportId, 'Rejected via Telegram', telegramData);
    } else if (action === 'change_category') {
      outcome = await changeCategoryAndApprove(reportId, categoryCode, telegramData);
    } else if (action === 'toggle_ai') {
      report.aiEnabled = !report.aiEnabled;
      await report.save();
      outcome = { status: 'toggled', report, aiEnabled: report.aiEnabled };
    }
  } catch (err) {
    // Race condition: report was deleted or processed between our check and the action
    if (err.message === 'REPORT_NOT_FOUND' || err.statusCode === 404) {
      await updateMessage(
        msgId, chatId,
        '🗑️ Báo cáo vừa bị xóa trong lúc xử lý.\nCác nút bấm không còn hiệu lực.'
      );
    } else {
      await updateMessage(
        msgId, chatId,
        '⚠️ Đã xảy ra lỗi khi xử lý. Vui lòng thử lại hoặc liên hệ quản trị viên.'
      );
    }
    return successResponse({ res, message: 'Telegram callback processed', data: { status: 'error' } });
  }

  // ── Update the Telegram message to reflect the outcome ───────────────────
  const text = buildDecisionText({
    reportCode: outcome.report.reportCode,
    resultStatus: outcome.status,
    action,
    categoryCode,
    aiEnabled: outcome.aiEnabled
  });

  // Keep keyboard open only for toggle_ai so admins can still approve/reject afterwards
  await updateMessage(msgId, chatId, text, action === 'toggle_ai');

  return successResponse({
    res,
    message: 'Telegram callback processed',
    data: { status: outcome.status }
  });
});
