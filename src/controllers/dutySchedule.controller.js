import DutySchedule from '../models/DutySchedule.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

export const createDutySchedule = asyncHandler(async (req, res) => {
  const item = await DutySchedule.create(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo lịch trực thành công',
    data: item
  });
});

export const getDutySchedules = asyncHandler(async (req, res) => {
  const { q = '', page = 1, limit = 10 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));

  const query = {};
  if (q) {
    query.$or = [
      { caTruc: { $regex: q, $options: 'i' } },
      { canBoTruc: { $regex: q, $options: 'i' } },
      { donVi: { $regex: q, $options: 'i' } },
      { diaDiemTruc: { $regex: q, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    DutySchedule.find(query)
      .sort({ ngayTruc: -1, createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    DutySchedule.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách lịch trực thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getDutyScheduleById = asyncHandler(async (req, res) => {
  const item = await DutySchedule.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trực' });
  }
  return successResponse({ res, message: 'Lấy chi tiết lịch trực thành công', data: item });
});

export const updateDutySchedule = asyncHandler(async (req, res) => {
  const item = await DutySchedule.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trực' });
  }

  return successResponse({ res, message: 'Cập nhật lịch trực thành công', data: item });
});

export const deleteDutySchedule = asyncHandler(async (req, res) => {
  const item = await DutySchedule.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy lịch trực' });
  }
  return successResponse({ res, message: 'Xóa lịch trực thành công', data: item });
});
