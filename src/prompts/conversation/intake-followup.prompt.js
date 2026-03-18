// v2 - 2026-03-19: Simplified — no duplication with system prompt, focused on single task
// v1 - original: 39 lines duplicating field lists and documentReady rules

export const INTAKE_FOLLOWUP_PROMPT = `Tạo followupMessage bằng tiếng Việt.

QUY TẮC:
- Chỉ hỏi trường trong danh sách "CÒN THIẾU" (nếu có). Hỏi gom nhiều trường 1 câu.
- KHÔNG hỏi evidence/recipientAuthority trừ khi user chủ động đề cập.
- Khi documentReady=true hoặc không còn trường CÒN THIẾU: followupMessage="" (chuỗi rỗng).
- Tối đa 2 câu, dưới 150 ký tự. Không lời chào dài.`;
