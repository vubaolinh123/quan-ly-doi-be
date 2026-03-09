import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Mã hạng mục là bắt buộc'],
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Tên hạng mục là bắt buộc'],
      trim: true
    },
    color: {
      type: String,
      required: [true, 'Màu hạng mục là bắt buộc'],
      trim: true
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const Category = mongoose.model('Category', categorySchema);

export default Category;
