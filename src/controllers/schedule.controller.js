import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

export const createSchedule = asyncHandler(async (req, res) => {
  const item = await Schedule.create(req.body);
  const populated = await Schedule.findById(item._id).populate('officer');

  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo lịch làm việc thành công',
    data: populated
  });
});

export const getSchedules = asyncHandler(async (req, res) => {
  const { officerId, from, to, shiftType, page = 1, limit = 200 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));
  const query = {};

  if (officerId && mongoose.Types.ObjectId.isValid(String(officerId))) {
    query.officer = officerId;
  }

  if (shiftType) {
    query.shiftType = shiftType;
  }

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(String(from));
    if (to) query.date.$lte = new Date(String(to));
  }

  const [items, total] = await Promise.all([
    Schedule.find(query)
      .populate('officer')
      .sort({ date: 1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    Schedule.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách lịch làm việc thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getScheduleById = asyncHandler(async (req, res) => {
  const item = await Schedule.findById(req.params.id).populate('officer');
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy lịch làm việc' });
  }
  return successResponse({ res, message: 'Lấy chi tiết lịch làm việc thành công', data: item });
});

export const updateSchedule = asyncHandler(async (req, res) => {
  const item = await Schedule.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('officer');

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy lịch làm việc' });
  }

  return successResponse({ res, message: 'Cập nhật lịch làm việc thành công', data: item });
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  const item = await Schedule.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy lịch làm việc' });
  }
  return successResponse({ res, message: 'Xóa lịch làm việc thành công', data: item });
});
