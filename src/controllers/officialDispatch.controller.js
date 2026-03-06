import OfficialDispatch from '../models/OfficialDispatch.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

export const createOfficialDispatch = asyncHandler(async (req, res) => {
  const item = await OfficialDispatch.create(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo công văn thành công',
    data: item
  });
});

export const getOfficialDispatches = asyncHandler(async (req, res) => {
  const { q = '', type, page = 1, limit = 10 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));

  const query = {};

  if (type && ['incoming', 'outgoing'].includes(type)) {
    query.type = type;
  }

  if (q) {
    query.$or = [
      { soCongVan: { $regex: q, $options: 'i' } },
      { trichYeu: { $regex: q, $options: 'i' } },
      { coQuanGuiNhan: { $regex: q, $options: 'i' } },
      { nguoiKy: { $regex: q, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    OfficialDispatch.find(query)
      .sort({ ngayBanHanh: -1, createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    OfficialDispatch.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách công văn thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getOfficialDispatchById = asyncHandler(async (req, res) => {
  const item = await OfficialDispatch.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy công văn' });
  }
  return successResponse({ res, message: 'Lấy chi tiết công văn thành công', data: item });
});

export const updateOfficialDispatch = asyncHandler(async (req, res) => {
  const item = await OfficialDispatch.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy công văn' });
  }

  return successResponse({ res, message: 'Cập nhật công văn thành công', data: item });
});

export const deleteOfficialDispatch = asyncHandler(async (req, res) => {
  const item = await OfficialDispatch.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy công văn' });
  }
  return successResponse({ res, message: 'Xóa công văn thành công', data: item });
});
