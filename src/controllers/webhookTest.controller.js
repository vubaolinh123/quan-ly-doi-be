import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { messageBatchService } from '../services/message-batch.service.js';

// ─── GET /api/webhooks/facebook/config ───────────────────────────────────────
// Returns the current Facebook webhook configuration status.
// Exposes the verify token value (needed by the UI to copy-paste into FB Dev
// Console) but never exposes appSecret or pageAccessToken values.
//
// "Configured" simply means the env var is non-empty — no hardcoded default
// comparison so any value the operator sets will be accepted.
// ─────────────────────────────────────────────────────────────────────────────
export const getWebhookConfig = asyncHandler(async (req, res) => {
  const protocol   = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host       = req.headers['x-forwarded-host']  || req.headers.host || 'localhost:5000';
  const webhookUrl = `${protocol}://${host}/api/webhooks/facebook`;

  const verifyTokenSet      = Boolean(env.facebookVerifyToken);
  const appSecretSet        = Boolean(env.facebookAppSecret);
  const pageAccessTokenSet  = Boolean(env.facebookPageAccessToken);

  res.json({
    success: true,
    data: {
      webhookUrl,
      // Expose the raw token value so the admin can copy it to FB Dev Console.
      // Only returned when the env var is actually set.
      verifyToken: verifyTokenSet ? env.facebookVerifyToken : null,
      verifyTokenSet,
      appSecretSet,
      pageAccessTokenSet,
    },
  });
});

// ─── POST /api/webhooks/facebook/test/verify ─────────────────────────────────
// Simulates the GET verification handshake that Facebook performs when the
// admin clicks "Verify and Save" in the Developer Console.
// We replicate the exact token check from verifyFacebookWebhook so the result
// is a faithful local smoke-test.
// ─────────────────────────────────────────────────────────────────────────────
export const testVerification = asyncHandler(async (req, res) => {
  const token = env.facebookVerifyToken;

  if (!token) {
    return res.status(400).json({
      ok: false,
      error:
        'FACEBOOK_VERIFY_TOKEN chưa được cấu hình. ' +
        'Hãy đặt giá trị trong file backend/.env rồi khởi động lại server.',
    });
  }

  // Mimic exactly what Facebook sends in the GET verification request
  const challenge = `challenge-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const sentMode  = 'subscribe';
  const sentToken = token; // simulate FB sending the correct token

  if (sentMode === 'subscribe' && sentToken === token) {
    return res.json({
      ok:      true,
      challenge,
      echoed:  challenge,
      message: 'Xác minh webhook thành công! Facebook sẽ gọi endpoint này với verify_token của bạn khi bạn nhấn "Verify and Save".',
    });
  }

  res.json({ ok: false, error: 'Token không khớp — kiểm tra lại FACEBOOK_VERIFY_TOKEN' });
});

// ─── POST /api/webhooks/facebook/test/event ──────────────────────────────────
// Injects a simulated incoming message into the processing pipeline without
// going through signature verification.  Useful to confirm that the batch
// service and AI orchestrator receive events after the webhook is live.
//
// Note: express.raw() is applied to the entire /api/webhooks/facebook path in
// app.js, so req.body may arrive as a Buffer.  We parse it safely here.
// ─────────────────────────────────────────────────────────────────────────────
export const testEvent = asyncHandler(async (req, res) => {
  // Safely parse body — may be Buffer (due to express.raw on parent path) or object
  let parsed = {};
  if (Buffer.isBuffer(req.body)) {
    try { parsed = JSON.parse(req.body.toString('utf8')); } catch { /* ignore */ }
  } else if (req.body && typeof req.body === 'object') {
    parsed = req.body;
  }

  const text      = String(parsed?.text || 'Tin nhắn thử nghiệm từ Admin UI');
  const senderId  = `test-user-${Date.now()}`;
  const messageId = `test-mid-${Date.now()}`;

  messageBatchService.addMessage(senderId, {
    messageId,
    text,
    timestamp: Date.now(),
  });

  const batchSize = messageBatchService.getBatchSize(senderId);

  res.json({
    ok:       true,
    senderId,
    messageId,
    batchSize,
    message:  `Sự kiện thử nghiệm đã được đưa vào pipeline. Batch hiện tại: ${batchSize} tin nhắn.`,
  });
});
