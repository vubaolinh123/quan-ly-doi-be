import { CATEGORY_CODES } from '../constants/domain.constants.js';

export const AI_INTENTS = ['report_crime', 'ask_info', 'complaint', 'other'];
export const AI_CATEGORY_CODES = Object.keys(CATEGORY_CODES);

/**
 * When the sender already has a pending report:
 *   "new_report"                  → this message is about a completely different incident
 *   "supplement_existing_report"  → this message adds info to the existing pending report
 * When there is no pending report, this field is not meaningful; orchestrator defaults to new_report.
 */
export const AI_REPORT_ACTIONS = ['new_report', 'supplement_existing_report'];

export const AI_ANALYSIS_SCHEMA = {
  type: 'object',
  required: [
    'intent',
    'suggestedCategoryCode',
    'confidence',
    'missingFields',
    'followupMessage',
    'adminSummary'
  ],
  properties: {
    intent: { type: 'string', enum: AI_INTENTS },
    suggestedCategoryCode: { type: 'string', enum: AI_CATEGORY_CODES },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    missingFields: { type: 'array', items: { type: 'string' } },
    followupMessage: { type: 'string' },
    adminSummary: { type: ['string', 'null'] },
    // noteSummary is optional — only populated when appending to an existing report
    noteSummary: { type: 'string' },
    // reportAction is optional — only meaningful when sender has a pending report
    reportAction: { type: 'string', enum: AI_REPORT_ACTIONS },
    // reportTitle — short ~20 word summary for quick admin review
    reportTitle: { type: ['string', 'null'] },
    // extractedData — structured data extracted from conversation for Đơn Tố Giác
    extractedData: { type: ['object', 'null'] },
    // documentReady — true when 70-80% of form fields are filled
    documentReady: { type: 'boolean' },
    // currentStep — which step the AI is currently asking about
    currentStep: { type: 'string' }
  }
};

const hasOnlyAllowedKeys = (obj, allowedKeys) =>
  Object.keys(obj).every((key) => allowedKeys.includes(key));

export const validateAiAnalysis = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const requiredFields = AI_ANALYSIS_SCHEMA.required;
  const propertyNames = Object.keys(AI_ANALYSIS_SCHEMA.properties);

  if (!hasOnlyAllowedKeys(value, propertyNames)) {
    return false;
  }

  for (const field of requiredFields) {
    if (!(field in value)) {
      return false;
    }
  }

  if (!AI_INTENTS.includes(value.intent)) {
    return false;
  }

  if (!AI_CATEGORY_CODES.includes(value.suggestedCategoryCode)) {
    return false;
  }

  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) {
    return false;
  }

  if (!Array.isArray(value.missingFields) || value.missingFields.some((item) => typeof item !== 'string')) {
    return false;
  }

  if (typeof value.followupMessage !== 'string') {
    return false;
  }

  // adminSummary may be null for supplement messages where the AI only fills noteSummary
  if (value.adminSummary !== null && typeof value.adminSummary !== 'string') {
    return false;
  }

  // noteSummary is optional — validate only when present
  if ('noteSummary' in value && typeof value.noteSummary !== 'string') {
    return false;
  }

  // reportAction is optional — validate only when present
  if ('reportAction' in value && !AI_REPORT_ACTIONS.includes(value.reportAction)) {
    return false;
  }

  // reportTitle is optional — validate only when present
  if ('reportTitle' in value && value.reportTitle !== null && typeof value.reportTitle !== 'string') {
    return false;
  }

  // extractedData is optional — validate only when present (must be object or null)
  if ('extractedData' in value && value.extractedData !== null && (typeof value.extractedData !== 'object' || Array.isArray(value.extractedData))) {
    return false;
  }

  // documentReady is optional — validate only when present
  if ('documentReady' in value && typeof value.documentReady !== 'boolean') {
    return false;
  }

  // currentStep is optional — validate only when present
  if ('currentStep' in value && typeof value.currentStep !== 'string') {
    return false;
  }

  return true;
};

export const createSafeAiFallback = () => ({
  intent: 'other',
  suggestedCategoryCode: 'KHXM',
  confidence: 0,
  missingFields: ['fullName', 'phone', 'incidentTime', 'incidentLocation'],
  followupMessage:
    'Vui lòng cung cấp họ tên, số điện thoại, thời gian và địa điểm xảy ra vụ việc để chúng tôi tiếp nhận đầy đủ.',
  adminSummary: 'Chưa đủ dữ liệu để phân tích. Cần bổ sung thêm thông tin từ người gửi.',
  noteSummary: 'Người dân gửi thêm thông tin nhưng chưa đủ để phân tích.',
  reportAction: 'supplement_existing_report',
  reportTitle: null,
  extractedData: null,
  documentReady: false,
  currentStep: 'greeting'
});
