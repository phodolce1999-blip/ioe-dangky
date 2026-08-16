// Server web đăng ký hồ sơ dự thi IOE + trang quản trị xét duyệt.
// Chỉ dùng các module lõi của Node.js (http, fs, crypto, ...) — không cần "npm install"
// để chạy được, tránh phụ thuộc mạng khi triển khai.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const config = require('./config');
const db = require('./db');
const sessions = require('./sessions');

const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_COOKIE = 'ioe_admin_session';

// ---------- Tiện ích chung ----------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, statusCode, message, details) {
  sendJSON(res, statusCode, { ok: false, error: message, details: details || undefined });
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

function readJSONBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    const MAX_SIZE = 1024 * 1024; // 1MB — quá đủ cho một form đăng ký
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_SIZE) {
        reject(new Error('Payload quá lớn'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('JSON không hợp lệ'));
      }
    });
    req.on('error', reject);
  });
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return sessions.isValid(cookies[SESSION_COOKIE]);
}

function requireAuth(req, res) {
  if (!isAuthenticated(req)) {
    sendError(res, 401, 'Chưa đăng nhập hoặc phiên đã hết hạn.');
    return false;
  }
  return true;
}

// ---------- Validate dữ liệu đăng ký ----------

const PHONE_REGEX = /^(0|\+84)(\d{9,10})$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const YEAR_REGEX = /^(19|20)\d{2}$/;

function validateDangKy(input) {
  const errors = {};

  const hoTen = (input.ho_ten || '').trim();
  if (hoTen.length < 2) errors.ho_ten = 'Vui lòng nhập họ tên thí sinh.';

  const namSinh = (input.nam_sinh || '').toString().trim();
  if (!YEAR_REGEX.test(namSinh)) errors.nam_sinh = 'Vui lòng nhập năm sinh hợp lệ (VD: 2015).';

  const khoiLop = (input.khoi_lop || '').trim();
  if (!config.khoiLopOptions.includes(khoiLop)) errors.khoi_lop = 'Vui lòng chọn khối lớp hợp lệ.';

  const phuHuynh = (input.ho_ten_phu_huynh || '').trim();
  if (phuHuynh.length < 2) errors.ho_ten_phu_huynh = 'Vui lòng nhập họ tên phụ huynh.';

  const namSinhPH = (input.nam_sinh_phu_huynh || '').toString().trim();
  if (namSinhPH && !YEAR_REGEX.test(namSinhPH)) errors.nam_sinh_phu_huynh = 'Năm sinh không hợp lệ.';

  const sdt = (input.sdt_phu_huynh || '').trim();
  if (!PHONE_REGEX.test(sdt)) errors.sdt_phu_huynh = 'Số điện thoại không hợp lệ (VD: 0912345678).';

  const email = (input.email || '').trim();
  if (email && !EMAIL_REGEX.test(email)) errors.email = 'Email không hợp lệ.';

  return { valid: Object.keys(errors).length === 0, errors };
}

// ---------- Phục vụ file tĩnh ----------

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  // Cho phép /admin và /admin/ mở thẳng trang dashboard (JS phía client sẽ tự
  // điều hướng sang login.html nếu chưa đăng nhập).
  if (filePath === '/admin' || filePath === '/admin/') filePath = '/admin/index.html';

  const resolved = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, 'Truy cập không hợp lệ.');
    return;
  }

  fs.readFile(resolved, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Không tìm thấy trang.');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Lỗi máy chủ.');
      }
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- Router API ----------

