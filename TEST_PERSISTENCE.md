# 🧪 HƯỚNG DẪN TEST PERSISTENCE - CHO GIẢNG VIÊN

## 📋 MỤC ĐÍCH

Tài liệu này cung cấp các bước test chi tiết để xác minh rằng:
- ✅ Kanban status được lưu persistent (không bị reset sau logout/login)
- ✅ Snooze metadata được lưu persistent
- ✅ Polling sync không làm mất dữ liệu user

---

## 🚀 SETUP BAN ĐẦU

### 1. Khởi động Backend
```bash
cd backend
npm install
npm run start:dev
```

**Expected output:**
```
[Nest] Application successfully started
[Gmail Scheduler] Checking for expired snoozed emails...
```

### 2. Khởi động Frontend
```bash
cd frontend
npm install
npm run dev
```

**Expected output:**
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. Truy cập ứng dụng
- Mở browser: `http://localhost:5173`
- Login bằng Google account có emails
- Vào trang Kanban: `/kanban`

---

## ✅ TEST CASE 1: DRAG & DROP PERSISTENCE

### Mục tiêu
Xác minh rằng khi user kéo email sang cột khác, trạng thái được lưu vĩnh viễn.

### Các bước test

#### Bước 1: Kéo email
1. Vào trang Kanban (`/kanban`)
2. Tìm một email trong cột **INBOX**
3. Kéo email sang cột **TO DO**
4. Quan sát:
   - ✅ Email di chuyển ngay lập tức
   - ✅ Toast notification: "Email moved to To Do"

#### Bước 2: Verify trong Console
1. Mở DevTools (F12)
2. Vào tab **Console**
3. Paste code sau:
```javascript
// Check frontend state
const emails = JSON.parse(localStorage.getItem('kanban-emails') || '[]');
const movedEmail = emails.find(e => e.status === 'To Do');
console.log('Moved email:', movedEmail);
console.assert(movedEmail, '❌ Email not found in To Do status');
console.log('✅ Frontend state OK');
```

Expected output:
```javascript
Moved email: { id: "193e...", status: "To Do", ... }
✅ Frontend state OK
```

#### Bước 3: Verify trong Network
1. Vẫn ở DevTools, chuyển sang tab **Network**
2. Filter: `XHR`
3. Tìm request: `PATCH /gmail/emails/193e.../status`
4. Click vào request → Tab **Response**
5. Kiểm tra response:
```json
{
  "id": "193e...",
  "status": "To Do",
  "labelIds": ["INBOX", "STARRED"],
  ...
}
```

Expected:
- ✅ Status code: 200
- ✅ Response có field `status: "To Do"`

#### Bước 4: Refresh trang
1. **Không logout**, chỉ refresh (Ctrl+R hoặc F5)
2. Đợi trang load lại
3. Quan sát:
   - ✅ Email vẫn ở cột **TO DO**
   - ✅ Không quay về INBOX

#### Bước 5: Logout và Login lại
1. Click avatar → Logout
2. Login lại bằng cùng account
3. Vào trang Kanban
4. Quan sát:
   - ✅ Email vẫn ở cột **TO DO**
   - ✅ Persistence confirmed!

---

## ✅ TEST CASE 2: SNOOZE PERSISTENCE

### Mục tiêu
Xác minh rằng khi user snooze email, metadata được lưu và email sẽ quay về đúng cột sau khi hết thời gian.

### Các bước test

#### Bước 1: Snooze một email (30 giây demo mode)
1. Vào trang Kanban
2. Tìm email trong cột **INBOX**
3. Click nút **Snooze** (icon đồng hồ)
4. Chọn **"30s (Demo)"**
5. Quan sát:
   - ✅ Modal đóng
   - ✅ Email **BIẾN MẤT** khỏi Inbox
   - ✅ Toast: "Email snoozed until ..."

#### Bước 2: Verify backend saved
1. Mở DevTools Console
2. Paste code:
```javascript
// Check API response
fetch('http://localhost:3000/api/gmail/emails/snoozed', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('access_token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('Snoozed emails:', data);
  console.assert(data.length > 0, '❌ No snoozed emails found');
  console.log('✅ Snooze saved to backend');
});
```

