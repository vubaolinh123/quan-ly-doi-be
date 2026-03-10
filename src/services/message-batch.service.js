import env from '../config/env.js';

const MAX_BATCHES = 500;
const MAX_MESSAGES_PER_BATCH = 50;
const STALE_BATCH_MS = 60_000;
const SWEEP_INTERVAL_MS = 30_000;

class MessageBatchService {
  constructor() {
    this.batches = new Map();
    this.handler = null;
    this._sweepTimer = setInterval(() => this._sweep(), SWEEP_INTERVAL_MS);
    if (this._sweepTimer.unref) this._sweepTimer.unref();
  }

  _sweep() {
    const now = Date.now();
    for (const [key, batch] of this.batches) {
      if (now - batch.createdAt > STALE_BATCH_MS) {
        void this.flush(key);
      }
    }
  }

  onBatchReady(handler) {
    this.handler = handler;
  }

  addMessage(senderId, message) {
    const key = String(senderId || '');
    if (!key) return;

    if (this.batches.size >= MAX_BATCHES && !this.batches.has(key)) {
      console.warn(`[message-batch] Dropping message — batch limit reached (${MAX_BATCHES})`);
      return;
    }

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

    if (batch.messages.length >= MAX_MESSAGES_PER_BATCH) {
      void this.flush(key);
      return;
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

    try {
      await this.handler({
        senderId: key,
        messages: batch.messages,
        startedAt: batch.createdAt,
        windowMs: env.messageBatchWindowMs
      });
    } catch (error) {
      console.error(`[message-batch] Handler error for sender ${key}:`, error.message);
    }
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

  destroy() {
    if (this._sweepTimer) {
      clearInterval(this._sweepTimer);
      this._sweepTimer = null;
    }
    this.clearAll();
  }
}

export const messageBatchService = new MessageBatchService();
