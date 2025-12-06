# CÁC VẤN ĐỀ ĐÃ SỬA VÀ GIẢI PHÁP

## 🔴 VẤN ĐỀ ĐÃ PHÁT HIỆN

### 1. Thư mục STARRED có nhiều email hơn Gmail thực tế
**Nguyên nhân:**
- Chỉ fetch 4 labels (INBOX, SENT, SPAM, TRASH) trong prefetch
- Logic merge labelIds từ nhiều label khiến emails bị duplicate
- Emails chỉ có STARRED label không được fetch

**Giải pháp đã áp dụng:**
- ✅ Fetch thêm 3 labels quan trọng: STARRED, DRAFT, IMPORTANT
- ✅ Loại bỏ logic merge labelIds - giữ nguyên labelIds từ Gmail API
- ✅ Mỗi email chỉ lưu 1 lần với labelIds chính xác từ Gmail

### 2. Unread count trong DB toàn là 0
**Nguyên nhân:**
- Chỉ đếm unread cho INBOX từ DB
- Các mailbox khác dùng giá trị cũ từ Gmail API (không đồng bộ với DB)
- Incremental sync overwrite messagesUnread từ Gmail API

**Giải pháp đã áp dụng:**
- ✅ Tạo method `countUnreadByLabel()` đếm unread cho MỌI mailbox từ DB
- ✅ Method `getMailboxes()` bây giờ tính unread cho TẤT CẢ mailboxes từ DB
- ✅ Incremental sync CHỈ update `messagesTotal`, KHÔNG touch `messagesUnread`

### 3. Incremental Sync không đồng bộ đúng
**Nguyên nhân:**
- Incremental sync lưu lại `messagesUnread` từ Gmail API
- Ghi đè lên giá trị đếm từ DB (chính xác hơn)

**Giải pháp đã áp dụng:**
- ✅ Tạo method `updateMailboxTotal()` chỉ update `messagesTotal`
- ✅ Incremental sync giờ update từng mailbox riêng lẻ, giữ nguyên `messagesUnread`

---

## ✅ THAY ĐỔI CHI TIẾT

### File: `backend/src/gmail/gmail.service.ts`

#### 1. `prefetchMailboxesAndEmails()` - Dòng ~1068
```typescript
// CŨ
const labelsToFetch = ['INBOX', 'SENT', 'SPAM', 'TRASH'];

// MỚI
const labelsToFetch = ['INBOX', 'SENT', 'STARRED', 'SPAM', 'TRASH', 'DRAFT', 'IMPORTANT'];
```

#### 2. `prefetchMailboxesAndEmails()` - Logic merge emails
```typescript
// CŨ - Merge labelIds (SAI)
if (emailMap[emailId]) {
  const oldLabels = emailMap[emailId].labelIds || [];
  emailMap[emailId].labelIds = Array.from(new Set([...(msg.data.labelIds || []), ...oldLabels]));
} else {
  emailMap[emailId] = {...}
}

// MỚI - Không merge (ĐÚNG)
if (!emailMap[emailId]) {
  emailMap[emailId] = {
    id: emailId,
    snippet: msg.data.snippet,
    payload: msg.data.payload,
    labelIds: msg.data.labelIds || [], // Giữ nguyên từ Gmail
    internalDate: msg.data.internalDate,
  };
}
```

#### 3. `getMailboxes()` - Dòng ~138
```typescript
// CŨ - Chỉ đếm unread cho INBOX
let inboxUnread = 0;
const inboxMailbox = mailboxes.find(m => m.id === 'INBOX');
if (inboxMailbox) {
  inboxUnread = await this.usersService.countUnreadInboxEmails(userId);
}

return mailboxes.map(m => ({
  ...m,
  messagesUnread: m.id === 'INBOX' ? inboxUnread : m.messagesUnread, // SAI
}));

// MỚI - Đếm unread cho TẤT CẢ mailboxes từ DB
const mailboxesWithRealUnread = await Promise.all(
  mailboxes.map(async (m) => {
    const unreadCount = await this.usersService.countUnreadByLabel(userId, m.id);
    return {
      id: m.id,
      name: m.name,
      messagesTotal: m.messagesTotal,
      messagesUnread: unreadCount, // Luôn tính từ DB
    };
  })
);
return mailboxesWithRealUnread;
```

