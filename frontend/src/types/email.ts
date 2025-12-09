/**
 * Email types for Kanban interface
 * Matches backend API response structure from GET /emails
 */

export type EmailStatus = 'Inbox' | 'To Do' | 'In Progress' | 'Done' | 'Snoozed';

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
}
