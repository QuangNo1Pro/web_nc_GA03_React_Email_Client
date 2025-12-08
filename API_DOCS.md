# API Documentation

## Authentication Endpoints

### POST /auth/login
- Email and password authentication
- Returns access_token and refresh_token
- Tokens stored in httpOnly cookies

### POST /auth/register
- Register new user with email/password
- Returns user data

### GET /auth/google
- Initiate Google OAuth2 flow
- Redirects to Google consent screen

### GET /auth/google/callback
- OAuth2 callback endpoint
- Exchanges authorization code for tokens
- Stores Google tokens server-side
- Sets JWT cookies and redirects to /inbox

### POST /auth/imap-login
- Login with IMAP credentials
- Validates connection before saving
- Encrypts password with AES-256-GCM
- Body: `{ email, password, imapConfig: { host, port, tls }, smtpConfig? }`

### POST /auth/enable-google-imap
- Enable IMAP access for Google OAuth users
- Configures Gmail IMAP/SMTP with XOAUTH2
- Requires existing Google login
- No password needed (uses OAuth tokens)

### POST /auth/refresh
- Refresh access token using refresh_token
- Access token expires: 15 minutes
- Refresh token expires: 7 days

### GET /auth/profile
- Get current user profile
- Returns: userId, email, name, picture, provider
- Requires valid JWT

### POST /auth/logout
- Logout user and revoke tokens
- Revokes Google tokens if OAuth user
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

## IMAP Endpoints

### GET /imap/mailboxes
- Fetch mailboxes via IMAP
- Supports XOAUTH2 (for Gmail with OAuth) or password authentication
- Auto-detects authentication method based on user config

### GET /imap/emails/:mailbox
- Fetch emails from IMAP mailbox
- Returns formatted email list with read/starred flags

### GET /imap/email/:mailbox/:uid
- Get full email details via IMAP
- Includes body (HTML/text), headers, attachments

### POST /imap/emails/:mailbox/:uid/read
- Mark IMAP email as read/unread
- Body: `{ read: boolean }`

### POST /imap/emails/:mailbox/:uid/star
- Toggle star on IMAP email
- Body: `{ starred: boolean }`

### POST /imap/emails/:mailbox/:uid/delete
- Delete email via IMAP
- Moves to Trash and expunges

### POST /imap/send
- Send email via SMTP
- Supports XOAUTH2 or password
- Body: `{ to, subject, body, html?, cc?, bcc? }`

### POST /imap/connect
- Test IMAP connection
- Body: `{ user, password, host, port, tls }`

## Authentication Methods

### XOAUTH2 (OAuth2 for IMAP/SMTP)
- **Supported providers:** Gmail, Outlook (with proper OAuth setup)
- **Requirements:** User must login via Google OAuth first
- **Activation:** Call `/auth/enable-google-imap` after Google login
- **Benefits:** No App Password needed, more secure, automatic token refresh

### Password Authentication
- **Supported providers:** Gmail (with App Password), Outlook, Yahoo, iCloud, custom IMAP servers
- **Security:** Passwords encrypted with AES-256-GCM before storage
- **Configuration:** Requires IMAP host, port, username, password
