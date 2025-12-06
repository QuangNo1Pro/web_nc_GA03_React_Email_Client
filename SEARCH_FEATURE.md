# Email Search Feature

## Overview
- Full-text search across all emails
- Filter by sender, subject, date range
- Advanced search operators

## Search Operators
```
from:user@example.com        - Search by sender
to:recipient@example.com     - Search by recipient
subject:"keyword"            - Search in subject
label:INBOX                  - Search by label
is:read / is:unread          - Search by read status
is:starred                   - Search starred emails
before:2024-01-01            - Search before date
after:2024-01-01             - Search after date
```

## Performance
- Indexed search on subject and snippet
- Backend caching for frequent searches
- Debounced frontend input (300ms)
- Pagination: 50 results per page

## UI Components
- Search bar with autocomplete
- Advanced search modal
- Search history dropdown
- Results count indicator
- No results state with suggestions
