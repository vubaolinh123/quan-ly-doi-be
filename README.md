# Backend — Quản lý Công tác Đội 3 PC05

Backend Node.js + Express + MongoDB cho hệ thống quản lý nghiệp vụ công an Đội 3 PC05, tích hợp Facebook Messenger + Gemini AI + Telegram Bot.

---

## 1. Cài đặt

```bash
cd backend
npm install
```

---

## 2. Cấu hình môi trường

Sao chép file mẫu:

```bash
cp .env.example .env
```

Chỉnh sửa `.env` với giá trị thật (xem mục **Biến môi trường** bên dưới).

---

## 3. Seed dữ liệu mẫu

```bash
npm run seed
```

Tạo:
- 01 tài khoản admin mặc định
- 10 hạng mục nghiệp vụ chuẩn (MA_TUY, HINH_SU, KINH_TE, ...)
- Cán bộ mẫu cho từng hạng mục

---

## 4. Chạy dự án

Phát triển (hot reload):

```bash
npm run dev
```

Production:

```bash
npm start
```

---

## 5. Biến môi trường

| Biến | Mô tả | Bắt buộc |
|------|-------|----------|
| `PORT` | Cổng server (mặc định: `5000`) | Không |
| `NODE_ENV` | Môi trường (`development`/`production`) | Không |
| `MONGO_URI` | Chuỗi kết nối MongoDB | Có |
| `JWT_SECRET` | Khóa ký JWT (đổi trong production) | Có |
| `JWT_EXPIRES_IN` | Thời hạn token (mặc định: `7d`) | Không |
| `ADMIN_EMAIL` | Email tài khoản admin seed | Không |
| `ADMIN_PASSWORD` | Mật khẩu admin seed | Không |
| `FACEBOOK_VERIFY_TOKEN` | Token xác thực webhook FB | Có |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Token gửi tin nhắn Facebook | Có |
| `FACEBOOK_APP_SECRET` | App Secret ký HMAC-SHA256 cho webhook | Có |
| `GEMINI_API_KEY` | API key Google Gemini | Có |
| `GEMINI_MODEL` | Model Gemini (mặc định: `gemini-1.5-flash`) | Không |
| `TELEGRAM_BOT_TOKEN` | Token Telegram Bot | Có |
| `TELEGRAM_CHAT_ID` | Chat ID nhận thông báo admin | Có |
| `TELEGRAM_WEBHOOK_SECRET` | Secret kiểm tra callback Telegram | Có |
| `MESSAGE_BATCH_WINDOW_MS` | Cửa sổ gom tin nhắn FB (ms, mặc định: `5000`) | Không |

---

## 6. API Endpoints

Base URL: `http://localhost:5000/api`

### Auth (public)
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/auth/register` | Đăng ký tài khoản |
| POST | `/auth/login` | Đăng nhập, nhận JWT |
| GET | `/auth/me` | Lấy thông tin user hiện tại |

### Webhooks (public, có signature verification)
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/webhooks/facebook` | FB verify token handshake |
| POST | `/webhooks/facebook` | Nhận event Messenger (bắt buộc `X-Hub-Signature-256`) |
| POST | `/webhooks/telegram` | Nhận callback Telegram (bắt buộc `X-Telegram-Bot-Api-Secret-Token`) |

**Luồng webhook Facebook:**
1. POST nhận tin nhắn → verify HMAC-SHA256
2. Gom theo `senderId` trong cửa sổ `MESSAGE_BATCH_WINDOW_MS`
3. 1 batch → 1 lần gọi Gemini AI
4. Tạo `Report` với trạng thái `pending_approval`
5. Gửi summary lên Telegram kèm inline keyboard (Approve/Reject)

### Hạng mục (Bearer token bắt buộc)
| Method | Path | RBAC |
|--------|------|------|
| GET | `/categories` | protect |
| POST | `/categories` | protect + admin |
| PUT | `/categories/:id` | protect + admin |
| DELETE | `/categories/:id` | protect + admin |

