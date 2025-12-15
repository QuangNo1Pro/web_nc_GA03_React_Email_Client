/**
 * F2 Frontend Integration Guide
 * 
 * How to integrate SearchBar and SearchResults into the Inbox view
 */

/*
STEP 1: Add search state to Inbox.tsx
=========================================
In the state declarations section near line 100, add:

    const [isSearchMode, setIsSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

STEP 2: Import SearchBar and SearchResults
=========================================
At the top of Inbox.tsx, add imports:

    import SearchBar from '../components/SearchBar';
    import SearchResults from '../pages/SearchResults';

STEP 3: Modify the JSX to include search functionality
=========================================
In the render return (around line 1220), modify the header/toolbar to include:

    {/* SEARCH BAR - Add to your toolbar section */}
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <SearchBar 
        onSearch={(query) => {
          setSearchQuery(query);
          setIsSearchMode(query.length > 0);
        }} 
      />
    </div>

STEP 4: Conditionally render search results or normal inbox
=========================================
Around line 1250, wrap the main email list with:

    {isSearchMode ? (
      <SearchResults 
        onClose={() => {
          setIsSearchMode(false);
          setSearchQuery('');
        }}
      />
    ) : (
      {/* Your existing email list JSX */}
    )}

STEP 5: Test the flow
=========================================
1. Run frontend: npm run dev
2. Navigate to Inbox
3. Type in the search bar and press Enter
4. Should see SearchResults component
5. Click "Back" to return to normal inbox

NOTES:
- SearchBar uses Tailwind CSS - ensure it's available
- SearchResults handles its own loading/error states
- The /api/search endpoint must be available on backend
- Auth token is sent automatically via axios interceptor
*/
