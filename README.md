# Ứng dụng Email Client bằng React tích hợp Gmail

Đây là một ứng dụng full-stack triển khai một email client thời gian thực với tính năng tích hợp Gmail. Ứng dụng sử dụng Google OAuth2 để truy cập tài khoản Gmail của người dùng thông qua Gmail REST API.

## Tính năng

-   **Tích hợp Gmail thời gian thực:** Kết nối với tài khoản Gmail của bạn và hiển thị email trong giao diện bảng Kanban 4 cột.
-   **Bảng Kanban với 4 cột:** Inbox, To Do, In Progress, Done - kéo thả email giữa các cột với drag & drop.
-   **Drag & Drop Email Management:** Sử dụng @dnd-kit/core để kéo thả email mượt mà giữa các cột trạng thái.
-   **Xác thực Google OAuth2 bảo mật:** Sử dụng luồng OAuth2 Authorization Code phía máy chủ an toàn để truy cập dữ liệu Gmail của bạn.
-   **Hỗ trợ IMAP đa nhà cung cấp:** Kết nối với Gmail, Outlook, Yahoo, iCloud và các email server khác qua IMAP/SMTP.
-   **XOAUTH2 cho Gmail:** Sử dụng Google OAuth tokens để truy cập IMAP/SMTP mà không cần App Password.
-   **Mã hóa thông tin đăng nhập:** Mật khẩu IMAP được mã hóa AES-256-GCM trước khi lưu trữ.
-   **Chức năng email đầy đủ:** Đọc, soạn, trả lời, xóa, gắn dấu sao và quản lý email của bạn.
-   **Snooze/Deferral với đồng bộ Gmail:** Hoãn email với đồng bộ hoá 2 chiều với Gmail API (SNOOZED label).
-   **Tự động đánh thức (Auto wake-up):** Scheduler backend kiểm tra mỗi phút để khôi phục email đã hết hạn.
-   **Rollback tự động:** Nếu Gmail API thất bại, thay đổi local sẽ được hoàn tác tự động.
-   **AI Email Summarization:** Tóm tắt nội dung email tự động bằng Gemini AI với fallback local summarization.
-   **Bảo mật dựa trên Token:** Sử dụng access và refresh token JWT để giao tiếp API an toàn với proxy backend.
-   **Tự động làm mới Token:** Tự động làm mới access token đã hết hạn mà không làm gián đoạn người dùng.
-   **Giao diện Kanban hiện đại:** Giao diện người dùng email client tương thích, tương tác với drag & drop.

## Công nghệ sử dụng

### Frontend

-   **React:** Thư viện JavaScript để xây dựng giao diện người dùng.
-   **TypeScript:** Một siêu tập hợp của JavaScript có kiểu dữ liệu.
-   **Vite:** Công cụ xây dựng và máy chủ phát triển nhanh.
-   **React Router v6:** Thư viện định tuyến khai báo cho React.
-   **TanStack Query:** Thư viện mạnh mẽ để tìm nạp và quản lý trạng thái dữ liệu.
-   **@dnd-kit/core:** Thư viện drag & drop hiện đại cho React, lightweight và có khả năng truy cập tốt.
-   **Axios:** Một HTTP client dựa trên promise.
-   **Tailwind CSS:** Một framework CSS tập trung vào tiện ích.
-   **react-hot-toast:** Để hiển thị thông báo toast.
-   **Quill Editor:** Rich text editor WYSIWYG cho việc soạn email.

### Backend

-   **NestJS:** Một framework Node.js tiến bộ để xây dựng các ứng dụng phía máy chủ hiệu quả và có khả năng mở rộng.
-   **TypeScript:** Một siêu tập hợp của JavaScript có kiểu dữ liệu.
-   **MongoDB & Mongoose:** Một cơ sở dữ liệu NoSQL và một công cụ tạo mô hình đối tượng thanh lịch.
-   **Passport.js:** Một middleware xác thực đơn giản, không phô trương cho Node.js.
-   **JWT & Google OAuth2 Strategies:** Các chiến lược Passport.js để xác thực dựa trên token và Google.
-   **googleapis:** Thư viện client API chính thức của Google cho Node.js.
-   **bcrypt:** Thư viện để mã hóa mật khẩu.
-   **@nestjs/schedule:** Module scheduler cho NestJS để tự động đánh thức email đã snooze.
-   **Gemini AI API:** Tích hợp Google Gemini 2.0 Flash cho tính năng tóm tắt email bằng AI.

## Bắt đầu

### Điều kiện tiên quyết