Expected output:
```javascript
Snoozed emails: [
  {
    id: "193e...",
    status: "Snoozed",
    snoozed: true,
    snoozedUntil: "2025-12-08T10:30:00.000Z",
    snoozedFromStatus: "Inbox"
  }
]
✅ Snooze saved to backend
```

#### Bước 3: Refresh trong khi đang snooze
1. **Refresh trang** (F5) ngay sau khi snooze
2. Quan sát:
   - ✅ Email **VẪN KHÔNG HIỆN** trong Inbox
   - ✅ Vẫn đang bị snoozed

#### Bước 4: Logout và Login trong khi snooze
1. Logout
2. Login lại
3. Vào Kanban
4. Quan sát:
   - ✅ Email **VẪN KHÔNG HIỆN**
   - ✅ Snooze persistent across sessions

#### Bước 5: Đợi wake-up (sau 30 giây)
1. Đợi 30 giây (hoặc xem log console)
2. Refresh trang
3. Quan sát:
   - ✅ Email **QUAY VỀ** cột **INBOX**
   - ✅ Không còn snoozed

#### Bước 6: Verify scheduler log
1. Mở terminal backend
2. Tìm log:
```
[Gmail Scheduler] Checking for expired snoozed emails...
[Gmail Scheduler] Found 1 expired snoozed email(s)
[Gmail Scheduler] Unsnoozing email 193e...
[Gmail Scheduler] Email 193e... restored to Inbox
```

Expected:
- ✅ Log hiện ra sau 30 giây
- ✅ Email được unsnooze tự động

---

## ✅ TEST CASE 3: DATABASE VERIFICATION

### Mục tiêu
Kiểm tra trực tiếp MongoDB để đảm bảo data được lưu đúng.

### Các bước test

#### Bước 1: Kết nối MongoDB
```bash
# Nếu dùng MongoDB local
mongosh

# Nếu dùng MongoDB Atlas
mongosh "mongodb+srv://cluster0.xxxxx.mongodb.net/myDatabase" --username admin
```

#### Bước 2: Query email sau khi drag & drop
```javascript
// Switch to database
use gmail_client

// Tìm email có status khác Inbox
db.emails.findOne({ status: { $ne: "Inbox" } })
```

**Expected output:**
```javascript
{
  _id: ObjectId("675554c9f0fb72e7b18e6b5a"),
  userId: "675554c9f0fb72e7b18e6b5a",
  messageId: "193ec7654321",
  snippet: "This is a test email",
  labelIds: ["INBOX", "STARRED"],
  payload: { ... },
  internalDate: "1733654400000",
  status: "To Do",           // ✅ Saved!
  snoozed: false,
  snoozedUntil: null,
  snoozedFromStatus: null,
  createdAt: ISODate("2025-12-08T10:00:00.000Z"),
  updatedAt: ISODate("2025-12-08T10:15:00.000Z")
}
```

**Kiểm tra:**
- ✅ Field `status` tồn tại và có giá trị "To Do"
- ✅ Field `snoozed` tồn tại (false)
- ✅ `updatedAt` được update khi drag & drop

#### Bước 3: Query email đang snooze
```javascript
db.emails.find({ snoozed: true })
```

**Expected output:**
```javascript
{
  messageId: "193ec1234567",
  status: "Snoozed",
  snoozed: true,                              // ✅ True!
  snoozedUntil: ISODate("2025-12-08T10:30:00.000Z"),  // ✅ Future timestamp!
  snoozedFromStatus: "Inbox"                  // ✅ Original status saved!
}
```

**Kiểm tra:**
- ✅ `snoozed = true`
- ✅ `snoozedUntil` là timestamp tương lai
- ✅ `snoozedFromStatus` lưu cột gốc

#### Bước 4: Verify indexes
```javascript
db.emails.getIndexes()
```

**Expected output:**
```javascript
[
  { key: { _id: 1 }, name: "_id_" },
  { key: { userId: 1, messageId: 1 }, name: "userId_1_messageId_1", unique: true },
  { key: { userId: 1, labelIds: 1 }, name: "userId_1_labelIds_1" },
  { key: { userId: 1, status: 1 }, name: "userId_1_status_1" },
  { key: { snoozed: 1, snoozedUntil: 1 }, name: "snoozed_1_snoozedUntil_1" }
]
```

