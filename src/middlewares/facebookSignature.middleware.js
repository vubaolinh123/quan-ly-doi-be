import crypto from 'crypto';
import env from '../config/env.js';

export const verifyFacebookSignature = (req, res, next) => {
  if (!env.facebookAppSecret) return next();

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(403).json({ success: false, message: 'Missing Facebook signature' });
  }

  const expected =
    'sha256=' + crypto.createHmac('sha256', env.facebookAppSecret).update(req.rawBody || '').digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return res.status(403).json({ success: false, message: 'Invalid Facebook signature' });
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return res.status(403).json({ success: false, message: 'Invalid Facebook signature' });
  }

  next();
};
