import express from 'express';
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasks,
  updateTask
} from '../controllers/task.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/').get(getTasks).post(requireAdmin, createTask);
router.route('/:id').get(getTaskById).put(requireAdmin, updateTask).delete(requireAdmin, deleteTask);

export default router;
