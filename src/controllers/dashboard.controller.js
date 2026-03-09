import Category from '../models/Category.js';
import Officer from '../models/Officer.js';
import Report from '../models/Report.js';
import Task from '../models/Task.js';
import asyncHandler from '../utils/asyncHandler.js';
import { successResponse } from '../utils/apiResponse.js';

const KANBAN_STATUSES = ['new', 'in_progress', 'review', 'done', 'returned'];

export const getDashboardOverview = asyncHandler(async (req, res) => {
  const now = new Date();

  const [
    totalTasks,
    inProgressTasks,
    doneTasks,
    overdueTasks,
    newReports,
    kanban,
    tasksByCategory,
    tasksByOfficer,
    categories,
    officers
  ] = await Promise.all([
    Task.countDocuments(),
    Task.countDocuments({ status: 'in_progress' }),
    Task.countDocuments({ status: 'done' }),
    Task.countDocuments({ status: { $ne: 'done' }, deadline: { $lt: now } }),
    Report.countDocuments({ status: 'pending_approval' }),
    Promise.all(
      KANBAN_STATUSES.map(async (status) => ({
        status,
        count: await Task.countDocuments({ status })
      }))
    ),
    Task.aggregate([{ $group: { _id: '$categoryCode', count: { $sum: 1 } } }]),
    Task.aggregate([{ $group: { _id: '$assignee', count: { $sum: 1 } } }]),
    Category.find({}, { code: 1, name: 1, color: 1 }).sort({ sortOrder: 1, code: 1 }),
    Officer.find({}, { hoTen: 1 })
  ]);

  const officerNameMap = new Map(officers.map((officer) => [String(officer._id), officer.hoTen]));

  return successResponse({
    res,
    message: 'Lấy dữ liệu tổng quan thành công',
    data: {
      stats: {
        totalTasks,
        inProgressTasks,
        doneTasks,
        overdueTasks,
        pendingReports: newReports
      },
      kanban,
      byCategory: categories.map((category) => {
        const hit = tasksByCategory.find((item) => item._id === category.code);
        return {
          categoryCode: category.code,
          categoryName: category.name,
          color: category.color,
          taskCount: hit?.count || 0
        };
      }),
      byOfficer: tasksByOfficer.map((item) => ({
        officerId: item._id,
        officerName: officerNameMap.get(String(item._id)) || 'Chưa xác định',
        taskCount: item.count
      }))
    }
  });
});
