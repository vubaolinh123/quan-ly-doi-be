import Report from '../models/Report.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

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
