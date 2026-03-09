import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import Report from '../src/models/Report.js';
import Task from '../src/models/Task.js';
import Officer from '../src/models/Officer.js';
import Category from '../src/models/Category.js';

const args = process.argv.slice(2);
const invalidSecretMode = args.includes('--invalid-secret');
const duplicateApproveMode = args.includes('--duplicate-approve');
const rejectMode = args.includes('--reject');

const verifySenderId = 'verify-telegram-user';
const verifyCategoryCode = 'TEST_TG';

const postTelegramWebhook = async ({ payload, secret }) => {
  return fetch(`http://127.0.0.1:${env.port}/api/webhooks/telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': secret
    },
    body: JSON.stringify(payload)
  });
};

const buildApprovePayload = (reportId) => ({
  update_id: Date.now(),
  callback_query: {
    id: `cq-approve-${Date.now()}`,
    from: { id: 999001, username: 'verify_bot_admin' },
    message: {
      message_id: 12001,
      chat: { id: 778899 }
    },
    data: `approve|${reportId}`
  }
});

const buildRejectPayload = (reportId) => ({
  update_id: Date.now(),
  callback_query: {
    id: `cq-reject-${Date.now()}`,
    from: { id: 999001, username: 'verify_bot_admin' },
    message: {
      message_id: 12002,
      chat: { id: 778899 }
    },
    data: `reject|${reportId}`
  }
});

const createPendingReport = async (suffix) => {
  return Report.create({
    reportCode: `TG-VERIFY-${suffix}-${Date.now()}`,
    channel: 'FACEBOOK',
    content: 'Nội dung kiểm thử telegram callback',
    reporterInfo: {
      facebookId: verifySenderId
    },
    categoryCode: verifyCategoryCode,
    aiAnalysis: {
      summary: 'Kiểm thử',
      confidence: 0.95,
      extractedSignals: []
    },
    status: 'pending_approval'
  });
};

const cleanup = async () => {
  await Task.deleteMany({ title: /^Xử lý tố giác TG-VERIFY-/ });
  await Report.deleteMany({ reportCode: /^TG-VERIFY-/ });
  await Officer.deleteMany({ hoTen: 'Verify Telegram Officer' });
  await Category.deleteMany({ code: 'TEST_TG' });
};

const ensureAssignmentFixture = async () => {
  await Category.updateOne(
    { code: 'TEST_TG' },
    {
      $setOnInsert: {
        code: 'TEST_TG',
        name: 'Telegram verify category',
        color: '#1D4ED8',
        assignmentCursor: 0,
        active: true
      }
    },
    { upsert: true }
  );

  await Officer.updateOne(
    { hoTen: 'Verify Telegram Officer' },
    {
      $set: {
        active: true,
        categoryCodes: ['TEST_TG']
      },
      $setOnInsert: {
        hoTen: 'Verify Telegram Officer'
      }
    },
    { upsert: true }
  );
};

const runInvalidSecret = async () => {
  const report = await createPendingReport('SECRET');
  const payload = buildApprovePayload(report._id);
  const response = await postTelegramWebhook({
    payload,
    secret: 'invalid-telegram-secret'
  });

  if (response.status !== 403) {
    throw new Error(`Expected 403 for invalid telegram secret, got ${response.status}`);
  }

  console.log('PASS: 403 invalid telegram secret');
};

const runDuplicateApprove = async () => {
  await ensureAssignmentFixture();
  const report = await createPendingReport('DUP');

  const firstResponse = await postTelegramWebhook({
    payload: buildApprovePayload(report._id),
    secret: env.telegramWebhookSecret
  });

  if (firstResponse.status !== 200) {
    throw new Error(`Expected first callback status 200, got ${firstResponse.status}`);
  }

  const firstBody = await firstResponse.json();
  if (firstBody?.data?.status !== 'approved') {
    throw new Error(`Expected first callback status=approved, got ${firstBody?.data?.status}`);
  }

  const secondResponse = await postTelegramWebhook({
    payload: buildApprovePayload(report._id),
    secret: env.telegramWebhookSecret
  });

  if (secondResponse.status !== 200) {
    throw new Error(`Expected second callback status 200, got ${secondResponse.status}`);
  }

  const secondBody = await secondResponse.json();
  if (secondBody?.data?.status !== 'already_processed') {
    throw new Error(`Expected second callback status=already_processed, got ${secondBody?.data?.status}`);
  }

  const createdTasks = await Task.countDocuments({ sourceReportId: report._id });
  if (createdTasks !== 1) {
    throw new Error(`Expected createdTasks=1, got ${createdTasks}`);
  }

  console.log('PASS: second=already_processed');
  console.log('PASS: createdTasks=1');
};

const runReject = async () => {
  const report = await createPendingReport('REJECT');

  const response = await postTelegramWebhook({
    payload: buildRejectPayload(report._id),
    secret: env.telegramWebhookSecret
  });

  if (response.status !== 200) {
    throw new Error(`Expected reject callback status 200, got ${response.status}`);
  }

  const freshReport = await Report.findById(report._id);
  if (freshReport?.status !== 'rejected') {
    throw new Error(`Expected reportStatus=rejected, got ${freshReport?.status}`);
  }

  console.log('PASS: reportStatus=rejected');
};

const main = async () => {
  let server;

  try {
    await mongoose.connect(env.mongoUri);
    await cleanup();

    server = app.listen(env.port);

    if (invalidSecretMode) {
      await runInvalidSecret();
      return;
    }

    if (duplicateApproveMode) {
      await runDuplicateApprove();
      return;
    }

    if (rejectMode) {
      await runReject();
      return;
    }

    throw new Error('Please provide one mode: --invalid-secret | --duplicate-approve | --reject');
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    await cleanup();

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
};

main();
