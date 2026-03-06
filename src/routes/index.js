import express from 'express';
import authRoutes from './auth.routes.js';
import teamRoutes from './team.routes.js';
import projectRoutes from './project.routes.js';
import dutyScheduleRoutes from './dutySchedule.routes.js';
import officialDispatchRoutes from './officialDispatch.routes.js';
import basicOperationRoutes from './basicOperation.routes.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/teams', protect, teamRoutes);
router.use('/projects', protect, projectRoutes);
router.use('/duty-schedules', protect, dutyScheduleRoutes);
router.use('/official-dispatches', protect, officialDispatchRoutes);
router.use('/basic-operations', protect, basicOperationRoutes);

export default router;
