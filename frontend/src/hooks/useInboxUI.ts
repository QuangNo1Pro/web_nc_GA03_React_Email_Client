import { useState, useCallback } from 'react';

export function useInboxUI({
  setSelectedMailbox,
  setSelectedEmail,
  setMobileView,
  setStarredState,
  setSelectedEmails,
  setShowCheckboxes,
  setFocusedEmailIndex,
  setCurrentPage,
  queryClient,
  user,
  emails,
}: {
  setSelectedMailbox: (v: string) => void;
  setSelectedEmail: (v: string | null) => void;
  setMobileView: (v: 'emails' | 'email') => void;
  setStarredState: (v: any) => void;
  setSelectedEmails: (v: Set<string>) => void;
  setShowCheckboxes: (v: boolean) => void;
  setFocusedEmailIndex: (v: number) => void;
  setCurrentPage: (v: number) => void;
  queryClient: any;
  user: any;
  emails: any[];
}) {
  // UI state
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMailboxMenu, setShowMailboxMenu] = useState(false);
  const [showMoveToMenu, setShowMoveToMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [focusedEmailIndex, setFocusedEmailIndexLocal] = useState(0);

  // Logout
  const handleLogout = useCallback((logout: () => void) => {
    logout();
  }, []);

  // Mailbox select
  const handleMailboxSelect = useCallback((mailboxId: string) => {
    setSelectedMailbox(mailboxId);
    setSelectedEmail(null);
    setMobileView('emails');
    setStarredState({});
    setSelectedEmails(new Set());
    setShowCheckboxes(false);
    setFocusedEmailIndex(0);
    setCurrentPage(1);
    queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
  }, [setSelectedMailbox, setSelectedEmail, setMobileView, setStarredState, setSelectedEmails, setShowCheckboxes, setFocusedEmailIndex, setCurrentPage, queryClient]);

  // Select all
  const handleToggleSelectAll = useCallback((paginatedEmails: any[], selectedEmails: Set<string>) => {
    if (selectedEmails.size === paginatedEmails.length) {
      setSelectedEmails(new Set());
      setShowCheckboxes(false);
    } else {
      setShowCheckboxes(true);
      setSelectedEmails(new Set(paginatedEmails.map((e: any) => e.id)));
    }
  }, [setSelectedEmails, setShowCheckboxes]);

  // Mouse down for resizing
  const handleMouseDown = useCallback((dividerIndex: number, mailboxWidth: number, emailListWidth: number, setMailboxWidth: (v: number) => void, setEmailListWidth: (v: number) => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startMailboxWidth = mailboxWidth;
    const startEmailListWidth = emailListWidth;
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const containerWidth = window.innerWidth;
      const deltaPercent = (deltaX / containerWidth) * 100;
      if (dividerIndex === 1) {
        const newMailboxWidth = Math.max(15, Math.min(30, startMailboxWidth + deltaPercent));
        setMailboxWidth(newMailboxWidth);
      } else if (dividerIndex === 2) {
        const newEmailListWidth = Math.max(30, Math.min(50, startEmailListWidth + deltaPercent));
        setEmailListWidth(newEmailListWidth);
      }
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  return {
    showProfileMenu,
    setShowProfileMenu,
    showMailboxMenu,
    setShowMailboxMenu,
    showMoveToMenu,
    setShowMoveToMenu,
    showMoreMenu,
    setShowMoreMenu,
    showKeyboardHelp,
    setShowKeyboardHelp,
    focusedEmailIndex,
    setFocusedEmailIndex: setFocusedEmailIndexLocal,
    handleLogout,
    handleMailboxSelect,
    handleToggleSelectAll,
    handleMouseDown,
  };
}
