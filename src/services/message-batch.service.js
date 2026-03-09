import env from '../config/env.js';

class MessageBatchService {
  constructor() {
    this.batches = new Map();
    this.handler = null;
  }

  onBatchReady(handler) {
    this.handler = handler;
  }

  addMessage(senderId, message) {
    const key = String(senderId || '');
    if (!key) return;

    let batch = this.batches.get(key);

    if (!batch) {
      const timer = setTimeout(() => {
        void this.flush(key);
      }, env.messageBatchWindowMs);

      batch = {
        messages: [],
        timer,
        createdAt: Date.now()
      };

      this.batches.set(key, batch);
    }

    batch.messages.push({
      ...message,
      receivedAt: Date.now()
    });
  }

  async flush(senderId) {
    const key = String(senderId || '');
    const batch = this.batches.get(key);
    if (!batch) return;

    clearTimeout(batch.timer);
    this.batches.delete(key);

    if (!batch.messages.length || typeof this.handler !== 'function') return;

    await this.handler({
      senderId: key,
      messages: batch.messages,
      startedAt: batch.createdAt,
      windowMs: env.messageBatchWindowMs
    });
  }

  getBatchSize(senderId) {
    const key = String(senderId || '');
    return this.batches.get(key)?.messages.length || 0;
  }

  clearBatch(senderId) {
    const key = String(senderId || '');
    const batch = this.batches.get(key);
    if (batch?.timer) {
      clearTimeout(batch.timer);
    }
    this.batches.delete(key);
  }

  clearAll() {
    for (const senderId of this.batches.keys()) {
      this.clearBatch(senderId);
    }
  }
}

export const messageBatchService = new MessageBatchService();
