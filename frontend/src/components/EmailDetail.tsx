import React from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { FiFileText, FiTrash2 } from 'react-icons/fi';
import { ArrowReply20Regular, ArrowReplyAll20Regular, ArrowForward20Regular } from '@fluentui/react-icons';
import { getAvatarColor, extractEmails } from '../utils/emailUtils';

interface EmailDetailProps {
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

const EmailDetail: React.FC<EmailDetailProps> = ({
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
  if (!email) return null;

  // Parse sender name and email
  const parseSender = () => {
    if (!email.from) return { name: "Unknown", email: "" };
    const match = email.from.match(/^("?)([^"<]*)\1\s*<([^>]+)>$/);
    if (match) {
      return { name: match[2].trim() || match[3].split('@')[0], email: match[3].trim() };
    }
    if (email.from.includes("@")) {
      return { name: email.from.split("@")[0], email: email.from };
    }
    return { name: email.from, email: "" };
  };

  const sender = parseSender();
  const avatarLetter = sender.name.charAt(0).toUpperCase() || "U";

  return (
    <div className="h-full overflow-y-auto">
      {/* Subject Header - Modern Card Design */}
      <div
        className="mb-3 p-3 rounded-xl border"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <h1
          className="text-xl font-semibold leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          {email.subject}
        </h1>
      </div>

      {/* Email Card */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Header Section */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            {/* Left: Avatar + Sender Info */}
            <div className="flex items-start flex-[2] min-w-0 gap-0">

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3
                    className="text-base font-semibold truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {sender.name}
                  </h3>
                </div>
                <div className="text-sm mb-2" style={{ color: 'var(--text-tertiary)' }}>
                  {sender.email}
                </div>
                <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-medium">Đến: </span>
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {[
                      ...extractEmails(email.to || ""),
                      ...extractEmails(email.cc || ""),
                      ...(email.bcc ? extractEmails(email.bcc).map((e) => `bcc:${e}`) : [])
                    ].join(", ")}
                  </span>

                </div>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink flex-[0.7]">
              <button
                onClick={handleReply}
                className="p-2.5 rounded-lg transition-all"
                title="Trả lời"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  setIsReplyHoveredDetail(true);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  setIsReplyHoveredDetail(false);
                }}
              >
                <ArrowReply20Regular
                  style={{ color: isReplyHoveredDetail ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                />
              </button>
              <button
                onClick={handleReplyAll}
                className="p-2.5 rounded-lg transition-all"
                title="Trả lời tất cả"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  setIsReplyAllHoveredDetail(true);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  setIsReplyAllHoveredDetail(false);
                }}
              >
                <ArrowReplyAll20Regular
                  style={{ color: isReplyAllHoveredDetail ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                />
              </button>
              <button
                onClick={handleForward}
                className="p-2.5 rounded-lg transition-all"
                title="Chuyển tiếp"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  setIsForwardHoveredDetail(true);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  setIsForwardHoveredDetail(false);
                }}
              >
                <ArrowForward20Regular
                  style={{ color: isForwardHoveredDetail ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                />
              </button>
              <div
                className="h-6 w-px mx-1"
                style={{ backgroundColor: 'var(--border-primary)' }}
              />
              <button
                onClick={() => handleToggleRead(email.id)}
                className="p-2.5 rounded-lg transition-all"
                title={email.read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  setIsMailHoveredDetail(true);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  setIsMailHoveredDetail(false);
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '20px',
                    color: isMailHoveredDetail ? 'var(--accent-primary)' : 'var(--text-secondary)'
                  }}
                >
                  {email.read ? "mark_email_read" : "mark_email_unread"}
                </span>
              </button>
              <button
                onClick={() => handleToggleStar(email.id)}
                className="p-2.5 rounded-lg transition-all"
                title={starredState[email.id] ? 'Bỏ gắn sao' : 'Gắn sao'}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  setIsStarHoveredDetail(true);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  setIsStarHoveredDetail(false);
                }}
              >
                {starredState[email.id] || isStarHoveredDetail ? (
                  <FaStar className="w-5 h-5 text-yellow-400" />
                ) : (
                  <FaRegStar className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                )}
              </button>
              <button
                onClick={() => handleDeleteEmail(email.id)}
                className="p-2.5 rounded-lg transition-all"
                title="Xóa"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  setIsDeleteHoveredDetail(true);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  setIsDeleteHoveredDetail(false);
                }}
              >
                <FiTrash2
                  className="w-5 h-5"
                  style={{ color: isDeleteHoveredDetail ? 'var(--error)' : 'var(--text-secondary)' }}
                />
              </button>
            </div>
          </div>

          {/* Date & Time */}
          <div
            className="text-xs flex items-center gap-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>schedule</span>
            <span>
              {(() => {
                const date = new Date(email.received);
                const weekday = date.toLocaleString('vi-VN', { weekday: 'long' }).replace(/^\w/, (c) => c.toUpperCase());
                const dateTime = date.toLocaleString('vi-VN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
                return `${weekday}, ${dateTime}`;
              })()}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div
          className="h-px mx-5"
          style={{ backgroundColor: 'var(--border-primary)' }}
        />

        {/* Email Body */}
        <div className="px-5 py-6">
          <div
            className="email-body prose max-w-none leading-relaxed"
            style={{
              color: 'var(--text-primary)',
              fontSize: '15px',
              lineHeight: '1.6',
            }}
            dangerouslySetInnerHTML={{ __html: email.body }}
          />

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="material-symbols-outlined text-xl"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  attach_file
                </span>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {email.attachments.length} tệp đính kèm
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {email.attachments.map((attachment: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                      e.currentTarget.style.borderColor = 'var(--accent-primary)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent-primary-light, rgba(59, 130, 246, 0.1))' }}
                      >
                        <FiFileText
                          size={20}
                          style={{ color: 'var(--accent-primary)' }}
                        />
                      </div>
                      <div className="truncate">
                        <div
                          className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {attachment.filename}
                        </div>
                        <div
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          {attachment.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'} • {Math.round(attachment.size / 1024)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      className="px-4 py-2 text-sm rounded-lg font-medium transition-all flex items-center gap-2 flex-shrink-0"
                      style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                      }}
                      onClick={() => handleDownloadAttachment(email.id, attachment)}
                      disabled={downloadingAttachments.has(attachment.attachmentId)}
                      onMouseEnter={(e) => {
                        if (!downloadingAttachments.has(attachment.attachmentId)) {
                          e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!downloadingAttachments.has(attachment.attachmentId)) {
                          e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      {downloadingAttachments.has(attachment.attachmentId) ? (
                        <>
                          <span className="material-symbols-outlined animate-spin" style={{ fontSize: '18px' }}>
                            progress_activity
                          </span>
                          <span>Đang tải...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                            download
                          </span>
                          <span>Tải xuống</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;
