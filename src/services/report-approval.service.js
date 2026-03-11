import Report from '../models/Report.js';
import Task from '../models/Task.js';
import { assignOfficerToTask } from './assignment.service.js';
import { sendFacebookTextMessage } from './facebook.service.js';

const buildApprovalTaskPayload = (report, assigneeId, categoryCode) => {
  return {
    title: `Xử lý tố giác ${report.reportCode}`,
    categoryCode,
    activity: 'DIEU_TRA_XU_LY',
    priority: 'high',
    assignee: assigneeId,
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000),
    sourceReportId: report._id,
    description: report.content
  };
};

const buildTelegramActor = (telegramData = {}) => {
  const username = telegramData?.from?.username;
  const userId = telegramData?.from?.id;
  return username ? `@${username}` : userId ? `tg:${userId}` : 'telegram';
};

const markTelegramDecision = (report, telegramData = {}) => {
  report.decisionMessageId = telegramData.messageId ? String(telegramData.messageId) : report.decisionMessageId;
  report.decisionUpdateId = telegramData.updateId ? String(telegramData.updateId) : report.decisionUpdateId;
  report.decisionSource = 'telegram';
};

const findReportOrThrow = async (reportId) => {
  const report = await Report.findById(reportId);
  if (!report) {
    const error = new Error('REPORT_NOT_FOUND');
    error.statusCode = 404;
    throw error;
  }
  return report;
};

const isAlreadyProcessed = (report) => report.status === 'approved' || report.status === 'rejected';

export const approveReport = async (reportId, categoryCode, telegramData = {}) => {
  const report = await findReportOrThrow(reportId);

  if (isAlreadyProcessed(report)) {
    return { status: 'already_processed', report };
  }

  if (report.status !== 'pending_approval') {
    const error = new Error('INVALID_STATE_TRANSITION');
    error.statusCode = 409;
    throw error;
  }

  const normalizedCategoryCode = String(categoryCode || report.categoryCode || 'KHXM').toUpperCase();
  const actor = buildTelegramActor(telegramData);

  report.status = 'approved';
  report.finalCategoryCode = normalizedCategoryCode;
  report.categoryCode = normalizedCategoryCode;
  report.approvedBy = actor;
  report.approvedAt = new Date();
  markTelegramDecision(report, telegramData);

  // Try to auto-assign an officer — non-fatal if none is configured for this category
  let officer = null;
  try {
    officer = await assignOfficerToTask(normalizedCategoryCode);
  } catch (err) {
    if (err.code === 'NO_OFFICER_FOR_CATEGORY') {
      console.warn(
        '[report-approval] No officer for category %s — approving without task assignment',
        normalizedCategoryCode
      );
    } else {
      throw err; // unexpected error — let it propagate
    }
  }

  await report.save();

  let taskCreated = false;
  if (officer) {
    try {
      await Task.create(buildApprovalTaskPayload(report, officer._id, normalizedCategoryCode));
      taskCreated = true;
    } catch (error) {
      if (error?.code === 11000) {
        return { status: 'already_processed', report, taskCreated: false };
      }
      throw error;
    }
  }

  return { status: 'approved', report, taskCreated };
};

export const rejectReport = async (reportId, reason, telegramData = {}) => {
  const report = await findReportOrThrow(reportId);

  if (isAlreadyProcessed(report)) {
    return { status: 'already_processed', report };
  }

  if (report.status !== 'pending_approval') {
    const error = new Error('INVALID_STATE_TRANSITION');
    error.statusCode = 409;
    throw error;
  }

  const actor = buildTelegramActor(telegramData);
  report.status = 'rejected';
  report.rejectedBy = actor;
  report.rejectedAt = new Date();
  report.rejectedReason = reason || 'Rejected via Telegram';
  markTelegramDecision(report, telegramData);
  await report.save();

  if (report.channel === 'FACEBOOK' && report.reporterInfo?.facebookId) {
    try {
      await sendFacebookTextMessage(report.reporterInfo.facebookId, 'Tố giác của bạn đã được tiếp nhận nhưng chưa đủ điều kiện xử lý.');
    } catch (error) {
      console.error('[report-approval] Facebook reject followup failed', error.message);
    }
  }

  return { status: 'rejected', report };
};

export const changeCategoryAndApprove = async (reportId, newCategoryCode, telegramData = {}) => {
  return approveReport(reportId, newCategoryCode, telegramData);
};
