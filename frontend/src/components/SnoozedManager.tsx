import React, { useState, useEffect } from 'react';
import { getSnoozedEmails, unsnoozeEmail, updateSnoozeTime } from '../services/emailService';
import toast from 'react-hot-toast';

interface Email {
  id: string;
  subject?: string;
  sender?: string;
  snippet?: string;
  snoozedUntil?: string;
  snoozedFromStatus?: string;
}

interface SnoozedManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailRestored: () => void;
}

const SnoozedManager: React.FC<SnoozedManagerProps> = ({
  isOpen,
  onClose,
  onEmailRestored,
}) => {
  const [snoozedEmails, setSnoozedEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now()); // For realtime countdown

  // Realtime countdown timer (updates every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load snoozed emails khi mở modal
  useEffect(() => {
    if (isOpen) {
      loadSnoozedEmails();
      
      // Refresh every 30s to sync with backend
      const interval = setInterval(loadSnoozedEmails, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Listen to SSE events for auto-refresh when emails are unsnoozed
  useEffect(() => {
    if (!isOpen) return;

    const handleEmailUpdate = () => {
      console.log('[SnoozedManager] Email update detected, refreshing...');
      loadSnoozedEmails();
    };

    // Listen for custom events from SSE
    window.addEventListener('email-update', handleEmailUpdate);
    return () => window.removeEventListener('email-update', handleEmailUpdate);
  }, [isOpen]);

  const loadSnoozedEmails = async () => {
    setLoading(true);
    try {
      const data = await getSnoozedEmails();
      console.log('[SnoozedManager] 📦 Received data:', data);
      
      // Backend returns array directly, not wrapped in {messages: [...]}
      const emails = Array.isArray(data) ? data : (data.messages || data || []);
      console.log('[SnoozedManager] 📧 Parsed emails:', emails);
      
      setSnoozedEmails(emails);
    } catch (error) {
      console.error('Failed to load snoozed emails:', error);
      toast.error('Failed to load snoozed emails');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsnooze = async (emailId: string) => {
    const loadingToast = toast.loading('🔄 Restoring email and syncing with Gmail...');
    
    try {
      await unsnoozeEmail(emailId);
      toast.dismiss(loadingToast);
      toast.success('✅ Email restored and synced with Gmail!', { duration: 3000 });
      setSnoozedEmails((prev) => prev.filter((e) => e.id !== emailId));
      onEmailRestored();
    } catch (error: any) {
      console.error('Failed to unsnooze:', error);
      toast.dismiss(loadingToast);
      
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      
      if (errorMsg.includes('rolled back')) {
        toast.error(
          '⚠️ Gmail sync failed. Changes rolled back. Please check your connection.',
          { duration: 5000 }
        );
      } else if (errorMsg.includes('token') || errorMsg.includes('auth')) {
        toast.error(
          '🔒 Gmail authentication expired. Please log out and log back in.',
          { duration: 5000 }
        );
      } else {
        toast.error(`❌ Failed to unsnooze: ${errorMsg}`, { duration: 4000 });
      }
    }
  };

  const handleUpdateSnoozeTime = async (emailId: string, minutes: number) => {
    const newTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const loadingToast = toast.loading('🔄 Updating snooze time...');
    
    try {
      await updateSnoozeTime(emailId, newTime);
      toast.dismiss(loadingToast);
      toast.success('⏰ Snooze time updated!');
      loadSnoozedEmails();
      setEditingId(null);
    } catch (error: any) {
      console.error('Failed to update snooze time:', error);
      toast.dismiss(loadingToast);
      
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      toast.error(`❌ Failed to update: ${errorMsg}`, { duration: 4000 });
    }
  };

  const formatSnoozeTime = (snoozedUntil?: string) => {
    if (!snoozedUntil) return 'Unknown';
    
    const date = new Date(snoozedUntil);
    const diff = date.getTime() - currentTime; // Use currentTime state for realtime
    
    if (diff < 0) return '⏰ Waking up...';
    if (diff < 60000) return `${Math.ceil(diff / 1000)}s`;
    if (diff < 3600000) return `${Math.ceil(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.ceil(diff / 3600000)}h`;
    return date.toLocaleString();
  };

  const extractSenderName = (sender?: string) => {
    if (!sender) return 'Unknown';
    const match = sender.match(/^"?([^"<]+)"?\s*<?/);
    return match ? match[1].trim() : sender.split('<')[0].trim() || 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Modal */}
      <div
        className="fixed right-0 top-0 h-full w-full md:w-96 z-50 shadow-2xl overflow-hidden flex flex-col animate-slide-in"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderLeft: '1px solid var(--border-primary)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--accent-primary)' }}>
              schedule
            </span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Snoozed Emails
            </h2>
            <span
              className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
              }}
            >
              {snoozedEmails.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-opacity-10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Gmail Sync Notice */}
        <div
          className="px-4 py-2 text-xs flex items-start gap-2 border-b"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: 'var(--accent-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <span className="material-symbols-outlined text-sm">info</span>
          <p>
            <strong>Gmail Sync:</strong> All snooze actions are synced with your Gmail account.
            Snoozed emails are hidden from your inbox and will automatically return when the time expires.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && snoozedEmails.length === 0 ? (
            <div className="text-center py-12">
              <div
                className="animate-spin w-10 h-10 border-4 rounded-full mx-auto"
                style={{
                  borderColor: 'var(--accent-primary)',
                  borderTopColor: 'transparent',
                }}
              />
              <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Loading snoozed emails...
              </p>
            </div>
          ) : snoozedEmails.length === 0 ? (
            <div className="text-center py-16">
              <span
                className="material-symbols-outlined text-7xl"
                style={{ color: 'var(--text-tertiary)' }}
              >
                mail_lock
              </span>
              <p className="mt-6 text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                No snoozed emails
              </p>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Emails you snooze will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {snoozedEmails.map((email) => {
                // Debug log each email
                console.log('[SnoozedManager] Rendering email:', {
                  id: email.id,
                  sender: email.sender,
                  subject: email.subject,
                  snippet: email.snippet?.substring(0, 50),
                });
                
                return (
                  <div
                    key={email.id}
                    className="p-4 rounded-lg border transition-all hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                    }}
                  >
                    {/* Email Info */}
                    <div className="mb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p
                          className="font-semibold text-sm line-clamp-1 flex-1"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {extractSenderName(email.sender)}
                        </p>
                        <span
                          className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium"
                          style={{
                            backgroundColor: 'var(--accent-primary)',
                            color: 'white',
                          }}
                        >
                          {formatSnoozeTime(email.snoozedUntil)}
                        </span>
                      </div>
                      <p
                        className="text-sm font-medium line-clamp-1 mb-1"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {email.subject || '(No Subject)'}
                      </p>
                      <p
                        className="text-xs line-clamp-2"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {email.snippet || 'No preview available'}
                      </p>
                    </div>

                  {/* Actions */}
                  {editingId === email.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleUpdateSnoozeTime(email.id, 5)}
                          className="px-3 py-2 text-xs rounded-lg transition-colors font-medium hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          + 5m
                        </button>
                        <button
                          onClick={() => handleUpdateSnoozeTime(email.id, 30)}
                          className="px-3 py-2 text-xs rounded-lg transition-colors font-medium hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          + 30m
                        </button>
                        <button
                          onClick={() => handleUpdateSnoozeTime(email.id, 60)}
                          className="px-3 py-2 text-xs rounded-lg transition-colors font-medium hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          + 1h
                        </button>
                        <button
                          onClick={() => handleUpdateSnoozeTime(email.id, 240)}
                          className="px-3 py-2 text-xs rounded-lg transition-colors font-medium hover:opacity-80"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          + 4h
                        </button>
                      </div>
                      <button
                        onClick={() => setEditingId(null)}
                        className="w-full px-3 py-2 text-xs rounded-lg transition-colors font-medium"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUnsnooze(email.id)}
                        className="flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-all hover:opacity-90 flex items-center justify-center gap-1"
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: 'white',
                        }}
                      >
                        <span className="material-symbols-outlined text-base">
                          notifications_active
                        </span>
                        Unsnooze
                      </button>
                      <button
                        onClick={() => setEditingId(email.id)}
                        className="px-3 py-2 text-sm rounded-lg transition-all hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                        }}
                        aria-label="Edit snooze time"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                    </div>
                  )}

                  {/* Restore Info */}
                  {email.snoozedFromStatus && (
                    <p
                      className="text-xs mt-2 flex items-center gap-1"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        restore
                      </span>
                      Will return to: {email.snoozedFromStatus}
                    </p>
                  )}
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SnoozedManager;
