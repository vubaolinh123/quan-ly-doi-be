import crypto from 'crypto';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '5001';
process.env.E2E_MOCK = 'true';
process.env.FACEBOOK_PAGE_ACCESS_TOKEN = '';
process.env.FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'test-fb-secret';
process.env.FACEBOOK_VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'test-verify-token';
process.env.TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'test-tg-secret';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.MESSAGE_BATCH_WINDOW_MS = process.env.MESSAGE_BATCH_WINDOW_MS || '5000';

const [{ default: mongoose }, { default: app }, { default: env }, { default: Report }, { default: Task }, { default: Officer }, { default: PendingConfirmation }, { resetAiCallCounter, getAiCallCounter }, { messageBatchService }, facebookMessagesFixtureModule, telegramCallbacksFixtureModule] = await Promise.all([
  import('mongoose'),
  import('../src/app.js'),
  import('../src/config/env.js'),
  import('../src/models/Report.js'),
  import('../src/models/Task.js'),
  import('../src/models/Officer.js'),
  import('../src/models/PendingConfirmation.js'),
  import('../src/services/ai-orchestrator.service.js'),
  import('../src/services/message-batch.service.js'),
  import('./test-fixtures/facebook-messages.json', { with: { type: 'json' } }),
  import('./test-fixtures/telegram-callbacks.json', { with: { type: 'json' } })
]);

const facebookMessagesFixture = facebookMessagesFixtureModule.default;
const telegramCallbacksFixture = telegramCallbacksFixtureModule.default;

const senderId = String(facebookMessagesFixture?.[0]?.senderId || 'e2e-fb-user-001');
const testCategoryCode = 'TDD';
const verifyOfficerName = 'E2E Verify Officer';
const e2eContentMarker = 'E2E-HARNESS:';

const signFacebookPayload = (jsonBody) => {
  const hmac = crypto.createHmac('sha256', env.facebookAppSecret);
  hmac.update(jsonBody);
  return `sha256=${hmac.digest('hex')}`;
};

const buildFacebookWebhookPayload = ({ senderId: sid, text, messageId }, index) => {
  return {
    object: 'page',
    entry: [
      {
        id: 'page-e2e',
        time: Date.now(),
        messaging: [
          {
            sender: { id: String(sid) },
            recipient: { id: 'page-e2e' },
            timestamp: Date.now(),
            message: {
              mid: `${messageId || `e2e-mid-${index + 1}`}-${Date.now()}`,
              text
            }
          }
        ]
      }
    ]
  };
};

const postFacebookWebhook = async (baseUrl, payload) => {
  const body = JSON.stringify(payload);
  const response = await fetch(`${baseUrl}/api/webhooks/facebook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signFacebookPayload(body)
    },
    body
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Facebook webhook failed: ${response.status} ${txt}`);
  }
};

const buildTelegramApprovePayload = (reportId) => {
  const template = telegramCallbacksFixture?.approve;
  const payload = JSON.parse(JSON.stringify(template));
  payload.update_id = Date.now();
  payload.callback_query.id = `e2e-callback-approve-${Date.now()}`;
  payload.callback_query.data = String(payload.callback_query.data || '').replace('__REPORT_ID__', String(reportId));
  return payload;
};

