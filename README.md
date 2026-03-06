# Backend CMS "Công tác CSHS"

Backend Node.js + Express + MongoDB cho hệ thống quản lý nghiệp vụ CSHS.

## 1) Cài đặt

```bash
cd backend
npm install
```

## 2) Cấu hình môi trường

Đã có sẵn file `.env` và `.env.example`.

Các biến chính:

- `PORT`: Cổng server (mặc định `5000`)
- `MONGO_URI`: Chuỗi kết nối MongoDB
- `JWT_SECRET`: Khóa ký JWT
- `JWT_EXPIRES_IN`: Thời hạn token (mặc định `7d`)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: Tài khoản admin để seed dữ liệu

## 3) Chạy dự án

```bash
npm run dev
```

Production:

```bash
npm start
```

## 4) Seed dữ liệu mẫu

```bash
npm run seed
```

Tạo:
- 01 tài khoản admin mặc định
- Dữ liệu mẫu cho Teams, Projects, DutySchedules, OfficialDispatches, BasicOperationRecords

## 5) API

Base URL: `http://localhost:5000/api`

### Auth (public)
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (Bearer token)

### Tài nguyên (đều yêu cầu Bearer token)
- `Teams`: `/teams`
- `Projects`: `/projects`
- `Duty Schedules`: `/duty-schedules`
- `Official Dispatches`: `/official-dispatches` (`type=incoming|outgoing`)
- `Basic Operations`: `/basic-operations` (`category=SUU_TRA|THANH_THIEU_NIEN_HU|TU_THA|TAM_THAN_NGAO_DA`)

Mỗi endpoint danh sách hỗ trợ query:
- `q`: từ khóa tìm kiếm
- `page`: trang
- `limit`: số bản ghi/trang

## 6) Kiến trúc thư mục

```text
backend/
  src/
    config/
    controllers/
    middlewares/
    models/
    routes/
    seed/
    utils/
    app.js
    server.js
```
