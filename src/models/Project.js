import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    maChuyenAn: {
      type: String,
      required: [true, 'Mã chuyên án là bắt buộc'],
      unique: true,
      trim: true
    },
    tenChuyenAn: {
      type: String,
      required: [true, 'Tên chuyên án là bắt buộc'],
      trim: true
    },
    loaiToiPham: {
      type: String,
      trim: true
    },
    diaBan: {
      type: String,
      trim: true
    },
    ngayBatDau: {
      type: Date,
      required: [true, 'Ngày bắt đầu là bắt buộc']
    },
    ngayKetThuc: {
      type: Date
    },
    chuTri: {
      type: String,
      trim: true
    },
    doiPhuTrach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    mucDoUuTien: {
      type: String,
      enum: ['thap', 'trung_binh', 'cao', 'khancap'],
      default: 'trung_binh'
    },
    trangThai: {
      type: String,
      enum: ['mo', 'dang_dieu_tra', 'tam_dung', 'ket_thuc'],
      default: 'mo'
    },
    ketQuaSoBo: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Project = mongoose.model('Project', projectSchema);

export default Project;
