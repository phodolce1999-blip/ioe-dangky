// Lớp lưu trữ dữ liệu đơn giản dựa trên file JSON.
// Dùng thao tác đồng bộ (sync) có chủ đích: dữ liệu nhỏ (vài nghìn hồ sơ vẫn ổn),
// tránh hoàn toàn lỗi race-condition khi ghi file đồng thời — phù hợp cho quy mô
// một trường/một cuộc thi. Nếu cần mở rộng lớn hơn, hãy thay bằng SQLite/Postgres.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data', 'hoso.json');

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]\n', 'utf8');
}

function readAll() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('Không đọc được data/hoso.json, dữ liệu có thể bị lỗi:', err.message);
    return [];
  }
}

function writeAll(list) {
  ensureDataFile();
  // Ghi ra file tạm rồi đổi tên để giảm rủi ro hỏng file nếu tiến trình bị ngắt giữa chừng.
  const tmpFile = DATA_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(list, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

function genId() {
  return crypto.randomUUID();
}

// Sinh Mã Thí Sinh theo đúng định dạng hệ thống IOE thật đang dùng, VD: "109QOHA"
// (3 chữ số + 4 chữ cái in hoa).
function genMaThiSinh() {
  const num = crypto.randomInt(100, 1000); // 100 - 999
  let letters = '';
  for (let i = 0; i < 4; i++) {
    letters += String.fromCharCode(65 + crypto.randomInt(0, 26));
  }
  return `${num}${letters}`;
}

function createHoSo(input) {
  const list = readAll();

  let maThiSinh = genMaThiSinh();
  // Đảm bảo mã thí sinh không trùng (xác suất trùng rất thấp nhưng vẫn kiểm tra cho chắc).
  while (list.some((h) => h.ma_thi_sinh === maThiSinh)) {
    maThiSinh = genMaThiSinh();
  }

  const now = new Date().toISOString();
  const hoSo = {
    id: genId(),
    ma_thi_sinh: maThiSinh, // Sinh ngay khi đăng ký, admin có thể sửa lại nếu cần
    ho_ten: input.ho_ten,
    nam_sinh: input.nam_sinh || '',
    khoi_lop: input.khoi_lop,
    ho_ten_phu_huynh: input.ho_ten_phu_huynh,
    nam_sinh_phu_huynh: input.nam_sinh_phu_huynh || '',
    sdt_phu_huynh: input.sdt_phu_huynh,
    nghe_nghiep_phu_huynh: input.nghe_nghiep_phu_huynh || '',
    dia_chi: input.dia_chi || '',
    email: input.email || '',
    ghi_chu: input.ghi_chu || '',
    trang_thai: 'pending',
    admin_note: '',
    ngay_dang_ky: now,
    ngay_cap_nhat: now,
  };

  list.push(hoSo);
  writeAll(list);
  return hoSo;
}

function getAll() {
  return readAll().sort((a, b) => new Date(b.ngay_dang_ky) - new Date(a.ngay_dang_ky));
}

function getById(id) {
  return readAll().find((h) => h.id === id) || null;
}

function updateHoSo(id, patch) {
  const list = readAll();
  const idx = list.findIndex((h) => h.id === id);
  if (idx === -1) return null;

  list[idx] = {
    ...list[idx],
    ...patch,
    id: list[idx].id, // không cho ghi đè id
    ngay_dang_ky: list[idx].ngay_dang_ky,
    ngay_cap_nhat: new Date().toISOString(),
  };
  writeAll(list);
  return list[idx];
}

function setTrangThai(id, trangThai, adminNote) {
  return updateHoSo(id, {
    trang_thai: trangThai,
    ...(adminNote !== undefined ? { admin_note: adminNote } : {}),
  });
}

function deleteHoSo(id) {
  const list = readAll();
  const next = list.filter((h) => h.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

module.exports = {
  createHoSo,
  getAll,
  getById,
  updateHoSo,
  setTrangThai,
  deleteHoSo,
};
