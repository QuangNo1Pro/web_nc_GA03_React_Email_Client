# HƯỚNG DẪN ĐĂNG NHẬP IMAP VỚI GMAIL

## ✅ NHỮNG GÌ ĐÃ SỬA

### Backend:
1. ✅ Đã uncomment và enable `ImapModule` trong `auth.module.ts`
2. ✅ Đã uncomment imports `ImapService` và `EncryptionService` trong `auth.controller.ts`
3. ✅ Đã uncomment endpoint `/auth/imap-login` trong `auth.controller.ts`
4. ✅ Đã uncomment method `updateImapConfig()` trong `users.service.ts`
5. ✅ Đã thêm `ENCRYPTION_KEY` vào file `.env`

### Frontend:
- ✅ Đã có sẵn form IMAP login trong `Login.tsx`
- ✅ Tự động điền IMAP/SMTP config cho Gmail
- ✅ Hiển thị hướng dẫn lấy App Password

---

## 🧪 CÁCH TEST IMAP VỚI GMAIL

### Bước 1: Chuẩn bị tài khoản Gmail

1. **Bật xác thực 2 bước (2FA)**
   - Truy cập: https://myaccount.google.com/security
   - Chọn "2-Step Verification" → Bật

2. **Tạo App Password**
   - Truy cập: https://myaccount.google.com/apppasswords
   - Chọn app: "Mail"
   - Chọn device: "Other" → Nhập tên (ví dụ: "Email Client")
   - Click "Generate"
   - **Lưu lại mật khẩu 16 ký tự** (format: xxxx xxxx xxxx xxxx)

### Bước 2: Test IMAP connection (Optional nhưng nên test)

```bash
cd backend
node test-imap-gmail.js
```

**Sửa thông tin trong file `test-imap-gmail.js`:**
```javascript
const config = {
  imap: {
    user: 'your-email@gmail.com',     // ← Thay bằng email của bạn
    password: 'xxxxxxxxxxxxxxxx',      // ← Thay bằng App Password (16 ký tự)
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
  }
};
```

**Kết quả mong đợi:**
```
✅ Successfully connected to Gmail IMAP!
📬 Found mailboxes:
  📁 INBOX
  📁 [Gmail]
    📄 All Mail
    📄 Drafts
    📄 Important
    📄 Sent Mail
    📄 Spam
    📄 Starred
    📄 Trash
✅ Found X messages in INBOX
✅ Connection closed successfully
🎉 IMAP test completed successfully!
```

### Bước 3: Chạy Backend

```bash
cd backend
npm run start:dev
```

**Kiểm tra logs:**
- Backend khởi động thành công
- Không có lỗi import `ImapModule`
- Port 3000 đang chạy

### Bước 4: Chạy Frontend

```bash
cd frontend
npm run dev
```

### Bước 5: Test đăng nhập IMAP qua UI

1. Mở trình duyệt: `http://localhost:5173/login`
2. Click tab **"IMAP Login"**
3. Nhập thông tin:
   - **Email**: your-email@gmail.com
   - **Password**: App Password 16 ký tự (KHÔNG có dấu cách)
   - **IMAP Host**: imap.gmail.com (tự động điền)
   - **IMAP Port**: 993 (tự động điền)
   - **Use TLS**: ✅ checked
4. (Optional) Click "Show SMTP Settings" nếu muốn gửi email:
   - **SMTP Host**: smtp.gmail.com
   - **SMTP Port**: 587
   - **Use TLS**: ✅ checked
5. Click **"Connect IMAP"**

**Kết quả mong đợi:**
- ✅ Hiển thị "IMAP login successful"
- ✅ Redirect sang `/inbox`
- ✅ Load được danh sách email từ Gmail qua IMAP

---

## 🐛 XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi: "Invalid IMAP credentials"
**Nguyên nhân:** Sai App Password hoặc chưa bật 2FA
**Giải pháp:**
- Kiểm tra lại App Password (16 ký tự, không có dấu cách)
- Đảm bảo đã bật 2FA trước khi tạo App Password
- Thử tạo lại App Password mới

### Lỗi: "IMAP connection failed: ECONNREFUSED"
**Nguyên nhân:** Không kết nối được tới Gmail IMAP server
**Giải pháp:**
- Kiểm tra internet connection
- Firewall có block port 993 không
- Thử ping `imap.gmail.com`

### Lỗi: "IMAP connection failed: ETIMEDOUT"
**Nguyên nhân:** Timeout khi kết nối
**Giải pháp:**
- Gmail có thể đang bảo trì
- Thử lại sau vài phút
- Kiểm tra proxy/VPN settings

### Lỗi: Backend không start
**Nguyên nhân:** Thiếu dependencies hoặc lỗi import
**Giải pháp:**
```bash
cd backend
npm install imap-simple mailparser nodemailer
npm run start:dev
```

### Lỗi: "Cannot find module 'imap-simple'"
**Giải pháp:**
```bash
cd backend
npm install imap-simple
```

---

## 📋 CHECKLIST ĐẦY ĐỦ

### Backend Setup:
- [x] ImapModule uncommented in auth.module.ts
- [x] ImapService, EncryptionService imported in auth.controller.ts
- [x] /auth/imap-login endpoint enabled
- [x] updateImapConfig() method enabled
- [x] ENCRYPTION_KEY added to .env
- [x] Dependencies installed (imap-simple, mailparser, nodemailer)

### Frontend Setup:
- [x] IMAP login form có sẵn trong Login.tsx
- [x] Auto-fill Gmail config
- [x] Hiển thị App Password instructions

### Gmail Account:
- [ ] Bật 2-Factor Authentication
- [ ] Tạo App Password
- [ ] Lưu App Password (16 ký tự)

### Testing:
- [ ] Test IMAP connection với test-imap-gmail.js
- [ ] Backend chạy không lỗi
- [ ] Frontend chạy không lỗi
- [ ] Đăng nhập IMAP thành công
- [ ] Load được emails từ Gmail

---

## 🎯 CÁC FILE ĐÃ THAY ĐỔI

1. **backend/src/auth/auth.module.ts** - Uncommented ImapModule
2. **backend/src/auth/auth.controller.ts** - Enabled IMAP login endpoint
3. **backend/src/users/users.service.ts** - Enabled updateImapConfig()
4. **backend/.env** - Added ENCRYPTION_KEY
5. **backend/test-imap-gmail.js** - Created test script

---

## 🔐 BẢO MẬT

- ✅ Password được mã hóa bằng AES-256-GCM
- ✅ Encryption key lưu trong .env (không commit lên Git)
- ✅ App Password thay vì password thật
- ✅ TLS/SSL enabled mặc định

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
1. Check backend logs trong terminal
2. Check browser console (F12)
3. Kiểm tra Network tab để xem request/response
4. Đảm bảo MongoDB đang chạy
5. Test IMAP connection script trước

---

**Chúc may mắn! 🎉**
