/**
 * useEmails Hook
 * Fetches all emails from backend and groups them by status for Kanban view
 * Handles loading, error states, and provides grouped email data
 * FEATURE II: Supports optimistic updates for drag & drop
 * FEATURE III: Supports dynamic Kanban column configuration
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { Email, EmailStatus, KanbanColumn } from '../types/email';
import { parseEmail } from '../utils/emailUtils';
import { KanbanColumnConfig, DEFAULT_COLUMNS } from '../utils/kanbanConstants';

/**
 * Fetch all emails from backend for Kanban view
 * Dynamically fetch from labels based on column configuration
 * @param columnLabels - Array of Gmail labels to fetch from (derived from columns)
 */
const fetchAllEmails = async (columnLabels: string[] = []): Promise<Email[]> => {
  try {
    // Base labels that we always fetch from
    const baseLabels = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT'];

    // Combine with column-specific labels (SPAM, TRASH, etc)
    const allLabels = [...new Set([...baseLabels, ...columnLabels])];

    // Filter out ARCHIVED as it's not a real Gmail label
    const labelsToFetch = allLabels.filter(l => l !== 'ARCHIVED');

    console.log('[fetchAllEmails] Fetching from labels:', labelsToFetch);

    // Fetch from all labels in parallel
    const fetchPromises = labelsToFetch.map(label =>
      api.get(`/gmail/mailboxes/${label}/emails`).catch(err => {
        console.warn(`[fetchAllEmails] Failed to fetch ${label}:`, err.message);
        return { data: { messages: [] } };
      })
    );

    const results = await Promise.allSettled(fetchPromises);

    // Collect all emails from results
    const emailsByLabel: Record<string, any[]> = {};
    let allEmails: any[] = [];

    results.forEach((result, index) => {
      const label = labelsToFetch[index];
      if (result.status === 'fulfilled') {
        const emails = result.value.data?.messages || [];
        emailsByLabel[label] = emails;
        allEmails = [...allEmails, ...emails];
      } else {
        emailsByLabel[label] = [];
      }
    });

    // Log counts per label
    const labelCounts = Object.entries(emailsByLabel)
      .map(([label, emails]) => `${label}: ${emails.length}`)
      .join(' | ');
    console.log('[fetchAllEmails]', labelCounts);

    // Deduplicate by email ID
    const uniqueEmails = Array.from(
      new Map(allEmails.map(e => [e.id, e])).values()
    );

    console.log('[fetchAllEmails] Total unique emails:', uniqueEmails.length);

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
 * Default column configuration (for backward compatibility)
 * @deprecated Use dynamic columns from useKanbanColumns hook instead
 */
export const KANBAN_COLUMNS: Array<{ id: EmailStatus; title: string; color: string; gmailLabel?: string }> = [
  { id: 'Inbox', title: 'INBOX', color: 'border-l-blue-500', gmailLabel: 'INBOX' },
  { id: 'To Do', title: 'TO DO', color: 'border-l-yellow-500', gmailLabel: 'STARRED' },
  { id: 'In Progress', title: 'IN PROGRESS', color: 'border-l-orange-500', gmailLabel: 'IMPORTANT' },
  { id: 'Done', title: 'DONE', color: 'border-l-green-500', gmailLabel: 'ARCHIVED' },
];

/**
 * Infer email status based on dynamic column configuration
 * Uses Gmail labels to determine which column an email belongs to
 * 
 * Priority order:
 * 1. TRASH - emails in trash folder
 * 2. SPAM - emails in spam folder  
 * 3. ARCHIVED - emails not in INBOX (and not in TRASH/SPAM)
 * 4. IMPORTANT - in progress emails
 * 5. STARRED - to do emails
 * 6. Other labels
 * 7. INBOX - default inbox
 */
const inferEmailStatusDynamic = (
  email: Email,
  columnConfig: KanbanColumnConfig[]
): EmailStatus => {
  const labels = email.labelIds || [];

  // PRIORITY 1: TRASH - highest priority (explicit trash action)
  const trashColumn = columnConfig.find(col => col.gmailLabel === 'TRASH');
  if (trashColumn && labels.includes('TRASH')) {
    return trashColumn.id;
  }

  // PRIORITY 2: SPAM - second highest (explicit spam)
  const spamColumn = columnConfig.find(col => col.gmailLabel === 'SPAM');
  if (spamColumn && labels.includes('SPAM')) {
    return spamColumn.id;
  }

  // PRIORITY 3: Archived (Done) - not in INBOX, TRASH, SPAM, DRAFT
  const archivedColumn = columnConfig.find(col => col.gmailLabel === 'ARCHIVED');
  if (archivedColumn) {
    if (!labels.includes('INBOX') &&
      !labels.includes('TRASH') &&
      !labels.includes('SPAM') &&
      !labels.includes('DRAFT')) {
      return archivedColumn.id;
    }
  }

  // PRIORITY 4: IMPORTANT (In Progress) - must also be in INBOX
  const importantColumn = columnConfig.find(col => col.gmailLabel === 'IMPORTANT');
  if (importantColumn && labels.includes('IMPORTANT') && labels.includes('INBOX')) {
    return importantColumn.id;
  }

  // PRIORITY 5: STARRED (To Do) - must also be in INBOX
  const starredColumn = columnConfig.find(col => col.gmailLabel === 'STARRED');
  if (starredColumn && labels.includes('STARRED') && labels.includes('INBOX')) {
    return starredColumn.id;
  }

  // PRIORITY 6: Other category labels (custom columns)
  for (const column of columnConfig) {
    if (column.gmailLabel &&
      column.gmailLabel !== 'INBOX' &&
      column.gmailLabel !== 'ARCHIVED' &&
      column.gmailLabel !== 'STARRED' &&
      column.gmailLabel !== 'IMPORTANT' &&
      column.gmailLabel !== 'TRASH' &&
      column.gmailLabel !== 'SPAM') {
      if (labels.includes(column.gmailLabel)) {
        return column.id;
      }
    }
  }

  // PRIORITY 7: Inbox column (default - must have INBOX label)
  const inboxColumn = columnConfig.find(col => col.gmailLabel === 'INBOX');
  if (inboxColumn && labels.includes('INBOX')) {
    return inboxColumn.id;
  }

  // Fallback: first column
  return columnConfig[0]?.id || 'Inbox';
};

export interface UseEmailsOptions {
  columnConfig?: KanbanColumnConfig[];
}

export const useEmails = (options: UseEmailsOptions = {}) => {
  const { columnConfig = DEFAULT_COLUMNS } = options;
  const queryClient = useQueryClient();

  // Extract Gmail labels from column config for fetching
  const columnLabels = useMemo(() => {
    return columnConfig
      .map(col => col.gmailLabel)
      .filter((label): label is string => !!label);
  }, [columnConfig]);

  const {
    data: emails = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Email[]>({
    queryKey: ['kanban-emails', columnLabels.sort().join(',')],
    queryFn: () => fetchAllEmails(columnLabels),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Group emails by status into columns
   * Memoized to prevent unnecessary recalculations
   * FEATURE III: Exclude snoozed emails from active columns
   * FEATURE III: Uses dynamic column configuration
   */
  const groupedEmails = useMemo((): KanbanColumn[] => {
    // Use dynamic column config
    const grouped: KanbanColumn[] = columnConfig.map(column => ({
      id: column.id,
      title: column.title,
      color: column.color,
      gmailLabel: column.gmailLabel,
      emails: [] as Email[],
    }));

    emails.forEach(email => {
      // FEATURE III: Skip snoozed emails unless viewing Snoozed column
      // (Snoozed emails are hidden from all active columns)
      if (email.snoozed) {
        // Only show in Snoozed column (if it exists)
        const snoozedColumn = grouped.find(col => col.id === 'Snoozed' || col.gmailLabel === 'SNOOZED');
        if (snoozedColumn) {
          snoozedColumn.emails.push(email);
        }
        return;
      }

      // Use dynamic status inference
      const status = inferEmailStatusDynamic(email, columnConfig);
      const column = grouped.find(col => col.id === status);
      if (column) {
        column.emails.push(email);
      }
    });

    return grouped;
  }, [emails, columnConfig]);

  /**
   * Get labelIds for a column based on its gmailLabel
   * Used for optimistic updates to keep inference consistent
   */
  const getLabelsForColumn = useCallback((columnId: string): string[] => {
    const column = columnConfig.find(col => col.id === columnId);
    if (!column?.gmailLabel) return ['INBOX'];

    const labelMappings: Record<string, string[]> = {
      'INBOX': ['INBOX'],
      'STARRED': ['INBOX', 'STARRED'],
      'IMPORTANT': ['INBOX', 'IMPORTANT'],
      'ARCHIVED': [], // Remove from INBOX
      'SPAM': ['SPAM'],
      'TRASH': ['TRASH'],
    };

    return labelMappings[column.gmailLabel] || [column.gmailLabel];
  }, [columnConfig]);

  /**
   * FEATURE II: Optimistic update - move email to new status immediately
   * Used when drag & drop happens, before backend confirms
   * CRITICAL: Updates both status AND labelIds to keep inference consistent
   */
  const optimisticUpdateEmailStatus = useCallback((
    emailId: string,
    newStatus: EmailStatus
  ) => {
    queryClient.setQueryData<Email[]>(['kanban-emails', columnLabels.sort().join(',')], (oldEmails = []) => {
      // DEEP CLONE: Create entirely new array with new email objects
      return oldEmails.map(email => {
        if (email.id !== emailId) {
          // Return NEW object for unchanged emails (prevents reference reuse)
          return { ...email };
        }

        // Update the moved email with new status AND correct labelIds
        // Use dynamic column config instead of static mapping
        const newLabelIds = getLabelsForColumn(newStatus);
        console.log(`[optimisticUpdate] ${emailId.substring(0, 8)} → ${newStatus}, labels:`, newLabelIds);

        return {
          ...email,
          status: newStatus,
          labelIds: newLabelIds,
        };
      });
    });
  }, [queryClient, columnLabels, getLabelsForColumn]);

  /**
   * FEATURE II: Revert optimistic update on error
   * Restores email to previous status if backend update fails
   * CRITICAL: Restores both status AND labelIds
   */
  const revertEmailStatus = useCallback((
    emailId: string,
    previousStatus: EmailStatus
  ) => {
    queryClient.setQueryData<Email[]>(['kanban-emails', columnLabels.sort().join(',')], (oldEmails = []) => {
      // DEEP CLONE: Create entirely new array with new email objects
      return oldEmails.map(email => {
        if (email.id !== emailId) {
          // Return NEW object for unchanged emails (prevents reference reuse)
          return { ...email };
        }

        // Restore the reverted email with previous status AND correct labelIds
        const previousLabelIds = getLabelsForColumn(previousStatus);
        return {
          ...email,
          status: previousStatus,
          labelIds: previousLabelIds,
        };
      });
    });
  }, [queryClient, columnLabels, getLabelsForColumn]);

  /**
   * FEATURE II: Update email with server response after successful move
   * CRITICAL: Merge ONLY specific fields to avoid overwriting UI state with stale data
   */
  const updateEmailFromServer = useCallback((updatedEmail: Email) => {
    queryClient.setQueryData<Email[]>(['kanban-emails', columnLabels.sort().join(',')], (oldEmails = []) => {
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
  }, [queryClient, columnLabels]);

  /**
   * FEATURE III: Snooze email (optimistic update)
   * Immediately hide email from active columns
   */
  const snoozeEmailOptimistic = useCallback((
    emailId: string,
    snoozedUntil: string,
    originalStatus: EmailStatus
  ) => {
    queryClient.setQueryData<Email[]>(['kanban-emails', columnLabels.sort().join(',')], (oldEmails = []) => {
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
  }, [queryClient, columnLabels]);

  /**
   * FEATURE III: Unsnooze email (optimistic update)
   * Restore email to original status
   */
  const unsnoozeEmailOptimistic = useCallback((emailId: string, restoreStatus: EmailStatus) => {
    queryClient.setQueryData<Email[]>(['kanban-emails', columnLabels.sort().join(',')], (oldEmails = []) => {
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
  }, [queryClient, columnLabels]);

  /**
   * FEATURE III: Revert snooze on error
   */
  const revertSnooze = useCallback((emailId: string, previousStatus: EmailStatus) => {
    queryClient.setQueryData<Email[]>(['kanban-emails', columnLabels.sort().join(',')], (oldEmails = []) => {
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
  }, [queryClient, columnLabels]);

  /**
   * FEATURE III: Update email with server response after snooze/unsnooze
   * CRITICAL: Merge ALL fields from server to preserve metadata (sender, subject, snippet)
   * If email not found (unsnooze case), ADD it to the cache
   */
  const updateEmailSnoozeFromServer = useCallback((updatedEmail: Email) => {
    queryClient.setQueryData<Email[]>(['kanban-emails', columnLabels.sort().join(',')], (oldEmails = []) => {
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
  }, [queryClient, columnLabels]);

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
