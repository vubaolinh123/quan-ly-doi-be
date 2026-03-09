import asyncHandler from '../utils/asyncHandler.js';
import env from '../config/env.js';
import { messageBatchService } from '../services/message-batch.service.js';
import { processBatch } from '../services/ai-orchestrator.service.js';

export const verifyFacebookWebhook = asyncHandler(async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.facebookVerifyToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ success: false, message: 'Verification failed' });
});

export const receiveFacebookWebhook = asyncHandler(async (req, res) => {
  const body = req.body;

  if (body.object !== 'page') {
    return res.status(400).json({ success: false, message: 'Not a page event' });
  }

  res.status(200).json({ success: true });

  for (const entry of body.entry || []) {
    for (const messaging of entry.messaging || []) {
      const senderId = messaging.sender?.id;
      const messageText = messaging.message?.text;

      if (!senderId || !messageText) continue;

      messageBatchService.addMessage(senderId, messageText, async (messages) => {
        try {
          await processBatch({ senderId, messages, facebookUserId: senderId });
        } catch (err) {
          console.error('[Webhook] processBatch error:', err);
        }
      });
    }
  }
});
