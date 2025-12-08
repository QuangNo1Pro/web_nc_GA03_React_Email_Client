# Database Schema

## Users Collection
```json
{
  "_id": ObjectId,
  "email": String,
  "name": String,
  "password": String (hashed with bcrypt, optional),
  "googleId": String (optional),
  "googleAccessToken": String (optional, used for XOAUTH2 IMAP/SMTP),
  "googleRefreshToken": String (optional),
  "picture": String (optional),
  "refreshToken": String (hashed JWT refresh token),
  "lastHistoryId": String (for Gmail incremental sync),
  "provider": String (enum: 'google', 'imap', 'local'),
  "imapConfig": {
    "host": String,
    "port": Number,
    "tls": Boolean,
    "user": String
  },
  "imapPassword": String (encrypted with AES-256-GCM),
  "smtpConfig": {
    "host": String,
    "port": Number,
    "tls": Boolean
  },
  "createdAt": Date
}
```

### Provider Types
- **google**: User authenticated via Google OAuth, may use XOAUTH2 for IMAP
- **imap**: User authenticated via traditional IMAP username/password
- **local**: Email+password only, no mail access

### Security Notes
- `googleAccessToken`: Used for XOAUTH2 authentication with Gmail IMAP/SMTP
- `imapPassword`: Encrypted using AES-256-GCM with ENCRYPTION_KEY from env
- `refreshToken`: Hashed with bcrypt before storage
- Frontend never receives Google refresh tokens or IMAP passwords

## Emails Collection (Cache)
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "gmailId": String,
  "threadId": String,
  "from": String,
  "to": [String],
  "subject": String,
  "snippet": String,
  "body": String,
  "labels": [String],
  "read": Boolean,
  "starred": Boolean,
  "timestamp": Date,
  "createdAt": Date
}
```

## Indexes
- Users: unique index on email, googleId
- Emails: compound index on (userId, timestamp), index on gmailId
