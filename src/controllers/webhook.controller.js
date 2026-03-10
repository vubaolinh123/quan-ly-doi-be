import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { messageBatchService } from '../services/message-batch.service.js';

// ─── GET /api/webhooks/facebook ───────────────────────────────────────────────
// Facebook calls this once during webhook setup to verify ownership.
// It sends hub.mode=subscribe, hub.verify_token, hub.challenge
// We must echo back hub.challenge if the token matches.
// ─────────────────────────────────────────────────────────────────────────────
export const verifyFacebookWebhook = (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log(`[webhook/fb] Verify request — mode=${mode}, tokenMatch=${token === env.facebookVerifyToken}`);

  if (mode === 'subscribe' && token === env.facebookVerifyToken) {
    console.log('[webhook/fb] ✅ Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.warn('[webhook/fb] ❌ Verification failed — token mismatch or wrong mode');
  return res.status(403).json({ success: false, message: 'Verification failed' });
};

// ─── Process a single messaging event ────────────────────────────────────────
const processMessagingEvent = (messagingEvent) => {
  const senderId = messagingEvent.sender?.id;
  const pageId   = messagingEvent.recipient?.id;

  if (!senderId) return;

  // ── Echo: message sent BY the page TO the user (not user → page)
  // Must be filtered out or the bot will process its own replies → infinite loop
  if (messagingEvent.message?.is_echo === true) {
    console.log(`[webhook/fb] Skip echo from page=${pageId} to ${senderId}`);
    return;
  }

  // ── Read receipts & delivery confirmations — no action needed
  if (messagingEvent.read || messagingEvent.delivery) return;

  // ── Text message ──────────────────────────────────────────────────────────
  if (messagingEvent.message?.text) {
    const preview = messagingEvent.message.text.slice(0, 80);
    console.log(`[webhook/fb] Text from ${senderId}: "${preview}${messagingEvent.message.text.length > 80 ? '…' : ''}"`);

    messageBatchService.addMessage(senderId, {
      messageId : messagingEvent.message.mid,
      text      : messagingEvent.message.text,
      timestamp : messagingEvent.timestamp || Date.now()
    });
    return;
  }

  // ── Attachment (image / audio / video / file / location / sticker) ────────
  if (messagingEvent.message?.attachments?.length) {
    const types   = messagingEvent.message.attachments.map(a => a.type).join(', ');
    const firstUrl = messagingEvent.message.attachments[0]?.payload?.url ?? '';
    const placeholder = `[${types.toUpperCase()}]${firstUrl ? ` ${firstUrl}` : ''}`;

    console.log(`[webhook/fb] Attachment(s) from ${senderId}: ${types}`);

    messageBatchService.addMessage(senderId, {
      messageId : messagingEvent.message.mid,
      text      : placeholder,
      timestamp : messagingEvent.timestamp || Date.now()
    });
    return;
  }

  // ── Postback (button tap / persistent menu click) ─────────────────────────
  if (messagingEvent.postback) {
    const label = messagingEvent.postback.title || messagingEvent.postback.payload;
    console.log(`[webhook/fb] Postback from ${senderId}: ${label}`);

    messageBatchService.addMessage(senderId, {
      messageId : `postback-${messagingEvent.timestamp || Date.now()}`,
      text      : label,
      timestamp : messagingEvent.timestamp || Date.now()
    });
    return;
  }

  // ── Quick-reply (already has message.text handled above, but safe fallback)
  if (messagingEvent.message?.quick_reply) {
    const payload = messagingEvent.message.quick_reply.payload;
    console.log(`[webhook/fb] Quick reply from ${senderId}: ${payload}`);
    messageBatchService.addMessage(senderId, {
      messageId : messagingEvent.message.mid,
      text      : messagingEvent.message.text || payload,
      timestamp : messagingEvent.timestamp || Date.now()
    });
    return;
  }

  // ── Unknown event type — log for diagnostics
  const keys = Object.keys(messagingEvent).join(', ');
  console.log(`[webhook/fb] Unhandled event type from ${senderId} — keys: ${keys}`);
};

// ─── POST /api/webhooks/facebook ─────────────────────────────────────────────
// Facebook delivers real-time events here after the webhook is verified.
// IMPORTANT: Must respond 200 within 20 seconds or Facebook will retry.
// We respond immediately then process asynchronously.
// ─────────────────────────────────────────────────────────────────────────────
export const receiveFacebookWebhook = asyncHandler(async (req, res) => {
  const body = req.body;

  console.log('[webhook/fb] POST received — object=%s, entries=%d',
    body?.object, body?.entry?.length ?? 0);

  if (body?.object !== 'page') {
    console.warn('[webhook/fb] ❌ 404 — object is not "page": %s', body?.object);
    return res.status(404).json({ success: false, message: 'Not a page event' });
  }

  // Acknowledge immediately — Facebook requires 200 within 20 s
  res.status(200).json({ received: true });

  // Process events outside the response cycle so errors don't trigger "headers already sent"
  try {
    let eventCount = 0;
    for (const entry of body.entry ?? []) {
      for (const messagingEvent of entry.messaging ?? []) {
        eventCount++;
        processMessagingEvent(messagingEvent);
      }
    }
    console.log('[webhook/fb] ✅ Processed %d event(s) from %d entr(ies)',
      eventCount, body.entry?.length ?? 0);
  } catch (err) {
    console.error('[webhook/fb] Error processing events:', err.message);
  }
});
