# Debug SSE & Polling

## Bước 1: Check SSE connection
Mở browser console (F12), chạy:
```javascript
fetch('http://localhost:3000/gmail/debug/polling-status', {
  headers: {
    'Authorization': `Bearer ${window.__ACCESS_TOKEN__ || localStorage.getItem('access_token')}`
  }
}).then(r => r.json()).then(console.log)
```

**Kết quả mong đợi:**
```json
{
  "userId": "xxx",
  "activePollingUsers": 1,
  "userSseConnections": 1,
  "isPolling": true
}
```

Nếu `activePollingUsers: 0` → **Polling chưa chạy!**

## Bước 2: Force poll thủ công
```javascript
fetch('http://localhost:3000/gmail/debug/force-poll', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${window.__ACCESS_TOKEN__ || localStorage.getItem('access_token')}`
  }
}).then(r => r.json()).then(console.log)
```

Xem kết quả có `changed > 0` không?

## Bước 3: Check backend log
Backend terminal phải có:
- `[SSE] Client connecting: xxx`
- `[Gmail Polling] Starting polling for user xxx`
- `[Gmail Polling] 🔄 Polling for user xxx...` (mỗi 30s)

## Bước 4: Nếu vẫn không work
1. Reload lại trang website
2. Check console có "[SSE] Connected successfully" không
3. Đợi 30s xem có polling log không
4. Gửi email test mới và đợi thêm 30s
