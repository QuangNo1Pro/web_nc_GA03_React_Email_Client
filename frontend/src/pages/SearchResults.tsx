/**
 * SearchResults Component
 * Displays fuzzy search results as a list of email cards
 * Shows loading, no results, and error states
 * Allows user to navigate back to inbox/kanban view
 */

import React, { useState, useEffect } from 'react';
import { searchEmails, semanticSearchEmails, SearchResponse } from '../services/searchService';
import SearchBar from './SearchBar';
import { Email } from '../types/email';

interface SearchResultsProps {
  onClose?: () => void; // Callback to return to normal view (inbox/kanban)
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
    // Prefer semantic search if available
    const data = await semanticSearchEmails(searchQuery, { limit, offset: 0 });
      setResults(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to search. Please try again.');
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
      const data = await semanticSearchEmails(query, { limit, offset: nextPage * limit });
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
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header with search bar and back button */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">Search Results</h1>
          {query && (
            <button
              onClick={handleBack}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              title="Return to inbox"
            >
              ← Back
            </button>
          )}
        </div>
        <SearchBar onSearch={handleSearch} isLoading={isLoading} />
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Error state */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* No query state */}
        {!query && !results && (
          <div className="flex items-center justify-center h-full text-center text-gray-500">
            <div>
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-lg">Enter a search query to get started</p>
              <p className="text-sm mt-2">Search across subjects, senders, and email bodies</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !results && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-gray-600">Searching emails...</p>
            </div>
          </div>
        )}

        {/* No results state */}
        {!isLoading && query && results && results.total === 0 && (
          <div className="flex items-center justify-center h-full text-center text-gray-500">
            <div>
              <div className="text-4xl mb-3">📭</div>
              <p className="text-lg">No results found for "{query}"</p>
              <p className="text-sm mt-2">Try different keywords or check spelling</p>
            </div>
          </div>
        )}

        {/* Results list */}
        {results && results.total > 0 && (
          <div>
            <div className="mb-4 text-sm text-gray-600">
              Found <strong>{results.total}</strong> result{results.total !== 1 ? 's' : ''} for "
              <strong>{query}</strong>"
            </div>

            <div className="space-y-3">
              {results.results.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  onOpenEmail={() => openEmailDetail(result)}
                />
              ))}
            </div>

            {/* Load more button */}
            {results.results.length < results.total && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-6 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
 * ResultCard Component
 * Displays a single search result as a card
 */
interface ResultCardProps {
  result: any;
  onOpenEmail?: () => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, onOpenEmail }) => {
  const getSenderName = (sender: string): string => {
    const match = sender.match(/^([^<]+)</);
    return match ? match[1].trim() : sender.split('@')[0];
  };

  const getSenderEmail = (sender: string): string => {
    const match = sender.match(/<([^>]+)>/);
    return match ? match[1] : sender;
  };

  const getAvatarLetter = (sender: string): string => {
    return getSenderName(sender).charAt(0).toUpperCase();
  };

  const getAvatarColor = (text: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-red-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-indigo-500',
      'bg-cyan-500',
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const senderName = getSenderName(result.sender);
  const senderEmail = getSenderEmail(result.sender);
  const avatarColor = getAvatarColor(senderName);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
      <div className="flex gap-4">
        {/* Avatar */}
        <div
          className={`${avatarColor} text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-semibold`}
        >
          {getAvatarLetter(result.sender)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Sender and Score */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{senderName}</h3>
              <p className="text-xs text-gray-500 truncate">{senderEmail}</p>
            </div>
            {/* Relevance badge */}
            <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex-shrink-0">
              {(100 - Math.round(result.score * 100)).toFixed(0)}% match
            </div>
          </div>

          {/* Subject */}
          <p className="text-sm font-medium text-gray-900 mt-2 line-clamp-2">{result.subject}</p>

          {/* Snippet */}
          {result.snippet && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{result.snippet}</p>
          )}

          {/* Matched fields */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {result.matchedFields?.map((field: string) => (
              <span
                key={field}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
              >
                {field}
              </span>
            ))}
          </div>
        </div>

        {/* View button */}
        <button
          onClick={onOpenEmail}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 whitespace-nowrap"
        >
          View
        </button>
      </div>
    </div>
  );
};

/**
 * Open email in Gmail or detail modal
 */
const openEmailDetail = (result: any) => {
  // Option 1: Open in Gmail directly
  const gmailUrl = `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(result.subject)}`;
  window.open(gmailUrl, '_blank', 'noopener,noreferrer');

  // Option 2: Could emit event to parent to open detail modal instead
  // parent would handle this via onOpenEmail callback
};

export default SearchResults;
