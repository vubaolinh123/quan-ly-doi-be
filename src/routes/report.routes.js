import express from 'express';
import {
  createReport,
  deleteReport,
  getReportById,
  getReports,
  updateReport
} from '../controllers/report.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/').get(getReports).post(requireAdmin, createReport);
router.route('/:id').get(getReportById).put(requireAdmin, updateReport).delete(requireAdmin, deleteReport);

export default router;