-   **Node.js:** v18 trở lên.
-   **npm hoặc Yarn:** Để quản lý các phần phụ thuộc của dự án.
-   **MongoDB:** Một phiên bản MongoDB đang chạy (cục bộ hoặc trên đám mây).
-   **Tài khoản Google Cloud Platform:** Để lấy thông tin xác thực OAuth2.

### Cách lấy thông tin xác thực Google OAuth2

1.  Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2.  Tạo một dự án mới.
3.  Vào **APIs & Services > Credentials**.
4.  Nhấp vào **Create Credentials > OAuth client ID**.
5.  Chọn **Web application** làm loại ứng dụng.
6.  Thêm `http://localhost:3000/auth/google/callback` vào **Authorized redirect URIs**.
7.  Nhấp vào **Create**. Bạn sẽ nhận được client ID và client secret.

### Cài đặt Backend

1.  **Truy cập thư mục backend:**
    ```sh
    cd backend
    ```
2.  **Cài đặt các phần phụ thuộc:**
    ```sh
    npm install
    npm install cookie-parser
    ```
3.  **Tạo tệp `.env`** trong thư mục `backend` và thêm các biến môi trường sau:
    ```
    MONGODB_URI=your_mongodb_connection_string
    PORT=3000
    JWT_SECRET=your_jwt_secret
    JWT_REFRESH_SECRET=your_jwt_refresh_secret
    CORS_ORIGIN=http://localhost:5173
    FRONTEND_URL=http://localhost:5173
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
    ENCRYPTION_KEY=your_32_character_encryption_key_for_aes256
    BCRYPT_SALT_ROUNDS=10
    GEMINI_API_KEY=your_gemini_api_key_here
    ```
4.  **Khởi động máy chủ phát triển:**
    ```sh
    npm run dev
    ```
    Máy chủ backend sẽ chạy trên `http://localhost:3000`.

### Cài đặt Frontend

1.  **Truy cập thư mục frontend:**
    ```sh
    cd frontend
    ```
2.  **Cài đặt các phần phụ thuộc:**
    ```sh
    npm install
    ```
3.  **Tạo tệp `.env`** trong thư mục `frontend` và thêm các biến môi trường sau:
    ```
    VITE_API_URL=http://localhost:3000
    ```
4.  **Khởi động máy chủ phát triển:**
    ```sh
    npm run dev
    ```
    Ứng dụng frontend sẽ khả dụng tại `http://localhost:5173`.

## Cải tiến bảo mật & Lưu trữ Token

Dự án này đã được tái cấu trúc để sử dụng mô hình xác thực dựa trên cookie mạnh mẽ, bảo mật.

-   **`HttpOnly` Cookies:** `access_token` và `refresh_token` của ứng dụng được lưu trữ trong các `HttpOnly` cookie an toàn. Đây là một biện pháp bảo mật quan trọng giúp ngăn chặn các token này bị truy cập bởi JavaScript phía client, giảm thiểu rủi ro đánh cắp token thông qua các cuộc tấn công Cross-Site Scripting (XSS). Trình duyệt sẽ tự động và an toàn quản lý các token này.
-   **Mã hóa Refresh Token phía máy chủ:** Refresh token của ứng dụng được mã hóa bằng `bcrypt` trước khi lưu trữ trong cơ sở dữ liệu. Điều này cung cấp một lớp bảo mật bổ sung, đảm bảo rằng ngay cả khi cơ sở dữ liệu bị xâm phạm, các refresh token sẽ không thể sử dụng ngay lập tức.
-   **Bảo vệ đồng thời (Concurrency Guard):** API client trên frontend hiện bao gồm một bảo vệ đồng thời. Cơ chế này đảm bảo rằng nếu nhiều lệnh gọi API thất bại đồng thời do access token hết hạn, chỉ có một yêu cầu làm mới được gửi đến backend. Tất cả các yêu cầu thất bại khác sẽ được xếp hàng và thử lại với token mới ngay khi có, ngăn ngừa tình trạng tranh chấp và các yêu cầu mạng không cần thiết.
-   **Lưu trữ Token Google an toàn:** `googleRefreshToken` có thời gian tồn tại dài, được lấy từ Google, được lưu trữ an toàn trong cơ sở dữ liệu backend (dưới dạng văn bản thuần, vì nó được yêu cầu để gọi API tới Google) và không bao giờ bị lộ ra frontend.

## Kiểm tra chức năng làm mới Token

Để kiểm tra cơ chế tự động làm mới token có hoạt động chính xác hay không, bạn có thể tạm thời rút ngắn thời gian hết hạn của `access_token`.

