# Database Schema

## Users Collection
```json
{
  "_id": ObjectId,
  "email": String,
  "name": String,
  "password": String (hashed with bcrypt),
  "googleId": String,
  "googleAccessToken": String,
  "googleRefreshToken": String,
  "picture": String,
  "currentRefreshToken": String,
  "createdAt": Date,
  "updatedAt": Date
}
```

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
