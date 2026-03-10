import dotenv from 'dotenv';

dotenv.config();

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cong-tac-cshs',
  jwtSecret: process.env.JWT_SECRET || 'change_this_jwt_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@cshs.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123456',
  // Facebook
  facebookVerifyToken:      process.env.FACEBOOK_VERIFY_TOKEN      || '',
  facebookPageAccessToken:  process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
  facebookAppSecret:        process.env.FACEBOOK_APP_SECRET        || '',
  // Gemini
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || 'change_this_tg_secret',
  // Batching
  messageBatchWindowMs: toPositiveInt(process.env.MESSAGE_BATCH_WINDOW_MS, 5000)
};

export default env;
