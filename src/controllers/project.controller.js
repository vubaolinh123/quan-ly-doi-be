import Project from '../models/Project.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

export const createProject = asyncHandler(async (req, res) => {
  const item = await Project.create(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo chuyên án thành công',
    data: item
  });
});

export const getProjects = asyncHandler(async (req, res) => {
  const { q = '', page = 1, limit = 10 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));

  const query = {};
  if (q) {
    query.$or = [
      { maChuyenAn: { $regex: q, $options: 'i' } },
      { tenChuyenAn: { $regex: q, $options: 'i' } },
      { loaiToiPham: { $regex: q, $options: 'i' } },
      { diaBan: { $regex: q, $options: 'i' } },
      { chuTri: { $regex: q, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    Project.find(query)
      .populate('doiPhuTrach')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    Project.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách chuyên án thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getProjectById = asyncHandler(async (req, res) => {
  const item = await Project.findById(req.params.id).populate('doiPhuTrach');
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy chuyên án' });
  }
  return successResponse({ res, message: 'Lấy chi tiết chuyên án thành công', data: item });
});

export const updateProject = asyncHandler(async (req, res) => {
  const item = await Project.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('doiPhuTrach');

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy chuyên án' });
  }

  return successResponse({ res, message: 'Cập nhật chuyên án thành công', data: item });
});

export const deleteProject = asyncHandler(async (req, res) => {
  const item = await Project.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy chuyên án' });
  }
  return successResponse({ res, message: 'Xóa chuyên án thành công', data: item });
});
