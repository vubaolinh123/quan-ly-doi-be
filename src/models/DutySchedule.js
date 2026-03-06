import mongoose from 'mongoose';

const dutyScheduleSchema = new mongoose.Schema(
  {
    caTruc: {
      type: String,
      enum: ['ca_1', 'ca_2', 'ca_3', 'ca_hanh_chinh'],
      required: [true, 'Ca trực là bắt buộc']
    },
    ngayTruc: {
      type: Date,
      required: [true, 'Ngày trực là bắt buộc']
    },
    gioBatDau: {
      type: String,
      required: [true, 'Giờ bắt đầu là bắt buộc']
    },
    gioKetThuc: {
      type: String,
      required: [true, 'Giờ kết thúc là bắt buộc']
    },
    canBoTruc: {
      type: String,
      required: [true, 'Cán bộ trực là bắt buộc'],
      trim: true
    },
    donVi: {
      type: String,
      trim: true,
      default: 'Đội CSHS'
    },
    diaDiemTruc: {
      type: String,
      trim: true,
      default: 'Trụ sở Công an'
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

const DutySchedule = mongoose.model('DutySchedule', dutyScheduleSchema);

export default DutySchedule;
