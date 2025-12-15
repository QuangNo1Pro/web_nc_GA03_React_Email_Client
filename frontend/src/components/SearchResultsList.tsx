/**
 * SearchResults Component (Inbox - Traditional View)
 * Displays fuzzy search results as vertical list of cards
 * Reuses EmailCard design or custom SearchResultCard
 */

import React, { useState, useEffect } from 'react';
import SearchBar from './SearchBar';
import { searchEmails, SearchResponse } from '../services/searchService';

interface SearchResultsProps {
  onClose?: () => void; // Return to normal email list
}

const SearchResults: React.FC<SearchResultsProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const limit = 20;

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery);
    setPage(0);
    setError(null);

    if (!searchQuery.trim()) {
      setResults(null);
      return;
    }

    setIsLoading(true);
    try {
      const data = await searchEmails(searchQuery, { limit, offset: 0 });
      setResults(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Search failed. Please try again.');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!query || !results) return;

    setIsLoading(true);
    try {
      const nextPage = page + 1;
      const data = await searchEmails(query, { limit, offset: nextPage * limit });
      setResults({
        total: data.total,
        results: [...results.results, ...data.results],
      });
      setPage(nextPage);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load more results.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setQuery('');
    setResults(null);
    setError(null);
    setPage(0);
    onClose?.();
  };

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 border-b px-6 py-4"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600' }}>
            Search Emails
          </h2>
          {query && (
            <button
              onClick={handleBack}
              className="px-3 py-1 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-primary)';
                (e.currentTarget as HTMLButtonElement).style.color = 'white';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-secondary)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }}
            >
              ← Back to Inbox
            </button>
          )}
        </div>
        <SearchBar onSearch={handleSearch} isLoading={isLoading} useThemeVars={true} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Error State */}
        {error && !isLoading && (
          <div
            className="mb-4 p-4 rounded-lg border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#dc2626',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && !results && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="inline-block w-8 h-8 border-4 border-transparent rounded-full animate-spin mb-3"
                style={{ borderTopColor: 'var(--accent-primary)' }}
              ></div>
              <p style={{ color: 'var(--text-secondary)' }}>Searching emails...</p>
            </div>
          </div>
        )}

        {/* No Query State */}
        {!query && !results && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '500' }}>
                Enter a search query
              </p>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Search across subjects, senders, and email bodies
              </p>
            </div>
          </div>
        )}

        {/* No Results State */}
        {!isLoading && query && results && results.total === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '500' }}>
                No results found for "{query}"
              </p>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Try different keywords or check the spelling
              </p>
            </div>
          </div>
        )}

        {/* Results List */}
        {results && results.total > 0 && (
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Found <strong>{results.total}</strong> result{results.total !== 1 ? 's' : ''} for "
              <strong>{query}</strong>"
            </div>

            <div className="space-y-3">
              {results.results.map((result) => (
                <SearchResultCard key={result.id} result={result} />
              ))}
            </div>

            {/* Load More */}
            {results.results.length < results.total && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-6 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-primary)',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * SearchResultCard Component
 * Displays a single search result
 */
interface SearchResultCardProps {
  result: any;
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result }) => {
  const getSenderName = (sender: string): string => {
    const match = sender.match(/^([^<]+)</);
    return match ? match[1].trim() : sender.split('@')[0];
  };

  const getSenderEmail = (sender: string): string => {
    const match = sender.match(/<([^>]+)>/);
    return match ? match[1] : sender;
  };

  const getAvatarColor = (text: string): string => {
    const colors = [
      '#3b82f6',
      '#ef4444',
      '#10b981',
      '#8b5cf6',
      '#ec4899',
      '#f59e0b',
      '#6366f1',
      '#06b6d4',
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const senderName = getSenderName(result.sender);
  const senderEmail = getSenderEmail(result.sender);
  const relevancePercent = Math.round((1 - result.score) * 100);
  const avatarColor = getAvatarColor(senderName);

  const openInGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${result.id}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="rounded-lg p-4 border transition-all hover:shadow-md cursor-pointer"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
      }}
      onClick={openInGmail}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm"
          style={{ backgroundColor: avatarColor }}
        >
          {senderName.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Sender + Relevance */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <h3
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
                className="truncate"
              >
                {senderName}
              </h3>
              <p
                style={{
                  color: 'var(--text-tertiary)',
                  fontSize: '12px',
                }}
                className="truncate"
              >
                {senderEmail}
              </p>
            </div>
            {/* Relevance Badge */}
            <span
              className="px-2 py-1 rounded text-xs font-medium flex-shrink-0 whitespace-nowrap"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
              }}
            >
              {relevancePercent}% match
            </span>
          </div>

          {/* Subject */}
          <p
            style={{
              color: 'var(--text-primary)',
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '8px',
            }}
            className="line-clamp-2"
          >
            {result.subject}
          </p>

          {/* Snippet */}
          {result.snippet && (
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                marginBottom: '8px',
              }}
              className="line-clamp-2"
            >
              {result.snippet}
            </p>
          )}

          {/* Matched Fields */}
          <div className="flex gap-1 flex-wrap">
            {result.matchedFields?.map((field: string) => (
              <span
                key={field}
                className="px-2 py-1 rounded text-xs"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                }}
              >
                {field}
              </span>
            ))}
          </div>
        </div>

        {/* View Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openInGmail();
          }}
          className="px-3 py-2 rounded text-sm font-medium transition-colors flex-shrink-0 whitespace-nowrap"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.opacity = '1';
          }}
        >
          View
        </button>
      </div>
    </div>
  );
};

export default SearchResults;
