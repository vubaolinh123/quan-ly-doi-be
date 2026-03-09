import mongoose from 'mongoose';

const officerSchema = new mongoose.Schema(
  {
    hoTen: {
      type: String,
      required: [true, 'Họ tên cán bộ là bắt buộc'],
      trim: true
    },
    capBac: {
      type: String,
      trim: true,
      default: 'Cán bộ'
    },
    chucVu: {
      type: String,
      trim: true,
      default: 'Cán bộ xử lý'
    },
    soDienThoai: {
      type: String,
      trim: true
    },
    categoryCodes: {
      type: [String],
      default: []
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

officerSchema.index({ hoTen: 1 });
officerSchema.index({ categoryCodes: 1, active: 1 });

const Officer = mongoose.model('Officer', officerSchema);

export default Officer;
