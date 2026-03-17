import mongoose from 'mongoose';

/**
 * Stores a "pending confirmation" entry when the AI has determined that enough
 * data has been collected (documentReady === true) but the reporter has NOT yet
 * confirmed the summary.  The orchestrator intercepts subsequent messages from
 * this senderId and routes them through the confirmation / correction flow
 * instead of the normal Gemini analysis path.
 *
 * TTL: documents expire automatically after 48 hours if the reporter never
 * replies, preventing stale entries from blocking a sender permanently.
 */
const pendingConfirmationSchema = new mongoose.Schema(
  {
    /** Facebook PSID of the reporter */
    senderId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    /**
     * AI-extracted data collected so far.
     * Keyed by the same field names as the AI JSON schema
     * (reporterName, reporterBirthYear, …, crimeDescription, evidence, etc.)
     */
    extractedData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {}
    },

    /**
     * Full AI analysis snapshot saved at the point documentReady became true.
     * Used by finalizePendingConfirmation to reconstruct Report fields.
     */
    analysisSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    /**
     * Raw conversation text captured when entering confirmation flow.
     * Used as Report.content once the reporter confirms.
     */
    sourceContent: {
      type: String,
      default: ''
    },

    /**
     * "new_report" or "supplement_existing_report" — mirrors analysis.reportAction.
     * Determines whether finalization creates a new Report or supplements an
     * existing pending one.
     */
    reportAction: {
      type: String,
      enum: ['new_report', 'supplement_existing_report'],
      default: 'new_report'
    },

    /**
     * If reportAction === "supplement_existing_report", this is the _id of the
     * existing pending Report that should receive the supplement.
     */
    openReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null
    },

    /**
     * How many times the confirmation bullet list has been sent.
     * Used to break out of an infinite correction loop after MAX_ATTEMPTS.
     */
    attempts: {
      type: Number,
      default: 0
    },

    /**
     * Creation timestamp — also drives the TTL index.
     * Mongoose normally sets createdAt via `timestamps: true`, but we declare
     * it explicitly here so we can attach a TTL index directly to this field.
     */
    createdAt: {
      type: Date,
      default: Date.now
    }
  }
);

// TTL: MongoDB removes the document automatically 48 hours after createdAt.
pendingConfirmationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

const PendingConfirmation = mongoose.model('PendingConfirmation', pendingConfirmationSchema);

export default PendingConfirmation;
