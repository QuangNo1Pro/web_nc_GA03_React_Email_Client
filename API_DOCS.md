# API Documentation

## Authentication Endpoints

### POST /auth/login
- Email and password authentication
- Returns access_token and refresh_token
- Tokens stored in httpOnly cookies

### POST /auth/refresh
- Refresh access token using refresh_token
- Access token expires: 15 minutes
- Refresh token expires: 1 minute (auto-logout)

### GET /auth/profile
- Get current user profile
- Requires valid JWT

### POST /auth/logout
- Logout user and revoke tokens
- Clears refresh token from database

## Gmail Endpoints

### GET /gmail/mailboxes
- Fetch all mailboxes (INBOX, SENT, DRAFT, etc.)
- Includes unread count and labels

### GET /gmail/emails/:mailbox
- Fetch emails from specific mailbox
- Auto-refresh every 15 seconds
- Real-time sync with Gmail API

### POST /gmail/send
- Send email via Gmail API
- Supports attachments and CC/BCC

### PATCH /gmail/emails/:id/read
- Mark email as read/unread

### DELETE /gmail/emails/:id
- Move email to trash
