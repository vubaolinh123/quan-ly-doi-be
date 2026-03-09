import Category from '../models/Category.js';
import asyncHandler from '../utils/asyncHandler.js';
import { errorResponse, successResponse } from '../utils/apiResponse.js';

export const createCategory = asyncHandler(async (req, res) => {
  const item = await Category.create(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo hạng mục thành công',
    data: item
  });
});

export const getCategories = asyncHandler(async (req, res) => {
  const { q = '', active, page = 1, limit = 50 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));
  const query = {};

  if (q) {
    query.$or = [
      { code: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } }
    ];
  }

  if (typeof active === 'string') {
    query.active = active === 'true';
  }

  const [items, total] = await Promise.all([
    Category.find(query)
      .sort({ sortOrder: 1, code: 1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    Category.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách hạng mục thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const item = await Category.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy hạng mục' });
  }
  return successResponse({ res, message: 'Lấy chi tiết hạng mục thành công', data: item });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const item = await Category.findById(req.params.id);

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy hạng mục' });
  }

  if (item.isLocked) {
    return errorResponse({
      res,
      message: 'Hạng mục này được khóa hệ thống, không thể chỉnh sửa',
      statusCode: 403
    });
  }

  Object.assign(item, req.body);
  await item.save();

  return successResponse({ res, message: 'Cập nhật hạng mục thành công', data: item });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const item = await Category.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy hạng mục' });
  }

  if (item.isLocked) {
    return errorResponse({
      res,
      message: 'Hạng mục này được khóa hệ thống, không thể xóa',
      statusCode: 403
    });
  }

  await item.deleteOne();

  return successResponse({ res, message: 'Xóa hạng mục thành công', data: item });
});