**Kiểm tra:**
- ✅ Index cho `status` tồn tại (query nhanh)
- ✅ Composite index cho `snoozed` + `snoozedUntil` (scheduler hiệu quả)

---

## ✅ TEST CASE 4: POLLING KHÔNG LÀM MẤT STATUS

### Mục tiêu
Xác minh rằng incremental sync (polling 10s) không ghi đè status/snooze.

### Các bước test

#### Bước 1: Kéo email sang cột mới
1. Kéo email từ Inbox → **In Progress**
2. Đợi toast notification

#### Bước 2: Monitor polling
1. Mở DevTools Console
2. Đợi 10 giây (polling interval)
3. Tìm log:
```
[Gmail Polling] 🔄 Polling for user 675554c9...
[Gmail Polling] Incremental sync complete: 0 changed, 0 deleted
```

#### Bước 3: Verify status không đổi
1. Sau polling log xuất hiện
2. Kiểm tra email vẫn ở cột **In Progress**
3. **KHÔNG** quay về Inbox
4. ✅ Status preserved!

#### Bước 4: Trigger manual sync
```javascript
// Trong DevTools Console
fetch('http://localhost:3000/api/gmail/sync', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('access_token')
  }
})
.then(r => r.json())
.then(data => {
  console.log('Sync result:', data);
  // Refresh trang để verify
  setTimeout(() => location.reload(), 1000);
});
```

#### Bước 5: Verify sau sync
1. Trang reload
2. Email vẫn ở **In Progress**
3. ✅ Manual sync cũng không ghi đè

---

## ✅ TEST CASE 5: MULTI-STEP WORKFLOW

### Mục tiêu
Test workflow phức tạp: Inbox → To Do → Snooze → Wake up → In Progress → Done

### Các bước test

#### Step 1: Inbox → To Do
1. Kéo email từ Inbox sang To Do
2. ✅ Email hiển thị ở To Do

#### Step 2: Refresh
1. F5
2. ✅ Email vẫn ở To Do

#### Step 3: To Do → In Progress
1. Kéo email sang In Progress
2. ✅ Email hiển thị ở In Progress

#### Step 4: Logout/Login
1. Logout → Login
2. ✅ Email vẫn ở In Progress

#### Step 5: Snooze từ In Progress
1. Click Snooze
2. Chọn "30s (Demo)"
3. ✅ Email biến mất

#### Step 6: Refresh trong snooze
1. F5
2. ✅ Email vẫn không hiện

#### Step 7: Wait wake-up
1. Đợi 30s
2. Refresh
3. ✅ Email quay về **In Progress** (không phải Inbox!)

#### Step 8: In Progress → Done
1. Kéo email sang Done
2. ✅ Email archived (không còn trong Inbox)

#### Step 9: Final refresh
1. F5
2. ✅ Email vẫn ở Done

---

## ✅ TEST CASE 6: API INTEGRATION TEST

### Mục tiêu
Test trực tiếp các API endpoint.

### Test PATCH /emails/:id/status

```bash
# Get access token
TOKEN=$(grep -o '"access_token":"[^"]*"' ~/.local/share/gmail_client/storage.json | cut -d'"' -f4)

# Update email status
curl -X PATCH http://localhost:3000/api/gmail/emails/193ec7654321/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "To Do"}'
```

**Expected response:**
```json
{
  "id": "193ec7654321",
  "status": "To Do",
  "labelIds": ["INBOX", "STARRED"],
  "sender": "test@example.com",
  "subject": "Test Email"
}
```

### Test POST /emails/:id/snooze

```bash
# Snooze for 1 hour
SNOOZE_TIME=$(date -u -d '+1 hour' +"%Y-%m-%dT%H:%M:%S.000Z")

curl -X POST "http://localhost:3000/api/gmail/emails/193ec7654321/snooze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"snoozedUntil\": \"$SNOOZE_TIME\"}"
```

**Expected response:**
```json
{
  "id": "193ec7654321",
  "status": "Snoozed",
  "snoozed": true,
  "snoozedUntil": "2025-12-08T11:30:00.000Z",
  "snoozedFromStatus": "Inbox"
}
```

### Test GET /emails/snoozed

