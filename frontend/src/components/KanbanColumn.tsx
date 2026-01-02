/**
 * KanbanColumn Component
 * Renders a single column in the Kanban board with title, count badge, and scrollable email cards
 * FEATURE II: Droppable zone for drag & drop functionality
 * FEATURE III: Pass snooze callback to EmailCard
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { KanbanColumn as KanbanColumnType } from '../types/email';
import EmailCard from './EmailCard';

interface KanbanColumnProps {
  column: KanbanColumnType;
  onSnooze?: (emailId: string, snoozedUntil: string, simulate: boolean) => void;
  onOpenEmail?: (emailId: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, onSnooze, onOpenEmail }) => {
  // Debug log
  if (column.emails.length > 0) {
    console.log(`[KanbanColumn] "${column.title}" rendering with ${column.emails.length} emails:`, {
      emailIds: column.emails.map(e => e.id).slice(0, 3),
      emailSubjects: column.emails.map(e => e.subject).slice(0, 3),
    });
  }

  // FEATURE II: Make column droppable
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-gray-50 rounded-lg h-full min-h-0 transition-colors ${isOver ? 'bg-blue-50 ring-2 ring-blue-400' : ''
        }`}
      style={{ minWidth: 0 }}
      role="region"
      aria-label={`${column.title} column with ${column.emails.length} emails`}
    >
      {/* Column Header: Title + Count Badge */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          {column.title}
        </h2>
        <div
          className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-1 rounded-full min-w-[28px] text-center"
          aria-label={`${column.emails.length} emails`}
        >
          {column.emails.length}
        </div>
      </div>

      {/* Column Body: Scrollable Email Cards */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-0 min-h-0"
        tabIndex={0}
        role="list"
        aria-label={`${column.title} email list`}
      >
        {column.emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-30">
              inbox
            </span>
            <p className="text-sm font-medium">No emails</p>
          </div>
        ) : (
          column.emails.map((email) => (
            <div key={email.id} role="listitem">
              <EmailCard
                email={email}
                borderColor={column.color}
                onSnooze={onSnooze}
                onOpenEmail={onOpenEmail}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
