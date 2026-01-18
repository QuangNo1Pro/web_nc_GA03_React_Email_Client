
# React Gmail Kanban Email Client

Full-stack real-time email client with Gmail integration, Kanban board, Google OAuth2, IMAP/SMTP support, AI summarization, and secure token management.

---

## 1. Project Setup Guide

### Prerequisites
- **Node.js** v18+
- **npm** or **Yarn**
- **MongoDB** (local or cloud)
- **Google Cloud Platform** account (for OAuth2)

### Backend Setup
```sh
cd backend
npm install
# (Optional) npm install cookie-parser
# Create .env file in backend/ with:
# MONGODB_URI=your_mongodb_connection_string
# PORT=3000
# JWT_SECRET=your_jwt_secret
# JWT_REFRESH_SECRET=your_jwt_refresh_secret
# CORS_ORIGIN=http://localhost:5173
# FRONTEND_URL=http://localhost:5173
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
# GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
# ENCRYPTION_KEY=your_32_character_encryption_key_for_aes256
# BCRYPT_SALT_ROUNDS=10
# GEMINI_API_KEY=your_gemini_api_key_here
# CUSTOM_AI_API_URL=https://delineable-maryanna-unvolubly.ngrok-free.dev/api/generate (optional, for local AI)
npm run dev
# Backend runs at http://localhost:3000
```

### Frontend Setup
```sh
cd frontend
npm install
# Create .env in frontend/ with:
# VITE_API_URL=http://localhost:3000
npm run dev
# Frontend runs at http://localhost:5173
```

---

## 2. Google OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. APIs & Services > Credentials > Create Credentials > OAuth client ID
4. Choose **Web application**
5. Add `http://localhost:3000/auth/google/callback` to **Authorized redirect URIs**
6. Save your **Client ID** and **Client Secret**
7. Add them to your backend `.env` as shown above

For production, add:
- `https://web-nc-ga03-react-email-client.onrender.com/auth/google/callback` to redirect URIs
- Authorized domains: `web-nc-ga03-react-email-client.onrender.com`, `web-nc-ga-03-react-email-client.vercel.app`

---

## 3. API Endpoints (Backend)

### Auth
- `POST /auth/register` — Register new user
- `POST /auth/login` — Login (local/IMAP)
- `GET /auth/google` — Start Google OAuth2
- `GET /auth/google/callback` — Google OAuth2 callback
- `POST /auth/logout` — Logout (clears refresh_token cookie)
- `POST /auth/refresh` — Refresh access token
- `GET /auth/profile` — Get current user profile
- `POST /auth/imap-login` — Login with IMAP credentials

### Gmail
- `GET /gmail/mailboxes` — List Gmail labels
- `GET /gmail/mailboxes/:labelId/emails` — List emails in label
- `GET /gmail/emails/:messageId` — Get email detail
- `PATCH /gmail/emails/:messageId/star` — Star/unstar email
- `PATCH /gmail/emails/:messageId/read` — Mark as read/unread
- `PATCH /gmail/emails/bulk-read` — Bulk mark as read/unread
- `DELETE /gmail/emails/:messageId` — Delete email
- `PATCH /gmail/emails/:messageId/archive` — Archive email
- `PATCH /gmail/emails/:messageId/spam` — Move to spam
- `PATCH /gmail/emails/:messageId/status` — Update Kanban status
- `POST /gmail/emails/:messageId/snooze` — Snooze email
- `POST /gmail/emails/:messageId/unsnooze` — Unsnooze email
- `PATCH /gmail/emails/:messageId/snooze-time` — Update snooze time
- `POST /gmail/emails/:id/summary` — Generate AI summary
- `POST /gmail/send` — Send email
- `POST /gmail/draft` — Save draft
- `GET /gmail/attachments/:messageId/:attachmentId` — Download attachment
- `POST /gmail/refresh` — Force mailbox sync
- `GET /gmail/kanban/config` — Get Kanban config
- `PUT /gmail/kanban/config` — Save Kanban config

### Search
- `GET /api/search` — Fuzzy search emails
- `POST /api/search/semantic` — Semantic search (vector-based)
- `GET /api/search/suggestions` — Type-ahead suggestions
- `POST /api/search/generate-embeddings` — Generate embeddings for emails

---

## 4. Token Storage & Security Considerations

- **HttpOnly Cookies:** `refresh_token` is stored in a secure, `HttpOnly` cookie. `access_token` is returned in API response and stored in memory on frontend (never in localStorage/sessionStorage).
- **Token Refresh:** When `access_token` expires, frontend automatically uses `refresh_token` (via cookie) to get a new one without user interruption.
- **Google Refresh Token:** Stored securely in backend DB, never exposed to frontend.
- **IMAP Passwords:** Encrypted with AES-256-GCM before DB storage.
- **Refresh Token Hashing:** Refresh tokens are hashed with bcrypt before DB storage for extra security.
- **Cross-Origin Cookies:** In production, cookies use `SameSite=None` and `Secure=true` for cross-domain auth (Vercel/Render).
- **Concurrency Guard:** Only one refresh request is sent if multiple API calls fail due to expired token; others wait for new token.

---

## 5. Security Best Practices

- Never store JWT tokens in localStorage/sessionStorage (XSS risk)
- Always use `HttpOnly` cookies for refresh tokens
- Use strong secrets for JWT and encryption keys
- Use HTTPS in production for all domains
- Restrict CORS origins to trusted frontend URLs
- Regularly rotate secrets and review OAuth2 credentials

---

## 6. AI Summarization (Local Llama 3.2 Fallback)

To use local AI summarization (instead of Gemini):
1. Install [Ollama](https://ollama.com) and run:
   ```sh
   ollama run llama3.2
   ```
2. Install [Ngrok](https://ngrok.com) and run:
   ```sh
   ngrok http 11434 --host-header="localhost:11434" --domain=your-ngrok-domain
   ```
3. Set `CUSTOM_AI_API_URL` in backend `.env` to your Ngrok URL
4. Backend will auto-fallback to local AI if Gemini fails

---

## 7. Deployment

- **Frontend (Vercel):** https://web-nc-ga-03-react-email-client.vercel.app/
- **Backend (Render):** https://web-nc-ga03-react-email-client.onrender.com

### Production Environment Variables
**Backend:**
```
NODE_ENV=production
CORS_ORIGIN=https://web-nc-ga-03-react-email-client.vercel.app
FRONTEND_URL=https://web-nc-ga-03-react-email-client.vercel.app
```
**Frontend:**
```
VITE_API_URL=https://web-nc-ga03-react-email-client.onrender.com
```

---

## 8. Further Documentation

- [GMAIL_SNOOZE_SYNC.md](./GMAIL_SNOOZE_SYNC.md): Gmail snooze sync architecture & details
- [FIX_SUMMARY.md](./FIX_SUMMARY.md): Kanban board persistence fixes
- [PERSISTENCE_FIX.md](./PERSISTENCE_FIX.md): Persistence bug details & fixes
- [TEST_PERSISTENCE.md](./TEST_PERSISTENCE.md): Persistence test checklist
- [TECHNICAL_REPORT.md](./TECHNICAL_REPORT.md): Technical report
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md): Production deployment checklist