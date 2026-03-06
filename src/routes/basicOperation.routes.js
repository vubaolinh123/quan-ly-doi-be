import express from 'express';
import {
  createBasicOperationRecord,
  deleteBasicOperationRecord,
  getBasicOperationRecordById,
  getBasicOperationRecords,
  updateBasicOperationRecord
} from '../controllers/basicOperation.controller.js';

const router = express.Router();

router.route('/').post(createBasicOperationRecord).get(getBasicOperationRecords);
router
  .route('/:id')
  .get(getBasicOperationRecordById)
  .put(updateBasicOperationRecord)
  .delete(deleteBasicOperationRecord);

export default router;
