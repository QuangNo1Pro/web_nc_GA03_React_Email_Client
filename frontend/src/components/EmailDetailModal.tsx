/**
 * EmailDetailModal Component
 * Popup modal to display full email details in Kanban view
 * Reuses EmailDetail component for consistency
 */

import React, { useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import EmailDetail from './EmailDetail';

interface EmailDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: any;
  starredState: { [id: string]: boolean };
  isReplyHoveredDetail: boolean;
  isReplyAllHoveredDetail: boolean;
  isForwardHoveredDetail: boolean;
  isMailHoveredDetail: boolean;
  isStarHoveredDetail: boolean;
  isDeleteHoveredDetail: boolean;
  downloadingAttachments: Set<string>;
  handleReply: () => void;
  handleReplyAll: () => void;
  handleForward: () => void;
  handleToggleRead: (id: string) => void;
  handleToggleStar: (id: string) => void;
  handleDeleteEmail: (id: string) => void;
  handleDownloadAttachment: (messageId: string, attachment: any) => void;
  setIsReplyHoveredDetail: (v: boolean) => void;
  setIsReplyAllHoveredDetail: (v: boolean) => void;
  setIsForwardHoveredDetail: (v: boolean) => void;
  setIsMailHoveredDetail: (v: boolean) => void;
  setIsStarHoveredDetail: (v: boolean) => void;
  setIsDeleteHoveredDetail: (v: boolean) => void;
}

const EmailDetailModal: React.FC<EmailDetailModalProps> = ({
  isOpen,
  onClose,
  email,
  starredState,
  isReplyHoveredDetail,
  isReplyAllHoveredDetail,
  isForwardHoveredDetail,
  isMailHoveredDetail,
  isStarHoveredDetail,
  isDeleteHoveredDetail,
  downloadingAttachments,
  handleReply,
  handleReplyAll,
  handleForward,
  handleToggleRead,
  handleToggleStar,
  handleDeleteEmail,
  handleDownloadAttachment,
  setIsReplyHoveredDetail,
  setIsReplyAllHoveredDetail,
  setIsForwardHoveredDetail,
  setIsMailHoveredDetail,
  setIsStarHoveredDetail,
  setIsDeleteHoveredDetail,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  if (!email) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
        <div className="relative bg-white dark:bg-gray-900 rounded-lg p-8 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">Loading email...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-4xl max-h-[90vh] mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Header with Close Button */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Chi tiết Email
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <IoClose
              className="w-6 h-6"
              style={{ color: 'var(--text-secondary)' }}
            />
          </button>
        </div>

        {/* Email Detail Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          <EmailDetail
            email={email}
            starredState={starredState}
            isReplyHoveredDetail={isReplyHoveredDetail}
            isReplyAllHoveredDetail={isReplyAllHoveredDetail}
            isForwardHoveredDetail={isForwardHoveredDetail}
            isMailHoveredDetail={isMailHoveredDetail}
            isStarHoveredDetail={isStarHoveredDetail}
            isDeleteHoveredDetail={isDeleteHoveredDetail}
            downloadingAttachments={downloadingAttachments}
            handleReply={handleReply}
            handleReplyAll={handleReplyAll}
            handleForward={handleForward}
            handleToggleRead={handleToggleRead}
            handleToggleStar={handleToggleStar}
            handleDeleteEmail={handleDeleteEmail}
            handleDownloadAttachment={handleDownloadAttachment}
            setIsReplyHoveredDetail={setIsReplyHoveredDetail}
            setIsReplyAllHoveredDetail={setIsReplyAllHoveredDetail}
            setIsForwardHoveredDetail={setIsForwardHoveredDetail}
            setIsMailHoveredDetail={setIsMailHoveredDetail}
            setIsStarHoveredDetail={setIsStarHoveredDetail}
            setIsDeleteHoveredDetail={setIsDeleteHoveredDetail}
          />
        </div>
      </div>
    </div>
  );
};

export default EmailDetailModal;
