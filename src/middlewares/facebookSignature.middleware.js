import crypto from 'crypto';
import env from '../config/env.js';

const SIGNATURE_PREFIX = 'sha256=';

export const verifyFacebookSignature = (req, res, next) => {
  const signature = req.get('x-hub-signature-256');
  const appSecret = env.facebookAppSecret;
  const rawBody = req.body;

  if (!signature || !appSecret || !Buffer.isBuffer(rawBody)) {
    return res.status(403).json({ success: false, message: 'Thiếu hoặc sai chữ ký xác thực' });
  }

  if (!signature.startsWith(SIGNATURE_PREFIX)) {
    return res.status(403).json({ success: false, message: 'Chữ ký xác thực không hợp lệ' });
  }

  const expected =
    SIGNATURE_PREFIX +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const signatureBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return res.status(403).json({ success: false, message: 'Chữ ký xác thực không hợp lệ' });
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return res.status(403).json({ success: false, message: 'Chữ ký xác thực không hợp lệ' });
  }

  req.rawBody = rawBody;

  try {
    req.body = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ' });
  }

  return next();
};
