import BasicOperationRecord from '../models/BasicOperationRecord.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

const validCategories = ['SUU_TRA', 'THANH_THIEU_NIEN_HU', 'TU_THA', 'TAM_THAN_NGAO_DA'];

export const createBasicOperationRecord = asyncHandler(async (req, res) => {
  const item = await BasicOperationRecord.create(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo hồ sơ nghiệp vụ cơ bản thành công',
    data: item
  });
});

export const getBasicOperationRecords = asyncHandler(async (req, res) => {
  const { q = '', category, page = 1, limit = 10 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));

  const query = {};

  if (category && validCategories.includes(category)) {
    query.category = category;
  }

  if (q) {
    query.$or = [
      { maHoSo: { $regex: q, $options: 'i' } },
      { hoTenDoiTuong: { $regex: q, $options: 'i' } },
      { cccd: { $regex: q, $options: 'i' } },
      { noiCuTru: { $regex: q, $options: 'i' } },
      { hanhViLienQuan: { $regex: q, $options: 'i' } },
      { diaBanQuanLy: { $regex: q, $options: 'i' } },
      { canBoPhuTrach: { $regex: q, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    BasicOperationRecord.find(query)
      .sort({ ngayGhiNhan: -1, createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    BasicOperationRecord.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách hồ sơ nghiệp vụ cơ bản thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getBasicOperationRecordById = asyncHandler(async (req, res) => {
  const item = await BasicOperationRecord.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ nghiệp vụ' });
  }
  return successResponse({ res, message: 'Lấy chi tiết hồ sơ nghiệp vụ thành công', data: item });
});

export const updateBasicOperationRecord = asyncHandler(async (req, res) => {
  const item = await BasicOperationRecord.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ nghiệp vụ' });
  }

  return successResponse({ res, message: 'Cập nhật hồ sơ nghiệp vụ thành công', data: item });
});

export const deleteBasicOperationRecord = asyncHandler(async (req, res) => {
  const item = await BasicOperationRecord.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ nghiệp vụ' });
  }
  return successResponse({ res, message: 'Xóa hồ sơ nghiệp vụ thành công', data: item });
});
