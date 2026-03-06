import dotenv from 'dotenv';

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cong-tac-cshs',
  jwtSecret: process.env.JWT_SECRET || 'change_this_jwt_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@cshs.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123456'
};

export default env;