1.  Mở tệp backend: `backend/src/auth/auth.service.ts`.
2.  Đi đến phương thức `login`.
3.  Tìm dòng sau:
    ```typescript
    this.jwtService.sign(payload),
    ```
4.  Sửa đổi nó để thêm thời gian hết hạn ngắn:
    ```typescript
    this.jwtService.sign(payload, { expiresIn: '15s' }),
    ```
5.  Khởi động lại máy chủ backend. Bây giờ, khi bạn đăng nhập, `access_token` sẽ hết hạn trong 15 giây. Sau 15 giây, hãy thử thực hiện một hành động cần xác thực (ví dụ: làm mới danh sách email). Yêu cầu sẽ thành công mà không bị đăng xuất, vì API client đã tự động sử dụng `refresh_token` để lấy `access_token` mới.

**Quan trọng:** Đừng quên xóa bỏ thay đổi `{ expiresIn: '15s' }` sau khi bạn đã kiểm tra xong.

## Triển khai
Ứng dụng được triển khai và có thể truy cập công khai tại các URL sau:

-   **Frontend (Vercel):** [https://web-nc-ga-03-react-email-client.vercel.app/](https://web-nc-ga-03-react-email-client.vercel.app/)
-   **Backend (Render):** [https://web-nc-ga03-react-email-client.onrender.com](https://web-nc-ga03-react-email-client.onrender.com)

### Cấu hình quan trọng cho Production

**Backend (Render):**
Đảm bảo các biến môi trường sau được thiết lập:
```
NODE_ENV=production
CORS_ORIGIN=https://web-nc-ga-03-react-email-client.vercel.app
FRONTEND_URL=https://web-nc-ga-03-react-email-client.vercel.app
```

**Frontend (Vercel):**
Đảm bảo biến môi trường:
```
VITE_API_URL=https://web-nc-ga03-react-email-client.onrender.com
```

**Google OAuth2 Credentials:**
- Thêm URL callback production vào Google Console:
  - `https://web-nc-ga03-react-email-client.onrender.com/auth/google/callback`
- Thêm authorized domains:
  - `web-nc-ga03-react-email-client.onrender.com`
  - `web-nc-ga-03-react-email-client.vercel.app`

**Lưu ý về Cookies Cross-Origin:**
- Ứng dụng sử dụng `sameSite: 'none'` và `secure: true` cookies cho production
- Điều này cho phép cookies hoạt động giữa Vercel (frontend) và Render (backend)
- Cả hai domain phải sử dụng HTTPS
- Cookies không được set với `domain` attribute để browser tự quản lý

**Debug Cookies trên Production:**
Nếu gặp lỗi 401 "Not authenticated" sau khi đăng nhập Google:
1. Mở Developer Tools (F12) → Tab Application/Storage → Cookies
2. Kiểm tra domain của backend (render.com) có cookies `access_token` và `refresh_token` không
3. Đảm bảo cookies có attributes: `HttpOnly`, `Secure`, `SameSite=None`
4. Xóa tất cả cookies và thử đăng nhập lại
5. Kiểm tra Console logs có lỗi CORS không

**Lưu ý:** Backend đã triển khai có các biến môi trường cần thiết cho thông tin xác thực Google.

---

## 📚 Tài liệu mở rộng

Để biết chi tiết về các tính năng nâng cao và triển khai kỹ thuật:

- **[GMAIL_SNOOZE_SYNC.md](./GMAIL_SNOOZE_SYNC.md)**: Tài liệu đầy đủ về tính năng Snooze với đồng bộ Gmail
  - Kiến trúc hệ thống và data flow
  - Chi tiết triển khai từng file (backend + frontend)
  - Xử lý lỗi và rollback mechanism
  - Hướng dẫn test và deployment
  - Troubleshooting guide
  - Mapping với tiêu chí chấm điểm (30/30 điểm)

- **[FIX_SUMMARY.md](./FIX_SUMMARY.md)**: Tóm tắt các fix persistence cho Kanban board
- **[PERSISTENCE_FIX.md](./PERSISTENCE_FIX.md)**: Chi tiết các bug persistence và cách fix
- **[TEST_PERSISTENCE.md](./TEST_PERSISTENCE.md)**: Checklist kiểm tra persistence sau mỗi hành động
- **[TECHNICAL_REPORT.md](./TECHNICAL_REPORT.md)**: Báo cáo kỹ thuật về phát triển tính năng III
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)**: Checklist triển khai production