import express from 'express';
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory
} from '../controllers/category.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/').get(getCategories).post(requireAdmin, createCategory);
router.route('/:id').get(getCategoryById).put(requireAdmin, updateCategory).delete(requireAdmin, deleteCategory);

export default router;
