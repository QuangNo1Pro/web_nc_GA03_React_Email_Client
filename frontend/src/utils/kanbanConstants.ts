/**
 * Kanban Constants
 * Defines valid Gmail labels for column mapping and validation rules
 * FEATURE III: Dynamic Kanban Configuration
 */

// Valid Gmail labels that can be used for column mapping
// These labels can be added/removed via Gmail API
export const VALID_COLUMN_LABELS = [
  { id: 'INBOX', name: 'Inbox', description: 'Emails in your inbox' },
  { id: 'STARRED', name: 'Starred', description: 'Mark as To Do / Priority' },
  { id: 'IMPORTANT', name: 'Important', description: 'Mark as In Progress / Urgent' },
  { id: 'SPAM', name: 'Spam', description: 'Move to spam folder' },
  { id: 'TRASH', name: 'Trash', description: 'Move to trash folder' },
  { id: 'ARCHIVED', name: 'Archived (Done)', description: 'Remove from inbox' },
] as const;

// System-only labels that CANNOT be manually assigned to emails
// Gmail manages these labels automatically based on actions
export const SYSTEM_ONLY_LABELS = [
  'SENT',      // Assigned when YOU send an email
  'DRAFT',     // Managed via draft operations
] as const;

// Available border colors for columns
export const COLUMN_COLORS = [
  { id: 'blue', class: 'border-l-blue-500', preview: '#3b82f6' },
  { id: 'yellow', class: 'border-l-yellow-500', preview: '#eab308' },
  { id: 'orange', class: 'border-l-orange-500', preview: '#f97316' },
  { id: 'green', class: 'border-l-green-500', preview: '#22c55e' },
  { id: 'purple', class: 'border-l-purple-500', preview: '#a855f7' },
  { id: 'pink', class: 'border-l-pink-500', preview: '#ec4899' },
  { id: 'red', class: 'border-l-red-500', preview: '#ef4444' },
  { id: 'teal', class: 'border-l-teal-500', preview: '#14b8a6' },
  { id: 'indigo', class: 'border-l-indigo-500', preview: '#6366f1' },
  { id: 'gray', class: 'border-l-gray-500', preview: '#6b7280' },
] as const;

// Column configuration interface
export interface KanbanColumnConfig {
  id: string;              // Unique identifier (e.g., 'inbox', 'todo', 'custom-1')
  title: string;           // Display name
  color: string;           // Tailwind border color class
  gmailLabel: string;      // Mapped Gmail label (INBOX, STARRED, etc.)
  isSystemColumn?: boolean; // If true, cannot be deleted
}

// Default columns for new users or when no saved config exists
export const DEFAULT_COLUMNS: KanbanColumnConfig[] = [
  {
    id: 'inbox',
    title: 'Inbox',
    color: 'border-l-blue-500',
    gmailLabel: 'INBOX',
    isSystemColumn: true,
  },
  {
    id: 'todo',
    title: 'To Do',
    color: 'border-l-yellow-500',
    gmailLabel: 'STARRED',
  },
  {
    id: 'inprogress',
    title: 'In Progress',
    color: 'border-l-orange-500',
    gmailLabel: 'IMPORTANT',
  },
  {
    id: 'done',
    title: 'Done',
    color: 'border-l-green-500',
    gmailLabel: 'ARCHIVED',
  },
];

// localStorage key for saving column configuration
export const KANBAN_CONFIG_STORAGE_KEY = 'kanban-column-config';

/**
 * Validate if a Gmail label can be used for column mapping
 */
export const isValidColumnLabel = (label: string): boolean => {
  // Check against system-only labels
  const systemLabels: readonly string[] = SYSTEM_ONLY_LABELS;
  if (systemLabels.includes(label)) {
    return false;
  }

  // Check against valid labels or allow custom labels (prefixed with Label_)
  const validLabelIds: readonly string[] = VALID_COLUMN_LABELS.map(l => l.id);
  return validLabelIds.includes(label) || label.startsWith('Label_');
};

/**
 * Get label display info by ID
 */
export const getLabelInfo = (labelId: string) => {
  return VALID_COLUMN_LABELS.find(l => l.id === labelId);
};

/**
 * Get color info by class name
 */
export const getColorInfo = (colorClass: string) => {
  return COLUMN_COLORS.find(c => c.class === colorClass);
};
