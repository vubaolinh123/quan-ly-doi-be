import express from 'express';
import {
  createOfficialDispatch,
  deleteOfficialDispatch,
  getOfficialDispatchById,
  getOfficialDispatches,
  updateOfficialDispatch
} from '../controllers/officialDispatch.controller.js';

const router = express.Router();

router.route('/').post(createOfficialDispatch).get(getOfficialDispatches);
router
  .route('/:id')
  .get(getOfficialDispatchById)
  .put(updateOfficialDispatch)
  .delete(deleteOfficialDispatch);

export default router;
