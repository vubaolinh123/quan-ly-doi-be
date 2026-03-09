import express from 'express';
import { receiveFacebookWebhook, verifyFacebookWebhook } from '../controllers/webhook.controller.js';
import { verifyFacebookSignature } from '../middlewares/facebookSignature.middleware.js';

const router = express.Router();

router.get('/facebook', verifyFacebookWebhook);
router.post('/facebook', verifyFacebookSignature, receiveFacebookWebhook);

export default router;