const postTelegramCallback = async (baseUrl, payload) => {
  const response = await fetch(`${baseUrl}/api/webhooks/telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': env.telegramWebhookSecret
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Telegram webhook failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
};

const ensureAssignmentFixture = async () => {
  await Officer.updateOne(
    { hoTen: verifyOfficerName },
    {
      $set: {
        active: true,
        categoryCodes: [testCategoryCode]
      },
      $setOnInsert: {
        hoTen: verifyOfficerName,
        capBac: 'Cán bộ',
        chucVu: 'Cán bộ xử lý'
      }
    },
    { upsert: true }
  );
};

const cleanup = async () => {
  messageBatchService.clearAll();
  await Task.deleteMany({ description: { $regex: e2eContentMarker } });
  await Report.deleteMany({ 'reporterInfo.facebookId': senderId, content: { $regex: e2eContentMarker } });
  await PendingConfirmation.deleteMany({ senderId });
  await Officer.deleteMany({ hoTen: verifyOfficerName });
};

const main = async () => {
  let server;
  let allPass = true;

  const fail = (message) => {
    allPass = false;
    console.error(`FAIL: ${message}`);
  };

  try {
    await mongoose.connect(env.mongoUri);
    await cleanup();
    await ensureAssignmentFixture();
    resetAiCallCounter();

    server = app.listen(Number(env.port));
    const baseUrl = `http://127.0.0.1:${env.port}`;

    for (let i = 0; i < facebookMessagesFixture.length; i += 1) {
      const payload = buildFacebookWebhookPayload(facebookMessagesFixture[i], i);
      await postFacebookWebhook(baseUrl, payload);
    }

    await new Promise((resolve) => setTimeout(resolve, Number(env.messageBatchWindowMs) + 1200));

    const aiCalls = getAiCallCounter();
    if (aiCalls === 1) {
      console.log('PASS: 3 Facebook messages batched into 1 AI call');
    } else {
      fail(`expected aiCalls=1, got ${aiCalls}`);
    }

    const pending = await PendingConfirmation.findOne({ senderId });
    if (!pending) {
      throw new Error('Expected PendingConfirmation to be created after first batch');
    }
    console.log('PASS: pending confirmation created before report persistence');

    const createdReportEarly = await Report.findOne({ 'reporterInfo.facebookId': senderId, content: { $regex: e2eContentMarker } }).sort({ createdAt: -1 });
    if (createdReportEarly) {
      fail('report must NOT be created before user confirmation');
    } else {
      console.log('PASS: no report created before explicit confirmation');
    }

    const confirmPayload = buildFacebookWebhookPayload({
      senderId,
      text: 'Đúng',
      messageId: `e2e-mid-confirm-${Date.now()}`
    }, 999);
    await postFacebookWebhook(baseUrl, confirmPayload);
    await new Promise((resolve) => setTimeout(resolve, Number(env.messageBatchWindowMs) + 1200));

    const createdReport = await Report.findOne({ 'reporterInfo.facebookId': senderId }).sort({ createdAt: -1 });
    if (!createdReport) {
      throw new Error('Expected report to be created after confirmation');
    }

    const pendingAfterConfirm = await PendingConfirmation.findOne({ senderId });
    if (pendingAfterConfirm) {
      fail('pending confirmation should be removed after confirmation');
    } else {
      console.log('PASS: pending confirmation removed after confirmation');
    }

    if (createdReport.status === 'pending_approval') {
      console.log('PASS: reportStatus=pending_approval');
    } else {
      fail(`expected reportStatus=pending_approval, got ${createdReport.status}`);
    }

    const approvePayload = buildTelegramApprovePayload(createdReport._id);
    const firstDecision = await postTelegramCallback(baseUrl, approvePayload);

    const approvedReport = await Report.findById(createdReport._id);
    if (approvedReport?.status === 'approved') {
      console.log('PASS: report approved after Telegram callback');
    } else {
      fail(`expected reportStatus=approved, got ${approvedReport?.status}`);
    }

    const linkedTask = await Task.findOne({ sourceReportId: createdReport._id });
    if (linkedTask) {
      console.log('PASS: approved_report_has_linked_task');
    } else {
      fail('expected linked task for approved report');
    }

    const createdTasksAfterFirst = await Task.countDocuments({ sourceReportId: createdReport._id });
    if (createdTasksAfterFirst === 1) {
      console.log('PASS: createdTasks=1 (no duplicate)');
    } else {
      fail(`expected createdTasks=1 after first approve, got ${createdTasksAfterFirst}`);
    }

    const secondDecision = await postTelegramCallback(baseUrl, buildTelegramApprovePayload(createdReport._id));
    if (secondDecision?.data?.status === 'already_processed' && firstDecision?.data?.status === 'approved') {
      console.log('PASS: duplicate callback=already_processed');
    } else {
      fail(`expected duplicate status already_processed, got ${secondDecision?.data?.status}`);
    }

    const createdTasksAfterDuplicate = await Task.countDocuments({ sourceReportId: createdReport._id });
    if (createdTasksAfterDuplicate === 1) {
      console.log('PASS: createdTasks=1 (no duplicate)');
    } else {
      fail(`expected createdTasks=1 after duplicate approve, got ${createdTasksAfterDuplicate}`);
    }
  } catch (error) {
    allPass = false;
    console.error(`FAIL: ${error.message}`);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await cleanup();
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }

  if (!allPass) {
    process.exit(1);
  }
};

await main();
