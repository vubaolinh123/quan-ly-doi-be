import mongoose from 'mongoose';

/**
 * Persistent per-sender state for accumulated extracted data.
 *
 * Instead of making Gemini re-extract ALL fields from raw conversation text
 * on every call, we store the merged extractedData here and inject it into
 * the prompt. The AI only needs to extract NEW information from the latest message.
 *
 * TTL: 48 hours — auto-deleted if reporter goes silent.
 * Cleared explicitly when reportAction === 'new_report' and a different incident starts.
 */
const senderStateSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  extractedData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  currentStep: {
    type: String,
    default: 'step_1'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL: auto-delete after 48 hours
senderStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

const SenderState = mongoose.model('SenderState', senderStateSchema);

export default SenderState;
