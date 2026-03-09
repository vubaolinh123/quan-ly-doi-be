import Officer from '../models/Officer.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

export const createOfficer = asyncHandler(async (req, res) => {
  const item = await Officer.create(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo cán bộ thành công',
    data: item
  });
});

export const getOfficers = asyncHandler(async (req, res) => {
  const { q = '', categoryCode, active, page = 1, limit = 50 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));
  const query = {};

  if (q) {
    query.$or = [{ hoTen: { $regex: q, $options: 'i' } }, { capBac: { $regex: q, $options: 'i' } }];
  }

  if (categoryCode) {
    query.categoryCodes = String(categoryCode).toUpperCase();
  }

  if (typeof active === 'string') {
    query.active = active === 'true';
  }

  const [items, total] = await Promise.all([
    Officer.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    Officer.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách cán bộ thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getOfficerById = asyncHandler(async (req, res) => {
  const item = await Officer.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy cán bộ' });
  }
  return successResponse({ res, message: 'Lấy chi tiết cán bộ thành công', data: item });
});

export const updateOfficer = asyncHandler(async (req, res) => {
  const item = await Officer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy cán bộ' });
  }

  return successResponse({ res, message: 'Cập nhật cán bộ thành công', data: item });
});

export const deleteOfficer = asyncHandler(async (req, res) => {
  const item = await Officer.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy cán bộ' });
  }
  return successResponse({ res, message: 'Xóa cán bộ thành công', data: item });
});
