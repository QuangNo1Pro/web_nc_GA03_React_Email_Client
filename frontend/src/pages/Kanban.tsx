/**
 * Kanban Page
 * Full-page Kanban view with app shell (header, search, profile)
 * Integrates seamlessly with existing Inbox layout
 * Supports both Fuzzy and Semantic search modes
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import KanbanBoard from '../components/KanbanBoard';
import MaterialIcon from '../components/MaterialIcon';
import { IoIosArrowDown } from 'react-icons/io';
import SnoozedManager from '../components/SnoozedManager';
import { useGmailSSE } from '../hooks/useGmailSSE';
import toast from 'react-hot-toast';
import { searchEmails, semanticSearchEmails, SearchResponse } from '../services/searchService';
import { SearchBar } from '../components/SearchBar';
import { useSearchMode } from '../components/SearchModeSelector';

const Kanban: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSnoozedManager, setShowSnoozedManager] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchMode, setSearchMode] = useSearchMode();
  const queryClient = useQueryClient();

  // F1 + F2: Fuzzy search states
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedSearchEmailId, setSelectedSearchEmailId] = useState<string | null>(null);
  const [selectedSearchEmailDetail, setSelectedSearchEmailDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Enable SSE for real-time updates
  const { isConnected: sseConnected } = useGmailSSE(true);

  // Listen for email updates from SSE (unsnooze events)
  useEffect(() => {
    const handleEmailUpdate = (event: any) => {
      console.log('[Kanban] 📧 Email update received:', event.detail);
      if (event.detail?.action === 'unsnooze') {
        const { email, originalStatus } = event.detail;
        console.log('[Kanban] 🔄 Refreshing board due to unsnooze event');
        console.log('[Kanban] Email restored:', email?.subject, '→', originalStatus);
        
        // Invalidate Kanban emails query to refetch
        queryClient.invalidateQueries({ queryKey: ['kanban-emails'] });
        
        // Force component refresh as backup
        setRefreshKey(prev => prev + 1);
        
        toast.success(`Email "${email?.subject}" moved back to ${originalStatus}`, {
          duration: 3000,
        });
      }
    };

    window.addEventListener('email-update', handleEmailUpdate);
    return () => window.removeEventListener('email-update', handleEmailUpdate);
  }, [queryClient]);

  // FEATURE IV: Listen for AI summary generation events
  useEffect(() => {
    const handleSummaryGenerated = (event: any) => {
      console.log('[Kanban] ✨ AI Summary generated:', event.detail);
      const { messageId, summary } = event.detail;
      
      // Update the email in cache with new summary
      queryClient.setQueryData<any[]>(['kanban-emails'], (oldEmails = []) => {
        return oldEmails.map(email => 
          email.id === messageId 
            ? { ...email, summary } 
            : email
        );
      });
      
      toast.success('AI summary generated successfully', {
        duration: 2000,
      });
    };

    window.addEventListener('email-summary-generated', handleSummaryGenerated);
    return () => window.removeEventListener('email-summary-generated', handleSummaryGenerated);
  }, [queryClient]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // F1 + F2: Handle search submit (Enter key)
  const handleSearchSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (!searchQuery.trim()) return;

    console.log('[Kanban] 🔍 Search submit:', searchQuery, 'Mode:', searchMode);
    setIsSearching(true);
    setSearchError(null);

    try {
      // Use appropriate search function based on mode
      const results = searchMode === 'fuzzy'
        ? await searchEmails(searchQuery.trim(), { limit: 100 })
        : await semanticSearchEmails(searchQuery.trim(), { limit: 100 });
      console.log('[Kanban] 📡 Search API response:', results);
      // Unwrap response: { success, data: { total, results } }
      setSearchResults(results.data);
      setIsSearchOpen(true);
    } catch (err: any) {
      console.error('[Kanban] ❌ Search error:', err);
      setSearchError(err.response?.data?.message || 'Search failed');
      toast.error('Search failed. Try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
    setIsSearchOpen(false);
    setSelectedSearchEmailId(null);
    setSelectedSearchEmailDetail(null);
  };

  // Handle selecting email from search results to view detail
  const handleSelectSearchEmail = async (emailId: string) => {
    setSelectedSearchEmailId(emailId);
    setIsLoadingDetail(true);
    try {
      const response = await fetch(`/api/emails/${emailId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to load email');
      const data = await response.json();
      setSelectedSearchEmailDetail(data);
    } catch (err) {
      console.error('[Kanban] Error loading email detail:', err);
      toast.error('Failed to load email detail');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseSearchEmailDetail = () => {
    setSelectedSearchEmailId(null);
    setSelectedSearchEmailDetail(null);
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Header Bar */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-3xl"
              style={{ color: 'var(--accent-primary)' }}
            >
              mail
            </span>
            <h1
              className="text-xl font-bold hidden sm:block"
              style={{ color: 'var(--text-primary)' }}
            >
            React Email Client
            </h1>
          </div>
          
          

          {/* Snoozed Manager Button */}
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onClick={() => setShowSnoozedManager(true)}
            aria-label="View snoozed emails"
          >
            <span className="material-symbols-outlined text-base">schedule</span>
            <span className="hidden sm:inline">Snoozed</span>
          </button>
        </div>

        {/* Center: Search Bar with Auto-Suggestions */}
        <div className="flex-1 max-w-2xl mx-8 hidden md:block">
          <SearchBar
            onSearch={(query) => {
              setSearchQuery(query);
              handleSearchSubmit({ key: 'Enter' } as any);
            }}
            isLoading={isSearching}
            onClear={handleClearSearch}
            placeholder="Tìm email: subject, sender, hoặc nội dung..."
            showModeSelector={true}
          />
        </div>

        {/* Right: Profile Menu */}
        <div className="flex items-center gap-3 relative">
          <button
            className="flex items-center gap-2 rounded-lg p-2 transition-all"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="Profile menu"
            aria-expanded={showProfileMenu ? 'true' : 'false'}
          >
            <img
              src={user?.picture || 'https://www.gravatar.com/avatar?d=mp&s=200'}
              alt="User avatar"
              className="w-8 h-8 rounded-full"
              style={{ border: '1px solid var(--border-primary)' }}
            />
            <span className="hidden sm:inline text-sm font-medium">
              {user?.name || 'User'}
            </span>
            <IoIosArrowDown style={{ color: 'var(--text-tertiary)' }} />
          </button>

          {showProfileMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowProfileMenu(false)}
                aria-hidden="true"
              />
              <div
                className="absolute top-full right-0 mt-2 w-52 rounded-lg shadow-lg border z-20 overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-lg)',
                }}
                role="menu"
              >

                {/* View Toggle Button */}
          <button
                  className="w-full px-4 py-3 flex items-center gap-3 transition-all"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={() => {
                    navigate('/inbox');
                    setShowProfileMenu(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  role="menuitem"
                >
                  <MaterialIcon name="view_list" size={20} />
                  Traditional View
                </button>
                
                <button
                  className="w-full px-4 py-3 flex items-center gap-3 transition-all"
                  style={{ color: 'var(--text-primary)' }}
                  onClick={() => {
                    toggleTheme();
                    setShowProfileMenu(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  role="menuitem"
                >
                  <MaterialIcon
                    name={theme === 'light' ? 'dark_mode' : 'light_mode'}
                    size={20}
                  />
                  {theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
                </button>

                <button
                  className="w-full px-4 py-3 flex items-center gap-3 font-medium transition-all"
                  style={{ color: 'var(--error)' }}
                  onClick={handleLogout}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  role="menuitem"
                >
                  <MaterialIcon name="logout" size={20} />
                  Đăng xuất
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Kanban Board */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Search mode header */}
        {isSearchOpen && (
          <div
            className="border-b px-6 py-3 flex items-center justify-between"
            style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}
          >
            <h2 className="font-semibold">
              Search Results for "<strong>{searchQuery}</strong>" 
              {searchResults && searchResults.total > 0 && (
                <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontWeight: 'normal' }}>
                  ({searchResults.total} emails)
                </span>
              )}
            </h2>
            <button
              onClick={handleClearSearch}
              className="px-3 py-1 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
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
              ← Back to Board
            </button>
          </div>
        )}

        {/* Kanban board - with search results or normal view */}
        <div className="flex-1 overflow-hidden">
          {isSearching ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                <p style={{ color: 'var(--text-secondary)' }}>Searching emails...</p>
              </div>
            </div>
          ) : searchError ? (
            <div className="flex items-center justify-center h-full">
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#dc2626',
                  maxWidth: '400px',
                }}
              >
                <strong>Search Error:</strong> {searchError}
              </div>
            </div>
          ) : (
            <>
              {console.log('[Kanban] 🔍 Passing to KanbanBoard:', { 
                isSearchOpen, 
                searchResults_exists: !!searchResults,
                searchResults_data: searchResults,
                searchResults_results_length: searchResults?.results?.length,
                will_pass_filteredEmails: isSearchOpen ? searchResults?.results : 'UNDEFINED',
                will_pass_isSearchMode: isSearchOpen
              })}
              <KanbanBoard 
                key={refreshKey} 
                filteredEmails={isSearchOpen ? searchResults?.results : undefined}
                isSearchMode={isSearchOpen}
              />
            </>
          )}
        </div>
      </div>

      {/* Snoozed Manager Sidebar */}
      <SnoozedManager
        isOpen={showSnoozedManager}
        onClose={() => setShowSnoozedManager(false)}
        onEmailRestored={() => {
          setRefreshKey((prev) => prev + 1);
          toast.success('✅ Email restored to board');
        }}
      />
    </div>
  );
};