async function handleApi(req, res, pathname) {
  const method = req.method;

  // --- Đăng ký hồ sơ (công khai) ---
  if (pathname === '/api/dangky' && method === 'POST') {
    let body;
    try {
      body = await readJSONBody(req);
    } catch (err) {
      return sendError(res, 400, err.message);
    }

    // Honeypot chống bot: field "website" phải luôn để trống (ẩn bằng CSS trên form).
    if (body.website) {
      return sendJSON(res, 200, { ok: true, data: { ma_thi_sinh: 'IOE-XXXXX' } }); // giả vờ thành công với bot
    }

    const { valid, errors } = validateDangKy(body);
    if (!valid) return sendError(res, 422, 'Dữ liệu chưa hợp lệ.', errors);

    const hoSo = db.createHoSo({
      ho_ten: body.ho_ten.trim(),
      nam_sinh: (body.nam_sinh || '').toString().trim(),
      khoi_lop: body.khoi_lop.trim(),
      ho_ten_phu_huynh: body.ho_ten_phu_huynh.trim(),
      nam_sinh_phu_huynh: (body.nam_sinh_phu_huynh || '').toString().trim(),
      sdt_phu_huynh: body.sdt_phu_huynh.trim(),
      nghe_nghiep_phu_huynh: (body.nghe_nghiep_phu_huynh || '').trim(),
      dia_chi: (body.dia_chi || '').trim(),
      email: (body.email || '').trim(),
      ghi_chu: (body.ghi_chu || '').trim(),
    });

    return sendJSON(res, 201, {
      ok: true,
      data: hoSo,
      message: 'Hệ thống xác nhận thông tin hồ sơ đã có trên hệ thống trong trạng thái chờ xét duyệt chính thức.',
    });
  }

  // --- Tra cứu trạng thái hồ sơ theo Mã Thí Sinh + SĐT (công khai) ---
  if (pathname === '/api/tra-cuu' && method === 'GET') {
    const { query } = url.parse(req.url, true);
    const maThiSinh = (query.ma_thi_sinh || '').trim();
    const sdt = (query.sdt || '').trim();
    if (!maThiSinh || !sdt) return sendError(res, 400, 'Thiếu mã thí sinh hoặc số điện thoại.');

    const hoSo = db.getAll().find(
      (h) => h.ma_thi_sinh.toLowerCase() === maThiSinh.toLowerCase() && h.sdt_phu_huynh === sdt
    );
    if (!hoSo) return sendError(res, 404, 'Không tìm thấy hồ sơ khớp với thông tin đã nhập.');

    return sendJSON(res, 200, { ok: true, data: hoSo });
  }

  // --- Đăng nhập admin ---
  if (pathname === '/api/admin/login' && method === 'POST') {
    let body;
    try {
      body = await readJSONBody(req);
    } catch (err) {
      return sendError(res, 400, err.message);
    }
    const { username, password } = body;

    // So sánh thời gian không đổi để giảm rủi ro timing attack.
    const validUser =
      typeof username === 'string' &&
      username.length === config.admin.username.length &&
      crypto.timingSafeEqual(Buffer.from(username), Buffer.from(config.admin.username));
    const validPass =
      typeof password === 'string' &&
      password.length === config.admin.password.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(config.admin.password));

    if (!validUser || !validPass) {
      return sendError(res, 401, 'Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    const token = sessions.createSession();
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(
        config.sessionMaxAgeMs / 1000
      )}; SameSite=Lax`
    );
    return sendJSON(res, 200, { ok: true });
  }

  // --- Đăng xuất admin ---
  if (pathname === '/api/admin/logout' && method === 'POST') {
    const cookies = parseCookies(req);
    sessions.destroySession(cookies[SESSION_COOKIE]);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
    return sendJSON(res, 200, { ok: true });
  }

  // --- Kiểm tra trạng thái đăng nhập ---
  if (pathname === '/api/admin/me' && method === 'GET') {
    return sendJSON(res, 200, { ok: true, authenticated: isAuthenticated(req) });
  }

  // Từ đây trở xuống, tất cả API đều yêu cầu đăng nhập admin.
  if (pathname.startsWith('/api/admin/')) {
    if (!requireAuth(req, res)) return;
  }

  // --- Danh sách hồ sơ (có filter) ---
  if (pathname === '/api/admin/hoso' && method === 'GET') {
    const { query } = url.parse(req.url, true);
    let list = db.getAll();

    const trangThai = (query.trang_thai || '').trim();
    if (trangThai && trangThai !== 'all') {
      list = list.filter((h) => h.trang_thai === trangThai);
    }

    const khoiLop = (query.khoi_lop || '').trim();
    if (khoiLop && khoiLop !== 'all') {
      list = list.filter((h) => h.khoi_lop === khoiLop);
    }

    const q = (query.q || '').trim().toLowerCase();
    if (q) {
      list = list.filter((h) =>
        [h.ho_ten, h.ma_thi_sinh, h.ho_ten_phu_huynh, h.sdt_phu_huynh, h.dia_chi]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }

    return sendJSON(res, 200, { ok: true, data: list, total: list.length });
  }

  // --- Chi tiết 1 hồ sơ ---
  const detailMatch = pathname.match(/^\/api\/admin\/hoso\/([a-f0-9-]+)$/i);
  if (detailMatch && method === 'GET') {
    const hoSo = db.getById(detailMatch[1]);
    if (!hoSo) return sendError(res, 404, 'Không tìm thấy hồ sơ.');
    return sendJSON(res, 200, { ok: true, data: hoSo });
  }

  // --- Sửa hồ sơ ---
  if (detailMatch && method === 'PUT') {
    let body;
    try {
      body = await readJSONBody(req);
    } catch (err) {
      return sendError(res, 400, err.message);
    }

    const allowedFields = [
      'ma_thi_sinh', 'ho_ten', 'nam_sinh', 'khoi_lop',
      'ho_ten_phu_huynh', 'nam_sinh_phu_huynh', 'sdt_phu_huynh', 'nghe_nghiep_phu_huynh',
      'dia_chi', 'email', 'ghi_chu', 'admin_note',
    ];
    const patch = {};
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        patch[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
      }
    }

    if (patch.khoi_lop && !config.khoiLopOptions.includes(patch.khoi_lop)) {
      return sendError(res, 422, 'Khối lớp không hợp lệ.');
    }
    if (patch.sdt_phu_huynh && !PHONE_REGEX.test(patch.sdt_phu_huynh)) {
      return sendError(res, 422, 'Số điện thoại không hợp lệ.');
    }
    if (patch.email && !EMAIL_REGEX.test(patch.email)) {
      return sendError(res, 422, 'Email không hợp lệ.');
    }

    const updated = db.updateHoSo(detailMatch[1], patch);
    if (!updated) return sendError(res, 404, 'Không tìm thấy hồ sơ.');
    return sendJSON(res, 200, { ok: true, data: updated });
  }

  // --- Xoá hồ sơ ---
  if (detailMatch && method === 'DELETE') {
    const removed = db.deleteHoSo(detailMatch[1]);
    if (!removed) return sendError(res, 404, 'Không tìm thấy hồ sơ.');
    return sendJSON(res, 200, { ok: true });
  }

  // --- Duyệt / Từ chối hồ sơ ---
  const statusMatch = pathname.match(/^\/api\/admin\/hoso\/([a-f0-9-]+)\/(duyet|tu-choi)$/i);
  if (statusMatch && method === 'PATCH') {
    let body = {};
    try {
      body = await readJSONBody(req);
    } catch (err) {
      // body rỗng cũng không sao đối với hành động duyệt/từ chối
    }

    const [, id, action] = statusMatch;
    const trangThai = action === 'duyet' ? 'approved' : 'rejected';

    // Khi duyệt, cho phép gán luôn Mã Thí Sinh chính thức nếu admin gửi kèm.
    if (action === 'duyet' && body.ma_thi_sinh) {
      db.updateHoSo(id, { ma_thi_sinh: String(body.ma_thi_sinh).trim() });
    }

    const updated = db.setTrangThai(id, trangThai, body.admin_note);
    if (!updated) return sendError(res, 404, 'Không tìm thấy hồ sơ.');
    return sendJSON(res, 200, { ok: true, data: updated });
  }

  // --- Thống kê nhanh cho dashboard ---
  if (pathname === '/api/admin/thong-ke' && method === 'GET') {
    const list = db.getAll();
    const stats = {
      total: list.length,
      pending: list.filter((h) => h.trang_thai === 'pending').length,
      approved: list.filter((h) => h.trang_thai === 'approved').length,
      rejected: list.filter((h) => h.trang_thai === 'rejected').length,
    };
    return sendJSON(res, 200, { ok: true, data: stats });
  }

  sendError(res, 404, 'Không tìm thấy API endpoint.');
}

// ---------- Server ----------

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = url.parse(req.url);

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res, pathname);
      return;
    }

    sendError(res, 405, 'Phương thức không được hỗ trợ.');
  } catch (err) {
    console.error('Lỗi server:', err);
    if (!res.headersSent) sendError(res, 500, 'Lỗi máy chủ nội bộ.');
  }
});

server.listen(config.port, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${config.port}`);
  console.log(`   Trang đăng ký:   http://localhost:${config.port}/dangky.html`);
  console.log(`   Trang quản trị:  http://localhost:${config.port}/admin/`);
  console.log(`   Tài khoản admin mặc định: ${config.admin.username} / ${config.admin.password}`);
  console.log(`   (Hãy đổi bằng biến môi trường ADMIN_USERNAME / ADMIN_PASSWORD khi triển khai thật!)`);
});
