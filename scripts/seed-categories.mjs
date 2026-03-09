import mongoose from 'mongoose';
import env from '../src/config/env.js';
import { CATEGORY_CODES, CATEGORY_COLORS } from '../src/constants/domain.constants.js';

const mongoUri = process.env.MONGO_URI || env.mongoUri;

const seedCategories = async () => {
  try {
    await mongoose.connect(mongoUri);

    const entries = Object.entries(CATEGORY_CODES);

    for (const [index, [code, name]] of entries.entries()) {
      await mongoose.connection.collection('categories').updateOne(
        { code },
        {
          $set: {
            code,
            name,
            color: CATEGORY_COLORS[code],
            isLocked: true,
            active: true
          },
          $setOnInsert: {
            assignmentCursor: 0,
            sortOrder: index,
            createdAt: new Date()
          },
          $currentDate: {
            updatedAt: true
          }
        },
        { upsert: true }
      );

      console.log(`✅ Hạng mục [${code}]: [${name}] - đã tạo/cập nhật`);
    }

    console.log(`✅ Đã tạo/cập nhật ${entries.length} hạng mục`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Seed hạng mục thất bại: ${error.message}`);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

seedCategories();
