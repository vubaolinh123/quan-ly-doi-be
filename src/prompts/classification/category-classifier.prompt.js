import { CATEGORY_CODES } from '../../constants/domain.constants.js';

const categoryList = Object.entries(CATEGORY_CODES)
  .map(([code, name]) => `- ${code}: ${name}`)
  .join('\n');

export const categoryClassifierPrompt = (messages) => `
Phân tích nội dung tố giác sau và trả về JSON theo đúng schema.

Nội dung tố giác:
${messages.map((m, i) => `[${i + 1}] ${m}`).join('\n')}

Danh sách hạng mục:
${categoryList}

Trả về JSON với schema:
{
  "intent": "report" | "inquiry" | "other",
  "suggestedCategoryCode": "<one of the category codes above or null>",
  "confidence": <0.0-1.0>,
  "missingFields": ["<tên trường còn thiếu>"],
  "followupMessage": "<câu hỏi tiếp theo bằng tiếng Việt nếu cần, hoặc null>",
  "adminSummary": "<tóm tắt ngắn gọn cho admin>"
}
`;
