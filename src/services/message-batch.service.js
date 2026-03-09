import env from '../config/env.js';

class MessageBatchService {
  constructor() {
    this.batches = new Map();
  }

  addMessage(senderId, messageText, onFlush) {
    if (!this.batches.has(senderId)) {
      this.batches.set(senderId, { messages: [], timer: null });
    }

    const batch = this.batches.get(senderId);
    batch.messages.push(messageText);

    if (batch.timer) {
      clearTimeout(batch.timer);
    }

    batch.timer = setTimeout(() => {
      const messages = [...batch.messages];
      this.batches.delete(senderId);
      onFlush(messages);
    }, env.messageBatchWindowMs);
  }
}

export const messageBatchService = new MessageBatchService();
