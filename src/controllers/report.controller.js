import Report from '../models/Report.js';
import Task from '../models/Task.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';
import { editMessageAfterDecision } from '../services/telegram.service.js';
import env from '../config/env.js';

const allowedStatuses = ['pending_approval', 'approved', 'rejected'];

export const createReport = asyncHandler(async (req, res) => {
  const item = await Report.create(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo tố giác thành công',
    data: item
  });
});

export const getReports = asyncHandler(async (req, res) => {
  const { q = '', status, channel, categoryCode, page = 1, limit = 20 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));
  const query = {};

  if (q) {
    query.$or = [
      { reportCode: { $regex: q, $options: 'i' } },
      { content: { $regex: q, $options: 'i' } },
      { 'reporterInfo.fullName': { $regex: q, $options: 'i' } }
    ];
  }

  if (status && allowedStatuses.includes(String(status))) {
    query.status = status;
  }

  if (channel) {
    query.channel = String(channel).toUpperCase();
  }

  if (categoryCode) {
    query.categoryCode = String(categoryCode).toUpperCase();
  }

  const [items, total] = await Promise.all([
    Report.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    Report.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách tố giác thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getReportById = asyncHandler(async (req, res) => {
  const item = await Report.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tố giác' });
  }
  return successResponse({ res, message: 'Lấy chi tiết tố giác thành công', data: item });
});

export const updateReport = asyncHandler(async (req, res) => {
  const item = await Report.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tố giác' });
  }

  return successResponse({ res, message: 'Cập nhật tố giác thành công', data: item });
});

export const deleteReport = asyncHandler(async (req, res) => {
  const item = await Report.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tố giác' });
  }
  return successResponse({ res, message: 'Xóa tố giác thành công', data: item });
});

// ── Web decision endpoints ────────────────────────────────────────────────────

export const approveReport = asyncHandler(async (req, res) => {
  const { finalCategoryCode, note } = req.body ?? {};
  const adminName = req.user?.username || req.user?.name || req.user?.email || 'admin';

  const update = {
    status: 'approved',
    approvedBy: adminName,
    approvedAt: new Date(),
    decisionSource: 'web',
    ...(finalCategoryCode ? { finalCategoryCode } : {}),
  };

  const item = await Report.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true
  });

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tố giác' });
  }

  // Sync decision to Telegram so the approval message is updated
  try {
    if (item.decisionMessageId && env.telegramGroupChatId) {
      const noteText = note ? `\nGhi chú: ${note}` : '';
      await editMessageAfterDecision(item.decisionMessageId, {
        chatId: env.telegramGroupChatId,
        text: `✅ ĐÃ DUYỆT (web)\nMã: ${item.reportCode}\nDuyệt bởi: ${adminName}${noteText}`
      });
    }
  } catch (err) {
    console.warn('[report] Telegram edit failed on web approve:', err.message);
  }

  return successResponse({ res, message: 'Đã duyệt tố giác', data: item });
});

export const rejectReport = asyncHandler(async (req, res) => {
  const { reason } = req.body ?? {};
  const adminName = req.user?.username || req.user?.name || req.user?.email || 'admin';

  const update = {
    status: 'rejected',
    rejectedBy: adminName,
    rejectedAt: new Date(),
    decisionSource: 'web',
    ...(reason ? { rejectedReason: reason } : {}),
  };

  const item = await Report.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true
  });

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tố giác' });
  }

  // Sync decision to Telegram
  try {
    if (item.decisionMessageId && env.telegramGroupChatId) {
      const reasonText = reason ? `\nLý do: ${reason}` : '';
      await editMessageAfterDecision(item.decisionMessageId, {
        chatId: env.telegramGroupChatId,
        text: `❌ ĐÃ TỪ CHỐI (web)\nMã: ${item.reportCode}\nTừ chối bởi: ${adminName}${reasonText}`
      });
    }
  } catch (err) {
    console.warn('[report] Telegram edit failed on web reject:', err.message);
  }

  return successResponse({ res, message: 'Đã từ chối tố giác', data: item });
});

export const toggleAi = asyncHandler(async (req, res) => {
  const item = await Report.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tố giác' });
  }

  item.aiEnabled = !item.aiEnabled;
  await item.save();

  return successResponse({
    res,
    message: item.aiEnabled ? 'Đã bật AI cho tố giác' : 'Đã tắt AI cho tố giác',
    data: item
  });
});

export const getLinkedTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({ sourceReportId: req.params.id })
    .populate('assignee', 'hoTen capBac')
    .lean();

  if (!task) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy công việc liên kết' });
  }

  return successResponse({ res, message: 'Lấy công việc liên kết thành công', data: task });
});
