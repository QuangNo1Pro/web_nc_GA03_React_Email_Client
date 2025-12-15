/**
 * SearchBar Component (Reusable)
 * Input field with Enter handler, clear button, loading state
 * Used in both Inbox and Kanban views
 * Supports CSS variables for theming
 */

import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  useThemeVars?: boolean; // Use CSS vars for dark/light theme
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading = false,
  placeholder = 'Search emails: subject, sender, body...',
  useThemeVars = true,
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch(''); // Clear search results
  };

  if (useThemeVars) {
    return (
      <form onSubmit={handleSubmit} className="w-full">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <div
              className="flex items-center rounded-lg px-4 py-2 transition-all"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <span
                className="material-symbols-outlined mr-3 flex-shrink-0"
                style={{ color: 'var(--text-tertiary)', fontSize: '20px' }}
              >
                search
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                disabled={isLoading}
                className="outline-none w-full text-sm"
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                }}
                aria-label="Search emails with fuzzy matching"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="ml-2 flex-shrink-0"
                  style={{ color: 'var(--text-tertiary)', cursor: 'pointer' }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            style={{
              backgroundColor: isLoading || !query.trim() ? 'var(--text-tertiary)' : 'var(--accent-primary)',
              color: 'white',
              cursor: isLoading || !query.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !query.trim() ? 0.6 : 1,
            }}
            aria-label="Search"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Searching
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </form>
    );
  }

  // Fallback: Tailwind-only version (for pages without CSS vars)
  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            aria-label="Search emails"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          aria-label="Search"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Searching
            </span>
          ) : (
            'Search'
          )}
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
