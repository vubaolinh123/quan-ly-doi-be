import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    hoTen: {
      type: String,
      required: [true, 'Họ tên là bắt buộc'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Mật khẩu là bắt buộc'],
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user'
    },
    chucVu: {
      type: String,
      trim: true,
      default: 'Cán bộ'
    },
    donViCongTac: {
      type: String,
      trim: true,
      default: 'Đội CSHS'
    },
    soDienThoai: {
      type: String,
      trim: true
    },
    trangThai: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function preSave(next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
