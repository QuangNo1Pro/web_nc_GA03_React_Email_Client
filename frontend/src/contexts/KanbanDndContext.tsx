/**
 * KanbanDndContext
 * Provides drag & drop context for Kanban board using @dnd-kit
 * Handles optimistic updates and rollback on errors
 * FEATURE III: Supports dynamic column label mappings
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Email, EmailStatus, KanbanColumn } from '../types/email';
import { updateEmailStatus } from '../services/emailService';
import toast from 'react-hot-toast';
import EmailCard from '../components/EmailCard';

interface KanbanDndContextValue {
  activeEmail: Email | null;
  isDragging: boolean;
}

const KanbanDndContext = createContext<KanbanDndContextValue>({
  activeEmail: null,
  isDragging: false,
});

export const useKanbanDnd = () => useContext(KanbanDndContext);

interface KanbanDndProviderProps {
  children: React.ReactNode;
  emails: Email[];
  columns?: KanbanColumn[]; // Dynamic columns for label mapping
  onEmailMove: (emailId: string, newStatus: EmailStatus, previousStatus: EmailStatus) => void;
  onEmailMoveSuccess: (email: Email) => void;
  onEmailMoveError: (emailId: string, previousStatus: EmailStatus, error: any) => void;
}

/**
 * Generate label mapping for a column based on its Gmail label
 */
const getLabelMappingForColumn = (column?: KanbanColumn): { add: string[], remove: string[] } | undefined => {
  if (!column?.gmailLabel) return undefined;

  const label = column.gmailLabel;

  // Default mappings for known labels
  const mappings: Record<string, { add: string[], remove: string[] }> = {
    'INBOX': { add: ['INBOX'], remove: ['STARRED', 'IMPORTANT', 'SPAM'] },
    'STARRED': { add: ['STARRED', 'INBOX'], remove: ['IMPORTANT', 'SPAM'] },
    'IMPORTANT': { add: ['IMPORTANT', 'INBOX'], remove: ['STARRED', 'SPAM'] },
    'ARCHIVED': { add: [], remove: ['INBOX', 'STARRED', 'IMPORTANT'] },
    'SPAM': { add: ['SPAM'], remove: ['INBOX', 'STARRED', 'IMPORTANT'] },
    'TRASH': { add: ['TRASH'], remove: ['INBOX', 'STARRED', 'IMPORTANT', 'SPAM'] },
  };

  return mappings[label] || { add: [label], remove: [] };
};

export const KanbanDndProvider: React.FC<KanbanDndProviderProps> = ({
  children,
  emails,
  columns = [],
  onEmailMove,
  onEmailMoveSuccess,
  onEmailMoveError,
}) => {
  const [activeEmail, setActiveEmail] = useState<Email | null>(null);

  // Configure sensors for drag & drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    // CRITICAL: Create DEEP CLONE of email object for drag overlay
    // This prevents mutations from affecting the dragged preview
    const email = emails.find(e => e.id === active.id);
    if (email) {
      setActiveEmail({ ...email });
    }
  }, [emails]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEmail(null);

    if (!over) return;

    const emailId = active.id as string;
    const newStatus = over.id as EmailStatus;

    // CRITICAL: Find email from CURRENT emails array (not stale closure)
    const email = emails.find(e => e.id === emailId);
    if (!email) {
      console.error('Email not found for drag:', emailId);
      return;
    }

    // Get previous status from CURRENT email state
    const previousStatus = email.status || 'Inbox';

    // Don't update if dropped in same column
    if (previousStatus === newStatus) return;

    // Find target column to get label mapping
    const targetColumn = columns.find(col => col.id === newStatus);
    const labelMapping = getLabelMappingForColumn(targetColumn);

    console.log('[DnD] Drag end:', { emailId, newStatus, previousStatus, targetColumn: targetColumn?.title, labelMapping });

    // Optimistic update - move email immediately in UI
    onEmailMove(emailId, newStatus, previousStatus);

    try {
      // Call backend API to persist change with label mapping
      const updatedEmail = await updateEmailStatus(emailId, newStatus, labelMapping);

      // Success - update local state with server response
      onEmailMoveSuccess(updatedEmail);

      toast.success(`Moved to ${targetColumn?.title || newStatus}`, {
        duration: 2000,
        position: 'bottom-right',
      });
    } catch (error: any) {
      // Error - revert optimistic update
      console.error('Failed to update email status:', error);

      onEmailMoveError(emailId, previousStatus, error);

      const errorMessage = error?.response?.data?.message || 'Failed to move email';
      toast.error(`${errorMessage} - Reverted`, {
        duration: 4000,
        position: 'bottom-right',
      });
    }
  }, [emails, columns, onEmailMove, onEmailMoveSuccess, onEmailMoveError]);

  const handleDragCancel = useCallback(() => {
    setActiveEmail(null);
  }, []);

  const contextValue: KanbanDndContextValue = {
    activeEmail,
    isDragging: !!activeEmail,
  };

  return (
    <KanbanDndContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}

        {/* Drag overlay - shows dragged card preview */}
        <DragOverlay>
          {activeEmail ? (
            <div style={{ cursor: 'grabbing', opacity: 0.8 }}>
              <EmailCard
                email={activeEmail}
                borderColor="border-l-blue-500"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </KanbanDndContext.Provider>
  );
};
