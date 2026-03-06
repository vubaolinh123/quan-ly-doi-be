import mongoose from 'mongoose';

const CATEGORIES = ['SUU_TRA', 'THANH_THIEU_NIEN_HU', 'TU_THA', 'TAM_THAN_NGAO_DA'];

const basicOperationRecordSchema = new mongoose.Schema(
  {
    maHoSo: {
      type: String,
      required: [true, 'Mã hồ sơ là bắt buộc'],
      unique: true,
      trim: true
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: [true, 'Danh mục nghiệp vụ là bắt buộc']
    },
    hoTenDoiTuong: {
      type: String,
      required: [true, 'Họ tên đối tượng là bắt buộc'],
      trim: true
    },
    namSinh: {
      type: Number
    },
    gioiTinh: {
      type: String,
      enum: ['nam', 'nu', 'khac'],
      default: 'nam'
    },
    cccd: {
      type: String,
      trim: true
    },
    noiCuTru: {
      type: String,
      trim: true
    },
    hanhViLienQuan: {
      type: String,
      trim: true
    },
    diaBanQuanLy: {
      type: String,
      trim: true
    },
    canBoPhuTrach: {
      type: String,
      trim: true
    },
    ngayGhiNhan: {
      type: Date,
      required: [true, 'Ngày ghi nhận là bắt buộc']
    },
    tinhTrangHoSo: {
      type: String,
      enum: ['theo_doi', 'da_chuyen_hoa', 'tam_dung'],
      default: 'theo_doi'
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

const BasicOperationRecord = mongoose.model('BasicOperationRecord', basicOperationRecordSchema);

export default BasicOperationRecord;
