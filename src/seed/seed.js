import mongoose from 'mongoose';
import env from '../config/env.js';
import { connectDB } from '../config/db.js';
import { CATEGORY_CODES, CATEGORY_COLORS } from '../constants/domain.constants.js';
import Category from '../models/Category.js';
import Officer from '../models/Officer.js';
import User from '../models/User.js';

const categoryEntries = Object.entries(CATEGORY_CODES);

const sampleOfficers = [
  {
    hoTen: 'Nguyễn Văn An',
    capBac: 'Đại úy',
    chucVu: 'Điều tra viên',
    soDienThoai: '0900000001',
    categoryCodes: ['DB', 'LD', 'KHXM'],
    active: true
  },
  {
    hoTen: 'Trần Thị Bình',
    capBac: 'Thượng úy',
    chucVu: 'Cán bộ xử lý',
    soDienThoai: '0900000002',
    categoryCodes: ['TDD', 'VK'],
    active: true
  },
  {
    hoTen: 'Lê Minh Châu',
    capBac: 'Thiếu tá',
    chucVu: 'Điều tra viên',
    soDienThoai: '0900000003',
    categoryCodes: ['MBDL', 'TMDT', 'BC'],
    active: true
  },
  {
    hoTen: 'Phạm Quốc Dũng',
    capBac: 'Đại úy',
    chucVu: 'Cán bộ chuyên án',
    soDienThoai: '0900000004',
    categoryCodes: ['MD', 'BVTE', 'DB'],
    active: true
  },
  {
    hoTen: 'Hoàng Mai Em',
    capBac: 'Trung úy',
    chucVu: 'Cán bộ nghiệp vụ',
    soDienThoai: '0900000005',
    categoryCodes: ['KHXM', 'TDD', 'LD'],
    active: true
  }
];

const ensureAdmin = async () => {
  const existingAdmin = await User.findOne({ email: env.adminEmail });
  if (existingAdmin) {
    return existingAdmin;
  }

  return User.create({
    email: env.adminEmail,
    password: env.adminPassword,
    role: 'admin',
    hoTen: 'Admin CSHS'
  });
};

const seed = async () => {
  try {
    await connectDB();
    const admin = await ensureAdmin();

    await Promise.all([Category.deleteMany({}), Officer.deleteMany({})]);

    await Category.insertMany(
      categoryEntries.map(([code, name], index) => ({
        code,
        name,
        color: CATEGORY_COLORS[code],
        sortOrder: index,
        assignmentCursor: 0,
        active: true,
        isLocked: true
      }))
    );

    await Officer.insertMany(sampleOfficers);

    console.log('✅ Seed dữ liệu thành công');
    console.log(`👤 Admin: ${admin.email}`);
    console.log(`📂 Categories: ${categoryEntries.length}`);
    console.log(`👮 Officers: ${sampleOfficers.length}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed dữ liệu thất bại:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

seed();
