import React from 'react';
import MaterialIcon from './MaterialIcon';
import { IoIosArrowDown } from 'react-icons/io';

interface MailboxListProps {
  mailboxes: any[];
  selectedMailbox: string;
  mailboxOrder: string[];
  getMailboxIcon: (mailbox: any) => JSX.Element;
  getMailboxLabel: (mailbox: any) => string;
  mailboxesLoading: boolean;
  mailboxesError: any;
  onSelect: (mailboxId: string) => void;
}

const MailboxList: React.FC<MailboxListProps> = ({
  mailboxes,
  selectedMailbox,
  mailboxOrder,
  getMailboxIcon,
  getMailboxLabel,
  mailboxesLoading,
  mailboxesError,
  onSelect,
}) => {
  return (
    <div className="px-2 pb-2">
      {mailboxesLoading ? (
        <div className="center-spinner"><div className="spinner" /></div>
      ) : mailboxesError ? (
        <div style={{ color: 'var(--error)', padding: '1rem', textAlign: 'center' }}>
          Error loading mailboxes
        </div>
      ) : (
        <ul className="space-y-0.5">
          {mailboxes
            ?.filter((mailbox: any) => {
              const allowed = [
                "CHAT",
                "INBOX",
                "UNREAD",
                "STARRED",
                "SENT",
                "DRAFT",
                "IMPORTANT",
                "SPAM",
                "TRASH",
              ];
              return allowed.includes(mailbox.id);
            })
            .sort(
              (a: any, b: any) =>
                mailboxOrder.indexOf(a.id) -
                mailboxOrder.indexOf(b.id)
            )
            .map((mailbox: any) => {
              const isSelected = selectedMailbox === mailbox.id;
              return (
                <li
                  key={mailbox.id}
                  className="mailbox-item cursor-pointer rounded-lg transition-all"
                  style={{
                    backgroundColor: isSelected ? 'var(--accent-secondary)' : 'transparent',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  onClick={() => onSelect(mailbox.id)}
                >
                  <div className="flex items-center gap-2 px-3 py-1">
                    <span className="mailbox-icon flex-shrink-0" style={{ fontSize: '18px' }}>
                      {getMailboxIcon(mailbox)}
                    </span>
                    <span className="mailbox-text flex-1 truncate pr-12" style={{ fontSize: '14px' }}>
                      {getMailboxLabel(mailbox)}
                    </span>
                    {mailbox.messagesUnread > 0 && (
                      <span
                        className="mailbox-count px-2 py-0.5 text-xs font-semibold flex-shrink-0"
                        style={{
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          minWidth: '24px',
                          textAlign: 'center',
                          fontSize: '13px',
                        }}
                      >
                        {mailbox.messagesUnread}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
};

export default MailboxList;
