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
    reportAction: { type: 'string', enum: AI_REPORT_ACTIONS }
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
  reportAction: 'supplement_existing_report'
});
