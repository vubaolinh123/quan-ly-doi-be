import mongoose from 'mongoose';
import { REPORT_CHANNELS, REPORT_STATUSES } from '../constants/domain.constants.js';

const reportSchema = new mongoose.Schema(
  {
    reportCode: {
      type: String,
      required: [true, 'Mã tố giác là bắt buộc'],
      unique: true,
      trim: true
    },
    channel: {
      type: String,
      enum: REPORT_CHANNELS,
      required: [true, 'Kênh tiếp nhận là bắt buộc']
    },
    content: {
      type: String,
      required: [true, 'Nội dung tố giác là bắt buộc'],
      trim: true
    },
    reporterInfo: {
      fullName: { type: String, trim: true },
      age: { type: Number },
      identityNumber: { type: String, trim: true },
      phone: { type: String, trim: true },
      facebookId: { type: String, trim: true }
    },
    categoryCode: {
      type: String,
      uppercase: true,
      trim: true
    },
    aiAnalysis: {
      summary: { type: String, trim: true },
      confidence: { type: Number, default: 0 },
      extractedSignals: { type: [String], default: [] }
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending_approval'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ channel: 1, status: 1 });

const Report = mongoose.model('Report', reportSchema);

export default Report;
