// Quản lý phiên đăng nhập admin đơn giản, lưu trong bộ nhớ (Map).
// Lưu ý: nếu chạy nhiều tiến trình (cluster) hoặc restart server, phiên sẽ mất —
// đủ dùng cho một admin/một trường quản lý, không cần Redis cho quy mô này.

'use strict';

const crypto = require('crypto');
const config = require('./config');

const sessions = new Map(); // token -> { createdAt, expiresAt }

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, { createdAt: now, expiresAt: now + config.sessionMaxAgeMs });
  return token;
}

function isValid(token) {
  if (!token) return false;
  const s = sessions.get(token);
  if (!s) return false;
  if (Date.now() > s.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function destroySession(token) {
  sessions.delete(token);
}

// Dọn các phiên hết hạn định kỳ để tránh rò rỉ bộ nhớ khi chạy lâu dài.
setInterval(() => {
  const now = Date.now();
  for (const [token, s] of sessions.entries()) {
    if (now > s.expiresAt) sessions.delete(token);
  }
}, 30 * 60 * 1000).unref();

module.exports = { createSession, isValid, destroySession };
