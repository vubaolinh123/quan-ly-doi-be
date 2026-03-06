import mongoose from 'mongoose';
import env from '../config/env.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import DutySchedule from '../models/DutySchedule.js';
import OfficialDispatch from '../models/OfficialDispatch.js';
import BasicOperationRecord from '../models/BasicOperationRecord.js';

const seed = async () => {
  try {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      Team.deleteMany({}),
      Project.deleteMany({}),
      DutySchedule.deleteMany({}),
      OfficialDispatch.deleteMany({}),
      BasicOperationRecord.deleteMany({})
    ]);

    const admin = await User.create({
      hoTen: 'Quản trị hệ thống CSHS',
      email: env.adminEmail,
      password: env.adminPassword,
      role: 'admin',
      chucVu: 'Đội trưởng',
      donViCongTac: 'Đội CSHS',
      soDienThoai: '0900000000'
    });

    const teams = await Team.insertMany([
      {
        maDoi: 'CSHS-01',
        tenDoi: 'Đội Trọng án',
        doiTruong: 'Thượng tá Nguyễn Văn A',
        soCanBo: 18,
        linhVucPhuTrach: 'Điều tra án nghiêm trọng',
        moTa: 'Phụ trách các vụ án hình sự đặc biệt nghiêm trọng'
      },
      {
        maDoi: 'CSHS-02',
        tenDoi: 'Đội Điều tra tổng hợp',
        doiTruong: 'Thiếu tá Trần Văn B',
        soCanBo: 14,
        linhVucPhuTrach: 'Điều tra tổng hợp địa bàn trọng điểm',
        moTa: 'Thu thập, xác minh và xử lý thông tin nghiệp vụ'
      }
    ]);

    await Project.insertMany([
      {
        maChuyenAn: 'CA-2026-001',
        tenChuyenAn: 'Triệt phá băng nhóm trộm cắp liên quận',
        loaiToiPham: 'Trộm cắp tài sản',
        diaBan: 'Quận 1, Quận 3',
        ngayBatDau: new Date('2026-01-05'),
        chuTri: 'Thượng tá Nguyễn Văn A',
        doiPhuTrach: teams[0]._id,
        mucDoUuTien: 'cao',
        trangThai: 'dang_dieu_tra',
        ketQuaSoBo: 'Đã xác định 3 đối tượng cầm đầu'
      },
      {
        maChuyenAn: 'CA-2026-002',
        tenChuyenAn: 'Đấu tranh tội phạm công nghệ cao',
        loaiToiPham: 'Lừa đảo chiếm đoạt tài sản',
        diaBan: 'Toàn thành phố',
        ngayBatDau: new Date('2026-02-12'),
        chuTri: 'Thiếu tá Trần Văn B',
        doiPhuTrach: teams[1]._id,
        mucDoUuTien: 'khancap',
        trangThai: 'mo',
        ketQuaSoBo: 'Đã lập danh sách 12 tài khoản nghi vấn'
      }
    ]);

    await DutySchedule.insertMany([
      {
        caTruc: 'ca_1',
        ngayTruc: new Date('2026-03-06'),
        gioBatDau: '06:00',
        gioKetThuc: '14:00',
        canBoTruc: 'Đại úy Phạm Văn C',
        donVi: 'Đội Trọng án',
        diaDiemTruc: 'Phòng trực ban CSHS',
        ghiChu: 'Tăng cường tuần tra giờ cao điểm'
      },
      {
        caTruc: 'ca_2',
        ngayTruc: new Date('2026-03-06'),
        gioBatDau: '14:00',
        gioKetThuc: '22:00',
        canBoTruc: 'Thượng úy Lê Văn D',
        donVi: 'Đội Điều tra tổng hợp',
        diaDiemTruc: 'Trực ban 113',
        ghiChu: 'Phối hợp xử lý tin báo khẩn'
      }
    ]);

    await OfficialDispatch.insertMany([
      {
        soCongVan: 'CV-2026-001',
        type: 'incoming',
        trichYeu: 'Phối hợp điều tra vụ việc trộm cắp tài sản',
        coQuanGuiNhan: 'Công an Quận 1',
        ngayBanHanh: new Date('2026-03-01'),
        nguoiKy: 'Nguyễn Văn E',
        mucDoMat: 'thuong',
        mucDoKhan: 'khan',
        hanXuLy: new Date('2026-03-10'),
        trangThaiXuLy: 'dang_xu_ly',
        ghiChu: 'Đã phân công cán bộ tiếp nhận'
      },
      {
        soCongVan: 'CV-2026-002',
        type: 'outgoing',
        trichYeu: 'Báo cáo sơ kết công tác đấu tranh phòng chống tội phạm',
        coQuanGuiNhan: 'Phòng Cảnh sát hình sự cấp trên',
        ngayBanHanh: new Date('2026-03-02'),
        nguoiKy: 'Trần Văn F',
        mucDoMat: 'mat',
        mucDoKhan: 'thuong',
        hanXuLy: new Date('2026-03-15'),
        trangThaiXuLy: 'chua_xu_ly',
        ghiChu: 'Chờ ký duyệt chính thức'
      }
    ]);

    await BasicOperationRecord.insertMany([
      {
        maHoSo: 'NV-2026-001',
        category: 'SUU_TRA',
        hoTenDoiTuong: 'Nguyễn Văn G',
        namSinh: 1995,
        gioiTinh: 'nam',
        cccd: '079095000001',
        noiCuTru: 'Phường Bến Nghé, Quận 1',
        hanhViLienQuan: 'Nghi vấn tiêu thụ tài sản do phạm tội mà có',
        diaBanQuanLy: 'Quận 1',
        canBoPhuTrach: 'Đại úy Phạm Văn C',
        ngayGhiNhan: new Date('2026-02-20'),
        tinhTrangHoSo: 'theo_doi',
        ghiChu: 'Cần tiếp tục xác minh mối quan hệ'
      },
      {
        maHoSo: 'NV-2026-002',
        category: 'TAM_THAN_NGAO_DA',
        hoTenDoiTuong: 'Lê Văn H',
        namSinh: 2000,
        gioiTinh: 'nam',
        cccd: '079100000002',
        noiCuTru: 'Phường 5, Quận 3',
        hanhViLienQuan: 'Sử dụng trái phép chất ma túy, gây rối trật tự công cộng',
        diaBanQuanLy: 'Quận 3',
        canBoPhuTrach: 'Thượng úy Lê Văn D',
        ngayGhiNhan: new Date('2026-02-25'),
        tinhTrangHoSo: 'da_chuyen_hoa',
        ghiChu: 'Đã đưa vào diện quản lý giáo dục tại địa phương'
      }
    ]);

    console.log('✅ Seed dữ liệu thành công');
    console.log(`👤 Admin mặc định: ${admin.email}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed dữ liệu thất bại:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seed();
