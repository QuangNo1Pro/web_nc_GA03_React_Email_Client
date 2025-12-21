/**
 * KanbanBoard Component
 * Main board component that renders all Kanban columns horizontally
 * Responsive and scrollable for multiple columns
 * FEATURE II: Integrated with drag & drop functionality
 * FEATURE III: Integrated with snooze/unsnooze operations
 * FEATURE: Email detail modal integration
 * FEATURE: Dynamic Kanban configuration
 */

import React, { useCallback, useState } from 'react';
import { useEmails } from '../hooks/useEmails';
import { KanbanDndProvider } from '../contexts/KanbanDndContext';
import { EmailStatus } from '../types/email';
import KanbanColumn from './KanbanColumn';
import { snoozeEmail as snoozeEmailAPI, fetchEmail } from '../services/emailService';
import toast from 'react-hot-toast';
import EmailDetailModal from './EmailDetailModal';
import { useNavigate } from 'react-router-dom';

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Date: Newest first' },
  { value: 'date-asc', label: 'Date: Oldest first' },
  { value: 'sender-asc', label: 'Sender: A-Z' },
  { value: 'sender-desc', label: 'Sender: Z-A' },
];

const KanbanBoard: React.FC<{
  filteredEmails?: any[];
  isSearchMode?: boolean;
}> = ({ filteredEmails, isSearchMode }) => {
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    // Filter & Sort state
    const [sortOption, setSortOption] = useState('date-desc');
    const [filterUnread, setFilterUnread] = useState(false);
    const [filterHasAttachment, setFilterHasAttachment] = useState(false);
    const [filterSender, setFilterSender] = useState('');
  const {
    columns,
    emails: allEmails,
    isLoading,
    error,
    optimisticUpdateEmailStatus,
    revertEmailStatus,
    updateEmailFromServer,
    snoozeEmailOptimistic,
    revertSnooze,
    updateEmailSnoozeFromServer,
  } = useEmails();

  const navigate = useNavigate();

  // Email detail modal state
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmailDetail, setSelectedEmailDetail] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [starredState, setStarredState] = useState<{ [id: string]: boolean }>({});
  const [downloadingAttachments, setDownloadingAttachments] = useState<Set<string>>(new Set());
  
  // Hover states for email detail actions
  const [isReplyHoveredDetail, setIsReplyHoveredDetail] = useState(false);
  const [isReplyAllHoveredDetail, setIsReplyAllHoveredDetail] = useState(false);
  const [isForwardHoveredDetail, setIsForwardHoveredDetail] = useState(false);
  const [isMailHoveredDetail, setIsMailHoveredDetail] = useState(false);
  const [isStarHoveredDetail, setIsStarHoveredDetail] = useState(false);
  const [isDeleteHoveredDetail, setIsDeleteHoveredDetail] = useState(false);

  // Handle opening email detail
  const handleOpenEmail = useCallback(async (emailId: string) => {
    setSelectedEmailId(emailId);
    setIsLoadingDetail(true);
    
    try {
      // Fetch full email detail from backend
      const emailDetail = await fetchEmail(emailId);
      
      // Find the email from list for metadata
      const listEmail = allEmails.find(e => e.id === emailId);
      
      // Construct complete email object (similar to Inbox.tsx)
      const completeEmail = {
        ...(listEmail || {}),
        id: emailId,
        body: emailDetail?.body || '',
        attachments: emailDetail?.attachments || [],
        // Backend returns lowercase header keys (headers.from, not headers.From)
        from: emailDetail?.headers?.from || listEmail?.sender || (listEmail as any)?.from,
        to: emailDetail?.headers?.to || listEmail?.to,
        cc: emailDetail?.headers?.cc || listEmail?.cc,
        bcc: emailDetail?.headers?.bcc || listEmail?.bcc,
        subject: emailDetail?.headers?.subject || listEmail?.subject,
        received: emailDetail?.headers?.date || listEmail?.timestamp,
        sender: listEmail?.sender || emailDetail?.headers?.from,
        timestamp: listEmail?.timestamp || emailDetail?.headers?.date,
        read: listEmail?.read ?? emailDetail?.read,
      };
      
      setSelectedEmailDetail(completeEmail);
    } catch (error) {
      console.error('Failed to load email detail:', error);
      toast.error('Failed to load email details', {
        duration: 3000,
        position: 'bottom-right',
      });
      setSelectedEmailId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [allEmails]);

  // Handle closing modal
  const handleCloseModal = useCallback(() => {
    setSelectedEmailId(null);
    setSelectedEmailDetail(null);
  }, []);

  // Email action handlers (placeholder - redirect to inbox for full functionality)
  const handleReply = () => {
    toast('Redirecting to inbox for compose...', { duration: 2000, icon: 'ℹ️' });
    navigate('/inbox');
  };

  const handleReplyAll = () => {
    toast('Redirecting to inbox for compose...', { duration: 2000, icon: 'ℹ️' });
    navigate('/inbox');
  };

  const handleForward = () => {
    toast('Redirecting to inbox for compose...', { duration: 2000, icon: 'ℹ️' });
    navigate('/inbox');
  };

  const handleToggleRead = (id: string) => {
    toast('Mark read/unread - coming soon', { duration: 2000, icon: 'ℹ️' });
  };

  const handleToggleStar = (id: string) => {
    setStarredState(prev => ({ ...prev, [id]: !prev[id] }));
    toast.success(starredState[id] ? 'Unstarred' : 'Starred', { duration: 1500 });
  };

  const handleDeleteEmail = (id: string) => {
    toast('Delete - coming soon', { duration: 2000, icon: 'ℹ️' });
    handleCloseModal();
  };

  const handleDownloadAttachment = (messageId: string, attachment: any) => {
    toast('Download attachment - coming soon', { duration: 2000, icon: 'ℹ️' });
  };

  // FEATURE III: Handle snooze action
  const handleSnooze = useCallback(async (
    emailId: string,
    snoozedUntil: string,
    simulate: boolean
  ) => {
    // Find email to get original status
    const email = allEmails.find(e => e.id === emailId);
    if (!email) return;

    const originalStatus = email.status || 'Inbox';

    // Optimistic update - hide email immediately
    snoozeEmailOptimistic(emailId, snoozedUntil, originalStatus);

    try {
      // Call backend API
      const updatedEmail = await snoozeEmailAPI(emailId, snoozedUntil, simulate);

      // Success - update with server response
      updateEmailSnoozeFromServer(updatedEmail);

      // Format snooze time for toast
      const snoozeDate = new Date(snoozedUntil);
      const timeStr = simulate 
        ? 'in 30 seconds (demo)'
        : snoozeDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });

      toast.success(`Snoozed until ${timeStr}`, {
        duration: 3000,
        position: 'bottom-right',
        icon: '⏰',
      });

    } catch (error: any) {
      // Error - revert optimistic update
      console.error('Failed to snooze email:', error);
      revertSnooze(emailId, originalStatus);

      const errorMessage = error?.response?.data?.message || 'Failed to snooze email';
      toast.error(`${errorMessage} - Reverted`, {
        duration: 4000,
        position: 'bottom-right',
      });
    }
  }, [allEmails, snoozeEmailOptimistic, updateEmailSnoozeFromServer, revertSnooze]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading emails...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-6">
          <span className="material-symbols-outlined text-red-500 text-6xl">
            error
          </span>
          <h3 className="text-lg font-semibold text-gray-900">
            Failed to load emails
          </h3>
          <p className="text-sm text-gray-600">
            {error instanceof Error ? error.message : 'An error occurred while fetching emails'}
          </p>
          <button
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Main board: chia đều các cột, không thừa khoảng trống
  // FEATURE II: Wrapped with DnD provider for drag & drop
  // FEATURE III: Pass handleSnooze callback to columns
  
  // Fallback columns in case useEmails hook hasn't loaded yet
  const fallbackColumns = [
    { id: 'Inbox' as const, title: 'Inbox', color: 'border-l-blue-500', emails: [] },
    { id: 'To Do' as const, title: 'To Do', color: 'border-l-yellow-500', emails: [] },
    { id: 'In Progress' as const, title: 'In Progress', color: 'border-l-purple-500', emails: [] },
    { id: 'Done' as const, title: 'Done', color: 'border-l-green-500', emails: [] },
  ];
  
  const activeColumns = columns && columns.length > 0 ? columns : fallbackColumns;
  
  // Chuẩn hóa và filter/sort email
  const normalizeAndFilterSortEmails = (emails: any[]) => {
    let arr = emails.map(result => {
      const existingEmail = allEmails.find(e => e.id === result.id);
      return {
        id: result.id || result._id || '',
        sender: result.sender || 'Unknown',
        subject: result.subject || '(No subject)',
        snippet: result.snippet || '',
        timestamp: result.timestamp || Date.now(),
        summary: result.summary || '',
        read: result.read ?? false,
        starred: result.starred ?? false,
        score: result.score,
        matchedFields: result.matchedFields,
        status: existingEmail?.status || 'Inbox',
        attachments: result.attachments || existingEmail?.attachments || [],
        ...result,
      };
    });
    // Filter
    if (filterUnread) arr = arr.filter(e => !e.read);
    if (filterHasAttachment) arr = arr.filter(e => (e.attachments && e.attachments.length > 0));
    if (filterSender.trim()) arr = arr.filter(e => e.sender?.toLowerCase().includes(filterSender.trim().toLowerCase()));
    // Sort
    arr = arr.slice();
    arr.sort((a, b) => {
      if (sortOption === 'date-desc') return b.timestamp - a.timestamp;
      if (sortOption === 'date-asc') return a.timestamp - b.timestamp;
      if (sortOption === 'sender-asc') return (a.sender || '').localeCompare(b.sender || '');
      if (sortOption === 'sender-desc') return (b.sender || '').localeCompare(a.sender || '');
      return 0;
    });
    return arr;
  };

  const normalizedFilteredEmails = filteredEmails ? normalizeAndFilterSortEmails(filteredEmails) : [];

  console.log('[KanbanBoard] Search results with status:', {
    totalEmails: normalizedFilteredEmails.length,
    byStatus: {
      Inbox: normalizedFilteredEmails.filter(e => e.status === 'Inbox').length,
      'To Do': normalizedFilteredEmails.filter(e => e.status === 'To Do').length,
      'In Progress': normalizedFilteredEmails.filter(e => e.status === 'In Progress').length,
      Done: normalizedFilteredEmails.filter(e => e.status === 'Done').length,
    }
  });
  
  const displayColumns = isSearchMode && filteredEmails
    ? activeColumns.map(col => {
        const emailsForCol = normalizedFilteredEmails.filter(e => e.status === col.id);
        return {
          ...col,
          emails: emailsForCol,
        };
      })
    : activeColumns.map(col => {
        // Áp dụng filter/sort cho emails từng cột khi không search
        let emails = col.emails;
        if (filterUnread) emails = emails.filter(e => !e.read);
        if (filterHasAttachment) emails = emails.filter(e => (e.attachments && e.attachments.length > 0));
        if (filterSender.trim()) emails = emails.filter(e => e.sender?.toLowerCase().includes(filterSender.trim().toLowerCase()));
        emails = emails.slice();
        emails.sort((a, b) => {
          if (sortOption === 'date-desc') return b.timestamp - a.timestamp;
          if (sortOption === 'date-asc') return a.timestamp - b.timestamp;
          if (sortOption === 'sender-asc') return (a.sender || '').localeCompare(b.sender || '');
          if (sortOption === 'sender-desc') return (b.sender || '').localeCompare(a.sender || '');
          return 0;
        });
        return { ...col, emails };
      });

  // If in search mode with filtered emails, organize them into columns by status
  // Search results don't have status field, so distribute them across all columns evenly
  // or show all in INBOX by default
  console.log('[KanbanBoard] Render:', { 
    isSearchMode, 
    filteredEmailsCount: filteredEmails?.length,
    columnsCount: columns?.length,
    displayColumnsCount: displayColumns.length,
    columnsIds: columns?.map(c => c.id),
    displayCondition: isSearchMode && filteredEmails,
    displayColumnsInbox: displayColumns.find(c => c.id === 'Inbox')?.emails?.length || 0,
    filteredEmailsSample: filteredEmails?.slice(0, 2)
  });

  return (
    <>
      {/* Filter & Sort Controls - UI đồng bộ, tinh tế hơn */}
      <div className="flex flex-wrap gap-3 items-center px-6 pt-2 pb-2 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
        <div className="flex gap-2 items-center bg-[var(--bg-primary)] rounded-lg px-2 py-1 shadow-sm border border-[var(--border-primary)] hover:shadow-md transition">
          <span className="material-symbols-outlined text-blue-400 text-sm mr-1">sort</span>
          <label className="font-semibold text-xs mr-1 text-[var(--text-secondary)]">Sort:</label>
          <select
            className="border border-blue-100 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-200 outline-none transition bg-[var(--bg-primary)] text-[var(--text-primary)]"
            value={sortOption}
            onChange={e => setSortOption(e.target.value)}
            aria-label="Sort emails"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center bg-[var(--bg-primary)] rounded-lg px-2 py-1 shadow-sm border border-[var(--border-primary)] hover:shadow-md transition">
          <span className="material-symbols-outlined text-green-400 text-sm mr-1">filter_alt</span>
          <label className="text-xs flex items-center text-[var(--text-secondary)]">
            <input type="checkbox" className="mr-1 accent-blue-400" checked={filterUnread} onChange={e => setFilterUnread(e.target.checked)} />
            <span className="font-medium">Unread</span>
          </label>
          <label className="text-xs flex items-center text-[var(--text-secondary)]">
            <input type="checkbox" className="mr-1 accent-purple-400" checked={filterHasAttachment} onChange={e => setFilterHasAttachment(e.target.checked)} />
            <span className="font-medium">Attachment</span>
          </label>
        </div>
        <div className="flex gap-2 items-center bg-[var(--bg-primary)] rounded-lg px-2 py-1 shadow-sm border border-[var(--border-primary)] hover:shadow-md transition">
          <span className="material-symbols-outlined text-orange-400 text-sm mr-1">person_search</span>
          <label className="font-semibold text-xs mr-1 text-[var(--text-secondary)]">From:</label>
          <input
            className="border border-orange-100 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-orange-200 outline-none transition bg-[var(--bg-primary)] text-[var(--text-primary)]"
            type="text"
            placeholder="Sender name/email"
            value={filterSender}
            onChange={e => setFilterSender(e.target.value)}
            aria-label="Filter by sender"
            style={{ minWidth: 100 }}
          />
        </div>
        {(filterUnread || filterHasAttachment || filterSender) && (
          <button
            className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 font-semibold shadow-sm hover:bg-blue-200 transition border border-blue-100 flex items-center gap-1"
            onClick={() => { setFilterUnread(false); setFilterHasAttachment(false); setFilterSender(''); }}
          >
            <span className="material-symbols-outlined text-xs align-middle">close</span>
            Clear
          </button>
        )}
        
        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition border border-gray-200 dark:border-gray-600 flex items-center gap-1.5"
          title="Kanban Settings"
        >
          <span className="material-symbols-outlined text-sm">settings</span>
          Settings
        </button>
      </div>
      
      <KanbanDndProvider
        emails={allEmails}
        onEmailMove={(emailId, newStatus) => {
          optimisticUpdateEmailStatus(emailId, newStatus);
        }}
        onEmailMoveSuccess={(updatedEmail) => {
          updateEmailFromServer(updatedEmail);
        }}
        onEmailMoveError={(emailId, previousStatus) => {
          revertEmailStatus(emailId, previousStatus);
        }}
      >
        <div
          className="grid h-full w-full bg-gray-100"
          style={{
            gridTemplateColumns: `repeat(${displayColumns.length}, 1fr)`,
            gap: '24px', // khoảng cách giữa các cột
            padding: '24px',
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
          role="main"
          aria-label="Kanban board"
        >
          {displayColumns.map((column) => (
            <KanbanColumn 
              key={column.id} 
              column={column}
              onSnooze={handleSnooze}
              onOpenEmail={handleOpenEmail}
            />
          ))}
        </div>
      </KanbanDndProvider>

      {/* Email Detail Modal */}
      {selectedEmailId && (
        <EmailDetailModal
          isOpen={true}
          onClose={handleCloseModal}
          email={selectedEmailDetail}
          starredState={starredState}
          isReplyHoveredDetail={isReplyHoveredDetail}
          isReplyAllHoveredDetail={isReplyAllHoveredDetail}
          isForwardHoveredDetail={isForwardHoveredDetail}
          isMailHoveredDetail={isMailHoveredDetail}
          isStarHoveredDetail={isStarHoveredDetail}
          isDeleteHoveredDetail={isDeleteHoveredDetail}
          downloadingAttachments={downloadingAttachments}
          handleReply={handleReply}
          handleReplyAll={handleReplyAll}
          handleForward={handleForward}
          handleToggleRead={handleToggleRead}
          handleToggleStar={handleToggleStar}
          handleDeleteEmail={handleDeleteEmail}
          handleDownloadAttachment={handleDownloadAttachment}
          setIsReplyHoveredDetail={setIsReplyHoveredDetail}
          setIsReplyAllHoveredDetail={setIsReplyAllHoveredDetail}
          setIsForwardHoveredDetail={setIsForwardHoveredDetail}
          setIsMailHoveredDetail={setIsMailHoveredDetail}
          setIsStarHoveredDetail={setIsStarHoveredDetail}
          setIsDeleteHoveredDetail={setIsDeleteHoveredDetail}
        />
      )}
    </>
  );
};

export default KanbanBoard;