/**
 * SearchResultsOverlay Component
 * Displays fuzzy search results as a full-screen overlay on Kanban view
 * Shows loading, error, and no results states
 */
interface SearchResultsOverlayProps {
  results: any;
  isLoading: boolean;
  error: string | null;
  query: string;
  onClose: () => void;
  selectedEmailId: string | null;
  selectedEmailDetail: any;
  isLoadingDetail: boolean;
  onSelectEmail: (emailId: string) => void;
  onCloseDetail: () => void;
}

const SearchResultsOverlay: React.FC<SearchResultsOverlayProps> = ({
  results,
  isLoading,
  error,
  query,
  onClose,
  selectedEmailId,
  selectedEmailDetail,
  isLoadingDetail,
  onSelectEmail,
  onCloseDetail,
}) => {
  // Debug log
  console.log('[SearchResultsOverlay] Render state:', { 
    isLoading, 
    error, 
    results: results ? { total: results.total, resultCount: results.results?.length } : null,
    selectedEmailId,
    selectedEmailDetail: selectedEmailDetail ? 'loaded' : null
  });

  // If email detail is selected, show detail view
  if (selectedEmailId && selectedEmailDetail && !isLoadingDetail) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Header with back button */}
        <div
          className="flex-shrink-0 border-b px-6 py-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={onCloseDetail}
            className="px-3 py-1 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
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
            ← Back to Results
          </button>
        </div>

        {/* Email detail content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="rounded-lg p-6"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-primary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {selectedEmailDetail.subject || '(No Subject)'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              From: <strong>{selectedEmailDetail.from || selectedEmailDetail.sender}</strong>
            </p>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Date: {selectedEmailDetail.received || selectedEmailDetail.timestamp}
            </p>

            <div
              className="border-t pt-4"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: selectedEmailDetail.body || selectedEmailDetail.snippet || '',
                }}
                style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="flex-shrink-0 border-b px-6 py-4"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            Search Results for "<strong>{query}</strong>"
          </h2>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
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
            ← Back to Board
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p style={{ color: 'var(--text-secondary)' }}>Searching emails...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#dc2626',
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* No Results State */}
        {!isLoading && !error && results && results.total === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="text-5xl mb-3">📭</div>
              <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '500' }}>
                No results found
              </p>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Try different keywords or check the spelling
              </p>
            </div>
          </div>
        )}

        {/* Results Grid */}
        {!isLoading && results && results.total > 0 && (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Found <strong>{results.total}</strong> result{results.total !== 1 ? 's' : ''}
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '16px',
              }}
            >
              {results.results.map((result) => (
                <SearchResultCard 
                  key={result.id} 
                  result={result}
                  onSelectDetail={() => onSelectEmail(result.id)}
                  isSelected={selectedEmailId === result.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Fallback: Show state for debugging */}
        {!isLoading && !error && (!results || results.total === 0) && (
          <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>
            <p>isLoading: {String(isLoading)}</p>
            <p>error: {error || 'null'}</p>
            <p>results: {results ? 'exists' : 'null'}</p>
            {results && <p>results.total: {results.total}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * SearchResultCard Component
 * Card displaying a single search result
 */
const SearchResultCard: React.FC<{ 
  result: any;
  onSelectDetail?: () => void;
  isSelected?: boolean;
}> = ({ result, onSelectDetail, isSelected }) => {
  const getSenderName = (sender: string): string => {
    const match = sender.match(/^([^<]+)</);
    return match ? match[1].trim() : sender.split('@')[0];
  };

  const getSenderEmail = (sender: string): string => {
    const match = sender.match(/<([^>]+)>/);
    return match ? match[1] : sender;
  };

  const getAvatarColor = (): string => {
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
    const text = getSenderName(result.sender);
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const senderName = getSenderName(result.sender);
  const senderEmail = getSenderEmail(result.sender);
  const relevancePercent = Math.round((1 - result.score) * 100);

  const openInGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${result.id}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };
  return (
    <div
      className="rounded-lg p-4 border transition-all hover:shadow-lg cursor-pointer"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
      }}
      onClick={openInGmail}
    >
      {/* Avatar + Sender */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm"
          style={{ backgroundColor: getAvatarColor() }}
        >
          {senderName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }} className="truncate">
            {senderName}
          </h3>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }} className="truncate">
            {senderEmail}
          </p>
        </div>
      </div>

      {/* Subject */}
      <p
        style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '14px', marginBottom: '8px' }}
        className="line-clamp-2"
      >
        {result.subject}
      </p>

      {/* Snippet */}
      {result.snippet && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }} className="line-clamp-2">
          {result.snippet}
        </p>
      )}

      {/* Matched Fields + Relevance */}
      <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
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
        <span
          className="px-2 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
          }}
        >
          {relevancePercent}% match
        </span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 mt-3">
        {onSelectDetail && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectDetail();
            }}
            className="flex-1 py-2 rounded text-sm font-medium transition-colors"
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
            Xem chi tiết
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            openInGmail();
          }}
          className="flex-1 py-2 rounded text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-tertiary)';
          }}
        >
          Gmail
        </button>
      </div>
    </div>
  );
};

export default Kanban;
