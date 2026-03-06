import mongoose from 'mongoose';

const officialDispatchSchema = new mongoose.Schema(
  {
    soCongVan: {
      type: String,
      required: [true, 'Số công văn là bắt buộc'],
      unique: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['incoming', 'outgoing'],
      required: [true, 'Loại công văn là bắt buộc']
    },
    trichYeu: {
      type: String,
      required: [true, 'Trích yếu là bắt buộc'],
      trim: true
    },
    coQuanGuiNhan: {
      type: String,
      required: [true, 'Cơ quan gửi/nhận là bắt buộc'],
      trim: true
    },
    ngayBanHanh: {
      type: Date,
      required: [true, 'Ngày ban hành là bắt buộc']
    },
    nguoiKy: {
      type: String,
      trim: true
    },
    mucDoMat: {
      type: String,
      enum: ['thuong', 'mat', 'toi_mat'],
      default: 'thuong'
    },
    mucDoKhan: {
      type: String,
      enum: ['thuong', 'khan', 'hoa_toc'],
      default: 'thuong'
    },
    hanXuLy: {
      type: Date
    },
    trangThaiXuLy: {
      type: String,
      enum: ['chua_xu_ly', 'dang_xu_ly', 'da_hoan_thanh'],
      default: 'chua_xu_ly'
    },
    ghiChu: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const OfficialDispatch = mongoose.model('OfficialDispatch', officialDispatchSchema);

export default OfficialDispatch;
