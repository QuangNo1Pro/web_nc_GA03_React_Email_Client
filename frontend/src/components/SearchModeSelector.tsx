/**
 * SearchModeSelector Component
 * Toggle between Fuzzy Search and Semantic Search modes
 * Preference is saved to localStorage
 */

import React, { useState, useEffect } from 'react';
import { Zap, Brain } from 'lucide-react';

export type SearchMode = 'fuzzy' | 'semantic';

interface SearchModeSelectorProps {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
  size?: 'sm' | 'md';
}

const STORAGE_KEY = 'search-mode-preference';

export function SearchModeSelector({ mode, onChange, size = 'md' }: SearchModeSelectorProps) {
  const handleToggle = (newMode: SearchMode) => {
    onChange(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  const isSm = size === 'sm';

  return (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 inline-flex">
      {/* Fuzzy Search Button */}
      <button
        onClick={() => handleToggle('fuzzy')}
        className={`flex items-center gap-2 px-3 py-2 rounded transition-all ${
          mode === 'fuzzy'
            ? 'bg-blue-500 text-white shadow-md'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        } ${isSm ? 'text-xs' : 'text-sm'}`}
        title="Fuzzy Search: Fast, typo-tolerant keyword matching"
      >
        <Zap size={isSm ? 14 : 16} />
        <span className={isSm ? 'hidden sm:inline' : ''}>Fuzzy</span>
      </button>

      {/* Semantic Search Button */}
      <button
        onClick={() => handleToggle('semantic')}
        className={`flex items-center gap-2 px-3 py-2 rounded transition-all ${
          mode === 'semantic'
            ? 'bg-purple-500 text-white shadow-md'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        } ${isSm ? 'text-xs' : 'text-sm'}`}
        title="Semantic Search: AI-powered meaning-based search"
      >
        <Brain size={isSm ? 14 : 16} />
        <span className={isSm ? 'hidden sm:inline' : ''}>Semantic</span>
      </button>
    </div>
  );
}

/**
 * Hook to get and persist search mode preference
 */
export function useSearchMode(): [SearchMode, (mode: SearchMode) => void] {
  const [mode, setMode] = useState<SearchMode>('semantic');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SearchMode | null;
    if (saved === 'fuzzy' || saved === 'semantic') {
      setMode(saved);
    }
    setIsLoaded(true);
  }, []);

  const handleChange = (newMode: SearchMode) => {
    setMode(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  return [mode, handleChange];
}
