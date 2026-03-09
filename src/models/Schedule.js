import mongoose from 'mongoose';

const SHIFT_TYPES = ['S', 'N', 'CT'];

const scheduleSchema = new mongoose.Schema(
  {
    officer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Officer',
      required: [true, 'Cán bộ là bắt buộc']
    },
    date: {
      type: Date,
      required: [true, 'Ngày làm việc là bắt buộc']
    },
    shiftType: {
      type: String,
      enum: SHIFT_TYPES,
      required: [true, 'Loại ca là bắt buộc']
    },
    note: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

scheduleSchema.index({ officer: 1, date: 1 }, { unique: true });

const Schedule = mongoose.model('Schedule', scheduleSchema);

export default Schedule;
