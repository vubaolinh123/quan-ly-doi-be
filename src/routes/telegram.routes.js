import express from 'express';
import { receiveTelegramWebhook } from '../controllers/telegram.controller.js';
import { verifyTelegramSecret } from '../middlewares/telegramSecret.middleware.js';

const router = express.Router();

router.post('/', verifyTelegramSecret, receiveTelegramWebhook);

export default router;
