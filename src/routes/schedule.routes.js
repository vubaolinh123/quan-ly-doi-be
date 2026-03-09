import express from 'express';
import {
  createSchedule,
  deleteSchedule,
  getScheduleById,
  getSchedules,
  updateSchedule
} from '../controllers/schedule.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/').get(getSchedules).post(requireAdmin, createSchedule);
router
  .route('/:id')
  .get(getScheduleById)
  .put(requireAdmin, updateSchedule)
  .delete(requireAdmin, deleteSchedule);

export default router;
