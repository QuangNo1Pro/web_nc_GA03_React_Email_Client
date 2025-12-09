/**
 * useEmails Hook
 * Fetches all emails from backend and groups them by status for Kanban view
 * Handles loading, error states, and provides grouped email data
 * FEATURE II: Supports optimistic updates for drag & drop
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { Email, EmailStatus, KanbanColumn } from '../types/email';
import { parseEmail } from '../utils/emailUtils';

/**
 * Fetch all emails from backend
 * Fetches from INBOX as the primary source for Kanban view
 */
const fetchAllEmails = async (): Promise<Email[]> => {
  try {
    // Fetch from INBOX as primary source for Kanban board
    const { data } = await api.get('/gmail/mailboxes/INBOX/emails');
    return data.messages?.map(parseEmail) || [];
  } catch (error: any) {
    console.error('Failed to fetch emails:', error);
    throw error;
  }
};

/**
 * Convert status to Gmail labelIds (matches backend statusToLabelsMap)
 * CRITICAL: Must match backend/src/gmail/gmail.service.ts logic exactly
 */
const getLabelsForStatus = (status: EmailStatus): string[] => {
  switch (status) {
    case 'Inbox':
      return ['INBOX'];
    case 'To Do':
      return ['INBOX', 'STARRED'];
    case 'In Progress':
      return ['INBOX', 'IMPORTANT'];
    case 'Done':
      // Archived: removed from INBOX
      return [];
    case 'Snoozed':
      return ['INBOX'];
    default:
      return ['INBOX'];
  }
};

/**
 * Map Gmail labels to Kanban status
 * Backend may not have explicit "status" field, so we infer from labelIds
 */
const inferEmailStatus = (email: Email): EmailStatus => {
  // If backend provides explicit status field, use it
  if (email.status) {
    return email.status;
  }

  // Otherwise, infer from labelIds
  const labels = email.labelIds || [];
  
  // Priority order: STARRED > IMPORTANT > No INBOX (Done) > Default (Inbox)
  if (labels.includes('STARRED') && labels.includes('INBOX')) return 'To Do';
  if (labels.includes('IMPORTANT') && labels.includes('INBOX')) return 'In Progress';
  if (!labels.includes('INBOX') && !labels.includes('TRASH') && !labels.includes('SPAM')) return 'Done'; // Archived
  
  // Default to Inbox for all other emails
  return 'Inbox';
};

/**
 * Column configuration
 * Can be modified to add/remove columns or change colors
 */
export const KANBAN_COLUMNS: Array<{ id: EmailStatus; title: string; color: string }> = [
  { id: 'Inbox', title: 'INBOX', color: 'border-l-blue-500' },
  { id: 'To Do', title: 'TO DO', color: 'border-l-yellow-500' },
  { id: 'In Progress', title: 'IN PROGRESS', color: 'border-l-orange-500' },
  { id: 'Done', title: 'DONE', color: 'border-l-green-500' },
];

