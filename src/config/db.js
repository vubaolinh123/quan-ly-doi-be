import mongoose from 'mongoose';
import env from './env.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 5_000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};
