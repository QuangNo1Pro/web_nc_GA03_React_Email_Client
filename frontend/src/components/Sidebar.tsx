import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import MaterialIcon from './MaterialIcon';

interface SidebarProps {
  user: any;
  mailboxes: any[];
  selectedMailbox: string;
  onMailboxSelect: (id: string) => void;
  onCompose: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  mailboxes,
  selectedMailbox,
  onMailboxSelect,
  onCompose,
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const mailboxIcons: Record<string, string> = {
    INBOX: 'inbox',
    STARRED: 'star',
    SENT: 'send',
    DRAFT: 'draft',
    SPAM: 'report',
    TRASH: 'delete',
    IMPORTANT: 'label_important',
    UNREAD: 'mark_email_unread',
  };

  const getAvatarLetter = () => {
    if (!user) return 'U';
    if (user.name) return user.name.charAt(0).toUpperCase();
    if (user.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };

  return (
    <aside 
      className="flex flex-col h-full border-r transition-colors duration-200"
      style={{ 
        backgroundColor: 'var(--bg-primary)', 
        borderColor: 'var(--border-primary)',
        width: '256px'
      }}
    >
      {/* User Profile Section */}
      <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150"
            style={{ color: 'var(--text-primary)' }}
          >
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name || user.email}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: 'var(--avatar-bg)' }}
              >
                {getAvatarLetter()}
              </div>
            )}
            <div className="flex-1 text-left overflow-hidden">
              <div className="font-medium text-sm truncate">
                {user?.name || user?.email || 'User'}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                {user?.email}
              </div>
            </div>
            <MaterialIcon name="expand_more" className="text-lg" />
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div
              className="absolute top-full left-0 right-0 mt-2 rounded-lg overflow-hidden shadow-lg z-50"
              style={{ 
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            >
              <button
                onClick={() => {
                  toggleTheme();
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors duration-150"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <MaterialIcon name={theme === 'light' ? 'dark_mode' : 'light_mode'} />
                <span className="text-sm">
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </button>
              <div className="h-px" style={{ backgroundColor: 'var(--border-primary)' }} />
              <button
                onClick={() => {
                  onLogout();
                  setShowProfileMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors duration-150"
                style={{ color: 'var(--error)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <MaterialIcon name="logout" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Compose Button */}
      <div className="px-3 py-2.5">
        <button
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 px-6 py-2.5 font-medium transition-all duration-150"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
          }}
        >
          <MaterialIcon name="edit" />
          <span>Compose</span>
        </button>
      </div>

      {/* Mailbox List */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {mailboxes.map((mailbox) => {
          const isSelected = selectedMailbox === mailbox.id;
          const icon = mailboxIcons[mailbox.id] || 'folder';
          
          return (
            <button
              key={mailbox.id}
              onClick={() => onMailboxSelect(mailbox.id)}
              className="w-full flex items-center gap-2 px-3 py- rounded-lg mb-0.5 transition-colors duration-150"
              style={{
                backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
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
            >
              <MaterialIcon 
                name={icon} 
                className={isSelected ? 'filled' : ''}
              />
              <span className="flex-1 text-left text-sm font-medium">
                {mailbox.name}
              </span>
              {mailbox.messagesUnread > 0 && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    color: isSelected ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  }}
                >
                  {mailbox.messagesUnread}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t text-xs text-center" style={{ 
        borderColor: 'var(--border-primary)',
        color: 'var(--text-tertiary)'
      }}>
        <p>Gmail Client</p>
        <p className="mt-1">© 2025</p>
      </div>
    </aside>
  );
};

export default Sidebar;
