/**
 * Kanban Page
 * Full-page Kanban view with app shell (header, search, profile)
 * Integrates seamlessly with existing Inbox layout
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

const Kanban: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSnoozedManager, setShowSnoozedManager] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const queryClient = useQueryClient();

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
              AI Email Flow
            </h1>
          </div>
          
          {/* View Toggle Button */}
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
            onClick={() => navigate('/inbox')}
            aria-label="Switch to traditional inbox view"
          >
            <span className="material-symbols-outlined text-base">view_list</span>
            <span className="hidden sm:inline">Traditional View</span>
          </button>

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

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-2xl mx-8 hidden md:block">
          <div
            className="flex items-center rounded-lg px-4 py-2 transition-all"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
            }}
            onFocus={(e: any) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
            }}
            onBlur={(e: any) => {
              e.currentTarget.style.borderColor = 'var(--border-primary)';
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
              placeholder="Tìm AI: tìm email có nội dung về..."
              className="outline-none w-full text-sm"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-primary)',
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search emails"
            />
          </div>
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
            aria-expanded={showProfileMenu}
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
      <div className="flex-1 overflow-hidden">
        <KanbanBoard key={refreshKey} />
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

export default Kanban;
