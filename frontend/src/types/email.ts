/**
 * Email types for Kanban interface
 * Matches backend API response structure from GET /emails
 * FEATURE III: Dynamic Kanban Configuration support
 */

// Re-export KanbanColumnConfig for convenience
export type { KanbanColumnConfig } from '../utils/kanbanConstants';

// EmailStatus is now string-based to support dynamic column configurations
// Common values: 'Inbox', 'To Do', 'In Progress', 'Done', 'Snoozed', or custom column IDs
export type EmailStatus = string;

export interface Email {
  id: string;
  sender: string;
  subject: string;
  body?: string;
  snippet?: string;
  summary?: string;
  timestamp: number;
  status?: EmailStatus;
  labelIds?: string[];
  read?: boolean;
  starred?: boolean;
  to?: string;
  cc?: string;
  bcc?: string;
  attachments?: any[];
  hasAttachment?: boolean; // Backend-computed flag for attachment presence
  // FEATURE III: Snooze fields
  snoozed?: boolean;
  snoozedUntil?: string | null; // ISO timestamp
  snoozedFromStatus?: EmailStatus | null;
}

export interface KanbanColumn {
  id: EmailStatus;
  title: string;
  color: string; // Tailwind color class for left border
  emails: Email[];
  gmailLabel?: string; // Gmail label mapping for dynamic columns
}

