import React, { useState, useEffect } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { FiFileText, FiTrash2 } from 'react-icons/fi';
import { ArrowReply20Regular, ArrowReplyAll20Regular, ArrowForward20Regular } from '@fluentui/react-icons';
import { getAvatarColor, extractEmails } from '../utils/emailUtils';
import { getGmailLink } from '../services/emailService';
import { api } from '../services/api';
import toast from 'react-hot-toast';

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

const AttachmentItem: React.FC<{
  attachment: any;
  emailId: string;
  downloadingAttachments: Set<string>;
  handleDownloadAttachment: (emailId: string, attachment: any) => void;
}> = ({ attachment, emailId, downloadingAttachments, handleDownloadAttachment }) => {
  const isImage = attachment.mimeType?.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';
  // Attempt preview for Image and small PDFs (< 5MB)
  const shouldPreview = isImage || (isPdf && attachment.size < 5 * 1024 * 1024);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchPreview = async () => {
      // Only fetch preview if eligible and valid attachmentId
      if (shouldPreview && !previewUrl && attachment.attachmentId) {
        setLoadingPreview(true);
        try {
          const { data } = await api.get(`/gmail/attachments/${emailId}/${attachment.attachmentId}`);
          if (data && data.data && isMounted) {
            const b64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
            // For PDF, data URI works in modern browsers
            setPreviewUrl(`data:${attachment.mimeType};base64,${b64}`);
          }
        } catch (err) {
          console.error("Failed to load preview", err);
        } finally {
          if (isMounted) setLoadingPreview(false);
        }
      }
    };

    fetchPreview();
    return () => { isMounted = false; };
  }, [attachment.attachmentId, emailId, shouldPreview, attachment.mimeType]);

  const ext = attachment.filename.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <div
      className="group relative flex flex-col rounded-xl border overflow-hidden transition-all hover:shadow-lg"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* Preview / Icon Area */}
      <div
        className="h-32 flex items-center justify-center relative overflow-hidden bg-white"
        style={{ backgroundColor: isPdf && previewUrl ? '#fff' : 'var(--bg-secondary)' }}
      >
        {shouldPreview && previewUrl ? (
          isImage ? (
            <img
              src={previewUrl}
              alt={attachment.filename}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <iframe
              src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
              className="w-full h-full border-none pointer-events-none select-none"
              style={{ overflow: 'hidden' }}
              tabIndex={-1}
              title={attachment.filename}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
            {loadingPreview ? (
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '32px', color: 'var(--text-tertiary)' }}>progress_activity</span>
            ) : (
              <>
                <FiFileText size={40} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>{ext}</span>
              </>
            )}
          </div>
        )}

        {/* Hover Overlay - Transparent trigger for buttons */}
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px] z-10">
          <button
            onClick={() => handleDownloadAttachment(emailId, attachment)}
            disabled={downloadingAttachments.has(attachment.attachmentId)}
            className="p-3 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-all cursor-pointer"
            style={{ backgroundColor: 'var(--accent-primary)', color: '#fff' }}
            title="Tải xuống"
          >
            {downloadingAttachments.has(attachment.attachmentId) ? (
              <span className="material-symbols-outlined animate-spin" style={{ fontSize: '20px' }}>progress_activity</span>
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>download</span>
            )}
          </button>
        </div>
      </div>

      {/* Info Footer */}
      <div className="p-3 border-t z-20 bg-white" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}>
        <div
          className="font-medium truncate text-sm mb-1"
          title={attachment.filename}
          style={{ color: 'var(--text-primary)' }}
        >
          {attachment.filename}
        </div>
        <div
          className="text-xs font-medium"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {Math.round(attachment.size / 1024)} KB
        </div>
      </div>
    </div>
  );
};

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
  const [isGmailHovered, setIsGmailHovered] = useState(false);
  const [isOpeningGmail, setIsOpeningGmail] = useState(false);
  const [displayBody, setDisplayBody] = useState(email.body || '');

  // Reset display body when email changes
  useEffect(() => {
    setDisplayBody(email.body || '');
  }, [email.body]);

  // Handle inline images (cid:)
  useEffect(() => {
    let isMounted = true;
    const processInlineImages = async () => {
      if (!email.body) return;

      const cidRegex = /src="cid:([^"]+)"/g;
      const matches = [...email.body.matchAll(cidRegex)];

      if (matches.length === 0) return;

      console.log(`[EmailDetail] Found ${matches.length} inline images to load`);

      // Copy current body to start replacement
      let newBody = email.body;
      let hasUpdates = false;

      // Process unique CIDs
      const uniqueCids = [...new Set(matches.map(m => m[1]))];

      await Promise.all(uniqueCids.map(async (cid) => {
        // Find attachment with matching contentId
        const attachment = email.attachments?.find((att: any) => att.contentId === cid);

        if (attachment) {
          try {
            // Fetch attachment content
            const { data } = await api.get(`/gmail/attachments/${email.id}/${attachment.attachmentId}`);
            if (data && data.data) {
              const b64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
              const dataUri = `data:${attachment.mimeType};base64,${b64}`;

              // Replace ALL occurrences of this cid
              // Escape regex special chars in cid just in case
              const safeCid = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              newBody = newBody.replace(new RegExp(`src="cid:${safeCid}"`, 'g'), `src="${dataUri}"`);
              hasUpdates = true;
            }
          } catch (err) {
            console.error(`Failed to load inline image ${cid}`, err);
          }
        }
      }));

      if (isMounted && hasUpdates) {
        setDisplayBody(newBody);
      }
    };

    processInlineImages();
    return () => { isMounted = false; };
  }, [email.id, email.body, email.attachments]);

  if (!email) return null;

  // ... unchanged code ...

  // ... update JSX render ...
  <div
    className="email-body prose max-w-none leading-relaxed"
    style={{
      color: 'var(--text-primary)',
      fontSize: '15px',
      lineHeight: '1.6',
    }}
    dangerouslySetInnerHTML={{ __html: displayBody }}
  />
  // ...

  // Handle open in Gmail
  const handleOpenInGmail = async () => {
    try {
      setIsOpeningGmail(true);
      const gmailUrl = await getGmailLink(email.id);
      window.open(gmailUrl, '_blank');
      toast.success('Opened in Gmail');
    } catch (error) {
      console.error('Failed to get Gmail link:', error);
      toast.error('Failed to open in Gmail');
    } finally {
      setIsOpeningGmail(false);
    }
  };

  // Parse sender name and email
  const parseSender = () => {
    // Use email.from if available (from detail API), otherwise fallback to email.sender (from list)
    const senderField = email.from || email.sender;

    if (!senderField) return { name: "Unknown Sender", email: "" };

    // Extract email using extractEmails helper for reliability
    const emails = extractEmails(senderField);
    const emailAddress = emails.length > 0 ? emails[0] : "";

    // Extract name from "Name <email>" format
    const match = senderField.match(/^("?)([^"<]*)\1\s*<([^>]+)>$/);
    if (match) {
      const name = match[2].trim() || match[3].split('@')[0];
      return { name, email: emailAddress };
    }

    // If it's just an email address
    if (emailAddress) {
      return { name: emailAddress.split("@")[0], email: emailAddress };
    }

    // Fallback: it's probably just a name without email
    return { name: senderField, email: "" };
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
                {/* {sender.email && (
                  <div className="text-sm mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    {sender.email}
                  </div>
                )} */}
                <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-medium">Đến: </span>
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {[
                      ...extractEmails(email.to || ""),
                      ...extractEmails(email.cc || ""),
                      ...(email.bcc ? extractEmails(email.bcc).map((e) => `bcc:${e}`) : [])
                    ].join(", ") || "Không rõ"}
                  </span>

                </div>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink flex-[0.7] ">
              <button
                onClick={handleReply}
                className="p-2.5 rounded-lg transition-all -translate-y-[10px]"
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
                className="p-2.5 rounded-lg transition-all -translate-y-[10px]"
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
                className="p-2.5 rounded-lg transition-all -translate-y-[10px]"
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
                className="h-6 w-px mx-1 -translate-y-[10px]"
                style={{ backgroundColor: 'var(--border-primary)' }}
              />
              <button
                onClick={() => handleToggleRead(email.id)}
                className="p-2.5 rounded-lg transition-all -translate-y-[10px]"
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
                className="p-2.5 rounded-lg transition-all -translate-y-[10px]"
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
                className="p-2.5 rounded-lg transition-all -translate-y-[10px]"
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
              <div
                className="h-6 w-px mx-1 -translate-y-[10px]"
                style={{ backgroundColor: 'var(--border-primary)' }}
              />
              <button
                onClick={handleOpenInGmail}
                disabled={isOpeningGmail}
                className="p-2.5 rounded-lg transition-all -translate-y-[10px]"
                title="Mở trong Gmail"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  setIsGmailHovered(true);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  setIsGmailHovered(false);
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '20px',
                    color: isGmailHovered ? 'var(--accent-primary)' : 'var(--text-secondary)'
                  }}
                >
                  open_in_new
                </span>
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
                // Use email.received if available (from detail API), otherwise use email.timestamp (from list)
                const dateValue = email.received || email.timestamp;

                if (!dateValue) {
                  return 'Không rõ thời gian';
                }

                const date = new Date(dateValue);

                // Check if date is valid
                if (isNaN(date.getTime())) {
                  return 'Không rõ thời gian';
                }

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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {email.attachments.map((attachment: any, index: number) => (
                  <AttachmentItem
                    key={index}
                    attachment={attachment}
                    emailId={email.id}
                    downloadingAttachments={downloadingAttachments}
                    handleDownloadAttachment={handleDownloadAttachment}
                  />
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
