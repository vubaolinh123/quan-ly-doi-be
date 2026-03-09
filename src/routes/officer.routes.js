import express from 'express';
import {
  createOfficer,
  deleteOfficer,
  getOfficerById,
  getOfficers,
  updateOfficer
} from '../controllers/officer.controller.js';
import { requireAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.route('/').get(getOfficers).post(requireAdmin, createOfficer);
router.route('/:id').get(getOfficerById).put(requireAdmin, updateOfficer).delete(requireAdmin, deleteOfficer);

export default router;
