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
 */
export function SearchResultsList({
  results,
  isLoading,
  error,
  onBack,
  onSelectEmail,
}: SearchResultsListProps) {
  console.log('[SearchResultsList] Rendered with state:', { isLoading, resultsCount: results.length, error });

  // 🔄 Loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-7 h-7 rounded-full animate-spin"
            style={{ border: '2px solid var(--border-primary)', borderTopColor: 'var(--accent-primary)' }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Đang tìm kiếm...</span>
        </div>
      </div>
    );
  }

  // ❌ Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 px-4">
        <AlertCircle size={40} style={{ color: '#ef4444' }} />
        <p className="font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Lỗi tìm kiếm</p>
        <p className="text-center" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{error}</p>
        <button
          onClick={onBack}
          className="mt-2 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          style={{ backgroundColor: 'var(--accent-primary)', color: 'white', fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          Quay lại Inbox
        </button>
      </div>
    );
  }

  // 🎯 Empty state
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 px-4">
        <span className="text-3xl">🔍</span>
        <p className="font-medium" style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Không tìm thấy email</p>
        <button
          onClick={onBack}
          className="mt-2 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          style={{ backgroundColor: 'var(--accent-primary)', color: 'white', fontSize: '13px' }}
        >
          <ArrowLeft size={16} />
          Quay lại Inbox
        </button>
      </div>
    );
  }

  // ✅ Results state - card style với căn chỉnh tốt hơn
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-colors"
          style={{ color: 'var(--accent-primary)', fontSize: '13px' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <ArrowLeft size={16} />
          <span>Quay lại Hộp thư</span>
        </button>
        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          Tìm thấy {results.length} kết quả
        </span>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {results.map((email) => (
          <div
            key={email.id}
            className="rounded-lg border overflow-hidden"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            {/* Email header */}
            <div
              className="px-3 py-2 border-b"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p
                    className="font-medium truncate"
                    style={{ color: 'var(--text-primary)', fontSize: '13px' }}
                  >
                    {email.sender}
                  </p>
                  <p
                    className="truncate mt-0.5"
                    style={{ color: 'var(--text-secondary)', fontSize: '12px' }}
                  >
                    {email.subject}
                  </p>
                </div>
                {email.score !== undefined && (
                  <span
                    className="flex-shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary)',
                      fontSize: '11px',
                    }}
                  >
                    {Math.round((1 - email.score) * 100)}%
                  </span>
                )}
              </div>
            </div>

            {/* Email preview + tags + button */}
            <div className="px-3 py-2 space-y-2">
              <p
                className="line-clamp-2"
                style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4' }}
              >
                {email.snippet}
              </p>



              {/* View button - nhỏ gọn hơn */}
              <button
                onClick={() => onSelectEmail?.(email)}
                className="w-full py-1.5 rounded transition-opacity"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
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
