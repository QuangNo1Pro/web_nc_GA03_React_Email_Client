# Testing Strategy

## Unit Tests
- Auth service: Token generation, refresh, validation
- Gmail service: Email caching, rate limiting
- Users service: CRUD operations

## Integration Tests
- Full auth flow: Login → JWT → Refresh → Logout
- Gmail integration: Fetch emails → Cache → Auto-refresh
- Email operations: Send, read, delete, archive

## E2E Tests
- User registration and login
- Email inbox navigation
- Compose and send email
- Archive/unarchive emails
- Real-time auto-refresh verification

## Performance Tests
- Email fetch performance with 1000+ emails
- Cache effectiveness (10-second TTL)
- Auto-refresh polling load test (15-second interval)

## Security Tests
- JWT token validation
- Refresh token rotation
- XSS prevention in email display
- CSRF protection on state-changing operations
