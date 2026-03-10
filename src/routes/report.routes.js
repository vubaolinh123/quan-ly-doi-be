import express from 'express';
import {
  approveReport,
  createReport,
  deleteReport,
  getReportById,
  getReports,
  rejectReport,
  toggleAi,
  updateReport
} from '../controllers/report.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/').get(getReports).post(requireAdmin, createReport);
router.route('/:id').get(getReportById).put(requireAdmin, updateReport).delete(requireAdmin, deleteReport);
router.post('/:id/approve', requireAdmin, approveReport);
router.post('/:id/reject', requireAdmin, rejectReport);
router.patch('/:id/ai-toggle', requireAdmin, toggleAi);

export default router;
