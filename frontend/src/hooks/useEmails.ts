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
 * Fetch all emails from backend for Kanban view
 * Fetch from multiple labels to ensure all columns have data, including archived emails
 */
const fetchAllEmails = async (): Promise<Email[]> => {
  try {
    // Fetch from multiple sources in parallel
    // SENT contains archived emails (Done column)
    const [inboxRes, starredRes, importantRes, sentRes] = await Promise.allSettled([
      api.get('/gmail/mailboxes/INBOX/emails'),
      api.get('/gmail/mailboxes/STARRED/emails'),
      api.get('/gmail/mailboxes/IMPORTANT/emails'),
      api.get('/gmail/mailboxes/SENT/emails'), // Archived emails often in SENT
    ]);
    
    const inboxEmails = inboxRes.status === 'fulfilled' ? (inboxRes.value.data.messages || []) : [];
    const starredEmails = starredRes.status === 'fulfilled' ? (starredRes.value.data.messages || []) : [];
    const importantEmails = importantRes.status === 'fulfilled' ? (importantRes.value.data.messages || []) : [];
    const sentEmails = sentRes.status === 'fulfilled' ? (sentRes.value.data.messages || []) : [];
    
    console.log('[fetchAllEmails] INBOX:', inboxEmails.length, '| STARRED:', starredEmails.length, 
                '| IMPORTANT:', importantEmails.length, '| SENT:', sentEmails.length);
    
    // Merge and deduplicate by email ID
    const allEmails = [...inboxEmails, ...starredEmails, ...importantEmails, ...sentEmails];
    const uniqueEmails = Array.from(
      new Map(allEmails.map(e => [e.id, e])).values()
    );
    
    console.log('[fetchAllEmails] Total unique emails:', uniqueEmails.length);
    
    // Debug: Count emails by inferred status
    const statusCounts = { 'Inbox': 0, 'To Do': 0, 'In Progress': 0, 'Done': 0 };
    uniqueEmails.forEach((e: any) => {
      const labels = e.labelIds || [];
      if (labels.includes('IMPORTANT') && labels.includes('INBOX')) {
        statusCounts['In Progress']++;
      } else if (labels.includes('STARRED') && labels.includes('INBOX')) {
        statusCounts['To Do']++;
      } else if (!labels.includes('INBOX') && !labels.includes('TRASH') && !labels.includes('SPAM') && !labels.includes('DRAFT')) {
        statusCounts['Done']++;
      } else {
        statusCounts['Inbox']++;
      }
    });
    console.log('[fetchAllEmails] Status counts:', statusCounts);
    
    return uniqueEmails.map(parseEmail);
  } catch (error: any) {
    console.error('[fetchAllEmails] Error:', error);
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
 * Implements strict priority order: Done > In Progress > To Do > Inbox
 * CRITICAL: Must match backend/src/gmail/gmail.service.ts::inferStatusFromLabels
 * 
 * This ensures emails with multiple labels are deterministically placed
 * in exactly ONE column based on highest priority label.
 */
const inferEmailStatus = (email: Email): EmailStatus => {
  // ALWAYS infer from labelIds (don't trust backend status field)
  const labels = email.labelIds || [];
  
  // PRIORITY 1: In Progress (Important emails in INBOX)
  if (labels.includes('IMPORTANT') && labels.includes('INBOX')) {
    console.log(`[inferEmailStatus] Email ${email.id?.substring(0, 8)} → In Progress (IMPORTANT):`, labels);
    return 'In Progress';
  }
  
  // PRIORITY 2: To Do (Starred emails in INBOX)
  if (labels.includes('STARRED') && labels.includes('INBOX')) {
    console.log(`[inferEmailStatus] Email ${email.id?.substring(0, 8)} → To Do (STARRED):`, labels);
    return 'To Do';
  }
  
  // PRIORITY 3: Done (Archived - not in INBOX, not in TRASH/SPAM)
  // NOTE: These emails won't appear unless we fetch from non-INBOX sources
  if (!labels.includes('INBOX') && 
      !labels.includes('TRASH') && 
      !labels.includes('SPAM') &&
      !labels.includes('DRAFT')) {
    console.log(`[inferEmailStatus] Email ${email.id?.substring(0, 8)} → Done (archived):`, labels);
    return 'Done';
  }
  
  // PRIORITY 4: Inbox (Default - any email with INBOX label)
  console.log(`[inferEmailStatus] Email ${email.id?.substring(0, 8)} → Inbox (default):`, labels);
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
