import React, { useState } from 'react';
import { CircleX, Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  onClear?: () => void;
  placeholder?: string;
}

/**
 * 🔍 Search bar component cho traditional Inbox view
 * - Enter để search
 * - X button để clear
 */
export function SearchBar({
  onSearch,
  isLoading = false,
  onClear,
  placeholder = 'Tìm kiếm email...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      console.log('[SearchBar] 🔍 Searching for:', query.trim());
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    onClear?.();
  };

  return (
    <div className="relative">
      <div 
        className="flex items-center gap-2 px-3 py-2 border rounded-lg focus-within:ring-2 focus-within:ring-blue-500"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <Search size={18} style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={isLoading}
          style={{
            flex: 1,
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
          }}
          className="placeholder-gray-500 dark:placeholder-gray-400"
        />
        {/* Search button - click để search */}
        {query.trim() && !isLoading && (
          <button
            onClick={() => {
              console.log('[SearchBar] 🔍 Click search button for:', query.trim());
              onSearch(query.trim());
            }}
            className="p-1 rounded transition-colors"
            style={{ 
              color: 'var(--accent-primary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Tìm kiếm (hoặc nhấn Enter)"
          >
            <Search size={18} />
          </button>
        )}
        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="p-1 rounded transition-colors"
            style={{ 
              color: 'var(--text-tertiary)',
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Xóa tìm kiếm"
          >
            <CircleX size={18} />
          </button>
        )}
        {isLoading && (
          <div 
            className="w-4 h-4 rounded-full animate-spin"
            style={{
              border: '2px solid transparent',
              borderTopColor: 'var(--accent-primary)',
            }}
          />
        )}
      </div>
    </div>
  );
}
