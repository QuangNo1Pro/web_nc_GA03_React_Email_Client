import React from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { SearchResult } from '../services/searchService';

interface SearchResultsListProps {
  results: SearchResult[];
  isLoading: boolean;
  error?: string;
  onBack: () => void;
  onSelectEmail?: (email: SearchResult) => void;
}

/**
 * 📧 Hiển thị kết quả tìm kiếm dưới dạng vertical card list
 * - Loading state (spinner)
 * - Empty state (No results found)
 * - Error state (Error message)
 * - Results (Card list + back button)
 */
export function SearchResultsList({
  results,
  isLoading,
  error,
  onBack,
  onSelectEmail,
}: SearchResultsListProps) {
  // Debug log
  console.log('[SearchResultsList] Rendered with state:', { isLoading, resultsCount: results.length, error });

  // 🔄 Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" />
          <span className="text-gray-500">Đang tìm kiếm...</span>
        </div>
      </div>
    );
  }

  // ❌ Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle size={48} className="text-red-500" />
        <p className="text-red-600 dark:text-red-400 font-medium">Lỗi tìm kiếm</p>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{error}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          ← Quay lại Inbox
        </button>
      </div>
    );
  }

  // 🎯 Empty state
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="text-4xl">🔍</span>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Không tìm thấy email</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={18} />
          Quay lại Inbox
        </button>
      </div>
    );
  }

  // ✅ Results state
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Quay lại Inbox</span>
        </button>
        <span className="text-sm text-gray-500">Tìm thấy {results.length} kết quả</span>
      </div>

      {/* Results list */}
      <div className="space-y-2 max-h-screen overflow-y-auto">
        {results.map((email) => (
          <div key={email.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {/* Email header */}
            <div className="p-3 border-b" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {email.sender}
                  </p>
                  <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                    {email.subject}
                  </p>
                </div>
                {email.score !== undefined && (
                  <div className="ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--accent-primary)' }}>
                    Relevance: {Math.round((1 - email.score) * 100)}%
                  </div>
                )}
              </div>
            </div>

            {/* Email preview + View button */}
            <div className="p-3 space-y-2">
              <p className="text-sm line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                {email.snippet}
              </p>
              {email.matchedFields && email.matchedFields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {email.matchedFields.map((field) => (
                    <span
                      key={field}
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--accent-primary)' }}
                    >
                      {field}
                    </span>
                  ))}
                </div>
              )}
              {/* View button */}
              <button
                onClick={() => {
                  console.log('[SearchResultsList] Button clicked, email:', email);
                  console.log('[SearchResultsList] onSelectEmail callback:', onSelectEmail);
                  onSelectEmail?.(email);
                }}
                className="mt-2 w-full px-3 py-2 rounded text-sm font-medium transition-colors"
                style={{ 
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                }}
              >
                Xem chi tiết
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
