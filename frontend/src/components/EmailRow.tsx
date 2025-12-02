import React from "react";
import { FaRegStar, FaStar } from "react-icons/fa";

interface EmailRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    emails: any[];
    selectedEmail: string | null;
    selectedEmails: Set<string>;
    starredState: { [id: string]: boolean };
    readState: { [id: string]: boolean };
    focusedEmailIndex: number;
    showCheckboxes: boolean;
    handleToggleCheckbox: (id: string) => void;
    handleEmailSelect: (id: string) => void;
    handleToggleRead: (id: string) => void;
    handleToggleStar: (id: string) => void;
    user: any;
  };
}

const EmailRow: React.FC<EmailRowProps> = ({ index, style, data }) => {
  const {
    emails,
    selectedEmail,
    selectedEmails,
    starredState,
    readState,
    focusedEmailIndex,
    showCheckboxes,
    handleToggleCheckbox,
    handleEmailSelect,
    handleToggleRead,
    handleToggleStar,
    user,
  } = data;

  const email = emails[index];
  if (!email) return null;

  const isUnread =
    readState[email.id] !== undefined
      ? !readState[email.id]
      : email.labelIds?.includes("UNREAD");

  const senderName = email.sender.replace(/^"|"$/g, "").trim();
  const currentUser = user;

  let avatarLetter = "";
  let avatarColorName = email.sender;

  if (
    currentUser &&
    currentUser.email &&
    email.sender &&
    email.sender.toLowerCase().includes(currentUser.email.toLowerCase())
  ) {
    avatarLetter = "T";
    avatarColorName = "Tôi";
  } else {
    avatarLetter = senderName.charAt(0).toUpperCase();
    avatarColorName = senderName;
  }

  return (
    <>
      <div
        style={{ ...style }}
        className={`group relative w-full flex items-center px-4 cursor-pointer 
          transition-colors duration-150 
          ${selectedEmail === email.id
            ? "bg-[var(--accent-secondary)]"
            : "bg-[var(--bg-primary)]"}
          hover:bg-[var(--bg-hover)]
          border-b border-[var(--border-primary)]
        `}
        onClick={() => handleEmailSelect(email.id)}
      >
        {/* Line xanh bên trái khi chưa đọc */}
        {isUnread && (
          <div className="absolute left-0 top-0 h-full w-1 bg-[var(--accent-primary)] rounded-r-sm" />
        )}

        {/* Avatar / Checkbox */}
        <div className="mr-3 flex-shrink-0 -translate-y-[10px]">
          <div className="w-10 h-10 flex items-center justify-center">
            {showCheckboxes || selectedEmail === email.id ? (
              <input
                type="checkbox"
                className="w-4 h-4 cursor-pointer accent-blue-600"
                checked={selectedEmails.has(email.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => handleToggleCheckbox(email.id)}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-white bg-blue-500"
                style={{ fontSize: "15px" }}
              >
                {avatarLetter}
              </div>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-grow min-w-0 leading-tight">
          {/* Sender + Icons */}
          <div className="relative w-full flex items-center leading-tight">
            {/* Sender */}
            <span
              className={`truncate pr-12 ${
                isUnread ? "font-semibold" : "font-normal"
              }`}
              style={{ color: "var(--text-primary)", fontSize: "0.9rem", marginBottom: "1.5px" }}
            >
              {email.sender}
            </span>

            {/* Icons (absolute overlay) */}
            <div className="absolute right-0 top-0 flex items-center gap-1 -translate-y-[5px]">
              {/* Star */}
              <button
                className="p-1 rounded-md transition opacity-70 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStar(email.id);
                }}
              >
                {starredState[email.id] ? (
                  <FaStar className="text-yellow-400" size={14} />
                ) : (
                  <FaRegStar className="text-[var(--text-tertiary)]" size={14} />
                )}
              </button>

              {/* Read/Unread */}
              <button
                className="p-1 rounded-md transition opacity-70 hover:opacity-100 -translate-y-[2px]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleRead(email.id);
                }}
              >
                {email.read ? (
                  <span
                    className="material-symbols-outlined text-[var(--text-tertiary)]"
                    style={{ fontSize: "16px" }}
                  >
                    mark_email_read
                  </span>
                ) : (
                  <span
                    className="material-symbols-outlined text-[var(--accent-primary)]"
                    style={{ fontSize: "16px" }}
                  >
                    mark_email_unread
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Subject + Time */}
          <div className="flex justify-between items-center mt-[2px] mb-[4.5px]">
            <span
              className={`truncate ${
                isUnread ? "font-semibold" : "font-normal"
              }`}
              style={{
                color: "var(--text-primary)",
                fontSize: "0.9rem",
                maxWidth: "70%",
              }}
            >
              {email.subject}
            </span>

            <span
              className="flex-shrink-0"
              style={{
                color: "var(--text-tertiary)",
                fontSize: "0.7rem",
                whiteSpace: "nowrap",
              }}
            >
              {(() => {
                const date = new Date(email.timestamp);
                const weekday = date
                  .toLocaleString("vi-VN", { weekday: "short" })
                  .replace(/^\w/, (c) => c.toUpperCase());
                const time = date.toLocaleString("vi-VN", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
                return `${weekday} ${time}`;
              })()}
            </span>
          </div>

          {/* Preview */}
          <div
            className="truncate mt-[2px] mb-1"
            style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}
          >
            {email.preview}
          </div>
        </div>
      </div>
    </>
  );
};

export default EmailRow;