### Cán bộ (Bearer token bắt buộc)
| Method | Path | RBAC |
|--------|------|------|
| GET | `/officers` | protect |
| POST | `/officers` | protect + admin |
| PUT | `/officers/:id` | protect + admin |
| DELETE | `/officers/:id` | protect + admin |

### Công việc (Bearer token bắt buộc)
| Method | Path | RBAC |
|--------|------|------|
| GET | `/tasks` | protect |
| POST | `/tasks` | protect + admin |
| PUT | `/tasks/:id` | protect + admin |
| DELETE | `/tasks/:id` | protect + admin |

### Tố giác (Bearer token bắt buộc)
| Method | Path | RBAC |
|--------|------|------|
| GET | `/reports` | protect |
| GET | `/reports/:id` | protect |
| PUT | `/reports/:id` | protect + admin |

### Lịch làm việc (Bearer token bắt buộc)
| Method | Path | RBAC |
|--------|------|------|
| GET | `/schedules` | protect |
| POST | `/schedules` | protect + admin |
| PUT | `/schedules/:id` | protect + admin |
| DELETE | `/schedules/:id` | protect + admin |

### Dashboard (Bearer token bắt buộc)
| Method | Path | RBAC |
|--------|------|------|
| GET | `/dashboard` | protect |

Response có keys: `stats`, `kanban`, `byCategory`, `byOfficer`

---

## 7. Kiến trúc thư mục

```text
backend/
  src/
    config/           # env.js — tập trung biến môi trường
    constants/        # domain.constants.js — mã hạng mục, trạng thái
    controllers/      # xử lý HTTP request/response
    middlewares/      # auth, facebookSignature, telegramSecret
    models/           # Mongoose schemas (Category, Officer, Task, Report, Schedule)
    prompts/          # Gemini prompts theo module
      system/         # base-system.prompt.js
      classification/ # category-classifier.prompt.js
      conversation/   # intake-followup.prompt.js
      summary/        # admin-summary.prompt.js
    routes/           # Express routers
    schemas/          # ai-analysis.schema.js — output contract Gemini
    seed/             # seed.js
    services/         # business logic
      assignment.service.js      # round-robin gán cán bộ
      ai-orchestrator.service.js # điều phối AI flow
      gemini.service.js          # wrapper Gemini API
      facebook.service.js        # gửi tin FB
      telegram.service.js        # gửi/nhận Telegram
      message-batch.service.js   # gom tin nhắn 5s
      report-approval.service.js # duyệt/từ chối tố giác
    utils/
    app.js
    server.js
  scripts/
    verify-round-robin.mjs
    verify-facebook-batching.mjs
    verify-telegram-idempotency.mjs
    e2e-facebook-gemini-telegram.mjs  # E2E harness offline
    test-fixtures/
      facebook-messages.json
      telegram-callbacks.json
```

---

## 8. Kiểm tra & Xác minh

### Round-robin gán cán bộ
```bash
node scripts/verify-round-robin.mjs
node scripts/verify-round-robin.mjs --category=EMPTY
```

### Facebook webhook batching
```bash
# Test signature không hợp lệ → 403
npm run verify:facebook-batching -- --invalid-signature

# Test 3 tin nhắn → 1 AI call, report pending_approval
npm run verify:facebook-batching -- --messages=3 --window=5000
```

### Telegram idempotency
```bash
# Test secret không hợp lệ → 403
node scripts/verify-telegram-idempotency.mjs --invalid-secret

# Test duyệt trùng → already_processed, chỉ 1 task
node scripts/verify-telegram-idempotency.mjs --duplicate-approve

# Test từ chối → reportStatus=rejected
node scripts/verify-telegram-idempotency.mjs --reject
```

### E2E đầy đủ (offline, không cần API keys thật)
```bash
npm run verify:e2e
```

Chạy toàn bộ luồng: FB messages → batch → AI mock → report → Telegram approve → task created.
