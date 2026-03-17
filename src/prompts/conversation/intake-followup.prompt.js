export const INTAKE_FOLLOWUP_PROMPT = `Tạo followupMessage bằng tiếng Việt, ngắn gọn, tối đa 2 câu (quy tắc cứng).

═══ THU THẬP THEO BƯỚC — ƯU TIÊN ═══

Hỏi theo thứ tự bước, nhưng ưu tiên hỏi GOM nhiều trường trong 1 lượt để chốt nhanh:

BƯỚC 2 + BƯỚC 3 (có thể hỏi cùng lúc):
- reporterName (họ tên)
- reporterBirthYear (sinh năm)
- reporterIdNumber (số CMND/CCCD)
- reporterIdIssuedBy (nơi cấp CMND/CCCD)
- reporterIdIssuedDate (ngày cấp)
- reporterPermanentAddress (hộ khẩu thường trú)
- reporterCurrentAddress (nơi cư ngụ hiện tại)

BƯỚC 4 + BƯỚC 5 (có thể hỏi cùng lúc):
- suspectName (họ tên đối tượng vi phạm)
- suspectCurrentAddress (địa chỉ đối tượng)
- crimeType (loại hành vi vi phạm)
- crimeDescription (mô tả chi tiết hành vi)

BƯỚC 6 (tùy chọn):
- evidence (chứng cứ chứng minh)

BƯỚC 7 (tùy chọn):
- recipientAuthority (cơ quan Công an quận/huyện nhận đơn)

═══ QUY TẮC BẮT BUỘC ═══

1. ĐỌC KỸ lịch sử hội thoại (phần LỊCH SỬ HỘI THOẠI GẦN ĐÂY) TRƯỚC khi hỏi.
2. TUYỆT ĐỐI KHÔNG hỏi lại trường đã được cung cấp trong lịch sử hoặc tin nhắn mới.
3. Chỉ hỏi các trường còn thiếu thực sự, ưu tiên hỏi gom để giảm số lượt.
4. KHÔNG hỏi evidence/recipientAuthority nếu user không chủ động đề cập.
5. Khi documentReady=true:
   → Đặt followupMessage = "" (chuỗi rỗng). Hệ thống sẽ tự động gửi tin nhắn xác nhận danh sách thông tin tới người dùng — AI KHÔNG gửi thêm bất cứ tin nhắn nào trong lượt này.
6. Khi TẤT CẢ thông tin đã đủ:
   → Đặt followupMessage = "" (chuỗi rỗng). Tương tự bước 5, hệ thống xử lý phần xác nhận và tạo đơn.
7. SAU KHI có reporterName + crimeDescription + 3 trường khác bất kỳ:
   → documentReady=true, KHÔNG hỏi thêm.`;
