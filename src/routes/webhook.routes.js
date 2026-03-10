import express from 'express';
import { receiveFacebookWebhook, verifyFacebookWebhook } from '../controllers/webhook.controller.js';
import { verifyFacebookSignature } from '../middlewares/facebookSignature.middleware.js';
import { getWebhookConfig, getTelegramConfig, testEvent, testTelegram, testVerification } from '../controllers/webhookTest.controller.js';

const router = express.Router();

// ── Facebook webhook (public, signature-verified for POST) ───────────────────
router.get('/facebook',  verifyFacebookWebhook);
router.post('/facebook', verifyFacebookSignature, receiveFacebookWebhook);

// ── Admin test endpoints (no signature required — for UI testing) ─────────────
// These sit UNDER /api/webhooks/facebook so express.raw() from app.js also
// applies; the controllers handle Buffer bodies where needed.
router.get('/facebook/config',        getWebhookConfig);
router.post('/facebook/test/verify',  testVerification);
router.post('/facebook/test/event',   testEvent);

// ── Telegram test endpoints ───────────────────────────────────────────────────
router.get('/telegram/config',  getTelegramConfig);
router.post('/telegram/test',   testTelegram);

export default router;
