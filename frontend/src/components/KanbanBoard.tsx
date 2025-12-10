/**
 * KanbanBoard Component
 * Main board component that renders all Kanban columns horizontally
 * Responsive and scrollable for multiple columns
 * FEATURE II: Integrated with drag & drop functionality
 * FEATURE III: Integrated with snooze/unsnooze operations
 * FEATURE: Email detail modal integration
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

const KanbanBoard: React.FC = () => {
  const {
    columns,
    emails,
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
      const listEmail = emails.find(e => e.id === emailId);
      
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
  }, [emails]);

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
    const email = emails.find(e => e.id === emailId);
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
  }, [emails, snoozeEmailOptimistic, updateEmailSnoozeFromServer, revertSnooze]);

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
  return (
    <>
      <KanbanDndProvider
        emails={emails}
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
            gridTemplateColumns: `repeat(${columns.length}, 1fr)`,
            gap: '24px', // khoảng cách giữa các cột
            padding: '24px',
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
          role="main"
          aria-label="Kanban board"
        >
          {columns.map((column) => (
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
