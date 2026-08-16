# Website Đăng Ký Dự Thi IOE

Website đăng ký hồ sơ dự thi IOE (Olympic Tiếng Anh Trên Internet) kèm trang quản trị để
xét duyệt, chỉnh sửa hồ sơ. Viết bằng Node.js thuần (không cần `npm install` — chỉ dùng
module lõi của Node), nên có thể chạy ngay trên hầu hết mọi máy chủ/hosting hỗ trợ Node.js.

## Tính năng

- **Trang chủ** (`/`) — giới thiệu cuộc thi, lịch tự luyện/thi, nút đăng ký.
- **Trang đăng ký** (`/dangky.html`) — phụ huynh/thí sinh điền form, hệ thống tự sinh
  **mã đăng ký** (VD `IOE2026-A1B2C`) để tra cứu sau này.
- **Trang tra cứu** (`/tra-cuu.html`) — tra cứu trạng thái hồ sơ bằng mã đăng ký + SĐT.
- **Trang quản trị** (`/admin/`) — đăng nhập, xem danh sách hồ sơ, lọc theo khối lớp/trạng
  thái, tìm kiếm, **Xem** chi tiết, **Sửa** hồ sơ (kể cả gán **Mã Thí Sinh** chính thức),
  **Duyệt** / **Từ chối** hồ sơ. Có thống kê nhanh (tổng số, chờ duyệt, đã duyệt, từ chối).
- Dữ liệu lưu trong `data/hoso.json` — không cần cài đặt database riêng. Có thể nâng cấp
  lên SQLite/MySQL/PostgreSQL sau này nếu số lượng hồ sơ lớn (xem phần "Nâng cấp" bên dưới).

## Chạy thử trên máy tính (local)

