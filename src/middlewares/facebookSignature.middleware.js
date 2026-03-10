import crypto from 'crypto';
import env from '../config/env.js';

const SIGNATURE_PREFIX = 'sha256=';

export const verifyFacebookSignature = (req, res, next) => {
  const signature = req.get('x-hub-signature-256');
  const appSecret = env.facebookAppSecret;
  const rawBody   = req.body;

  // ── 1. Pre-condition checks ───────────────────────────────────────────────
  if (!appSecret) {
    console.warn(
      '[fb-sig] ⚠️  FACEBOOK_APP_SECRET not configured — signature verification DISABLED. ' +
      'All Facebook webhook POSTs will be accepted without HMAC check. ' +
      'Set FACEBOOK_APP_SECRET in .env to enable verification.'
    );
    // Still parse the raw body so downstream handlers receive a JS object
    if (Buffer.isBuffer(rawBody)) {
      req.rawBody = rawBody;
      try {
        req.body = JSON.parse(rawBody.toString('utf8'));
      } catch (parseError) {
        console.error('[fb-sig] ❌ 400 — JSON parse failed (no-secret path):', parseError.message);
        return res.status(400).json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ' });
      }
    }
    return next();
  }

  if (!signature) {
    console.warn('[fb-sig] ❌ 403 — missing x-hub-signature-256 header');
    console.warn('[fb-sig]   headers received:', Object.keys(req.headers).join(', '));
    return res.status(403).json({ success: false, message: 'Thiếu hoặc sai chữ ký xác thực' });
  }

  if (!Buffer.isBuffer(rawBody)) {
    console.error(
      '[fb-sig] ❌ 403 — req.body is not a Buffer (type=%s). ' +
      'Check that express.raw() is applied BEFORE express.json() for this path.',
      typeof rawBody
    );
    return res.status(403).json({ success: false, message: 'Thiếu hoặc sai chữ ký xác thực' });
  }

  // ── 2. Signature format check ─────────────────────────────────────────────
  if (!signature.startsWith(SIGNATURE_PREFIX)) {
    console.warn('[fb-sig] ❌ 403 — signature does not start with "sha256=": %s', signature.slice(0, 20));
    return res.status(403).json({ success: false, message: 'Chữ ký xác thực không hợp lệ' });
  }

  // ── 3. HMAC comparison ────────────────────────────────────────────────────
  const expected =
    SIGNATURE_PREFIX +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer  = Buffer.from(expected, 'utf8');

  if (signatureBuffer.length !== expectedBuffer.length) {
    console.warn(
      '[fb-sig] ❌ 403 — signature length mismatch (received=%d, expected=%d). ' +
      'FACEBOOK_APP_SECRET is likely wrong.',
      signatureBuffer.length, expectedBuffer.length
    );
    console.warn('[fb-sig]   received : %s', signature.slice(0, 32) + '…');
    console.warn('[fb-sig]   expected : %s', expected.slice(0, 32) + '…');
    return res.status(403).json({ success: false, message: 'Chữ ký xác thực không hợp lệ' });
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    console.warn(
      '[fb-sig] ❌ 403 — HMAC mismatch. FACEBOOK_APP_SECRET is likely wrong or body was mutated.'
    );
    console.warn('[fb-sig]   received : %s', signature.slice(0, 32) + '…');
    console.warn('[fb-sig]   expected : %s', expected.slice(0, 32) + '…');
    console.warn('[fb-sig]   body size: %d bytes', rawBody.length);
    return res.status(403).json({ success: false, message: 'Chữ ký xác thực không hợp lệ' });
  }

  // ── 4. All good — parse JSON body and continue ────────────────────────────
  console.log('[fb-sig] ✅ Signature valid — body %d bytes', rawBody.length);

  req.rawBody = rawBody;

  try {
    req.body = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    console.error('[fb-sig] ❌ 400 — JSON parse failed:', error.message);
    return res.status(400).json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ' });
  }

  return next();
};
