/**
 * EmailCard Component
 * Displays an email as a card in the Kanban board
 * Matches the design from the screenshot: avatar, sender, timestamp, subject, summary box, footer actions
 * FEATURE II: Draggable for drag & drop workflow management
 * FEATURE III: Snooze button integration
 */

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Email } from '../types/email';
import { getAvatarColor } from '../utils/emailUtils';
import SnoozeModal from './SnoozeModal';
import { summarizeEmail } from '../services/emailService';
import toast from 'react-hot-toast';

interface EmailCardProps {
  email: Email;
  borderColor: string; // Tailwind class for left border color
  onSnooze?: (emailId: string, snoozedUntil: string, simulate: boolean) => void;
  onSummaryGenerated?: (emailId: string, summary: string) => void;
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
 * Get content preview (fallback to first 160 chars of body if no summary/snippet)
 */
const getContentPreview = (email: Email): string => {
  if (email.summary) return email.summary;
  if (email.snippet) return email.snippet;
  if (email.body) {
    // Strip HTML tags and get first 160 characters
    const stripped = email.body.replace(/<[^>]*>/g, '').trim();
    return stripped.length > 160 ? stripped.substring(0, 160) + '...' : stripped;
  }
  return 'No content available';
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

const EmailCard: React.FC<EmailCardProps> = ({ email, borderColor, onSnooze, onSummaryGenerated }) => {
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [localSummary, setLocalSummary] = useState(email.summary);
  
  const avatarLetter = getAvatarLetter(email.sender);
  const senderName = getSenderName(email.sender);
  const timestamp = formatTimestamp(email.timestamp);
  const preview = localSummary || getContentPreview(email);
  const avatarColorClass = getAvatarColor(senderName);

  const handleGenerateSummary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isGeneratingSummary || localSummary) return;

    setIsGeneratingSummary(true);
    const loadingToast = toast.loading('🤖 Generating AI summary...');

    try {
      const result = await summarizeEmail(email.id);
      setLocalSummary(result.summary);
      toast.dismiss(loadingToast);
      toast.success('✨ Summary generated!', { duration: 2000 });
      
      if (onSummaryGenerated) {
        onSummaryGenerated(email.id, result.summary);
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.message || 'Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // FEATURE II: Make card draggable
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: email.id,
  });

  // Only set transform style when actually dragging (required for drag animation)
  const dragStyle = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

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

  return (
    <>
      <div
        ref={setNodeRef}
        style={dragStyle}
        {...attributes}
        {...listeners}
        className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all mb-3 border-l-4 ${borderColor} group cursor-grab active:cursor-grabbing ${
          isDragging ? 'z-50 opacity-50' : ''
        }`}
        role="article"
        aria-label={`Email from ${senderName}: ${email.subject}`}
      >
        {/* Card Header: Avatar, Sender, Timestamp */}
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
          <div className="text-xs text-gray-500 flex-shrink-0">
            {timestamp}
          </div>
        </div>

        {/* Card Body: Subject */}
        <div className="px-4 pb-2">
          <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2">
            {email.subject || '(No subject)'}
          </h3>
        </div>

        {/* AI Summary Box */}
        <div className="px-4 pb-3">
          <div className="bg-gray-50 rounded-md p-3 border border-gray-100">
            <div className="flex items-start gap-2">
              <span 
                className="material-symbols-outlined text-blue-600 text-base flex-shrink-0 mt-0.5"
                aria-label="AI Summary"
              >
                auto_awesome
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-blue-600">
                    {localSummary ? 'AI Summary' : 'Preview'}
                  </div>
                  {!localSummary && (
                    <button
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                      title="Generate AI summary"
                    >
                      {isGeneratingSummary ? '...' : '✨ Summarize'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 line-clamp-3">
                  {preview}
                </p>
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
              openInGmail(email);
            }}
            onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking button
            aria-label="Open email in Gmail"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            Open Mail
          </button>
        </div>
      </div>

      {/* FEATURE III: Snooze Modal */}
      <SnoozeModal
        email={email}
        isOpen={showSnoozeModal}
        onClose={() => setShowSnoozeModal(false)}
        onSnooze={handleSnoozeConfirm}
      />
    </>
  );
};

export default EmailCard;
