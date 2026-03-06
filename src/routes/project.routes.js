import express from 'express';
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjects,
  updateProject
} from '../controllers/project.controller.js';

const router = express.Router();

router.route('/').post(createProject).get(getProjects);
router.route('/:id').get(getProjectById).put(updateProject).delete(deleteProject);

export default router;
