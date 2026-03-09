import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { messageBatchService } from '../services/message-batch.service.js';

export const verifyFacebookWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.facebookVerifyToken) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ success: false, message: 'Verification failed' });
};

export const receiveFacebookWebhook = asyncHandler(async (req, res) => {
  const body = req.body;

  if (body.object !== 'page') {
    return res.status(404).json({ success: false, message: 'Not a page event' });
  }

  res.status(200).json({ received: true });

  for (const entry of body.entry || []) {
    for (const messagingEvent of entry.messaging || []) {
      const senderId = messagingEvent.sender?.id;
      const messageText = messagingEvent.message?.text;

      if (!senderId || !messageText) {
        continue;
      }

      messageBatchService.addMessage(senderId, {
        messageId: messagingEvent.message.mid,
        text: messageText,
        timestamp: messagingEvent.timestamp || Date.now()
      });
    }
  }
});
