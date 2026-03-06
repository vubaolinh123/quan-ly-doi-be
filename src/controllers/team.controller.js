import Team from '../models/Team.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

export const createTeam = asyncHandler(async (req, res) => {
  const team = await Team.create(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: 'Tạo đội công tác thành công',
    data: team
  });
});

export const getTeams = asyncHandler(async (req, res) => {
  const { q = '', page = 1, limit = 10 } = req.query;
  const currentPage = Math.max(1, Number(page));
  const pageSize = Math.max(1, Number(limit));

  const query = {};
  if (q) {
    query.$or = [
      { maDoi: { $regex: q, $options: 'i' } },
      { tenDoi: { $regex: q, $options: 'i' } },
      { doiTruong: { $regex: q, $options: 'i' } },
      { linhVucPhuTrach: { $regex: q, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    Team.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
    Team.countDocuments(query)
  ]);

  return successResponse({
    res,
    message: 'Lấy danh sách đội công tác thành công',
    data: items,
    meta: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  });
});

export const getTeamById = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy đội công tác' });
  }
  return successResponse({ res, message: 'Lấy chi tiết đội công tác thành công', data: team });
});

export const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!team) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy đội công tác' });
  }

  return successResponse({ res, message: 'Cập nhật đội công tác thành công', data: team });
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findByIdAndDelete(req.params.id);
  if (!team) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy đội công tác' });
  }
  return successResponse({ res, message: 'Xóa đội công tác thành công', data: team });
});
