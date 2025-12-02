# Deployment Guide

## Frontend Deployment
- Hosted on Vercel
- Automatic deployment on push to master
- Environment variables configured in Vercel dashboard

## Backend Deployment
- NestJS server
- Deployed on AWS/Heroku (configure as needed)
- MongoDB connection via Atlas

## Environment Setup
```
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
MONGODB_URI=your_mongodb_uri
GMAIL_API_KEY=your_api_key
```

## Auto-Refresh Configuration
- Frontend: 15-second polling interval
- Backend: 10-second cache TTL
- Real-time sync enabled
