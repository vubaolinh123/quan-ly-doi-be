import mongoose from 'mongoose';

/**
 * Persistent per-sender conversation log.
 *
 * Every inbound Facebook message and every outbound AI reply is stored here.
 * The AI orchestrator reads the N most recent entries for a sender and injects
 * them into the prompt as "lịch sử hội thoại" so the model can reply in context
 * instead of repeating the same follow-up questions each batch.
 *
 * direction:
 *   'inbound'  — message sent BY the user TO the page
 *   'outbound' — AI follow-up reply sent FROM the page TO the user
 */
const conversationMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
      trim: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true
    }
  },
  {
    timestamps: true // createdAt used for ordering
  }
);

// Primary lookup: newest N messages for a sender
conversationMessageSchema.index({ senderId: 1, createdAt: -1 });

// Optional TTL — auto-delete entries older than 90 days to keep the collection lean.
// Set CONVERSATION_TTL_DAYS=0 in .env to disable.
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
conversationMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });

const ConversationMessage = mongoose.model('ConversationMessage', conversationMessageSchema);

export default ConversationMessage;
