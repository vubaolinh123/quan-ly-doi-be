export const ADMIN_SUMMARY_PROMPT = `Tạo 3 trường tóm tắt bằng tiếng Việt thuần túy dành cho cán bộ đọc.
TUYỆT ĐỐI không viết tên trường kỹ thuật: suggestedCategoryCode, confidence, missingFields, noteSummary, adminSummary hay bất kỳ từ tiếng Anh nào vào nội dung text.

━━━ reportTitle ━━━
Tóm tắt ngắn gọn ~20 từ nội dung vụ việc, dùng làm tiêu đề để cán bộ nhận xét nhanh.
Ví dụ tốt: "Tố giác lừa đảo chuyển khoản 50 triệu qua app giả mạo ngân hàng tại Nha Trang"
Ví dụ tốt: "Phản ánh đánh bạc online qua ứng dụng cá cược tại Cam Ranh"
Nếu chưa đủ thông tin: "Tiếp nhận tố giác tội phạm - đang thu thập thông tin"

━━━ adminSummary ━━━
Dùng khi tạo báo cáo mới lần đầu. Gồm tối đa 3 dòng:
  Dòng 1: 2-3 câu mô tả vụ việc tự nhiên — ai tố giác gì, xảy ra khi nào / ở đâu / như thế nào (chỉ nêu những gì đã biết, không bịa).
  Dòng 2: "Nhóm tội phạm đề xuất: [tên nhóm đầy đủ bằng tiếng Việt]"
  Dòng 3: "Còn thiếu: [danh sách tiếng Việt ngắn, cách nhau bởi dấu phẩy]" — bỏ dòng này nếu không còn thiếu gì.

Ví dụ tốt:
  "Nguyễn Văn A (SĐT: 0908789987) tố giác bị lừa đảo mất tiền trong tài khoản ngân hàng ABC sau khi nhấp vào link abc.vn lúc 15h hôm nay tại 80 Trần Phú, Nha Trang.
  Nhóm tội phạm đề xuất: Lừa đảo chiếm đoạt tài sản trên không gian mạng
  Còn thiếu: Mô tả đối tượng, chi tiết giao dịch"

Ví dụ xấu (không được làm):
  "- Mã nhóm tội phạm: LD, confidence: 0.9 - missingFields: fullName, phone..."

━━━ noteSummary ━━━
Dùng khi người dân BỔ SUNG thông tin vào báo cáo đã có. Chỉ 1-2 câu ngắn gọn, nêu ĐÚNG những gì mới nhận được trong batch này, không nhắc lại thông tin cũ.

Ví dụ tốt: "Người dân bổ sung: họ tên Nguyễn Văn A, SĐT 0908789987, thời gian khoảng 15h hôm nay, địa điểm 80 Trần Phú, Nha Trang."
Ví dụ xấu: "Người dân tố giác bị lừa đảo... Nhóm tội phạm đề xuất... Còn thiếu: mô tả đối tượng..."`;
