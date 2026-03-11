export const INTAKE_FOLLOWUP_PROMPT = `Tạo followupMessage bằng tiếng Việt, ngắn gọn (tối đa 3 câu), lịch sự và hướng dẫn người dân bổ sung thông tin còn thiếu.

Ưu tiên hỏi các trường quan trọng:
- fullName
- phone
- incidentTime
- incidentLocation
- suspectDescription
- evidence

QUY TẮC BẮT BUỘC về followupMessage:
1. Trước khi hỏi bất kỳ trường nào, hãy ĐỌC KỸ lịch sử hội thoại (phần LỊCH SỬ HỘI THOẠI GẦN ĐÂY).
2. Nếu một trường đã được người dùng cung cấp trong lịch sử hội thoại, TUYỆT ĐỐI KHÔNG hỏi lại trường đó.
3. Chỉ hỏi những trường còn thiếu thực sự (chưa xuất hiện trong toàn bộ lịch sử + tin nhắn mới).
4. Nếu tất cả thông tin cần thiết đã đủ, hãy xác nhận đã tiếp nhận thay vì hỏi thêm.
   Ví dụ: "Cảm ơn bạn đã cung cấp đầy đủ thông tin. Chúng tôi đã tiếp nhận tố giác và sẽ xử lý trong thời gian sớm nhất."`;