```bash
curl -X GET http://localhost:3000/api/gmail/emails/snoozed \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
[
  {
    "id": "193ec7654321",
    "status": "Snoozed",
    "snoozed": true,
    "snoozedUntil": "2025-12-08T11:30:00.000Z",
    "snoozedFromStatus": "Inbox"
  }
]
```

---

## 📊 CHECKLIST TỔNG HỢP

### Backend Persistence
- [ ] `users.service.getEmailsByLabel()` có `.select('status snoozed...')`
- [ ] `gmail.service.getEmails()` map đầy đủ field status + snooze
- [ ] `users.service.saveEmails()` dùng `$setOnInsert` cho status/snooze
- [ ] MongoDB có indexes cho status và snooze

### Frontend Persistence
- [ ] `emailUtils.parseEmail()` preserve status và snooze fields
- [ ] `useEmails` hook filter snoozed emails
- [ ] Optimistic updates hoạt động

### Workflow Tests
- [ ] Drag & drop → refresh → status giữ nguyên
- [ ] Drag & drop → logout/login → status giữ nguyên
- [ ] Snooze → refresh → vẫn snoozed
- [ ] Snooze → logout/login → vẫn snoozed
- [ ] Snooze wake-up → email quay về cột gốc
- [ ] Polling không ghi đè status/snooze

### Database Verification
- [ ] MongoDB query trả về status field
- [ ] Snoozed emails có đầy đủ metadata
- [ ] Indexes tồn tại và hoạt động

---

## 🐛 TROUBLESHOOTING

### Email bị reset về Inbox sau refresh

**Nguyên nhân có thể:**
1. Backend chưa restart sau khi sửa code
2. Browser cache còn code cũ
3. MongoDB query không có `.select()`

**Giải pháp:**
```bash
# 1. Restart backend
cd backend
npm run start:dev

# 2. Clear browser cache
# DevTools → Application → Clear storage

# 3. Verify MongoDB
mongosh
use gmail_client
db.emails.findOne({ messageId: "YOUR_EMAIL_ID" })
```

### Snooze không wake-up

**Nguyên nhân:**
1. Scheduler không chạy (thiếu @nestjs/schedule)
2. Backend bị restart (setTimeout bị clear)
3. snoozedUntil trong quá khứ

**Giải pháp:**
```bash
# 1. Check scheduler log
# Backend console phải có:
[Gmail Scheduler] Checking for expired snoozed emails...

# 2. Manual unsnooze qua API
curl -X POST http://localhost:3000/api/gmail/emails/ID/unsnooze \
  -H "Authorization: Bearer $TOKEN"

# 3. Check MongoDB
db.emails.find({ 
  snoozed: true, 
  snoozedUntil: { $lte: new Date() } 
})
```

### Polling ghi đè status

**Nguyên nhân:** Code cũ của `saveEmails()` không có `$setOnInsert`

**Giải pháp:**
```bash
# 1. Verify code
cat backend/src/users/users.service.ts | grep -A 20 "async saveEmails"

# Phải có:
# $setOnInsert: {
#   status: 'Inbox',
#   snoozed: false,
#   ...
# }

# 2. Restart backend
npm run start:dev
```

---

## 🎓 GRADING RUBRIC

### Persistence (15/25 điểm)
- [5đ] Status persistence sau refresh
- [5đ] Status persistence sau logout/login
- [5đ] Snooze persistence đầy đủ

### Snooze Wake-up (5/25 điểm)
- [3đ] Scheduler tự động unsnooze
- [2đ] Email quay về đúng cột gốc

### Code Quality (5/25 điểm)
- [2đ] Backend có `.select()` và map đúng fields
- [2đ] Frontend parse đầy đủ fields
- [1đ] `$setOnInsert` preserve metadata

---

## 📞 SUPPORT

Nếu có vấn đề trong quá trình test:

1. **Check logs:** Backend console + Browser console
2. **Verify database:** Query MongoDB trực tiếp
3. **Test API:** Dùng curl/Postman test từng endpoint
4. **Read docs:** `PERSISTENCE_FIX.md` có flow chi tiết

---

**Tài liệu test hoàn chỉnh**  
**Version:** 1.0  
**Date:** December 8, 2025
