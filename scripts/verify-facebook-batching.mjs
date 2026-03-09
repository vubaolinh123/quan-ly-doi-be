import crypto from 'crypto';
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import Report from '../src/models/Report.js';
import { resetAiCallCounter, getAiCallCounter } from '../src/services/ai-orchestrator.service.js';

const args = process.argv.slice(2);
const hasInvalidSignatureMode = args.includes('--invalid-signature');
const messagesArg = args.find((item) => item.startsWith('--messages='));
const windowArg = args.find((item) => item.startsWith('--window='));

const messageCount = Number(messagesArg?.split('=')[1] || 3);
const windowMs = Number(windowArg?.split('=')[1] || env.messageBatchWindowMs || 5000);
const senderId = 'verify-facebook-user';

const effectiveSecret = env.facebookAppSecret || 'verify-facebook-app-secret';

const signPayload = (payload) => {
  const hmac = crypto.createHmac('sha256', effectiveSecret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
};

const buildEventPayload = (idx) => {
  const body = {
    object: 'page',
    entry: [
      {
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: 'page-id' },
            timestamp: Date.now(),
            message: {
              mid: `m-${idx}-${Date.now()}`,
              text: `test message ${idx}`
            }
          }
        ]
      }
    ]
  };

  return JSON.stringify(body);
};

const postWebhook = async ({ payload, signature }) => {
  return fetch(`http://127.0.0.1:${env.port}/api/webhooks/facebook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature
    },
    body: payload
  });
};

const main = async () => {
  let server;
  const previousSecret = process.env.FACEBOOK_APP_SECRET;

  try {
    process.env.FACEBOOK_APP_SECRET = effectiveSecret;
    env.facebookAppSecret = effectiveSecret;

    await mongoose.connect(env.mongoUri);
    await Report.deleteMany({ 'reporterInfo.facebookId': senderId });

    resetAiCallCounter();

    server = app.listen(env.port);

    if (hasInvalidSignatureMode) {
      const payload = buildEventPayload(1);
      const response = await postWebhook({
        payload,
        signature: 'sha256=invalid-signature'
      });

      if (response.status !== 403) {
        throw new Error(`Expected 403 for invalid signature, got ${response.status}`);
      }

      console.log('PASS: invalid signature rejected with 403');
      return;
    }

    for (let i = 1; i <= messageCount; i += 1) {
      const payload = buildEventPayload(i);
      const signature = signPayload(payload);
      const response = await postWebhook({ payload, signature });

      if (response.status !== 200) {
        throw new Error(`Expected 200 for valid webhook event, got ${response.status}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, windowMs + 1000));

    const aiCalls = getAiCallCounter();
    if (aiCalls !== 1) {
      throw new Error(`Expected aiCalls=1 for batched messages, got ${aiCalls}`);
    }

    const report = await Report.findOne({ 'reporterInfo.facebookId': senderId }).sort({ createdAt: -1 });
    if (!report) {
      throw new Error('Expected one report to be created');
    }

    if (report.status !== 'pending_approval') {
      throw new Error(`Expected report status pending_approval, got ${report.status}`);
    }

    console.log(`PASS: aiCalls=${aiCalls} reportStatus=${report.status}`);
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  } finally {
    process.env.FACEBOOK_APP_SECRET = previousSecret;
    env.facebookAppSecret = previousSecret || '';

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await Report.deleteMany({ 'reporterInfo.facebookId': senderId });

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
};

main();
