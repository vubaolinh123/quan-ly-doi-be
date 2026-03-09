import { CATEGORY_CODES } from '../../constants/domain.constants.js';

const categoryLines = Object.entries(CATEGORY_CODES)
  .map(([code, label]) => `- ${code}: ${label}`)
  .join('\n');

export const buildCategoryClassifierPrompt = () => `Phân loại nội dung vào đúng 1 mã nhóm tội phạm sau:\n${categoryLines}\n\nChỉ chọn 1 mã suggestedCategoryCode thuộc danh sách trên.`;
