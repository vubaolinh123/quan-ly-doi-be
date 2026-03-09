export const AI_ANALYSIS_SCHEMA = {
  required: ['intent', 'confidence', 'adminSummary'],
  intents: ['report', 'inquiry', 'other']
};

export const validateAiAnalysis = (data) => {
  if (!data || typeof data !== 'object') return false;
  if (!AI_ANALYSIS_SCHEMA.intents.includes(data.intent)) return false;
  if (typeof data.confidence !== 'number') return false;
  if (typeof data.adminSummary !== 'string') return false;
  return true;
};

export const fallbackAnalysis = {
  intent: 'report',
  suggestedCategoryCode: null,
  confidence: 0,
  missingFields: ['thông tin người tố giác', 'nội dung chi tiết'],
  followupMessage: 'Xin lỗi, chúng tôi chưa hiểu rõ nội dung. Bạn có thể mô tả lại sự việc không?',
  adminSummary: '[AI parse failed] Cần xem xét thủ công'
};