Yêu cầu: đã cài [Node.js](https://nodejs.org) bản 18 trở lên.

```bash
cd ioe-dangky
node server.js
```

Sau đó mở trình duyệt:

- Trang đăng ký: http://localhost:3000/dangky.html
- Trang quản trị: http://localhost:3000/admin/

**Tài khoản quản trị mặc định:**
- Tên đăng nhập: `admin`
- Mật khẩu: `ioe@2026`

> ⚠️ **Đổi tài khoản này trước khi dùng thật** — xem phần "Cấu hình" bên dưới.

## Cấu hình

Đặt các biến môi trường trước khi chạy `node server.js` (hoặc dùng file `.env` cùng
công cụ quản lý tiến trình như PM2, Render, Railway,... để nạp biến môi trường):

| Biến môi trường   | Mặc định   | Ý nghĩa                                  |
|--------------------|-----------|-------------------------------------------|
| `PORT`             | `3000`    | Cổng chạy server                          |
| `ADMIN_USERNAME`   | `admin`   | Tên đăng nhập quản trị                    |
| `ADMIN_PASSWORD`   | `ioe@2026`| Mật khẩu quản trị                         |

Ví dụ chạy với tài khoản riêng:

```bash
ADMIN_USERNAME=quantriIOE ADMIN_PASSWORD="MatKhauManh#2026" PORT=8080 node server.js
```

Danh sách khối lớp cho phép đăng ký nằm ở `config.js` (`khoiLopOptions`) — sửa tại đây
nếu muốn thêm/bớt khối lớp. Khi sửa, nhớ cập nhật tương ứng trong
`public/dangky.js` và `public/admin/admin.js` (biến `KHOI_LOP_OPTIONS`) để đồng bộ.

## Cấu trúc thư mục

```
ioe-dangky/
├── server.js           # Server chính (routing, API)
├── config.js            # Cấu hình (cổng, tài khoản admin, danh sách khối lớp)
├── db.js                 # Lớp lưu trữ dữ liệu (đọc/ghi data/hoso.json)
├── sessions.js           # Quản lý phiên đăng nhập admin
├── data/
│   └── hoso.json         # Dữ liệu hồ sơ (tự tạo, đừng xoá thư mục "data")
└── public/
    ├── index.html         # Trang chủ
    ├── dangky.html         # Form đăng ký + dangky.js
    ├── tra-cuu.html         # Tra cứu hồ sơ
    ├── style.css             # Style dùng chung
    └── admin/
        ├── login.html         # Đăng nhập quản trị
        ├── index.html          # Bảng điều khiển quản trị + admin.js
        └── admin.js
```

## API (tham khảo nếu muốn tích hợp thêm)

| Method | Endpoint                              | Mô tả                                   | Cần đăng nhập |
|--------|----------------------------------------|-------------------------------------------|:---:|
| POST   | `/api/dangky`                          | Nộp hồ sơ đăng ký mới                     | ❌ |
| GET    | `/api/tra-cuu?ma_thi_sinh=&sdt=`        | Tra cứu 1 hồ sơ                           | ❌ |
| POST   | `/api/admin/login`                     | Đăng nhập admin                           | ❌ |
| POST   | `/api/admin/logout`                    | Đăng xuất admin                           | ✅ |
| GET    | `/api/admin/me`                        | Kiểm tra trạng thái đăng nhập             | ❌ |
| GET    | `/api/admin/hoso?q=&khoi_lop=&trang_thai=` | Danh sách hồ sơ (có lọc/tìm kiếm)     | ✅ |
| GET    | `/api/admin/hoso/:id`                  | Chi tiết 1 hồ sơ                          | ✅ |
| PUT    | `/api/admin/hoso/:id`                  | Sửa hồ sơ                                 | ✅ |
| PATCH  | `/api/admin/hoso/:id/duyet`            | Duyệt hồ sơ (có thể kèm `ma_thi_sinh`)    | ✅ |
| PATCH  | `/api/admin/hoso/:id/tu-choi`          | Từ chối hồ sơ                             | ✅ |
| DELETE | `/api/admin/hoso/:id`                  | Xoá hồ sơ                                 | ✅ |
| GET    | `/api/admin/thong-ke`                  | Thống kê nhanh (tổng/chờ/duyệt/từ chối)   | ✅ |

## Triển khai để có link công khai thật (deploy)

Ứng dụng này là một server Node.js thuần, có thể chạy trên bất kỳ nền tảng nào hỗ trợ
Node.js. Vài lựa chọn phổ biến, miễn phí hoặc chi phí thấp:

### 1. Render.com (khuyên dùng, dễ nhất, có gói miễn phí)
1. Tạo tài khoản tại https://render.com, đăng nhập.
2. Đưa thư mục `ioe-dangky` này lên một repo GitHub (hoặc dùng tính năng "Upload" nếu có).
3. Chọn **New → Web Service**, kết nối repo.
4. Build Command: để trống (không cần build). Start Command: `node server.js`.
5. Vào mục **Environment**, thêm biến `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
6. Bấm Deploy — Render sẽ cấp cho bạn link dạng `https://ten-du-an.onrender.com`.

   ⚠️ Lưu ý: gói miễn phí của Render "ngủ" sau một thời gian không có truy cập, và **ổ
   đĩa không được lưu lâu dài** (dữ liệu `data/hoso.json` có thể mất khi server khởi động
   lại) — nếu dùng lâu dài nên nâng cấp gói trả phí có "Persistent Disk", hoặc chuyển
   sang lưu dữ liệu ở database ngoài (xem phần "Nâng cấp" bên dưới).

### 2. Railway.app
Tương tự Render: kết nối repo GitHub, Railway tự nhận diện Node.js, Start Command
`node server.js`, thêm biến môi trường trong tab Variables.

### 3. VPS riêng (DigitalOcean, Vietnix, Azota, v.v.)
1. Cài Node.js trên VPS.
2. Copy thư mục `ioe-dangky` lên VPS (qua `scp` hoặc `git clone`).
3. Cài PM2 để chạy nền: `npm install -g pm2` rồi `pm2 start server.js --name ioe-dangky`.
4. Dùng Nginx làm reverse proxy để gắn tên miền + HTTPS (Let's Encrypt/Certbot).

### 4. Chạy trên máy tính cá nhân qua ngrok/Cloudflare Tunnel (chỉ để test nhanh)
Chạy `node server.js` trên máy, sau đó dùng `ngrok http 3000` (hoặc Cloudflare Tunnel)
để có link công khai tạm thời — phù hợp để demo, **không phù hợp để chạy lâu dài**.

## Bảo mật & lưu ý trước khi dùng thật

- **Đổi `ADMIN_USERNAME`/`ADMIN_PASSWORD`** khỏi giá trị mặc định.
- Luôn chạy sau HTTPS khi lên môi trường thật (Render/Railway tự cấp HTTPS; nếu tự dùng
  VPS thì cần cấu hình SSL qua Nginx + Let's Encrypt).
- Hiện chỉ có **1 tài khoản quản trị dùng chung** — phù hợp cho một trường/một cuộc thi.
  Nếu cần nhiều tài khoản quản trị riêng biệt (phân quyền theo trường, theo khối), cần
  mở rộng thêm bảng "người dùng quản trị" (liên hệ để được hỗ trợ mở rộng).
- Có honeypot chống bot đơn giản trên form đăng ký; nếu bị spam nhiều, cân nhắc thêm
  CAPTCHA (VD Google reCAPTCHA/Cloudflare Turnstile).

## Nâng cấp trong tương lai (gợi ý)

- Thay `data/hoso.json` bằng SQLite (`better-sqlite3`) hoặc PostgreSQL nếu số lượng hồ sơ
  lớn (hàng chục nghìn) hoặc cần chạy nhiều server song song.
- Thêm gửi email/SMS tự động khi hồ sơ được duyệt/từ chối.
- Thêm xuất danh sách hồ sơ ra file Excel/CSV cho admin.
- Thêm phân quyền nhiều tài khoản quản trị (theo trường/theo vai trò).

---
Mọi thắc mắc khi triển khai hoặc cần bổ sung tính năng, cứ nhắn lại nhé!
