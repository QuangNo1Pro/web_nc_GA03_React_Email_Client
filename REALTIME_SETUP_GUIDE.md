# 📧 Hướng Dẫn Cài Đặt Real-time Email Sync

## ✅ ĐÃ HOÀN THÀNH (Backend Code)

Tôi đã sửa xong code backend và frontend:
- ✅ Tạo `SseService` để quản lý kết nối real-time
- ✅ Thêm endpoint `/gmail/events` cho SSE connection
- ✅ Thêm endpoint `/gmail/webhook/pubsub` để nhận notification từ Google
- ✅ Frontend đã kết nối SSE và tự động refresh khi có email mới
- ✅ Tăng timeout cho SSE connections

---

## 🎯 BẠN CẦN LÀM (Cấu hình Google Cloud)

### Bước 1: Tạo Pub/Sub Topic (5 phút)

1. Mở [Google Cloud Console](https://console.cloud.google.com)
2. Chọn project đang dùng Gmail API
3. Vào menu bên trái → **Pub/Sub** → **Topics**
4. Click **CREATE TOPIC**
5. Điền:
   - **Topic ID**: `gmail-push-notifications`
   - Để mặc định các options khác
6. Click **CREATE**

### Bước 2: Cấp Quyền Cho Gmail (5 phút)

1. Vẫn trong topic `gmail-push-notifications` vừa tạo
2. Click tab **PERMISSIONS**
3. Click **ADD PRINCIPAL**
4. Điền:
   - **New principals**: `gmail-api-push@system.gserviceaccount.com`
   - **Role**: Chọn `Pub/Sub Publisher`
5. Click **SAVE**

---

## ⚠️ QUAN TRỌNG: Deploy Backend Trước

**CHƯA LÀM BƯỚC 3** cho đến khi:
1. Backend đã deploy lên server (VPS/Cloud)
2. Có domain hoặc IP công khai
3. Backend đang chạy và truy cập được từ internet

### Bước 3: Tạo Push Subscription (SAU KHI DEPLOY)

1. Vào **Pub/Sub** → **Subscriptions**
2. Click **CREATE SUBSCRIPTION**
3. Điền:
   - **Subscription ID**: `gmail-push-webhook`
   - **Select a Cloud Pub/Sub topic**: Chọn `gmail-push-notifications`
   - **Delivery type**: Chọn **Push**
   - **Endpoint URL**: `https://YOUR_DOMAIN/gmail/webhook/pubsub`
     - Thay `YOUR_DOMAIN` bằng domain thật của bạn
     - Ví dụ: `https://api.example.com/gmail/webhook/pubsub`
4. Click **CREATE**

---

## 🧪 TESTING LOCAL (Không cần deploy)

### Test SSE Connection

1. Khởi động backend:
```bash
cd backend
npm run start:dev
```

2. Khởi động frontend:
```bash
cd frontend
npm run dev
```

3. Mở browser DevTools (F12) → Console
4. Đăng nhập vào app
5. Xem console, bạn sẽ thấy:
```
[SSE] Connecting to: http://localhost:3000/gmail/events
[SSE] Connected successfully
```

6. Trong backend terminal, bạn sẽ thấy:
```
[SSE] Client connecting: <userId>
[SSE] User <userId> connected. Total: 1
```

### Test Webhook (Cần ngrok hoặc deploy)

Webhook chỉ test được khi có domain công khai. Có 2 cách:

**Cách 1: Dùng ngrok (Nhanh nhất)**
```bash
# Cài ngrok: https://ngrok.com/download
ngrok http 3000
```

Copy URL ngrok (vd: `https://abc123.ngrok.io`) và dùng cho Push Subscription URL:
```
https://abc123.ngrok.io/gmail/webhook/pubsub
```

**Cách 2: Deploy lên server thật**
- Heroku, AWS, DigitalOcean, v.v.

---

## 📋 CHECKLIST HOÀN THÀNH

### Cấu hình Google Cloud:
- [ ] Tạo Pub/Sub Topic: `gmail-push-notifications`
- [ ] Cấp quyền Publisher cho `gmail-api-push@system.gserviceaccount.com`
- [ ] Deploy backend lên server công khai
- [ ] Tạo Push Subscription với endpoint URL của backend

### Testing:
- [ ] SSE connection hoạt động (xem console log)
- [ ] Gửi email test từ Gmail khác
- [ ] Frontend tự động hiển thị toast "📬 New emails received"
- [ ] Danh sách email tự động refresh

---

## 🔧 TROUBLESHOOTING

### SSE không kết nối được

**Triệu chứng:** Console log: `[SSE] Connection error: HTTP 401`

**Nguyên nhân:** Token không hợp lệ

**Giải pháp:**
1. Logout và login lại
2. Kiểm tra backend log xem có JWT error không
3. Kiểm tra `localStorage.getItem('access_token')` trong console

---

### Webhook không nhận được notification

**Triệu chứng:** Có email mới nhưng frontend không tự động cập nhật

**Checklist:**
- [ ] Push Subscription URL đúng chưa?
- [ ] Backend có chạy và accessible từ internet không?
- [ ] Kiểm tra backend log có thấy `[Webhook] Received Pub/Sub notification` không?

**Debug:**
```bash
# Xem Pub/Sub logs
gcloud logging read "resource.type=pubsub_subscription" --limit 50
```

---

### Gmail Watch chưa được enable

**Bạn cần gọi Gmail Watch API 1 lần** để bật push notifications:

Tạo endpoint test trong backend (tạm thời):

```typescript
// Thêm vào gmail.controller.ts
@Post('admin/enable-watch')
@UseGuards(AuthGuard('jwt'))
async enableWatch(@Request() req: ExpressRequest) {
  const userId = (req.user as any).userId;
  const gmail = await this.gmailService.getGmailClient(userId);
  
  const response = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName: 'projects/YOUR_PROJECT_ID/topics/gmail-push-notifications',
      labelIds: ['INBOX'],
    },
  });
  
  return response.data;
}
```

**Thay `YOUR_PROJECT_ID`** bằng project ID thật của bạn (xem trong Google Cloud Console).

Sau đó call endpoint này:
```bash
curl -X POST http://localhost:3000/gmail/admin/enable-watch \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**LÀM ĐIỀU NÀY CHO TỪNG USER** - Watch expire sau 7 ngày, cần setup cron job để renew.

---

## 🚀 NEXT STEPS (Sau khi test thành công)

1. **Xóa test logs:** Bớt console.log trong production
2. **Add Security:** Implement PubSubGuard để verify token từ Google
3. **Cron Job:** Auto-renew Gmail watch mỗi 7 ngày
4. **Monitoring:** Track SSE connection count, webhook success rate

---

## 📞 SUPPORT

Nếu gặp vấn đề, check:
1. Backend terminal logs
2. Frontend browser console
3. Google Cloud Pub/Sub logs

**Error thường gặp đã được xử lý trong code:**
- Token expired → Auto refresh
- SSE disconnect → Auto reconnect
- Webhook error → Log và continue (không crash)

---

**Chúc bạn thành công! 🎉**
