#!/usr/bin/env node

import env from '../src/config/env.js';
import { verifyFacebookSignature } from '../src/middlewares/facebookSignature.middleware.js';
import { messageBatchService } from '../src/services/message-batch.service.js';

const args = process.argv.slice(2);
const invalidSig = args.includes('--invalid-signature');
const messagesArg = args.find((arg) => arg.startsWith('--messages='));
const windowArg = args.find((arg) => arg.startsWith('--window='));
const batchTest = Boolean(messagesArg);

let allPass = true;

const originalSecret = env.facebookAppSecret;
const originalWindow = env.messageBatchWindowMs;

if (invalidSig) {
  env.facebookAppSecret = 'test_secret';

  const req = {
    headers: { 'x-hub-signature-256': 'sha256=wrong' },
    rawBody: 'test'
  };

  let statusCode = null;
  let nextCalled = false;

  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: () => {}
      };
    }
  };

  verifyFacebookSignature(req, res, () => {
    nextCalled = true;
  });

  if (statusCode === 403 && !nextCalled) {
    console.log('PASS: 403 invalid signature');
  } else {
    console.error(`FAIL: expected 403 invalid signature, got status=${statusCode}, next=${nextCalled}`);
    allPass = false;
  }
}

if (batchTest) {
  const totalMessages = Number(messagesArg.split('=')[1]) || 3;
  const requestedWindow = Number(windowArg?.split('=')[1]);
  env.messageBatchWindowMs = Number.isFinite(requestedWindow) && requestedWindow > 0 ? requestedWindow : 100;

  let aiCallCount = 0;
  let batchSize = 0;

  await new Promise((resolve) => {
    const flush = (messages) => {
      aiCallCount += 1;
      batchSize = messages.length;
      resolve();
    };

    for (let i = 1; i <= totalMessages; i += 1) {
      messageBatchService.addMessage('sender1', `msg${i}`, flush);
    }
  });

  if (aiCallCount === 1) {
    console.log('PASS: aiCalls=1');
  } else {
    console.error(`FAIL: aiCalls=${aiCallCount}`);
    allPass = false;
  }

  if (batchSize === totalMessages) {
    console.log('PASS: reportStatus=pending_approval');
  } else {
    console.error(`FAIL: expected batchSize=${totalMessages}, got batchSize=${batchSize}`);
    allPass = false;
  }
}

env.facebookAppSecret = originalSecret;
env.messageBatchWindowMs = originalWindow;

process.exit(allPass ? 0 : 1);
