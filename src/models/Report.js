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
      facebookId: { type: String, trim: true },
      birthYear: { type: Number },
      idIssuedBy: { type: String, trim: true },
      idIssuedDate: { type: String, trim: true },
      permanentAddress: { type: String, trim: true },
      currentAddress: { type: String, trim: true }
    },
    suspectInfo: {
      name: { type: String, trim: true },
      currentAddress: { type: String, trim: true }
    },
    reportTitle: {
      type: String,
      trim: true,
      default: null
    },
    crimeType: {
      type: String,
      trim: true
    },
    crimeDescription: {
      type: String,
      trim: true
    },
    evidence: {
      type: String,
      trim: true
    },
    recipientAuthority: {
      type: String,
      trim: true
    },
    documentUrl: {
      type: String,
      default: null
    },
    documentGenerated: {
      type: Boolean,
      default: false
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
      type: String,
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    decisionMessageId: {
      type: String,
      trim: true,
      default: null
    },
    decisionUpdateId: {
      type: String,
      trim: true,
      default: null
    },
    rejectedBy: {
      type: String,
      trim: true,
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null
    },
    rejectedReason: {
      type: String,
      trim: true,
      default: null
    },
    decisionSource: {
      type: String,
      enum: ['telegram', 'web'],
      default: null
    },
    finalCategoryCode: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },
    aiEnabled: {
      type: Boolean,
      default: true
    },
    notes: [
      {
        text: { type: String, trim: true },
        source: { type: String, enum: ['ai', 'admin'], default: 'ai' },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ channel: 1, status: 1 });
reportSchema.index({ 'reporterInfo.facebookId': 1, status: 1 });

const Report = mongoose.model('Report', reportSchema);

export default Report;
