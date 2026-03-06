import express from 'express';
import {
  createDutySchedule,
  deleteDutySchedule,
  getDutyScheduleById,
  getDutySchedules,
  updateDutySchedule
} from '../controllers/dutySchedule.controller.js';

const router = express.Router();

router.route('/').post(createDutySchedule).get(getDutySchedules);
router.route('/:id').get(getDutyScheduleById).put(updateDutySchedule).delete(deleteDutySchedule);

export default router;
