import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'singleton' },
    /**
     * Controls the report intake filter behaviour:
     *   true  (default) — AI pipeline: Gemini analyses every message,
     *                     confidence threshold applied before creating a Report.
     *   false           — Fast-path: messages containing fraud keywords
     *                     bypass Gemini and create a Report immediately.
     */
    reportFilterEnabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

/**
 * Atomic singleton accessor.
 * Uses a fixed _id='singleton' + findOneAndUpdate upsert so concurrent
 * calls never race to create two documents.
 */
systemConfigSchema.statics.getSingleton = async function () {
  return this.findOneAndUpdate(
    { _id: 'singleton' },
    { $setOnInsert: { reportFilterEnabled: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
};

const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);
export default SystemConfig;
