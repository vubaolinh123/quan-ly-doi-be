import express from 'express';
import {
  createTeam,
  deleteTeam,
  getTeamById,
  getTeams,
  updateTeam
} from '../controllers/team.controller.js';

const router = express.Router();

router.route('/').post(createTeam).get(getTeams);
router.route('/:id').get(getTeamById).put(updateTeam).delete(deleteTeam);

export default router;
