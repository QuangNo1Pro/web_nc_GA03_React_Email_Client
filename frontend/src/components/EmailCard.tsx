/**
 * EmailCard Component
 * Displays an email as a card in the Kanban board
 * Matches the design from the screenshot: avatar, sender, timestamp, subject, summary box, footer actions
 * FEATURE II: Draggable for drag & drop workflow management
 * FEATURE III: Snooze button integration
 */

import React, { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Email } from '../types/email';
import { getAvatarColor } from '../utils/emailUtils';
import SnoozeModal from './SnoozeModal';
import { summarizeEmail } from '../services/emailService';
import { summaryQueue } from '../utils/summaryQueue';

interface EmailCardProps {
  email: Email;
  borderColor: string; // Tailwind class for left border color
  onSnooze?: (emailId: string, snoozedUntil: string, simulate: boolean) => void;
  onOpenEmail?: (emailId: string) => void;
}

/**
 * Format timestamp to readable format
 * Shows time for today, date for older emails
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  // Show "2 days ago" format for recent emails
  const daysAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) {
    return `${daysAgo} days ago`;
  }
  
  return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
};

/**
 * Extract first letter of sender name for avatar
 */
const getAvatarLetter = (sender: string): string => {
  const cleanSender = sender.replace(/^"|"$/g, '').trim();
  const match = cleanSender.match(/^([^<]+)</);
  const name = match ? match[1].trim() : cleanSender;
  return name.charAt(0).toUpperCase();
};

/**
 * Get display name from sender (remove email part)
 */
const getSenderName = (sender: string): string => {
  const cleanSender = sender.replace(/^"|"$/g, '').trim();
  const match = cleanSender.match(/^([^<]+)</);
  return match ? match[1].trim() : cleanSender.split('@')[0];
};

/**
 * Navigate to Gmail to open email
 * Uses email ID to construct Gmail URL
 */
const openInGmail = (email: Email) => {
  // Gmail URL format: https://mail.google.com/mail/u/0/#inbox/{emailId}
  const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${email.id}`;
  window.open(gmailUrl, '_blank', 'noopener,noreferrer');
};

const EmailCard: React.FC<EmailCardProps> = ({ email, borderColor, onSnooze, onOpenEmail }) => {
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [localSummary, setLocalSummary] = useState(email.summary);
  
  // Sync localSummary when email.summary changes (from cache update)
  useEffect(() => {
    if (email.summary && email.summary !== localSummary) {
      setLocalSummary(email.summary);
    }
  }, [email.summary]);
  
  const avatarLetter = getAvatarLetter(email.sender);
  const senderName = getSenderName(email.sender);
  const timestamp = formatTimestamp(email.timestamp);
  const avatarColorClass = getAvatarColor(senderName);

  // FEATURE II: Make card draggable
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: email.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  // FEATURE III: Handle snooze action
  const handleSnoozeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSnoozeModal(true);
  };

  const handleSnoozeConfirm = (snoozedUntil: string, simulate: boolean) => {
    if (onSnooze) {
      onSnooze(email.id, snoozedUntil, simulate);
    }
    setShowSnoozeModal(false);
  };

  // FEATURE IV: Generate summary for email using queue to prevent rate limiting
  const generateSummaryForEmail = async () => {
    if (isGeneratingSummary || localSummary) return;
    
    setIsGeneratingSummary(true);
    try {
      // Add to queue instead of calling directly
      const summary = await summaryQueue.addToQueue(email.id, async (emailId) => {
        const result = await summarizeEmail(emailId);
        return result.summary;
      });
      
      setLocalSummary(summary);
      
      // Dispatch event to update cache globally
      window.dispatchEvent(new CustomEvent('email-summary-generated', {
        detail: { messageId: email.id, summary }
      }));
    } catch (error) {
      console.error('[EmailCard] Failed to generate summary:', error);
      setLocalSummary('Không thể tạo tóm tắt');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Get email preview text (snippet or body preview)
  const getPreviewText = (): string => {
    if (email.snippet) {
      return email.snippet;
    }
    // Fallback if no snippet available
    return 'Nhấn để tạo tóm tắt AI...';
  };

  // Calculate relevance percentage (invert score: 0=perfect match, 1=no match)
  const getRelevancePercent = (): number => {
    if (typeof (email as any).score === 'number') {
      return Math.round((1 - (email as any).score) * 100);
    }
    return 0;
  };

  const relevancePercent = getRelevancePercent();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all mb-3 border-l-4 pl-1 ${borderColor} group ${
        isDragging ? 'z-50' : ''
      }`}
      role="article"
      aria-label={`Email from ${senderName}: ${email.subject}`}
      aria-grabbed={isDragging}
    >
      {/* Card Header: Avatar, Sender, Timestamp, Score */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${avatarColorClass}`}
          aria-hidden="true"
        >
          {avatarLetter}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 text-sm truncate">
            {senderName}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {relevancePercent > 0 && (
            <span
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
              }}
            >
              {relevancePercent}% match
            </span>
          )}
          <div className="text-xs text-gray-500">
            {timestamp}
          </div>
        </div>
      </div>

      {/* Card Body: Subject */}
      <div className="px-4 pb-2">
        <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2">
          {email.subject || '(No subject)'}
        </h3>
      </div>

      {/* Content Preview / AI Summary Box */}
      <div className="px-4 pb-3">
        <div className="bg-gray-100 rounded-lg p-3 border-l-2 border-l-gray-400">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {isGeneratingSummary ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-gray-500">Đang tạo tóm tắt AI...</span>
                </div>
              ) : localSummary ? (
                /* AI Summary - scrollable */
                <div 
                  className="text-sm text-gray-700 leading-relaxed max-h-32 overflow-y-auto pr-2 custom-scrollbar"
                  style={{
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {localSummary}
                </div>
              ) : (
                /* Email Preview - clickable to generate AI summary */
                <button
                  className="w-full text-left group/preview"
                  onClick={(e) => {
                    e.stopPropagation();
                    generateSummaryForEmail();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="text-sm text-gray-600 leading-relaxed line-clamp-3 mb-2">
                    {getPreviewText()}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-blue-600 group-hover/preview:text-blue-700 font-medium transition-colors">
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    <span>Tạo tóm tắt AI</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer: Actions */}
      <div className="flex items-center gap-2 px-4 pb-4 pt-1 border-t border-gray-100">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
          onClick={handleSnoozeClick}
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking button
          aria-label="Snooze email"
        >
          <span className="material-symbols-outlined text-base">schedule</span>
          Snooze
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenEmail) {
              onOpenEmail(email.id);
            } else {
              openInGmail(email);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking button
          aria-label="Open email"
        >
          <span className="material-symbols-outlined text-base">
            {onOpenEmail ? 'visibility' : 'open_in_new'}
          </span>
          {onOpenEmail ? 'View Detail' : 'Open Mail'}
        </button>
      </div>

      {/* FEATURE III: Snooze Modal */}
      <SnoozeModal
        email={email}
        isOpen={showSnoozeModal}
        onClose={() => setShowSnoozeModal(false)}
        onSnooze={handleSnoozeConfirm}
      />
    </div>
  );
};

export default EmailCard;
