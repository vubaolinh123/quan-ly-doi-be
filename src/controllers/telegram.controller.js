import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';
import {
  approveReport,
  changeCategoryAndApprove,
  rejectReport
} from '../services/report-approval.service.js';
import { editMessageAfterDecision } from '../services/telegram.service.js';
import Report from '../models/Report.js';

const parseCallbackData = (raw) => {
  const [action, reportId, categoryCode] = String(raw || '').split('|');
  return { action, reportId, categoryCode };
};

const buildDecisionText = ({ reportCode, resultStatus, action, categoryCode, aiEnabled }) => {
  if (resultStatus === 'already_processed') {
    return `ℹ️ Báo cáo ${reportCode} đã được xử lý trước đó.`;
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

export const receiveTelegramWebhook = asyncHandler(async (req, res) => {
  const callbackQuery = req.body?.callback_query;
  if (!callbackQuery?.data) {
    return successResponse({
      res,
      message: 'Ignored telegram update',
      data: { ignored: true }
    });
  }

  const { action, reportId, categoryCode } = parseCallbackData(callbackQuery.data);
  const telegramData = {
    from: callbackQuery.from,
    messageId: callbackQuery.message?.message_id,
    updateId: callbackQuery.id
  };

  let outcome;
  if (action === 'approve') {
    outcome = await approveReport(reportId, null, telegramData);
  } else if (action === 'reject') {
    outcome = await rejectReport(reportId, 'Rejected via Telegram', telegramData);
  } else if (action === 'change_category') {
    outcome = await changeCategoryAndApprove(reportId, categoryCode, telegramData);
  } else if (action === 'change_category_menu') {
    return successResponse({
      res,
      message: 'Telegram callback processed',
      data: { status: 'category_menu_opened' }
    });
  } else if (action === 'toggle_ai') {
    const report = await Report.findById(reportId);
    if (!report || report.status !== 'pending_approval') {
      return successResponse({
        res,
        message: 'Telegram callback processed',
        data: { status: 'not_pending' }
      });
    }
    report.aiEnabled = !report.aiEnabled;
    await report.save();
    outcome = { status: 'toggled', report, aiEnabled: report.aiEnabled };
  } else {
    return successResponse({
      res,
      message: 'Unsupported callback action',
      data: { ignored: true }
    });
  }

  const text = buildDecisionText({
    reportCode: outcome.report.reportCode,
    resultStatus: outcome.status,
    action,
    categoryCode,
    aiEnabled: outcome.aiEnabled
  });

  try {
    await editMessageAfterDecision(callbackQuery.message?.message_id, {
      chatId: callbackQuery.message?.chat?.id,
      text,
      keepKeyboard: action === 'toggle_ai'
    });
  } catch (error) {
    console.error('[telegram.controller] edit message failed', error.message);
  }

  return successResponse({
    res,
    message: 'Telegram callback processed',
    data: { status: outcome.status }
  });
});
