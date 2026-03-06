import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    maDoi: {
      type: String,
      required: [true, 'Mã đội là bắt buộc'],
      unique: true,
      trim: true
    },
    tenDoi: {
      type: String,
      required: [true, 'Tên đội là bắt buộc'],
      trim: true
    },
    doiTruong: {
      type: String,
      trim: true
    },
    soCanBo: {
      type: Number,
      default: 0
    },
    linhVucPhuTrach: {
      type: String,
      trim: true
    },
    moTa: {
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

const Team = mongoose.model('Team', teamSchema);

export default Team;
