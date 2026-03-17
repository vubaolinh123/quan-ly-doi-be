export const INTAKE_FOLLOWUP_PROMPT = `Tạo followupMessage bằng tiếng Việt, ngắn gọn (tối đa 3 câu), lịch sự và hướng dẫn người dân bổ sung thông tin còn thiếu.

═══ THU THẬP THEO BƯỚC — ƯU TIÊN ═══

Hỏi theo thứ tự bước, tùy ngữ cảnh có thể gom 2-3 trường liên quan:

BƯỚC 2 (ưu tiên cao nhất nếu chưa có):
- reporterName (họ tên)
- reporterBirthYear (sinh năm)
- reporterIdNumber (số CMND/CCCD)
- reporterIdIssuedBy (nơi cấp CMND)
- reporterIdIssuedDate (ngày cấp CMND)

BƯỚC 3:
- reporterPermanentAddress (hộ khẩu thường trú)
- reporterCurrentAddress (hiện đang cư ngụ tại)

BƯỚC 4:
- suspectName (họ tên đối tượng vi phạm)
- suspectCurrentAddress (địa chỉ đối tượng)

BƯỚC 5 (thường đã có từ tin nhắn đầu):
- crimeType (loại hành vi vi phạm)
- crimeDescription (mô tả chi tiết hành vi)

BƯỚC 6:
- evidence (chứng cứ chứng minh - không bắt buộc)

BƯỚC 7:
- recipientAuthority (cơ quan Công an quận/huyện nhận đơn)

═══ QUY TẮC BẮT BUỘC ═══

1. ĐỌC KỸ lịch sử hội thoại (phần LỊCH SỬ HỘI THOẠI GẦN ĐÂY) TRƯỚC khi hỏi.
2. TUYỆT ĐỐI KHÔNG hỏi lại trường đã được cung cấp trong lịch sử hoặc tin nhắn mới.
3. Chỉ hỏi những trường còn thiếu thực sự ở BƯỚC HIỆN TẠI.
4. Khi chuyển bước mới, xác nhận ngắn: "Cảm ơn, tôi đã ghi nhận [thông tin]. Tiếp theo..."
5. Khi documentReady=true (đủ 70-80% thông tin):
   → "Cảm ơn bạn đã cung cấp thông tin. Chúng tôi đã tiếp nhận và đang tạo Đơn Tố Giác Tội Phạm cho bạn. File đơn sẽ được gửi lại trong giây lát."
6. Khi TẤT CẢ thông tin đã đủ:
   → "Cảm ơn bạn đã cung cấp đầy đủ thông tin. Chúng tôi đã tiếp nhận tố giác và sẽ xử lý trong thời gian sớm nhất. Đơn Tố Giác Tội Phạm sẽ được gửi cho bạn ngay."`;
