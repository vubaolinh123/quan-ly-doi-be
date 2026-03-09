import mongoose from 'mongoose';
import Task from '../models/Task.js';
import { TASK_STATUSES } from '../constants/domain.constants.js';
import { assignOfficerToTask } from '../services/assignment.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

const allowedStatuses = TASK_STATUSES;

export const createTask = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (!payload.assignee) {
    try {
      const officer = await assignOfficerToTask(payload.categoryCode);
      payload.assignee = officer._id;
    } catch (error) {
      if (error.code === 'NO_OFFICER_FOR_CATEGORY') {
        return res.status(422).json({
          success: false,
          message: error.message
        });
      }

      throw error;
    }
  }

  const item = await Task.create(payload);
  const populated = await Task.findById(item._id).populate('assignee').populate('sourceReportId');

  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo công việc thành công',
    data: populated
  });
});

export const getTasks = asyncHandler(async (req, res) => {
  const { q = '', categoryCode, status, assignee, page = 1, limit = 20 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));
  const query = {};

  if (q) {
    query.$or = [{ title: { $regex: q, $options: 'i' } }, { description: { $regex: q, $options: 'i' } }];
  }

  if (categoryCode) {
    query.categoryCode = String(categoryCode).toUpperCase();
  }

  if (status && allowedStatuses.includes(String(status))) {
    query.status = status;
  }

  if (assignee && mongoose.Types.ObjectId.isValid(String(assignee))) {
    query.assignee = assignee;
  }

  const [items, total] = await Promise.all([
    Task.find(query)
      .populate('assignee')
      .populate('sourceReportId')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    Task.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách công việc thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getTaskById = asyncHandler(async (req, res) => {
  const item = await Task.findById(req.params.id).populate('assignee').populate('sourceReportId');
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
  }
  return successResponse({ res, message: 'Lấy chi tiết công việc thành công', data: item });
});

export const updateTask = asyncHandler(async (req, res) => {
  const item = await Task.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  })
    .populate('assignee')
    .populate('sourceReportId');

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
  }

  return successResponse({ res, message: 'Cập nhật công việc thành công', data: item });
});

export const deleteTask = asyncHandler(async (req, res) => {
  const item = await Task.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy công việc' });
  }
  return successResponse({ res, message: 'Xóa công việc thành công', data: item });
});
