import React, { useState, useEffect, useRef } from 'react';
import { CircleX, Search, Zap, Brain } from 'lucide-react';
import { getSearchSuggestions } from '../services/searchService';
import { SearchModeSelector, SearchMode, useSearchMode } from './SearchModeSelector';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  onClear?: () => void;
  placeholder?: string;
  label?: string; // Optional: current mailbox/label for suggestions filtering
  showModeSelector?: boolean; // Show search mode toggle
  value?: string; // Controlled value from parent
}

/**
 * 🔍 Search bar component với auto-suggestions (type-ahead)
 * - Auto-suggestions dropdown hiển thị khi user nhập
 * - Arrow keys để navigate suggestions
 * - Enter để search, Escape để close dropdown
 * - Click suggestion để search với suggestion text
 * - Optional: Search mode selector (Fuzzy vs Semantic)
 */
export function SearchBar({
  onSearch,
  isLoading = false,
  onClear,
  placeholder = 'Tìm kiếm email...',
  label,
  showModeSelector = false,
  value = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(value);

  // Sync query with external value prop
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Reset query when label (mailbox) changes
  useEffect(() => {
    setQuery('');
  }, [label]);
  const [suggestions, setSuggestions] = useState<{
    senders: string[];
    subjects: string[];
  }>({ senders: [], subjects: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [searchMode, setSearchMode] = useSearchMode();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine all suggestions into a flat list for keyboard navigation
  const allSuggestions = [
    ...suggestions.senders.map(s => ({ text: s, type: 'sender' as const })),
    ...suggestions.subjects.map(s => ({ text: s, type: 'subject' as const })),
  ];

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        setSuggestions({ senders: [], subjects: [] });
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const response = await getSearchSuggestions(query, {
          label,
          limit: 5,
        });

        if (response.success) {
          setSuggestions(response.data);
          setShowSuggestions(true);
          setSelectedSuggestionIndex(-1); // Reset selection
        }
      } catch (error) {
        console.error('[SearchBar] Failed to fetch suggestions:', error);
        setSuggestions({ senders: [], subjects: [] });
      } finally {
        setLoadingSuggestions(false);
      }
    };

    // Debounce: only fetch if user stops typing for 300ms
    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [query, label]);

  // Close suggestions on blur (with delay to allow click)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If suggestions are shown, handle arrow keys and Enter differently
    if (showSuggestions && allSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          Math.min(prev + 1, allSuggestions.length - 1)
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => Math.max(prev - 1, -1));
        return;
      }

      if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        const selected = allSuggestions[selectedSuggestionIndex];
        const q = selected.text.trim();
        if (q) {
          console.log('[SearchBar] 🔍 Search with suggestion:', q);
          onSearch(q);
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        return;
      }
    }

    // Regular Enter to search with current query
    if (e.key === 'Enter' && !isLoading) {
      const q = query.trim();
      if (q) {
        console.log('[SearchBar] 🔍 Searching for:', q);
        onSearch(q);
        setShowSuggestions(false);
      }
      e.preventDefault();
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions({ senders: [], subjects: [] });
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    onClear?.();
  };

  const handleSuggestionClick = (text: string) => {
    console.log('[SearchBar] 🔍 Clicked suggestion:', text);
    onSearch(text);
    setQuery(text);
    setSuggestions({ senders: [], subjects: [] });
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  // Toggle search mode
  const toggleSearchMode = () => {
    const newMode = searchMode === 'fuzzy' ? 'semantic' : 'fuzzy';
    setSearchMode(newMode);
  };

  return (
    <div className="relative">
      {/* Container for search bar + toggle */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div
          className="flex-1 flex items-center gap-2 px-2 py-1 border rounded-lg focus-within:ring-1 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <Search size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            style={{
              flex: 1,
              outline: 'none',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '14px',
              minWidth: 0,
            }}
            className="placeholder-gray-400 dark:placeholder-gray-500"
            autoComplete="off"
          />

          {/* Loading spinner */}
          {(isLoading || loadingSuggestions) && (
            <div
              className="w-4 h-4 rounded-full animate-spin flex-shrink-0"
              style={{
                border: '2px solid transparent',
                borderTopColor: 'var(--accent-primary)',
              }}
            />
          )}

          {/* Clear button */}
          {query && !isLoading && (
            <button
              onClick={handleClear}
              className="p-1 rounded transition-colors flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700"
              style={{ color: 'var(--text-tertiary)' }}
              title="Xóa"
            >
              <CircleX size={16} />
            </button>
          )}
        </div>

        {/* Search mode toggle - outside search bar */}
        {showModeSelector && (
          <button
            onClick={toggleSearchMode}
            className="px-2.5 py-2 rounded-md transition-all flex-shrink-0"
            style={{
              backgroundColor: searchMode === 'semantic' ? 'rgba(147, 51, 234, 0.12)' : 'rgba(59, 130, 246, 0.12)',
              color: searchMode === 'semantic' ? 'rgb(147, 51, 234)' : 'rgb(59, 130, 246)',
              fontSize: '12px',
              fontWeight: 500,
            }}
            title={searchMode === 'fuzzy' ? 'Click để đổi sang Semantic Search' : 'Click để đổi sang Fuzzy Search'}
          >
            {searchMode === 'fuzzy' ? 'Fuzzy' : 'Semantic'}
          </button>
        )}
      </div>

      {/* 💡 Auto-suggestions dropdown */}
      {showSuggestions && allSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-50"
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: `1px solid var(--border-primary)`,
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {/* Senders section */}
          {suggestions.senders.length > 0 && (
            <>
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'var(--text-tertiary)',
                  borderBottom: `1px solid var(--border-primary)`,
                }}
              >
                SENDERS
              </div>
              {suggestions.senders.map((sender, idx) => {
                const absoluteIdx = idx;
                const isSelected = selectedSuggestionIndex === absoluteIdx;
                return (
                  <div
                    key={`sender-${idx}`}
                    onClick={() => handleSuggestionClick(sender)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: isSelected
                        ? 'var(--bg-hover)'
                        : 'transparent',
                      borderLeft: isSelected
                        ? `3px solid var(--accent-primary)`
                        : '3px solid transparent',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={() => setSelectedSuggestionIndex(absoluteIdx)}
                    className="hover:bg-opacity-80"
                  >
                    <span style={{ color: 'var(--text-primary)' }}>{sender}</span>
                  </div>
                );
              })}
            </>
          )}

          {/* Subjects section */}
          {suggestions.subjects.length > 0 && (
            <>
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: 'var(--text-tertiary)',
                  borderTop: suggestions.senders.length > 0 ? `1px solid var(--border-primary)` : 'none',
                  borderBottom: `1px solid var(--border-primary)`,
                }}
              >
                SUBJECTS
              </div>
              {suggestions.subjects.map((subject, idx) => {
                const absoluteIdx = suggestions.senders.length + idx;
                const isSelected = selectedSuggestionIndex === absoluteIdx;
                return (
                  <div
                    key={`subject-${idx}`}
                    onClick={() => handleSuggestionClick(subject)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: isSelected
                        ? 'var(--bg-hover)'
                        : 'transparent',
                      borderLeft: isSelected
                        ? `3px solid var(--accent-primary)`
                        : '3px solid transparent',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={() => setSelectedSuggestionIndex(absoluteIdx)}
                    className="hover:bg-opacity-80"
                  >
                    <span style={{ color: 'var(--text-primary)' }}>
                      {subject.length > 50 ? `${subject.substring(0, 50)}...` : subject}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