export const useEmails = () => {
  const queryClient = useQueryClient();
  
  const {
    data: emails = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Email[]>({
    queryKey: ['kanban-emails'],
    queryFn: fetchAllEmails,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Group emails by status into columns
   * Memoized to prevent unnecessary recalculations
   * FEATURE III: Exclude snoozed emails from active columns
   */
  const groupedEmails = useMemo((): KanbanColumn[] => {
    const grouped = KANBAN_COLUMNS.map(column => ({
      ...column,
      emails: [] as Email[],
    }));

    emails.forEach(email => {
      // FEATURE III: Skip snoozed emails unless viewing Snoozed column
      // (Snoozed emails are hidden from all active columns)
      if (email.snoozed) {
        // Only show in Snoozed column (if it exists in KANBAN_COLUMNS)
        const snoozedColumn = grouped.find(col => col.id === 'Snoozed');
        if (snoozedColumn) {
          snoozedColumn.emails.push(email);
        }
        return;
      }

      const status = inferEmailStatus(email);
      const column = grouped.find(col => col.id === status);
      if (column) {
        column.emails.push(email);
      }
    });

    return grouped;
  }, [emails]);

  /**
   * FEATURE II: Optimistic update - move email to new status immediately
   * Used when drag & drop happens, before backend confirms
   * CRITICAL: Updates both status AND labelIds to keep inference consistent
   */
  const optimisticUpdateEmailStatus = useCallback((
    emailId: string,
    newStatus: EmailStatus
  ) => {
    queryClient.setQueryData<Email[]>(['kanban-emails'], (oldEmails = []) => {
      // DEEP CLONE: Create entirely new array with new email objects
      return oldEmails.map(email => {
        if (email.id !== emailId) {
          // Return NEW object for unchanged emails (prevents reference reuse)
          return { ...email };
        }
        
        // Update the moved email with new status AND correct labelIds
        const newLabelIds = getLabelsForStatus(newStatus);
        return {
          ...email,
          status: newStatus,
          labelIds: newLabelIds,
        };
      });
    });
  }, [queryClient]);

  /**
   * FEATURE II: Revert optimistic update on error
   * Restores email to previous status if backend update fails
   * CRITICAL: Restores both status AND labelIds
   */
  const revertEmailStatus = useCallback((
    emailId: string,
    previousStatus: EmailStatus
  ) => {
    queryClient.setQueryData<Email[]>(['kanban-emails'], (oldEmails = []) => {
      // DEEP CLONE: Create entirely new array with new email objects
      return oldEmails.map(email => {
        if (email.id !== emailId) {
          // Return NEW object for unchanged emails (prevents reference reuse)
          return { ...email };
        }
        
        // Restore the reverted email with previous status AND correct labelIds
        const previousLabelIds = getLabelsForStatus(previousStatus);
        return {
          ...email,
          status: previousStatus,
          labelIds: previousLabelIds,
        };
      });
    });
  }, [queryClient]);

  /**
   * FEATURE II: Update email with server response after successful move
   * CRITICAL: Merge ONLY specific fields to avoid overwriting UI state with stale data
   */
  const updateEmailFromServer = useCallback((updatedEmail: Email) => {
    queryClient.setQueryData<Email[]>(['kanban-emails'], (oldEmails = []) => {
      // DEEP CLONE: Create entirely new array with new email objects
      return oldEmails.map(email => {
        if (email.id !== updatedEmail.id) {
          // Return NEW object for unchanged emails (prevents reference reuse)
          return { ...email };
        }
        
        // Merge ONLY status and labelIds from server (keep other fields from UI)
        return {
          ...email,
          status: updatedEmail.status,
          labelIds: updatedEmail.labelIds,
        };
      });
    });
  }, [queryClient]);

  /**
   * FEATURE III: Snooze email (optimistic update)
   * Immediately hide email from active columns
   */
  const snoozeEmailOptimistic = useCallback((
    emailId: string,
    snoozedUntil: string,
    originalStatus: EmailStatus
  ) => {
    queryClient.setQueryData<Email[]>(['kanban-emails'], (oldEmails = []) => {
      return oldEmails.map(email => {
        if (email.id !== emailId) {
          return { ...email };
        }
        
        return {
          ...email,
          status: 'Snoozed',
          snoozed: true,
          snoozedUntil,
          snoozedFromStatus: originalStatus,
        };
      });
    });
  }, [queryClient]);

  /**
   * FEATURE III: Unsnooze email (optimistic update)
   * Restore email to original status
   */
  const unsnoozeEmailOptimistic = useCallback((emailId: string, restoreStatus: EmailStatus) => {
    queryClient.setQueryData<Email[]>(['kanban-emails'], (oldEmails = []) => {
      return oldEmails.map(email => {
        if (email.id !== emailId) {
          return { ...email };
        }
        
        return {
          ...email,
          status: restoreStatus,
          snoozed: false,
          snoozedUntil: null,
          snoozedFromStatus: null,
        };
      });
    });
  }, [queryClient]);

  /**
   * FEATURE III: Revert snooze on error
   */
  const revertSnooze = useCallback((emailId: string, previousStatus: EmailStatus) => {
    queryClient.setQueryData<Email[]>(['kanban-emails'], (oldEmails = []) => {
      return oldEmails.map(email => {
        if (email.id !== emailId) {
          return { ...email };
        }
        
        return {
          ...email,
          status: previousStatus,
          snoozed: false,
          snoozedUntil: null,
          snoozedFromStatus: null,
        };
      });
    });
  }, [queryClient]);

  /**
   * FEATURE III: Update email with server response after snooze/unsnooze
   * CRITICAL: Merge ALL fields from server to preserve metadata (sender, subject, snippet)
   * If email not found (unsnooze case), ADD it to the cache
   */
  const updateEmailSnoozeFromServer = useCallback((updatedEmail: Email) => {
    queryClient.setQueryData<Email[]>(['kanban-emails'], (oldEmails = []) => {
      const emailIndex = oldEmails.findIndex(e => e.id === updatedEmail.id);
      
      if (emailIndex === -1) {
        // Email not in cache (was snoozed) - ADD it
        console.log('[useEmails] Adding unsnoozed email to cache:', updatedEmail.id);
        return [...oldEmails, updatedEmail];
      }
      
      // Email exists - UPDATE it
      return oldEmails.map(email => {
        if (email.id !== updatedEmail.id) {
          return { ...email };
        }
        
        // Merge ALL fields from server response to preserve full email data
        // This ensures sender, subject, snippet, body are not lost
        return {
          ...email,
          ...updatedEmail, // Merge everything from server
          // Preserve any UI-only fields if needed
        };
      });
    });
  }, [queryClient]);

  return {
    columns: groupedEmails,
    emails,
    isLoading,
    error,
    refetch,
    // Feature II: Drag & drop helpers
    optimisticUpdateEmailStatus,
    revertEmailStatus,
    updateEmailFromServer,
    // Feature III: Snooze helpers
    snoozeEmailOptimistic,
    unsnoozeEmailOptimistic,
    revertSnooze,
    updateEmailSnoozeFromServer,
  };
};
