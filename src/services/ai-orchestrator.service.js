import Report from '../models/Report.js';
import ConversationMessage from '../models/ConversationMessage.js';
import PendingConfirmation from '../models/PendingConfirmation.js';
import SenderState from '../models/SenderState.js';
import { messageBatchService } from './message-batch.service.js';
import { analyzeWithGemini } from './gemini.service.js';
import { sendFacebookFileMessage, sendFacebookTextMessage } from './facebook.service.js';
import { sendApprovalMessage, sendNoteUpdateMessage } from './telegram.service.js';
import { SYSTEM_INSTRUCTION } from '../prompts/system/base-system.prompt.js';
import { INTAKE_FOLLOWUP_PROMPT } from '../prompts/conversation/intake-followup.prompt.js';
import { ADMIN_SUMMARY_PROMPT } from '../prompts/summary/admin-summary.prompt.js';
import SystemConfig from '../models/SystemConfig.js';
import { storeGeneratedDocument, readStoredDocument } from './document-generator.service.js';

let aiCallCounter = 0;

// ── Config ────────────────────────────────────────────────────────────────────
const REPORT_INTENT        = 'report_crime';
const CONFIDENCE_THRESHOLD = 0.5;   // minimum AI confidence to persist a Report

/**
 * How many recent conversation messages to fetch per sender.
 * Fetching more gives the AI better context but increases prompt size.
 *   - 30 covers roughly 7-15 batch windows of back-and-forth, enough for
 *     the full 7-step data collection flow without clipping early steps.
 */
const HISTORY_LIMIT = 30;

// ── Fast-path (filter OFF) ────────────────────────────────────────────────────
/**
 * Keywords that trigger immediate report creation when the AI filter is disabled.
 * NOTE: Keep this list in sync with the informational display in
 *       frontend/src/components/admin/modules/settings-module.tsx
 */
const FRAUD_KEYWORDS = [
  'lừa đảo', 'bị lừa', 'chuyển khoản', 'mất tiền',
  'lừa tiền', 'chiếm đoạt', 'lừa', 'scam'
];

// ── Field classification for server-side documentReady ────────────────────
const REQUIRED_FIELDS = ['reporterName', 'crimeType', 'crimeDescription'];
const REPORTER_IDENTITY_FIELDS = [
  'reporterBirthYear', 'reporterIdNumber', 'reporterIdIssuedBy',
  'reporterIdIssuedDate', 'reporterPermanentAddress', 'reporterCurrentAddress',
];
// Suspect fields are CONTEXTUAL — only relevant when there's a known individual suspect.
// NOT asked when reporting websites, organisations, or unknown perpetrators.
const CONTEXTUAL_FIELDS = ['suspectName', 'suspectCurrentAddress'];
const OPTIONAL_FIELDS = ['evidence', 'recipientAuthority'];
// Fields that the server-side missing-fields message will list (excludes contextual + optional)
const ASKABLE_FIELDS = [...REQUIRED_FIELDS, ...REPORTER_IDENTITY_FIELDS];
// All non-optional fields (used for counting filled fields)
const NON_OPTIONAL_FIELDS = [...REQUIRED_FIELDS, ...REPORTER_IDENTITY_FIELDS, ...CONTEXTUAL_FIELDS];

/**
 * Returns true if any message text contains at least one fraud keyword.
 * Matching is case-insensitive (toLowerCase) — no diacritic normalisation needed
 * because Vietnamese fraud keywords are reliably written with diacritics.
 */