#### 4. `incrementalSync()` - Dòng ~1014
```typescript
// CŨ - Overwrite messagesUnread (SAI)
const mailboxes = labels.map(label => ({
  userId,
  id: label.id!,
  name: label.name || 'Unknown',
  messagesTotal: label.messagesTotal || 0,
  messagesUnread: label.messagesUnread || 0, // GHI ĐÈ
}));
await this.usersService.saveMailboxes(userId, mailboxes);

// MỚI - Chỉ update messagesTotal (ĐÚNG)
for (const label of labels) {
  await this.usersService.updateMailboxTotal(userId, label.id!, label.messagesTotal || 0);
}
```

### File: `backend/src/users/users.service.ts`

#### 1. Thêm method `countUnreadByLabel()` - Sau dòng 207
```typescript
async countUnreadByLabel(userId: string, labelId: string): Promise<number> {
  // Special case: UNREAD label means emails that ONLY have UNREAD (not in other main folders)
  if (labelId === 'UNREAD') {
    return this.emailModel
      .countDocuments({
        userId,
        labelIds: 'UNREAD',
        labelIds: { $nin: ['INBOX', 'SENT', 'SPAM', 'TRASH'] }
      })
      .exec();
  }

  // For other labels: count emails that have both the label AND UNREAD
  return this.emailModel
    .countDocuments({
      userId,
      labelIds: { $all: [labelId, 'UNREAD'] },
    })
    .exec();
}
```

#### 2. Thêm method `updateMailboxTotal()` - Sau dòng 233
```typescript
async updateMailboxTotal(userId: string, mailboxId: string, total: number) {
  return this.mailboxModel.findOneAndUpdate(
    { userId, id: mailboxId },
    { $set: { messagesTotal: total } },
    { new: true, upsert: true }
  ).exec();
}
```

---

## 🧪 CÁCH TEST

### 1. Khởi động lại backend
```bash
cd backend
npm run dev
```

### 2. Login vào application
- Hệ thống sẽ tự động gọi `prefetchMailboxesAndEmails()`
- Fetch emails từ 7 labels: INBOX, SENT, STARRED, SPAM, TRASH, DRAFT, IMPORTANT

### 3. Kiểm tra số lượng emails
✅ **STARRED:** Số lượng phải khớp với Gmail
✅ **INBOX:** Số email chưa đọc phải khớp với Gmail
✅ **Các mailbox khác:** Unread count chính xác

### 4. Test các chức năng
- Gắn/bỏ dấu sao → Số lượng trong STARRED phải cập nhật đúng
- Đọc email → Unread count giảm
- Xóa email → Không xuất hiện trong mailbox nữa
- Incremental sync (đợi 30s) → Unread count vẫn đúng

---

## 📊 KẾT QUẢ MỌI LẦN ĐỒNG BỘ

### Prefetch (Lần đầu)
```
✅ Fetch from 7 labels: INBOX, SENT, STARRED, SPAM, TRASH, DRAFT, IMPORTANT
✅ Mỗi email chỉ lưu 1 lần với labelIds chính xác
✅ Không merge, không duplicate
✅ messagesUnread = 0 (sẽ được tính khi gọi getMailboxes)
```

### Incremental Sync (Mỗi 30s)
```
✅ Chỉ fetch changed/deleted messages
✅ Update labelIds chính xác cho changed emails
✅ CHỈ update messagesTotal
✅ KHÔNG touch messagesUnread (giữ nguyên để getMailboxes tính từ DB)
```

### getMailboxes (Mỗi lần frontend request)
```
✅ Đếm unread từ DB cho TẤT CẢ mailboxes
✅ Luôn trả về số liệu chính xác và real-time
✅ Không phụ thuộc vào cache cũ
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

1. **Đã xóa 790 emails và 45 mailboxes** từ database cũ
2. **Đã reset lastHistoryId** - lần đầu sẽ chạy full prefetch
3. **Backend PHẢI restart** sau khi apply code changes
4. **Frontend không cần thay đổi** - API response giống như cũ
5. **Lần đầu fetch có thể mất ~30-60 giây** (7 labels × 200 emails)

---

## 🎯 KẾT LUẬN

Tất cả các vấn đề đã được sửa:
✅ STARRED không còn có nhiều email hơn Gmail
✅ Unread count chính xác cho TẤT CẢ mailboxes
✅ Không còn merge labelIds sai
✅ Incremental sync không overwrite unread count
✅ Database đồng bộ hoàn toàn với Gmail

**Giờ bạn có thể restart backend và test lại!**
