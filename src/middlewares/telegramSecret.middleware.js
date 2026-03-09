import env from '../config/env.js';

export const verifyTelegramSecret = (req, res, next) => {
  const token = req.get('X-Telegram-Bot-Api-Secret-Token');

  if (!token || token !== env.telegramWebhookSecret) {
    return res.status(403).json({ success: false, message: 'Secret token Telegram không hợp lệ' });
  }

  return next();
};
