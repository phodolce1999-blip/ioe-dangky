// Cấu hình ứng dụng — đọc từ biến môi trường, có giá trị mặc định để chạy thử nhanh.
// QUAN TRỌNG: khi đưa lên môi trường thật (production), hãy đặt biến môi trường
// ADMIN_USERNAME và ADMIN_PASSWORD của riêng bạn (không dùng giá trị mặc định).

'use strict';

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'ioe@2026',
  },

  // Thời gian phiên đăng nhập admin còn hiệu lực (mili giây)
  sessionMaxAgeMs: 12 * 60 * 60 * 1000, // 12 giờ

  // Danh sách khối lớp hợp lệ khi đăng ký
  khoiLopOptions: [
    'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5',
    'Lớp 6', 'Lớp 7', 'Lớp 8', 'Lớp 9',
    'Lớp 10', 'Lớp 11', 'Lớp 12',
  ],
};