const hasFraudKeyword = (messages) => {
  const text = messages.map((m) => (m.text || '').toLowerCase()).join(' ');
  return FRAUD_KEYWORDS.some((kw) => text.includes(kw));
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Server-side deterministic check: is enough data collected to generate the document?
 * Returns true when ALL required fields are filled AND total filled fields ≥ 4.
 * This OVERRIDES the AI's documentReady flag to prevent infinite "ask more" loops.
 *
 * Threshold lowered from 5→4 because suspect fields are contextual — many legitimate
 * reports (e.g. reporting a gambling website) have no suspect identity info.
 */
const isDocumentReady = (extractedData) => {
  if (!extractedData || typeof extractedData !== 'object') return false;
  const allRequiredFilled = REQUIRED_FIELDS.every(
    (f) => isNonEmptyString(String(extractedData[f] ?? ''))
  );
  if (!allRequiredFilled) return false;
  // Count ALL non-optional fields (including contextual if user provided them)
  const totalFilled = NON_OPTIONAL_FIELDS.filter(
    (f) => isNonEmptyString(String(extractedData[f] ?? ''))
  ).length;
  return totalFilled >= 4;
};

const normalizeString = (value) => (isNonEmptyString(value) ? value.trim() : undefined);

// ── Confirmation flow ─────────────────────────────────────────────────────────

/**
 * Vietnamese labels shown in the confirmation bullet list.
 * Keys match the extractedData field names produced by the AI schema.
 */
const EXTRACTED_DATA_LABELS = {
  reporterName:             'Họ tên người tố giác',
  reporterBirthYear:        'Năm sinh',
  reporterIdNumber:         'Số CMND/CCCD',
  reporterIdIssuedBy:       'Nơi cấp CMND/CCCD',
  reporterIdIssuedDate:     'Ngày cấp CMND/CCCD',
  reporterPermanentAddress: 'Địa chỉ thường trú',
  reporterCurrentAddress:   'Địa chỉ hiện tại',
  suspectName:              'Họ tên đối tượng',
  suspectCurrentAddress:    'Địa chỉ đối tượng',
  crimeType:                'Loại tội phạm',
  crimeDescription:         'Mô tả hành vi vi phạm',
  evidence:                 'Chứng cứ',
  recipientAuthority:       'Cơ quan tiếp nhận đơn',
};

/**
 * Regex that matches a reporter's explicit positive confirmation reply.
 * Case-insensitive; matches the whole trimmed message.
 */
const CONFIRMATION_REGEX =
  /^(đúng|ok|oke|okey|okay|đồng ý|dong y|xác nhận|xac nhan|không cần sửa|khong can sua|chính xác|chinh xac|đúng rồi|dung roi|correct|yes)$/i;

const stripVietnameseDiacritics = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const isPositiveConfirmation = (text) => {
  const raw = String(text || '').trim();
  if (!raw) return false;

  if (CONFIRMATION_REGEX.test(raw)) return true;

  const normalized = stripVietnameseDiacritics(raw).toLowerCase();
  return [
    'dung',
    'ok',
    'oke',
    'okey',
    'okay',
    'dong y',
    'xac nhan',
    'khong can sua',
    'chinh xac',
    'dung roi',
    'yes',
    'correct',
  ].includes(normalized);
};

/**
 * Build a Vietnamese bullet-list confirmation message from extractedData.
 * Only includes fields that have a non-null, non-empty value.
 */
const buildConfirmationMessage = (extractedData) => {
  const lines = Object.entries(EXTRACTED_DATA_LABELS)
    .filter(([key]) => isNonEmptyString(String(extractedData[key] ?? '')))
    .map(([key, label]) => `- ${label}: ${extractedData[key]}`);

  return [
    'Cảm ơn bạn. Dưới đây là thông tin chúng tôi đã ghi nhận:',
    '',
    ...lines,
    '',
    'Vui lòng kiểm tra và trả lời "Đúng" nếu thông tin chính xác, hoặc gửi lại nội dung cần sửa đổi.',
    'Sau khi xác nhận, chúng tôi sẽ tạo Đơn Tố Giác Tội Phạm và gửi cho bạn.',
  ].join('\n');
};

/**
 * Build a Vietnamese bullet-list of MISSING fields from extractedData.
 * Only checks ASKABLE fields (reporter identity + required) — excludes contextual
 * (suspect) and optional (evidence, recipientAuthority) fields.
 * Returns null when:
 *  – extractedData is falsy (AI hasn't returned structured data yet)
 *  – ALL askable fields are empty (AI hasn't started — use AI followup)
 *  – ZERO askable fields are empty (all reporter data collected)
 */
const ASKABLE_LABELS = Object.fromEntries(
  Object.entries(EXTRACTED_DATA_LABELS).filter(([key]) => ASKABLE_FIELDS.includes(key))
);

const buildMissingFieldsMessage = (extractedData) => {
  if (!extractedData) return null;
  const allKeys = Object.keys(ASKABLE_LABELS);
  const missing = Object.entries(ASKABLE_LABELS)
    .filter(([key]) => !isNonEmptyString(String(extractedData[key] ?? '')))
    .map(([, label]) => `- ${label}`);
  // ALL empty → AI hasn't started extracting; NONE empty → all collected
  if (missing.length === allKeys.length || missing.length === 0) return null;
  return ['Vui lòng cung cấp các thông tin sau:', '', ...missing].join('\n');
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const getExtractedData = (analysis) => {
  if (!analysis?.extractedData || typeof analysis.extractedData !== 'object' || Array.isArray(analysis.extractedData)) {
    return {};
  }

  return analysis.extractedData;
};

const buildReporterInfo = (senderId, extractedData) => ({
  facebookId: senderId,
  fullName: normalizeString(extractedData.reporterName),
  birthYear: normalizeNumber(extractedData.reporterBirthYear),
  identityNumber: normalizeString(extractedData.reporterIdNumber),
  idIssuedBy: normalizeString(extractedData.reporterIdIssuedBy),
  idIssuedDate: normalizeString(extractedData.reporterIdIssuedDate),
  permanentAddress: normalizeString(extractedData.reporterPermanentAddress),
  currentAddress: normalizeString(extractedData.reporterCurrentAddress),
});

const buildReportFieldsFromAnalysis = ({ senderId, analysis }) => {
  const extractedData = getExtractedData(analysis);

  return {
    reporterInfo: buildReporterInfo(senderId, extractedData),
    suspectInfo: {
      name: normalizeString(extractedData.suspectName),
      currentAddress: normalizeString(extractedData.suspectCurrentAddress),
    },
    reportTitle: normalizeString(analysis.reportTitle),
    crimeType: normalizeString(extractedData.crimeType),
    crimeDescription: normalizeString(extractedData.crimeDescription),
    evidence: normalizeString(extractedData.evidence),
    recipientAuthority: normalizeString(extractedData.recipientAuthority),
  };
};

const assignIfPresent = (target, key, value) => {
  if (value === undefined) return;
  target[key] = value;
};

const buildSupplementSet = (analysis) => {
  const extractedData = getExtractedData(analysis);
  const update = {};

  assignIfPresent(update, 'reportTitle', normalizeString(analysis.reportTitle));
  assignIfPresent(update, 'reporterInfo.fullName', normalizeString(extractedData.reporterName));
  assignIfPresent(update, 'reporterInfo.birthYear', normalizeNumber(extractedData.reporterBirthYear));
  assignIfPresent(update, 'reporterInfo.identityNumber', normalizeString(extractedData.reporterIdNumber));
  assignIfPresent(update, 'reporterInfo.idIssuedBy', normalizeString(extractedData.reporterIdIssuedBy));
  assignIfPresent(update, 'reporterInfo.idIssuedDate', normalizeString(extractedData.reporterIdIssuedDate));
  assignIfPresent(update, 'reporterInfo.permanentAddress', normalizeString(extractedData.reporterPermanentAddress));
  assignIfPresent(update, 'reporterInfo.currentAddress', normalizeString(extractedData.reporterCurrentAddress));
  assignIfPresent(update, 'suspectInfo.name', normalizeString(extractedData.suspectName));
  assignIfPresent(update, 'suspectInfo.currentAddress', normalizeString(extractedData.suspectCurrentAddress));
  assignIfPresent(update, 'crimeType', normalizeString(extractedData.crimeType));
  assignIfPresent(update, 'crimeDescription', normalizeString(extractedData.crimeDescription));
  assignIfPresent(update, 'evidence', normalizeString(extractedData.evidence));
  assignIfPresent(update, 'recipientAuthority', normalizeString(extractedData.recipientAuthority));

  return update;
};

const maybeGenerateAndSendDocument = async ({ report, analysis, senderId }) => {
  if (!report || analysis?.documentReady !== true || report.documentGenerated) {
    return report;
  }

  try {
    const generated = await storeGeneratedDocument(report.toObject ? report.toObject() : report);
    const updatedReport = await Report.findByIdAndUpdate(
      report._id,
      {
        documentUrl: generated.filename,
        documentGenerated: true,
      },
      { new: true, runValidators: true }
    );

    try {
      await sendFacebookTextMessage(
        senderId,
        'Cảm ơn bạn đã cung cấp thông tin. Chúng tôi đã tạo Đơn Tố Giác Tội Phạm dựa trên nội dung bạn gửi. Vui lòng kiểm tra file đính kèm.'
      );
      await sendFacebookFileMessage(senderId, generated.buffer, generated.filename);
    } catch (err) {
      console.error('[ai-orchestrator] Facebook document send failed:', err.message);
    }

    return updatedReport ?? report;
  } catch (err) {
    console.error('[ai-orchestrator] Document generation failed:', err.message);
    return report;
  }
};

// ── Confirmation handlers ─────────────────────────────────────────────────────

/**
 * Finalise a pending confirmation: create (or supplement) Report, send Telegram,
 * maybe generate .docx, and clean up the PendingConfirmation record.
 *
 * @returns {import('mongoose').Document} the saved Report
 */
const finalizePendingConfirmation = async ({ senderId, pending }) => {
  const analysis = pending.analysisSnapshot || {};
  // Reconstruct extractedData into analysis so existing helpers work
  analysis.extractedData = pending.extractedData;
  // Force documentReady — we only enter confirmation flow when it was true
  analysis.documentReady = true;

  // ── Supplement an existing report ──────────────────────────────────────────
  if (pending.reportAction === 'supplement_existing_report' && pending.openReportId) {
    const noteText = analysis.noteSummary || analysis.adminSummary || '(bổ sung sau xác nhận)';
    const supplementSet = buildSupplementSet(analysis);

    let updatedReport = await Report.findByIdAndUpdate(
      pending.openReportId,
      {
        $push: { notes: { text: noteText, source: 'ai', createdAt: new Date() } },
        ...(Object.keys(supplementSet).length > 0 ? { $set: supplementSet } : {})
      },
      { new: true, runValidators: true }
    );

    try { await sendNoteUpdateMessage(updatedReport, noteText); }
    catch (err) { console.error('[ai-orchestrator] Telegram note-update after confirm failed:', err.message); }

    try {
      await sendFacebookTextMessage(senderId, 'Đã xác nhận. Thông tin bổ sung đã được cập nhật vào tố giác của bạn.');
    } catch (err) { console.error('[ai-orchestrator] Facebook ack after supplement-confirm failed:', err.message); }

    // Force regenerate document with latest confirmed data (reset flag so maybeGenerate... doesn't bail)
    if (updatedReport && updatedReport.documentGenerated) {
      updatedReport.documentGenerated = false;
      await updatedReport.save();
    }
    console.info('[ai-orchestrator] Finalize: generating document for report %s (documentReady=%s, documentGenerated=%s)', updatedReport?._id, analysis.documentReady, updatedReport?.documentGenerated);
    updatedReport = await maybeGenerateAndSendDocument({ report: updatedReport, analysis, senderId });

    await clearSenderState(senderId);
    await PendingConfirmation.deleteOne({ _id: pending._id });
    return updatedReport;
  }

  // ── Create a brand-new Report ──────────────────────────────────────────────
  const reportCode = await nextReportCode();

  let report = await Report.create({
    reportCode,
    channel: 'FACEBOOK',
    content: pending.sourceContent || analysis.adminSummary || '(nội dung từ hội thoại)',
    ...buildReportFieldsFromAnalysis({ senderId, analysis }),
    categoryCode: analysis.suggestedCategoryCode,
    aiAnalysis: {
      summary: analysis.adminSummary || analysis.noteSummary || '',
      confidence: analysis.confidence,
      extractedSignals: analysis.missingFields
    },
    status: 'pending_approval'
  });

  // Telegram approval
  try {
    const telegramResult = await sendApprovalMessage(report);
    if (telegramResult?.result?.message_id) {
      report.decisionMessageId = String(telegramResult.result.message_id);
      await report.save();
    }
  } catch (err) { console.error('[ai-orchestrator] Telegram after confirm failed:', err.message); }

  try {
    await sendFacebookTextMessage(senderId, 'Đã xác nhận. Chúng tôi đã tiếp nhận tố giác và đang xử lý. Đơn Tố Giác sẽ được gửi cho bạn ngay.');
  } catch (err) { console.error('[ai-orchestrator] Facebook ack after confirm failed:', err.message); }

  // Force regenerate document with confirmed data (reset flag so maybeGenerate... doesn't bail)
  if (report && report.documentGenerated) {
    report.documentGenerated = false;
    await report.save();
  }
  console.info('[ai-orchestrator] Finalize: generating document for report %s (documentReady=%s, documentGenerated=%s)', report._id, analysis.documentReady, report.documentGenerated);
  report = await maybeGenerateAndSendDocument({ report, analysis, senderId });

  await clearSenderState(senderId);
  await PendingConfirmation.deleteOne({ _id: pending._id });
  return report;
};

/**
 * Handle an incoming batch for a sender who already has a PendingConfirmation.
 *
 * - If the batch is a confirmation → finalise.
 * - If the batch is a correction → merge, re-send bullet list.
 * - If too many attempts → abandon and let AI take over.
 */
const handlePendingConfirmation = async ({ senderId, messages, pending }) => {
  const text = messages.map((m) => (m.text || '').trim()).join(' ').trim();

  // ── Positive confirmation ──────────────────────────────────────────────────
  if (isPositiveConfirmation(text)) {
    console.info('[ai-orchestrator] Sender %s confirmed pending data — finalising', senderId);
    await saveToHistory(senderId, messages, null);
    const report = await finalizePendingConfirmation({ senderId, pending });
    return report;
  }

  // ── Correction: merge new info, re-send bullet list ────────────────────────
  console.info('[ai-orchestrator] Sender %s sent correction (attempt %d) — merging', senderId, pending.attempts + 1);

  // Re-run AI to extract any updated fields from the correction text
  try {
    const history = await getConversationHistory(senderId);
    const openReport = pending.openReportId ? await Report.findById(pending.openReportId).lean() : null;
    const accumulatedData = await loadSenderState(senderId);
    const { systemPrompt: corrSystemPrompt, userPrompt: corrUserPrompt } = buildPrompt({ senderId, messages, history, openReport, accumulatedData });
    const analysis = await analyzeWithGemini(corrSystemPrompt, corrUserPrompt);

    // Save inbound only after AI prompt is built, avoiding duplicate context
    await saveToHistory(senderId, messages, null);

    // Merge: new non-null values override stored ones
    const newExtracted = getExtractedData(analysis);
    const merged = { ...pending.extractedData };
    for (const [key, value] of Object.entries(newExtracted)) {
      if (value !== null && value !== undefined && value !== '') {
        merged[key] = value;
      }
    }

    // Persist merged state for future prompts
    await updateSenderState(senderId, merged, analysis.currentStep);

    // Update snapshot fields that may have changed
    const updatedSnapshot = { ...pending.analysisSnapshot };
    if (analysis.adminSummary) updatedSnapshot.adminSummary = analysis.adminSummary;
    if (analysis.reportTitle) updatedSnapshot.reportTitle = analysis.reportTitle;
    if (analysis.suggestedCategoryCode) updatedSnapshot.suggestedCategoryCode = analysis.suggestedCategoryCode;

    await PendingConfirmation.updateOne(
      { _id: pending._id },
      {
        $set: { extractedData: merged, analysisSnapshot: updatedSnapshot },
        $inc: { attempts: 1 }
      }
    );

    // Re-send bullet list
    const confirmMsg = buildConfirmationMessage(merged);
    try {
      await sendFacebookTextMessage(senderId, confirmMsg);
    } catch (err) { console.error('[ai-orchestrator] Facebook re-confirm failed:', err.message); }
    await saveToHistory(senderId, [], confirmMsg);

    return null; // no Report yet
  } catch (err) {
    console.error('[ai-orchestrator] Correction re-analysis failed:', err.message);
    // Send generic "please try again" instead of crashing
    try {
      await sendFacebookTextMessage(senderId, 'Xin lỗi, đã có lỗi khi xử lý chỉnh sửa. Vui lòng thử lại hoặc trả lời "Đúng" để xác nhận thông tin hiện tại.');
    } catch (_) { /* silent */ }
    return null;
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const nextReportCode = async () => {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const seed = Math.floor(Math.random() * 9000) + 1000;

  for (let index = 0; index < 10; index += 1) {
    const code = `FB-${datePrefix}-${seed + index}`;
    const exists = await Report.exists({ reportCode: code });
    if (!exists) return code;
  }

  return `FB-${datePrefix}-${Date.now()}`;
};

/**
 * Retrieve the N most recent conversation messages for a sender, oldest first.
 * Returns an empty array when the sender has no prior history.
 */
const getConversationHistory = async (senderId) => {
  const docs = await ConversationMessage
    .find({ senderId })
    .sort({ createdAt: -1 })   // newest first so we can limit efficiently
    .limit(HISTORY_LIMIT)
    .lean();

  return docs.reverse(); // oldest → newest so the AI reads them in order
};

/**
 * Find an existing pending Report for this Facebook sender.
 * Returns null if none found.
 */
const findPendingReportForSender = async (senderId) => {
  return Report.findOne({
    'reporterInfo.facebookId': senderId,
    status: 'pending_approval'
  }).lean();
};

/**
 * Persist the current inbound batch and (optionally) the outbound AI reply
 * to the conversation log so future batches can read them as history.
 */
const saveToHistory = async (senderId, messages, outboundText) => {
  try {
    const inbound = messages.map((m) => ({
      senderId,
      text: m.text,
      direction: 'inbound',
      createdAt: new Date(m.timestamp || m.receivedAt || Date.now())
    }));

    if (inbound.length) {
      await ConversationMessage.insertMany(inbound, { ordered: false });
    }

    if (outboundText) {
      await ConversationMessage.create({ senderId, text: outboundText, direction: 'outbound' });
    }
  } catch (err) {
    // Non-fatal — history saves failing should not break the main flow
    console.error('[ai-orchestrator] saveToHistory failed:', err.message);
  }
};

// ── SenderState helpers ──────────────────────────────────────────────────────

/**
 * Load accumulated extracted data for a sender from SenderState.
 * Falls back to empty object if no state exists.
 */
const loadSenderState = async (senderId) => {
  const state = await SenderState.findOne({ senderId }).lean();
  return state || { extractedData: {}, currentStep: 'step_1' };
};

/**
 * Merge new AI-extracted data into SenderState.
 * New non-null values override existing ones; null/empty values are ignored.
 * Returns the merged extractedData object.
 */
const updateSenderState = async (senderId, newExtractedData, currentStep) => {
  const existing = await SenderState.findOne({ senderId });
  const merged = { ...(existing?.extractedData || {}) };

  for (const [key, value] of Object.entries(newExtractedData || {})) {
    if (value !== null && value !== undefined && value !== '') {
      merged[key] = value;
    }
  }

  await SenderState.findOneAndUpdate(
    { senderId },
    {
      $set: {
        extractedData: merged,
        currentStep: currentStep || 'step_1',
        createdAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

  return merged;
};

/**
 * Clear SenderState when starting a brand-new report (different incident)
 * or after finalizing a pending confirmation.
 */
const clearSenderState = async (senderId) => {
  await SenderState.deleteOne({ senderId });
};

/**
 * Build the AI prompt pair: systemPrompt (static) + userPrompt (dynamic).
 *
 * systemPrompt → Gemini systemInstruction (role, rules, output format)
 * userPrompt   → contents[0] (accumulated data, history, new messages, task)
 */
const buildPrompt = ({ senderId, messages, history, openReport, accumulatedData }) => {
  // ── Current batch transcript ──────────────────────────────────────────────
  const transcript = messages
    .map((m, idx) =>
      `${idx + 1}. [${new Date(m.timestamp || m.receivedAt).toISOString()}] ${m.text}`
    )
    .join('\n');

  // ── Conversation history section ──────────────────────────────────────────
  const historyLines = history.length > 0
    ? [
        '',
        `=== LỊCH SỬ HỘI THOẠI GẦN ĐÂY (${history.length} tin nhắn cuối) ===`,
        ...history.map(
          (m) =>
            `[${new Date(m.createdAt).toISOString()}] ${m.direction === 'inbound' ? 'USER' : 'AI'}: ${m.text}`
        ),
        '=== HẾT LỊCH SỬ — chỉ trả lời tin nhắn mới bên dưới ===',
      ]
    : [
        '',
        '(Không có lịch sử hội thoại — đây là tin nhắn đầu tiên từ người dùng này.)',
      ];

  // ── Accumulated extracted data section ──────────────────────────────────
  const accData = accumulatedData?.extractedData || {};
  const filledFields = Object.entries(accData)
    .filter(([, v]) => isNonEmptyString(String(v ?? '')));
  // Only list ASKABLE fields as missing (excludes suspect/optional fields)
  const missingFieldNames = ASKABLE_FIELDS
    .filter((f) => !isNonEmptyString(String(accData[f] ?? '')));

  const accumulatedLines = filledFields.length > 0
    ? [
        '',
        '=== DỮ LIỆU ĐÃ THU THẬP (từ các lượt trước) ===',
        '{',
        ...filledFields.map(([k, v], i) =>
          `  "${k}": "${v}"${i < filledFields.length - 1 ? ',' : ''}`
        ),
        '}',
        missingFieldNames.length > 0
          ? `CÒN THIẾU: ${missingFieldNames.join(', ')}`
          : 'ĐÃ ĐỦ DỮ LIỆU BẮT BUỘC — hãy set documentReady=true',
        '⚠️ GIỮ NGUYÊN các giá trị đã có. Chỉ cập nhật từ tin nhắn mới. Chỉ ghi đè nếu user sửa rõ ràng.',
        '=== HẾT DỮ LIỆU ĐÃ THU THẬP ===',
      ]
    : [
        '',
        '(Chưa có dữ liệu thu thập từ các lượt trước — đây có thể là lượt đầu tiên.)',
      ];

  // ── Existing pending report section (if any) ─────────────────────────────
  const openReportLines = openReport
    ? [
        '',
        '=== BÁO CÁO ĐANG CHỜ DUYỆT CỦA NGƯỜI GỬI NÀY ===',
        `Mã báo cáo : ${openReport.reportCode}`,
        `Danh mục   : ${openReport.categoryCode}`,
        `Tóm tắt AI : ${openReport.aiAnalysis?.summary || '(chưa có)'}`,
        `Nội dung gốc: ${(openReport.content || '').slice(0, 400)}`,
        '=== HẾT THÔNG TIN BÁO CÁO ===',
        '',
        '⚠️ YÊU CẦU QUAN TRỌNG — BÁO CÁO ĐANG MỞ:',
        'Người gửi này đã có 1 báo cáo đang chờ duyệt (thông tin ở trên).',
        'Bạn PHẢI quyết định tin nhắn mới này thuộc trường hợp nào:',
        '  • reportAction = "supplement_existing_report"',
        '    → Nếu tin nhắn mới BỔ SUNG hoặc làm rõ thêm cho VỤ VIỆC ĐÃ BÁO CÁO ở trên.',
        '  • reportAction = "new_report"',
        '    → Nếu tin nhắn mới là VỤ VIỆC KHÁC HOÀN TOÀN (khác địa điểm, khác thời gian, khác loại tội phạm).',
        'Không được bỏ qua field reportAction khi có báo cáo đang mở.',
      ]
    : [
        '',
        '(Người gửi này chưa có báo cáo nào đang chờ duyệt. reportAction = "new_report".)',
      ];

  // ── Build system prompt (static instructions) ─────────────────────────────
  const systemPrompt = SYSTEM_INSTRUCTION;

  // ── Build user prompt (dynamic per-request content) ───────────────────────
  const userPrompt = [
    INTAKE_FOLLOWUP_PROMPT,
    ADMIN_SUMMARY_PROMPT,
    ...accumulatedLines,
    ...historyLines,
    ...openReportLines,
    '',
    `senderId: ${senderId}`,
    'Tin nhắn mới cần phân tích:',
    transcript,
    '',
    'Lưu ý: Nếu "DỮ LIỆU ĐÃ THU THẬP" có giá trị cho 1 trường, ' +
    'ĐỪNG hỏi lại — giữ nguyên giá trị đó trong extractedData.',
  ].join('\n');

  return { systemPrompt, userPrompt };
};

// ── Main orchestrator ─────────────────────────────────────────────────────────

export const processBatch = async ({ senderId, messages }) => {
  if (!messages?.length) return null;

  // ── Fast-path: report filter disabled ────────────────────────────────────
  // When an admin has disabled the AI filter, any message containing a fraud
  // keyword bypasses Gemini entirely and creates a Report immediately.
  // We still respect the dedup rule: if the sender already has a pending
  // report, we append a note rather than creating a duplicate.
  const sysConfig = await SystemConfig.getSingleton();
  if (!sysConfig.reportFilterEnabled && hasFraudKeyword(messages)) {
    console.info(
      '[ai-orchestrator] FAST-PATH — filter disabled, fraud keyword detected for sender=%s',
      senderId
    );

    // Dedup: check for existing pending report
    const existingReport = await findPendingReportForSender(senderId);
    if (existingReport) {
      const noteText = messages.map((m) => m.text).join(' ');
      await Report.findByIdAndUpdate(existingReport._id, {
        $push: { notes: { text: noteText, source: 'ai', createdAt: new Date() } }
      });
      try {
        await sendFacebookTextMessage(
          senderId,
          'Chúng tôi đã nhận thêm thông tin và bổ sung vào tố giác đang xử lý của bạn.'
        );
      } catch (err) {
        console.error('[ai-orchestrator] Facebook fast-path supplement reply failed:', err.message);
      }
      await saveToHistory(senderId, messages, null);
      return existingReport;
    }

    // No existing pending report — create a new one immediately
    const reportCode = await nextReportCode();
    const content = messages.map((m) => m.text).join('\n');

    const report = await Report.create({
      reportCode,
      channel: 'FACEBOOK',
      content,
      reporterInfo: { facebookId: senderId },
      categoryCode: 'LD',
      aiAnalysis: {
        summary: 'Tạo nhanh — bộ lọc AI đã tắt, phát hiện từ khóa lừa đảo',
        confidence: 1,
        extractedSignals: []
      },
      status: 'pending_approval'
    });

    // Telegram approval notification
    try {
      const telegramResult = await sendApprovalMessage(report);
      if (telegramResult?.result?.message_id) {
        report.decisionMessageId = String(telegramResult.result.message_id);
        await report.save();
      }
    } catch (err) {
      console.error('[ai-orchestrator] Telegram fast-path notification failed:', err.message);
    }

    // Facebook auto-reply to the reporter
    try {
      await sendFacebookTextMessage(
        senderId,
        'Cảm ơn bạn đã phản ánh. Chúng tôi đã tiếp nhận tố giác và sẽ xử lý sớm nhất có thể.'
      );
    } catch (err) {
      console.error('[ai-orchestrator] Facebook fast-path reply failed:', err.message);
    }

    await saveToHistory(senderId, messages, null);
    return report;
  }

  // ── Confirmation flow: if sender already has pending confirmation, handle it first
  // This must happen before the normal Gemini/report flow so we don't accidentally
  // create a report or ask unrelated follow-up questions.
  const pendingConfirmation = await PendingConfirmation.findOne({ senderId }).lean();
  if (pendingConfirmation) {
    return await handlePendingConfirmation({
      senderId,
      messages,
      pending: pendingConfirmation
    });
  }

  aiCallCounter += 1;

  // ── Step 1: Load conversation history for this sender ────────────────────
  // Fetch BEFORE saving current batch so the current messages are NOT in history
  // (they appear separately in the "new messages" section of the prompt).
  const history = await getConversationHistory(senderId);

  // ── Step 1.5: Check for an existing pending Report ───────────────────────
  // Must happen BEFORE calling Gemini so we can inject the open report's context
  // into the prompt and let the AI decide: supplement vs new incident.
  const openReport = await findPendingReportForSender(senderId);

  // Bail early if AI is disabled for this report
  if (openReport && openReport.aiEnabled === false) {
    console.info(
      '[ai-orchestrator] AI disabled for report %s — skipping reply for sender %s',
      openReport._id, senderId
    );
    return null;
  }

  console.info(
    '[ai-orchestrator] Processing batch for sender=%s | batch=%d msg(s) | history=%d msg(s) | openReport=%s',
    senderId, messages.length, history.length, openReport?._id ?? 'none'
  );

  // ── Step 1.7: Load accumulated sender state ─────────────────────────────
  const accumulatedData = await loadSenderState(senderId);

  // ── Step 2: Call Gemini with history-enriched prompt ─────────────────────
  const { systemPrompt: aiSystemPrompt, userPrompt: aiUserPrompt } = buildPrompt({ senderId, messages, history, openReport, accumulatedData });
  const analysis = await analyzeWithGemini(aiSystemPrompt, aiUserPrompt);

  // ── Step 2.5: Update sender state with merged extracted data ─────────────
  const newExtracted = getExtractedData(analysis);
  const mergedData = await updateSenderState(senderId, newExtracted, analysis.currentStep);

  // ── Step 2.6: Server-side documentReady override ─────────────────────────
  // Check both AI's current extraction AND merged accumulated data
  const serverDocReady = isDocumentReady(mergedData);
  if (serverDocReady && !analysis.documentReady) {
    console.info('[ai-orchestrator] Server-side override: documentReady forced to true (AI said false)');
    analysis.documentReady = true;
    // Use merged data so confirmation message includes all accumulated fields
    analysis.extractedData = mergedData;
  }

  const filledCount = NON_OPTIONAL_FIELDS.filter(
    (f) => isNonEmptyString(String(mergedData[f] ?? ''))
  ).length;
  const requiredCount = REQUIRED_FIELDS.filter(
    (f) => isNonEmptyString(String(mergedData[f] ?? ''))
  ).length;
  console.info(
    '[ai-orchestrator] Turn stats: filled=%d/%d, required=%d/%d, documentReady=%s',
    filledCount, NON_OPTIONAL_FIELDS.length, requiredCount, REQUIRED_FIELDS.length, analysis.documentReady
  );

  // ── Step 3: Persist conversation (inbound batch + outbound AI reply) ──────
  // Done immediately after AI responds, BEFORE the classification gate, so even
  // non-report conversations accumulate context for future batches.
  await saveToHistory(senderId, messages, analysis.followupMessage || null);

  // ── Step 4: Classification gate ──────────────────────────────────────────
  // Only persist a Report when the AI is confident this is a real crime report.
  if (analysis.intent !== REPORT_INTENT || (analysis.confidence ?? 0) < CONFIDENCE_THRESHOLD) {
    console.info(
      '[ai-orchestrator] NON-report (intent=%s, confidence=%s) — skipping Report persistence',
      analysis.intent, analysis.confidence ?? 'N/A'
    );

    // ── Document re-send: user asking for existing document ──────────────────
    // When intent is not report_crime but user has an open report with a
    // generated document and their message looks like a document request,
    // re-send the file instead of falling through to generic followup.
    if (openReport && openReport.documentGenerated && openReport.documentUrl) {
      const batchText = messages.map((m) => (m.text || '').toLowerCase()).join(' ');
      const DOCUMENT_REQUEST_KEYWORDS = ['đơn tố giác', 'gửi đơn', 'gửi file', 'tải đơn', 'file word', 'tài liệu', 'document'];
      const wantsDocument = DOCUMENT_REQUEST_KEYWORDS.some((kw) => batchText.includes(kw));

      if (wantsDocument) {
        console.info('[ai-orchestrator] Document re-send requested by sender %s for report %s', senderId, openReport._id);
        try {
          const stored = await readStoredDocument(openReport.documentUrl);
          await sendFacebookTextMessage(senderId, 'Đây là Đơn Tố Giác Tội Phạm của bạn. Vui lòng kiểm tra file đính kèm.');
          await sendFacebookFileMessage(senderId, stored.buffer, openReport.documentUrl);
        } catch (err) {
          console.error('[ai-orchestrator] Document re-send failed:', err.message);
          try {
            await sendFacebookTextMessage(senderId, 'Xin lỗi, không thể gửi lại đơn tố giác lúc này. Vui lòng thử lại sau.');
          } catch (_) { /* silent */ }
        }
        return null;
      }
    }

    try {
      const extracted = getExtractedData(analysis);
      const missingMsg = buildMissingFieldsMessage(extracted);
      const followup = missingMsg || analysis.followupMessage;
      if (followup) {
        await sendFacebookTextMessage(senderId, followup);
      }
    } catch (err) {
      console.error('[ai-orchestrator] Facebook followup (non-report) failed:', err.message);
    }

    return null;
  }

  // ── Step 5: Append to existing pending Report OR create a new one ─────────
  // Use AI's reportAction field to decide:
  //   "supplement_existing_report" → append note to the open report
  //   "new_report" (or absent)    → create a fresh report
  if (openReport && analysis.reportAction !== 'new_report') {
    console.info(
      '[ai-orchestrator] reportAction=%s — appending note to existing pending report %s for sender %s',
      analysis.reportAction ?? '(unset)', openReport._id, senderId
    );

    // If AI says data is ready, do NOT supplement immediately.
    // Save pending confirmation and ask reporter to confirm first.
    if (sysConfig.reportFilterEnabled && analysis.documentReady === true) {
      const extractedData = getExtractedData(analysis);
      const confirmMessage = buildConfirmationMessage(extractedData);

      await PendingConfirmation.findOneAndUpdate(
        { senderId },
        {
          $set: {
            senderId,
            extractedData,
            analysisSnapshot: analysis,
            sourceContent: messages.map((m) => m.text).join('\n'),
            reportAction: 'supplement_existing_report',
            openReportId: openReport._id,
            createdAt: new Date()
          },
          $inc: { attempts: 1 }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      try {
        await sendFacebookTextMessage(senderId, confirmMessage);
      } catch (err) {
        console.error('[ai-orchestrator] Facebook confirmation (supplement) failed:', err.message);
      }

      await saveToHistory(senderId, [], confirmMessage);
      return null;
    }

    // noteSummary = delta of new info; adminSummary may be null for supplement turns
    const noteText = analysis.noteSummary || analysis.adminSummary || messages.map((m) => m.text).join(' ');

    const supplementSet = buildSupplementSet(analysis);

    let updatedReport = await Report.findByIdAndUpdate(
      openReport._id,
      {
        $push: {
          notes: {
            text: noteText,
            source: 'ai',
            createdAt: new Date()
          }
        },
        ...(Object.keys(supplementSet).length > 0 ? { $set: supplementSet } : {})
      },
      {
        new: true,
        runValidators: true
      }
    );

    // ── Telegram: only notify immediately when filter is OFF (fast-path) ──────
    // When filter is ON, Telegram notification deferred to finalizePendingConfirmation
    if (!sysConfig.reportFilterEnabled) {
      try {
        await sendNoteUpdateMessage(openReport, noteText);
      } catch (err) {
        console.error('[ai-orchestrator] Telegram note-update notification failed:', err.message);
      }
    }

    try {
      const extracted = getExtractedData(analysis);
      const missingMsg = buildMissingFieldsMessage(extracted);
      const followup = missingMsg || analysis.followupMessage;
      if (followup) {
        await sendFacebookTextMessage(senderId, followup);
      }
    } catch (err) {
      console.error('[ai-orchestrator] Facebook followup (existing report) failed:', err.message);
    }

    updatedReport = await maybeGenerateAndSendDocument({
      report: updatedReport,
      analysis,
      senderId
    });

    return updatedReport;
  }

  // ── Step 5b: No existing report, or AI says this is a new incident ────────
  if (openReport) {
    console.info(
      '[ai-orchestrator] reportAction=new_report — creating new report despite open report %s for sender %s',
      openReport._id, senderId
    );
    await clearSenderState(senderId);
  }

  // If AI says the information is sufficient, do NOT create Report yet.
  // Save pending confirmation and wait for explicit reporter confirmation.
  if (sysConfig.reportFilterEnabled && analysis.documentReady === true) {
    const extractedData = getExtractedData(analysis);
    const confirmMessage = buildConfirmationMessage(extractedData);

    await PendingConfirmation.findOneAndUpdate(
      { senderId },
      {
        $set: {
          senderId,
          extractedData,
          analysisSnapshot: analysis,
          sourceContent: messages.map((m) => m.text).join('\n'),
          reportAction: 'new_report',
          openReportId: null,
          createdAt: new Date()
        },
        $inc: { attempts: 1 }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
      await sendFacebookTextMessage(senderId, confirmMessage);
    } catch (err) {
      console.error('[ai-orchestrator] Facebook confirmation (new report) failed:', err.message);
    }

    await saveToHistory(senderId, [], confirmMessage);
    return null;
  }

  const reportCode = await nextReportCode();

  let report = await Report.create({
    reportCode,
    channel: 'FACEBOOK',
    content: messages.map((m) => m.text).join('\n'),
    ...buildReportFieldsFromAnalysis({ senderId, analysis }),
    categoryCode: analysis.suggestedCategoryCode,
    aiAnalysis: {
      summary: analysis.adminSummary || analysis.noteSummary || '',
      confidence: analysis.confidence,
      extractedSignals: analysis.missingFields
    },
    status: 'pending_approval'
  });

  // ── Step 6: Telegram approval notification ────────────────────────────────
  try {
    const telegramResult = await sendApprovalMessage(report);
    if (telegramResult?.result?.message_id) {
      report.decisionMessageId = String(telegramResult.result.message_id);
      await report.save();
    }
  } catch (err) {
    console.error('[ai-orchestrator] Telegram approval notification failed:', err.message);
  }

  // ── Step 7: Facebook follow-up to the reporter ────────────────────────────
  try {
    const extracted = getExtractedData(analysis);
    const missingMsg = buildMissingFieldsMessage(extracted);
    const followup = missingMsg || analysis.followupMessage;
    if (followup) {
      await sendFacebookTextMessage(senderId, followup);
    }
  } catch (err) {
    console.error('[ai-orchestrator] Facebook followup (report) failed:', err.message);
  }

  report = await maybeGenerateAndSendDocument({ report, analysis, senderId });

  return report;
};

messageBatchService.onBatchReady(processBatch);

export const getAiCallCounter  = () => aiCallCounter;
export const resetAiCallCounter = () => { aiCallCounter = 0; };
