import express from 'express';
import authRoutes from './auth.routes.js';
import categoryRoutes from './category.routes.js';
import officerRoutes from './officer.routes.js';
import taskRoutes from './task.routes.js';
import reportRoutes from './report.routes.js';
import scheduleRoutes from './schedule.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import webhookRoutes from './webhook.routes.js';
import telegramRoutes from './telegram.routes.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/webhooks/telegram', telegramRoutes);
router.use('/categories', protect, categoryRoutes);
router.use('/officers', protect, officerRoutes);
router.use('/tasks', protect, taskRoutes);
router.use('/reports', protect, reportRoutes);
router.use('/schedules', protect, scheduleRoutes);
router.use('/dashboard', protect, dashboardRoutes);

export default router;
