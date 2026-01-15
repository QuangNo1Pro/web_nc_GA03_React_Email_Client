import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as ReactWindow from 'react-window';
import { api } from '../services/api';
import { searchEmails, semanticSearchEmails, SearchResult } from '../services/searchService';
import { SearchBar } from '../components/SearchBar';
import { SearchResultsList } from '../components/SearchResultsList';
import { useSearchMode } from '../components/SearchModeSelector';
import {
  fetchMailboxes,
  fetchEmails,
  fetchEmail,
  patchEmailStar,
  patchEmailRead,
  patchBulkRead,
  patchEmailSpam,
  deleteEmail,
  patchEmailArchive,
  postEmailMove,
  postGmailRefresh,
  postSendEmail,
  getAttachment,
  saveDraft,
} from '../services/emailService';
import MaterialIcon from '../components/MaterialIcon';
import MailboxList from '../components/MailboxList';
import EmailRow from '../components/EmailRow';
import EmailList, { EmailListHandle } from '../components/EmailList';
import { useAuth } from "../auth/AuthContext";
import { useTheme } from '../contexts/ThemeContext';
import ComposeModal from '../components/ComposeModal';
import { useComposeEmail } from '../hooks/useComposeEmail';
import { useComposeHandlers } from '../hooks/useComposeHandlers';
import { useEmailPagination } from '../hooks/useEmailPagination';
import { useGmailSSE } from '../hooks/useGmailSSE';
import { KeyboardShortcutsHelp, KeyboardShortcutsButton } from '../components/KeyboardShortcutsHelp';

const FixedSizeList = (ReactWindow as any).FixedSizeList;

import EmailDetail from '../components/EmailDetail';
import ConfirmDialog from '../components/ConfirmDialog';

import {
  mailboxLabelVN,
  getMailboxLabelVN,
  b64toBlob,
  parseAttachments,
  getAvatarColor,
  extractEmails,
  parseEmail,
} from '../utils/emailUtils';

// ...existing code...

// ===== ICON MAP =====
// Đảm bảo các icon được import đúng
import { IoIosArrowDown } from 'react-icons/io';

const mailboxIcons: Record<string, JSX.Element> = {
  INBOX: <MaterialIcon name="inbox" />,
  STARRED: <MaterialIcon name="star" />,
  SENT: <MaterialIcon name="send" />,
  IMPORTANT: <MaterialIcon name="label_important" />,
  DRAFT: <MaterialIcon name="draft" />,
  SPAM: <MaterialIcon name="report" />,
  TRASH: <MaterialIcon name="delete" />,
  UNREAD: <MaterialIcon name="mark_email_unread" />,
  CHAT: <MaterialIcon name="chat" />,
  default: <MaterialIcon name="mail" />,
};

// ...existing code...

export default function Inbox() {
  // State for Mark as Read button hover
  const [isMarkHovered, setIsMarkHovered] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const emailListComponentRef = useRef<EmailListHandle>(null);

  // Store ref globally for access in handlers
  useEffect(() => {
    (window as any).__EMAIL_LIST_REF__ = emailListComponentRef.current;
  }, [emailListComponentRef.current]);

  // === Profile menu + Auth ===
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // 👉 State declarations - must be before effects that use them
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMailbox, setSelectedMailbox] = useState('INBOX');

  // 🔍 Fuzzy search state (F2)
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isInSearchMode, setIsInSearchMode] = useState(false);
  const [searchMode, setSearchMode] = useSearchMode();

  // Debug: log search state changes
  useEffect(() => {
    console.log('[Inbox] 🔍 Search state:', { isInSearchMode, isSearching, resultsCount: searchResults.length, error: searchError });
  }, [isInSearchMode, isSearching, searchResults, searchError]);


  // === Real-time email sync via SSE ===
  const { isConnected: sseConnected } = useGmailSSE(true);

  // Debug SSE connection
  useEffect(() => {
    console.log('[Inbox] SSE connection status:', sseConnected);
  }, [sseConnected]);

  // Listen for email updates from SSE (unsnooze events)
  useEffect(() => {
    const handleEmailUpdate = (event: any) => {
      console.log('[Inbox] 📧 Email update received:', event.detail);
      if (event.detail?.action === 'unsnooze') {
        const { email, originalStatus } = event.detail;
        console.log(`[Inbox] 🔄 Refreshing due to unsnooze: ${email?.messageId} → ${originalStatus}`);

        // Invalidate mailboxes to update counts
        queryClient.invalidateQueries({ queryKey: ['mailboxes'] });

        // Invalidate current mailbox if it's the target
        if (selectedMailbox === originalStatus || selectedMailbox === 'INBOX') {
          queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
        }

        toast.success(`Email moved back to ${originalStatus}`);
      }
    };

    window.addEventListener('email-update', handleEmailUpdate);
    return () => window.removeEventListener('email-update', handleEmailUpdate);
  }, [queryClient, selectedMailbox]);

  const handleLogout = () => {
    logout();
  };
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [enableAutoSelect, setEnableAutoSelect] = useState(false); // Only auto-select when using keyboard
  const [mobileView, setMobileView] = useState<'emails' | 'email'>('emails');

  const [starredState, setStarredState] = useState<{ [id: string]: boolean }>(
    {},
  );
  const [readState, setReadState] = useState<{ [id: string]: boolean }>(
    {},
  );
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(
    new Set(),
  );

  const [showCheckboxes, setShowCheckboxes] = useState(false);

  const [mailboxWidth, setMailboxWidth] = useState(20);
  const [emailListWidth, setEmailListWidth] = useState(40);

  // Compose email state & logic
  const {
    showComposeModal,
    setShowComposeModal,
    composeTo,
    setComposeTo,
    composeCc,
    setComposeCc,
    composeBcc,
    setComposeBcc,
    composeSubject,
    setComposeSubject,
    composeBody,
    setComposeBody,
    composeAttachments,
    setComposeAttachments,
    showCc,
    setShowCc,
    showBcc,
    setShowBcc,
    composeErrors,
    setComposeErrors,
    isSending,
    setIsSending,
    editingDraftId,
    setEditingDraftId
  } = useComposeEmail();

  // Hàm đóng compose và lưu nháp nếu chưa gửi
  const handleCloseCompose = async () => {
    // Nếu chưa gửi, có subject/body hoặc file thì lưu nháp
    const hasContent = composeSubject.trim() || composeBody.trim() || composeAttachments.length > 0;
    const notSent = !isSending && (hasContent || composeTo.trim() || composeCc.trim() || composeBcc.trim());
    if (notSent) {
      try {
        // Convert files to base64 for draft
        const attachmentsBase64 = await Promise.all(
          composeAttachments.map(async (file) => {
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(',')[1]);
              };
              reader.readAsDataURL(file);
            });
            return { filename: file.name, mimeType: file.type, base64Content: base64 };
          })
        );

        // Lưu hoặc update draft
        await saveDraft({
          to: composeTo,
          cc: composeCc,
          bcc: composeBcc,
          subject: composeSubject,
          body: composeBody,
          attachments: attachmentsBase64,
          draftId: editingDraftId || undefined, // Pass draftId nếu đang edit
        });

        // Refresh draft mailbox to show new draft
        queryClient.invalidateQueries({ queryKey: ['emails', 'DRAFT'] });
        queryClient.invalidateQueries({ queryKey: ['mailboxes'] });

        toast.success(editingDraftId ? 'Đã cập nhật thư nháp' : 'Đã lưu vào thư nháp');
      } catch (err) {
        console.error('Save draft error:', err);
        toast.error('Lưu nháp thất bại');
      }
    }
    setShowComposeModal(false);
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setComposeSubject('');
    setComposeBody('');
    setComposeAttachments([]);
    setShowCc(false);
    setShowBcc(false);
    setComposeErrors({});
    setEditingDraftId(null); // Clear editing draft ID
  };
  <button onClick={handleCloseCompose} className="text-gray-500 hover:text-gray-700">✕</button>

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [focusedEmailIndex, setFocusedEmailIndex] = useState(0);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showMailboxMenu, setShowMailboxMenu] = useState(false);
  const [showMoveToMenu, setShowMoveToMenu] = useState(false);
  const [showReadFilterMenu] = useState(false);
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>(
    'all',
  );

  const [downloadingAttachments, setDownloadingAttachments] = useState<
    Set<string>
  >(new Set());

  const emailListRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(500);

  const [isMailHoveredDetail, setIsMailHoveredDetail] = useState(false);
  const [isStarHoveredDetail, setIsStarHoveredDetail] = useState(false);
  const [isRefreshHovered, setIsRefreshHovered] = useState(false);
  const [isReplyHovered, setIsReplyHovered] = useState(false);
  const [isReplyAllHovered, setIsReplyAllHovered] = useState(false);
  const [isForwardHovered, setIsForwardHovered] = useState(false);
  const [isReplyHoveredDetail, setIsReplyHoveredDetail] = useState(false);
  const [isReplyAllHoveredDetail, setIsReplyAllHoveredDetail] =
    useState(false);
  const [isForwardHoveredDetail, setIsForwardHoveredDetail] =
    useState(false);
  const [isArchiveHoveredDetail, setIsArchiveHoveredDetail] =
    useState(false);
  const [isDeleteHoveredDetail, setIsDeleteHoveredDetail] =
    useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState<string | null>(null);


  const {
    data: mailboxes,
    isLoading: mailboxesLoading,
    error: mailboxesError,
  } = useQuery({
    queryKey: ['mailboxes'],
    queryFn: fetchMailboxes,
  });

  // === KEYBOARD NAVIGATION STATE ===
  const [navMode, setNavMode] = useState<'emails' | 'sidebar'>('emails');
  const [focusedMailboxId, setFocusedMailboxId] = useState<string | null>(null);

  const navMailboxOrder = useMemo(() => [
    "CHAT", "INBOX", "UNREAD", "STARRED", "SENT", "DRAFT", "IMPORTANT", "SPAM", "TRASH"
  ], []);

  const sortedMailboxes = useMemo(() => {
    if (!mailboxes) return [];
    return mailboxes
      .filter((mb: any) => {
        const allowed = ["CHAT", "INBOX", "UNREAD", "STARRED", "SENT", "DRAFT", "IMPORTANT", "SPAM", "TRASH", "ALL_MAIL"];
        return allowed.includes(mb.id);
      })
      .sort((a: any, b: any) => {
        const idxA = navMailboxOrder.indexOf(a.id);
        const idxB = navMailboxOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.id.localeCompare(b.id);
      });
  }, [mailboxes, navMailboxOrder]);

  // Sync focused mailbox with selection when switching mode or initially
  useEffect(() => {
    if (navMode === 'emails' && selectedMailbox) {
      setFocusedMailboxId(selectedMailbox);
    }
  }, [selectedMailbox, navMode]);

  // Debug: log mailboxes data
  useEffect(() => {
    if (mailboxes) {
      console.log('📬 Mailboxes data:', mailboxes);
      console.log('📬 Sample mailbox:', mailboxes[0]);
    }
  }, [mailboxes]);

  const {
    data: emailsRaw,
    isLoading: emailsLoading,
    isFetching: emailsFetching,
    error: emailsError,
  } = useQuery({
    queryKey: ['emails', selectedMailbox],
    queryFn: () => fetchEmails(selectedMailbox),
    enabled: !!selectedMailbox,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent auto-refetch
    select: (data) => {
      const parsedEmails = data.messages.map(parseEmail);
      if (selectedMailbox === 'ALL_MAIL') {
        // loại INBOX nếu cần
        return parsedEmails.filter(
          (email: any) => !email.labelIds?.includes('INBOX'),
        );
      }
      return parsedEmails;
    },
  });

  // Merge readState overrides into emails, exactly like starredState
  const emails = useMemo(() => {
    if (!emailsRaw) return [];
    return emailsRaw.map((email: any) => ({
      ...email,
      read: readState[email.id] !== undefined ? readState[email.id] : email.read,
    }));
  }, [emailsRaw, readState]);

  const {
    data: emailDetail,
    isLoading: emailLoading,
    error: emailError,
  } = useQuery({
    queryKey: ['email', selectedEmail ?? undefined],
    queryFn: () => selectedEmail ? fetchEmail(selectedEmail) : Promise.resolve(undefined),
    enabled: !!selectedEmail,
  });

  // Sử dụng hook useEmailPagination cho filter và phân trang
  const {
    filteredEmails,
    paginatedEmails,
    currentPage,
    setCurrentPage,
    pageSize,
    startIndex,
    totalPages,
    safeCurrentPage,
  } = useEmailPagination(
    emails,
    searchQuery,
    selectedMailbox,
    starredState,
    readFilter,
    20
  );

  // Email đang xem (detail) - merge readState override for consistent UI
  const email =
    selectedEmail &&
    (() => {
      const listEmail = emails?.find((e: any) => e.id === selectedEmail);
      if (!emailDetail) return listEmail || null;

      // CRITICAL: Parse sender from payload.headers if not available as direct field
      const parseSenderFromPayload = (email: any): string => {
        if (email?.sender) return email.sender;
        if (email?.from) return email.from;
        // Parse from payload headers
        const headers = email?.payload?.headers || [];
        const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
        return fromHeader;
      };

      const senderField = parseSenderFromPayload(listEmail) || parseSenderFromPayload(emailDetail);

      // CRITICAL: Build object carefully to avoid overriding with undefined values
      return {
        // Start with listEmail as base (has sender, subject, timestamp, etc.)
        ...(listEmail || {}),
        // Add emailDetail fields that are actually populated
        id: selectedEmail,
        body: emailDetail?.body || listEmail?.body || '',
        attachments: parseAttachments(emailDetail?.payload?.parts),
        // CRITICAL: Backend returns lowercase header keys (headers.from, not headers.From)
        from: emailDetail?.headers?.from || senderField || listEmail?.from,
        to: emailDetail?.headers?.to || listEmail?.to,
        cc: emailDetail?.headers?.cc || listEmail?.cc,
        bcc: emailDetail?.headers?.bcc || listEmail?.bcc,
        subject: emailDetail?.headers?.subject || listEmail?.subject,
        received: emailDetail?.headers?.date || listEmail?.timestamp,
        // Preserve both sender and from for maximum compatibility
        sender: senderField || emailDetail?.headers?.from,
        timestamp: listEmail?.timestamp || emailDetail?.headers?.date,
        // Override read state from readState for instant UI update
        read: readState[selectedEmail] !== undefined ? readState[selectedEmail] : (listEmail?.read ?? emailDetail?.read),
      };
    })();

  const handleDownloadAttachment = async (
    messageId: string,
    attachment: any,
  ) => {
    if (downloadingAttachments.has(attachment.attachmentId)) return;

    setDownloadingAttachments((prev) =>
      new Set(prev).add(attachment.attachmentId),
    );
    const toastId = toast.loading(
      `Đang tải xuống ${attachment.filename}...`,
    );

    try {
      const { data } = await api.get(
        `/gmail/attachments/${messageId}/${attachment.attachmentId}`,
      );

      const b64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
      const blob = b64toBlob(b64, attachment.mimeType);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Tải xuống thành công!', { id: toastId });
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Lỗi khi tải xuống tệp!', { id: toastId });
    } finally {
      setDownloadingAttachments((prev) => {
        const newSet = new Set(prev);
        newSet.delete(attachment.attachmentId);
        return newSet;
      });
    }
  };

  /**
   * 🔍 Handle search (Fuzzy or Semantic based on mode)
   * - Call appropriate API based on searchMode
   * - Filter by selected mailbox
   * - Switch to search results view
   */
  const handleSearch = async (query: string) => {
    console.log('[Inbox] 🔍 handleSearch called with:', query, 'in mailbox:', selectedMailbox, 'mode:', searchMode);

    // Check auth token status
    const token = localStorage.getItem('access_token');
    console.log('[Inbox] 🔐 Token in localStorage:', token ? `Exists (${token.substring(0, 20)}...)` : 'NOT FOUND');

    setSearchQuery(query); // ✅ Sync searchQuery state


    if (!query.trim()) {
      setIsInSearchMode(false);
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    try {
      setIsSearching(true);
      setSearchError(null);
      setIsInSearchMode(true); // Set search mode immediately
      setSelectedEmail(null); // Clear selected email when starting a search
      console.log('[Inbox] 📡 Calling', searchMode, 'search API with label:', selectedMailbox);

      const response = searchMode === 'fuzzy'
        ? await searchEmails(query, {
          limit: 50,
          offset: 0,
          label: selectedMailbox, // ✅ Filter by selected mailbox
        })
        : await semanticSearchEmails(query, {
          limit: 50,
          offset: 0,
          label: selectedMailbox, // ✅ Filter by selected mailbox
        });

      console.log('🔍 Search results:', response.data.results);
      setSearchResults(response.data.results);
      toast.success(`Tìm thấy ${response.data.results.length} kết quả trong ${selectedMailbox}`);
    } catch (error) {
      console.error('Search error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Tìm kiếm thất bại';
      setSearchError(errorMsg);
      setSearchResults([]); // Clear results on error
      toast.error(errorMsg);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * 🔙 Exit search mode + back to normal inbox view
   */
  const handleClearSearch = () => {
    setIsInSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchError(null);
    setSelectedEmail(null);
    setEnableAutoSelect(false); // Reset auto-select
  };

  const handleMailboxSelect = (mailboxId: string) => {
    setSelectedMailbox(mailboxId);
    setSelectedEmail(null);
    setEnableAutoSelect(false); // Reset auto-select
    setMobileView('emails');
    setStarredState({});
    setReadState({});
    setSelectedEmails(new Set());
    setShowCheckboxes(false);
    setFocusedEmailIndex(0);
    setCurrentPage(1); // reset về page 1 khi đổi mailbox

    // 🔍 Reset search state khi đổi mailbox
    setIsInSearchMode(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);

    queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
  };

  // Keyboard navigation (trên trang hiện tại)
  useEffect(() => {
    // Debug log state changes if needed
  }, [selectedEmail, mobileView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ignore inputs & contenteditable
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
      if (showComposeModal && !e.ctrlKey) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setEnableAutoSelect(true); // Enable auto-select on keyboard nav
          if (navMode === 'emails') {
            if (paginatedEmails && paginatedEmails.length > 0) {
              setFocusedEmailIndex((prev) => Math.min(prev + 1, paginatedEmails.length - 1));
            }
          } else if (navMode === 'sidebar') {
            if (sortedMailboxes.length > 0) {
              const currIdx = sortedMailboxes.findIndex((m: any) => m.id === focusedMailboxId);
              const nextIdx = currIdx === -1 ? 0 : Math.min(currIdx + 1, sortedMailboxes.length - 1);
              setFocusedMailboxId(sortedMailboxes[nextIdx].id);
            }
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setEnableAutoSelect(true); // Enable auto-select on keyboard nav
          if (navMode === 'emails') {
            setFocusedEmailIndex((prev) => Math.max(prev - 1, 0));
          } else if (navMode === 'sidebar') {
            if (sortedMailboxes.length > 0) {
              const currIdx = sortedMailboxes.findIndex((m: any) => m.id === focusedMailboxId);
              const nextIdx = currIdx === -1 ? 0 : Math.max(currIdx - 1, 0);
              setFocusedMailboxId(sortedMailboxes[nextIdx].id);
            }
          }
          break;
        case 'ArrowLeft':
          // Move from emails -> sidebar
          if (navMode === 'emails') {
            e.preventDefault();
            setNavMode('sidebar');
            if (!focusedMailboxId && selectedMailbox) {
              setFocusedMailboxId(selectedMailbox);
            } else if (!focusedMailboxId && sortedMailboxes.length > 0) {
              setFocusedMailboxId(sortedMailboxes[0].id);
            }
          }
          break;
        case 'ArrowRight':
          // Move from sidebar -> emails
          if (navMode === 'sidebar') {
            e.preventDefault();
            setNavMode('emails');
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (navMode === 'emails') {
            if (paginatedEmails && paginatedEmails[focusedEmailIndex]) {
              handleEmailSelect(paginatedEmails[focusedEmailIndex].id);
            }
          } else if (navMode === 'sidebar') {
            if (focusedMailboxId) {
              handleMailboxSelect(focusedMailboxId);
              setNavMode('emails');
            }
          }
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleRefresh();
          }
          break;
        case 'c':
          // Allow Ctrl+C (common user expectation/guide) or just 'c'
          // If text is selected, let default Copy (Ctrl+C) happen
          if (window.getSelection()?.toString()) break;

          if (e.ctrlKey || e.metaKey || !e.ctrlKey) {
            e.preventDefault();
            setEditingDraftId(null);
            setShowComposeModal(true);
          }
          break;
        case 's':
          if ((e.ctrlKey || e.metaKey) && selectedEmail) {
            e.preventDefault();
            handleToggleStar(selectedEmail);
          }
          break;
        case 'u':
          if ((e.ctrlKey || e.metaKey) && selectedEmail) {
            e.preventDefault();
            handleToggleRead(selectedEmail);
          }
          break;
        case 'Escape':
          if (showComposeModal) {
            setShowComposeModal(false);
          } else if (showKeyboardHelp) {
            setShowKeyboardHelp(false);
          } else if (showMailboxMenu) {
            setShowMailboxMenu(false);
          } else if (selectedEmail) {
            setSelectedEmail(null);
            setMobileView('emails');
            // If viewing list details, ensure nav mode is emails
            setNavMode('emails');
          }
          break;
        case '?':
          if (e.shiftKey) {
            e.preventDefault();
            setShowKeyboardHelp(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    paginatedEmails,
    focusedEmailIndex,
    selectedEmail,
    showComposeModal,
    showKeyboardHelp,
    showMailboxMenu,
    navMode,
    focusedMailboxId,
    sortedMailboxes,
    selectedMailbox
  ]);


  // update height list khi resize
  useEffect(() => {
    const updateHeight = () => {
      if (emailListRef.current) {
        setListHeight(emailListRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    if (mailboxes) {
      console.log('Mailboxes data:', mailboxes);
    }
  }, [mailboxes]);

  // sync starredState and readState
  useEffect(() => {
    if (!emailsRaw) return;
    // Only update starredState if emails array actually changed
    setStarredState((prev) => {
      const newState: { [id: string]: boolean } = {};
      emailsRaw.forEach((email: any) => {
        newState[email.id] = !!email.starred;
      });
      // Only update if different
      const isSame = Object.keys(newState).length === Object.keys(prev).length && Object.keys(newState).every((id) => newState[id] === prev[id]);
      return isSame ? prev : newState;
    });
    // Sync readState from emailsRaw
    setReadState((prev) => {
      const newState: { [id: string]: boolean } = {};
      emailsRaw.forEach((email: any) => {
        newState[email.id] = !!email.read;
      });
      // Only update if different
      const isSame = Object.keys(newState).length === Object.keys(prev).length && Object.keys(newState).every((id) => newState[id] === prev[id]);
      return isSame ? prev : newState;
    });
  }, [emailsRaw]);

  // khi đổi filter / mailbox / page → reset focus về dòng đầu
  useEffect(() => {
    setFocusedEmailIndex(0);
    setSelectedEmail(null); // Clear selected email when context changes
  }, [selectedMailbox, readFilter, currentPage]);

  const handleToggleStar = async (emailId: string) => {
    const newStarred = !starredState[emailId];
    console.log(
      `Toggle star for email ${emailId}: ${starredState[emailId]} -> ${newStarred}`,
    );

    setStarredState((prev) => ({
      ...prev,
      [emailId]: newStarred,
    }));

    // data của query ['emails', selectedMailbox] là array emails (do select đã map)
    queryClient.setQueryData(['emails', selectedMailbox], (oldData: any) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.map((e: any) =>
        e.id === emailId ? { ...e, starred: newStarred } : e,
      );
    });

    queryClient.setQueryData(['emails', 'starred'], (oldData: any) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.map((e: any) =>
        e.id === emailId ? { ...e, starred: newStarred } : e,
      );
    });

    try {
      await api.patch(`/gmail/emails/${emailId}/star`, {
        starred: newStarred,
      });
      // Only invalidate mailboxes for count updates, optimistic UI handles the rest
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      if (selectedEmail === emailId) {
        queryClient.invalidateQueries({ queryKey: ['email', emailId] });
      }
    } catch (err) {
      console.error('Star API error:', err);
      setStarredState((prev) => ({
        ...prev,
        [emailId]: !newStarred,
      }));
      queryClient.setQueryData(
        ['emails', selectedMailbox],
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((e: any) =>
            e.id === emailId ? { ...e, starred: !newStarred } : e,
          );
        },
      );
      toast.error('Lỗi cập nhật trạng thái starred!');
    }
  };

  const handleToggleRead = async (emailId: string) => {
    const newRead = !readState[emailId];
    console.log(
      `Toggle read for email ${emailId}: ${readState[emailId]} -> ${newRead}`,
    );

    // Update readState immediately for instant UI feedback
    setReadState((prev) => ({
      ...prev,
      [emailId]: newRead,
    }));

    // Update React Query cache to sync detail view
    queryClient.setQueryData(['email', emailId], (oldDetail: any) => {
      if (!oldDetail) return oldDetail;
      return { ...oldDetail, read: newRead };
    });

    // DO NOT remove email from cache, just update read state
    // Email will stay in list until manual refresh or folder change

    try {
      await api.patch(`/gmail/emails/${emailId}/read`, {
        read: newRead,
      });
      // Only invalidate mailboxes to update unread count, NOT emails list
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
    } catch (err) {
      console.error('Read API error:', err);
      // Rollback on error
      setReadState((prev) => ({
        ...prev,
        [emailId]: !newRead,
      }));
      queryClient.setQueryData(['email', emailId], (oldDetail: any) => {
        if (!oldDetail) return oldDetail;
        return { ...oldDetail, read: !newRead };
      });
      toast.error('Lỗi cập nhật trạng thái đã đọc/chưa đọc!');
    }
  };


  const handleEmailSelect = async (emailId: string) => {
    // Sync focused index to prevent keyboard nav effect from overriding mouse selection
    if (paginatedEmails) {
      const idx = paginatedEmails.findIndex((e: any) => e.id === emailId);
      if (idx !== -1) {
        setFocusedEmailIndex(idx);
      }
    }

    // If in UNREAD mailbox, remove read emails from cache when selecting new email
    if (selectedMailbox === 'UNREAD' && selectedEmail !== emailId) {
      queryClient.setQueryData(['emails', 'UNREAD'], (oldData: any) => {
        if (!oldData || !oldData.messages) return oldData;
        // Remove emails that are marked as read in readState
        return {
          ...oldData,
          messages: oldData.messages.filter((e: any) => {
            // Keep email if it's not in readState or if it's marked as unread
            return readState[e.id] === undefined || !readState[e.id];
          })
        };
      });
    }

    const emailObj = emails.find((e: any) => e.id === emailId);
    if (selectedMailbox === 'DRAFT' && emailObj) {
      // Nếu là thư nháp, mở compose và điền lại nội dung
      try {
        // Fetch full email details to get body and attachments
        const { data: draftDetail } = await api.get(`/gmail/emails/${emailId}`);

        // Extract recipients from headers
        const toHeader = draftDetail.headers?.To || emailObj.to || '';
        const ccHeader = draftDetail.headers?.Cc || emailObj.cc || '';
        const bccHeader = draftDetail.headers?.Bcc || emailObj.bcc || '';
        const subjectHeader = draftDetail.headers?.Subject || emailObj.subject || '';

        setComposeTo(toHeader);
        setComposeCc(ccHeader);
        setComposeBcc(bccHeader);
        setComposeSubject(subjectHeader);
        setComposeBody(draftDetail.body || emailObj.body || '');
        setComposeAttachments([]); // Attachments handling can be enhanced later
        setShowCc(!!ccHeader);
        setShowBcc(!!bccHeader);
        setComposeErrors({});
        setEditingDraftId(emailId); // Set draft ID đang chỉnh sửa
        setShowComposeModal(true);
      } catch (err) {
        console.error('Error loading draft:', err);
        toast.error('Không thể mở thư nháp');
      }
      return;
    }
    setSelectedEmail(emailId);
    setMobileView("email");
    setSelectedEmails(new Set());
    setShowCheckboxes(false);
    if (emailObj && !emailObj.read) {
      handleToggleRead(emailId);
    }
  };


  const handleToggleCheckbox = (emailId: string) => {
    setSelectedEmails((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
        if (newSet.size === 0) {
          setShowCheckboxes(false);
          setSelectedEmail(null);
        }
      } else {
        newSet.add(emailId);
        setShowCheckboxes(true);
      }
      return newSet;
    });
  };

  const handleToggleSelectAll = () => {
    if (!filteredEmails) return;

    if (selectedEmails.size === paginatedEmails.length) {
      setSelectedEmails(new Set());
      setShowCheckboxes(false);
    } else {
      setShowCheckboxes(true);
      setSelectedEmails(new Set(paginatedEmails.map((e: any) => e.id)));
    }
  };

  const handleMouseDown = (dividerIndex: number) => (
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const startMailboxWidth = mailboxWidth;
    const startEmailListWidth = emailListWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const containerWidth = window.innerWidth;
      const deltaPercent = (deltaX / containerWidth) * 100;

      if (dividerIndex === 1) {
        const newMailboxWidth = Math.max(
          15,
          Math.min(30, startMailboxWidth + deltaPercent),
        );
        setMailboxWidth(newMailboxWidth);
      } else if (dividerIndex === 2) {
        const newEmailListWidth = Math.max(
          30,
          Math.min(50, startEmailListWidth + deltaPercent),
        );
        setEmailListWidth(newEmailListWidth);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleRefresh = async (silent?: boolean) => {
    const toastId = silent ? undefined : toast.loading('Đang đồng bộ với Gmail...');
    try {
      await api.post('/gmail/refresh');
      // Incremental sync is fast, invalidate both emails and mailboxes
      queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      if (!silent) {
        toast.success('Đã đồng bộ thành công!', { id: toastId });
      }
    } catch (err) {
      console.error('Refresh error:', err);
      if (!silent) {
        toast.error('Lỗi khi đồng bộ!', { id: toastId });
      }
    }
  };

  const handleBulkMarkRead = async (read: boolean) => {
    // Nếu chưa tick checkbox → dùng email đang xem
    const targetIds =
      selectedEmails.size > 0
        ? Array.from(selectedEmails)
        : selectedEmail
          ? [selectedEmail]
          : [];

    if (targetIds.length === 0) return;

    // ===== OPTIMISTIC UI: Update readState immediately =====
    const newReadState: { [id: string]: boolean } = {};
    targetIds.forEach(id => {
      newReadState[id] = read;
    });
    setReadState(prev => ({ ...prev, ...newReadState }));

    // Preserve scroll position
    const scrollOffset = emailListComponentRef.current?.preserveScroll?.() || 0;

    try {
      await api.patch('/gmail/emails/bulk-read', {
        ids: targetIds,
        read,
      });

      toast.success(`Đã đánh dấu ${targetIds.length} email!`);

      // Only invalidate mailboxes for count updates
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });

      // Restore scroll after state update
      setTimeout(() => {
        emailListComponentRef.current?.restoreScroll?.(scrollOffset);
      }, 0);
    } catch (err) {
      console.error('Bulk mark read error:', err);
      toast.error('Lỗi khi cập nhật trạng thái!');

      // Rollback on error
      const rollbackState: { [id: string]: boolean } = {};
      targetIds.forEach(id => {
        rollbackState[id] = !read;
      });
      setReadState(prev => ({ ...prev, ...rollbackState }));
    }
  };

  const handleMarkSpam = async (emailId: string) => {
    try {
      await api.patch(`/gmail/emails/${emailId}/spam`);

      // Only invalidate mailboxes for count updates
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });

      toast.success("Đã báo cáo spam!");
      await handleRefresh(true);
    } catch (err) {
      console.error("Spam error:", err);
      toast.error("Lỗi khi báo cáo spam!");
    }
  };

  const handleDeleteEmail = async (emailId?: string) => {
    const id = emailId || selectedEmail;
    if (!id) return;

    // Check if email is in trash or selected mailbox is TRASH
    const emailObj = emails?.find((e: any) => e.id === id);
    const isInTrash = emailObj?.labelIds?.includes('TRASH') || selectedMailbox === 'TRASH';

    if (isInTrash) {
      // Use native browser confirm dialog
      const confirmed = window.confirm('Thư sẽ được xóa vĩnh viễn. Bạn chắc chắn muốn xóa nó chứ?');
      if (!confirmed) return;
      await performDelete(id, true);
      return;
    }

    // Delete immediately for non-trash emails
    await performDelete(id, false);
  };

  const performDelete = async (emailId: string, isPermanent: boolean) => {
    try {
      await api.delete(`/gmail/emails/${emailId}`);
      // Only clear selectedEmail if the deleted email is no longer in emails list
      if (selectedEmail === emailId) {
        // Wait for emails to refresh, then check if email still exists
        setTimeout(() => {
          const stillExists = emails?.some((e: any) => e.id === emailId);
          if (!stillExists) {
            setSelectedEmail(null);
          }
        }, 500);
      }
      setSelectedEmails(new Set());
      // Only invalidate mailboxes for count updates
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });

      if (isPermanent) {
        toast.success('Đã xóa vĩnh viễn.');
      } else {
        toast.success('Đã xóa email.');
      }

      await handleRefresh(true);
    } catch (err: any) {
      console.error('Delete email error:', err);
      console.error('Response:', err.response?.data);
      const errorMsg =
        err.response?.data?.message || 'Lỗi khi xóa email!';
      if (
        errorMsg.includes('insufficient permissions') ||
        errorMsg.includes('Insufficient permissions')
      ) {
        toast.error('Cần cấp quyền. Vui lòng đăng nhập lại.');
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (emailToDelete) {
      await performDelete(emailToDelete, true);
      setShowDeleteConfirm(false);
      setEmailToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setEmailToDelete(null);
  };

  const handleArchiveEmail = async (emailId?: string) => {
    const id = emailId || selectedEmail;
    if (!id) return;

    try {
      await api.patch(`/gmail/emails/${id}/archive`, {});

      setSelectedEmail(null);
      setSelectedEmails(new Set());

      // Only invalidate mailboxes for count updates
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });

      toast.success('Lưu trữ email thành công!');
    } catch (err: any) {
      console.error('Archive email error:', err);
      console.error('Response:', err.response?.data);
      const errorMsg =
        err.response?.data?.message || 'Lỗi khi lưu trữ email!';
      if (
        errorMsg.includes('insufficient permissions') ||
        errorMsg.includes('Insufficient permissions')
      ) {
        toast.error('Cần cấp quyền. Vui lòng đăng nhập lại.');
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleMoveTo = async (targetLabel: string) => {
    const ids =
      selectedEmails.size > 0
        ? Array.from(selectedEmails)
        : selectedEmail
          ? [selectedEmail]
          : [];

    if (ids.length === 0) return;

    // Không cho chuyển vào SENT nếu không phải email mình gửi
    if (targetLabel === "SENT" && user) {
      const invalid = ids.some((id) => {
        const em = emails.find((e: any) => e.id === id);
        return em && !em.sender?.toLowerCase().includes(user.email.toLowerCase());
      });

      if (invalid) {
        toast.error("Không thể chuyển vào 'Đã gửi' vì có email không phải bạn gửi.");
        setShowMoveToMenu(false);
        return;
      }
    }

    // ===== OPTIMISTIC UI: Update cache immediately =====
    const movedEmails = ids.map(id => emails.find((e: any) => e.id === id)).filter(Boolean);

    // Remove from current mailbox
    queryClient.setQueryData(['emails', selectedMailbox], (oldData: any) => {
      if (!Array.isArray(oldData)) return oldData;
      return oldData.filter((e: any) => !ids.includes(e.id));
    });

    // Add to target mailbox cache
    queryClient.setQueryData(['emails', targetLabel], (oldData: any) => {
      if (!Array.isArray(oldData)) return [];
      const updatedEmails = movedEmails.map((email: any) => ({
        ...email,
        labelIds: [targetLabel, ...(email.labelIds || []).filter((l: string) => l !== selectedMailbox)]
      }));
      return [...updatedEmails, ...oldData];
    });

    // Update mailboxes count optimistically
    queryClient.setQueryData(['mailboxes'], (oldMailboxes: any) => {
      if (!Array.isArray(oldMailboxes)) return oldMailboxes;
      return oldMailboxes.map((mb: any) => {
        if (mb.id === selectedMailbox) {
          return { ...mb, messagesTotal: Math.max(0, mb.messagesTotal - ids.length) };
        }
        if (mb.id === targetLabel) {
          return { ...mb, messagesTotal: mb.messagesTotal + ids.length };
        }
        return mb;
      });
    });

    setSelectedEmail(null);
    setSelectedEmails(new Set());
    setShowMoveToMenu(false);

    try {
      // API call
      await Promise.all(ids.map(id => api.post(`/gmail/emails/${id}/move`, { label: targetLabel })));

      toast.success(`Đã chuyển ${ids.length} email!`);

      // Only invalidate mailboxes for count sync
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      await handleRefresh(true);
    } catch (err) {
      console.error("Move error:", err);
      toast.error("Lỗi khi chuyển thư! Đang hoàn tác...");

      // Rollback on error
      queryClient.invalidateQueries({ queryKey: ["emails", selectedMailbox] });
      queryClient.invalidateQueries({ queryKey: ["emails", targetLabel] });
      queryClient.invalidateQueries({ queryKey: ["mailboxes"] });
    }
  };

  const handleReply = () => {
    if (!email) return;

    // CRITICAL: Try multiple sources to get sender email
    // Priority: email.from (from headers) > email.sender (from list)
    const fromField = email.from || email.sender || '';

    console.log('[Reply Debug] email.from:', email.from);
    console.log('[Reply Debug] email.sender:', email.sender);
    console.log('[Reply Debug] fromField:', fromField);

    // Dùng extractEmails để lấy địa chỉ email thuần túy
    const senderEmails = extractEmails(fromField);
    console.log('[Reply Debug] Extracted emails:', senderEmails);

    let senderEmail = senderEmails.length > 0 ? senderEmails[0] : '';

    // FALLBACK: If extractEmails failed, check if email.to contains our email
    // This means WE sent the email, so reply to email.to instead
    if (!senderEmail && email.to) {
      const toEmails = extractEmails(email.to);
      if (toEmails.length > 0) {
        senderEmail = toEmails[0];
        console.log('[Reply Debug] Using email.to as fallback:', senderEmail);
      }
    }

    console.log('[Reply Debug] Final senderEmail:', senderEmail);

    setComposeTo(senderEmail);
    setComposeCc('');
    setComposeBcc('');
    setShowCc(false);
    setShowBcc(false);

    // Xử lý subject với fallback
    const subject = email.subject || '(No Subject)';
    setComposeSubject(`Re: ${subject.replace(/^Re:\s*/i, '')}`);
    setComposeBody('');
    setEditingDraftId(null);
    setShowComposeModal(true);
  };

  const handleReplyAll = () => {
    if (!email) return;

    // Xử lý sender email với fallback
    const fromField = email.from || email.sender || '';
    const senderEmails = extractEmails(fromField);
    const senderEmail = senderEmails.length > 0 ? senderEmails[0] : '';

    // Reply all: gửi cho người gửi + cc
    setComposeTo(senderEmail);

    if (email.cc) {
      // Dùng extractEmails để lấy danh sách email thuần túy
      const ccEmails = extractEmails(email.cc);
      setComposeCc(ccEmails.join(', '));
      setShowCc(true);
    } else {
      setComposeCc('');
      setShowCc(false);
    }

    setComposeBcc('');
    setShowBcc(false);

    // Xử lý subject với fallback
    const subject = email.subject || '(No Subject)';
    setComposeSubject(`Re: ${subject.replace(/^Re:\s*/i, '')}`);
    setComposeBody('');
    setEditingDraftId(null);
    setShowComposeModal(true);
  };

  const handleForward = async () => {
    if (!email) return;

    setComposeTo('');

    // Xử lý subject với fallback
    const subject = email.subject || '(No Subject)';
    setComposeSubject(`Fwd: ${subject.replace(/^Fwd:\s*/i, '')}`);

    // Xử lý các field cho forwarded message với fallback
    const fromField = email.from || email.sender || 'Unknown';
    const dateValue = email.received || email.timestamp;
    const dateStr = dateValue ? new Date(dateValue).toLocaleString('vi-VN') : 'Unknown date';
    const toField = email.to || 'Unknown';
    const bodyContent = email.body || email.snippet || 'No content';

    setComposeBody(
      `<br><br>--- Forwarded message ---<br>From: ${fromField}<br>Date: ${dateStr}<br>Subject: ${subject}<br>To: ${toField}<br><br>${bodyContent}`
    );

    // Download and attach original attachments
    if (email.attachments && email.attachments.length > 0) {
      toast.loading('Đang tải attachments...', { id: 'forward-attachments' });
      try {
        const attachmentFiles: File[] = [];
        for (const attachment of email.attachments) {
          try {
            const { data } = await api.get(
              `/gmail/attachments/${email.id}/${attachment.attachmentId}`
            );
            // Convert base64 to File
            const b64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
            const blob = b64toBlob(b64, attachment.mimeType);
            const file = new File([blob], attachment.filename, { type: attachment.mimeType });
            attachmentFiles.push(file);
          } catch (err) {
            console.error(`Failed to download attachment ${attachment.filename}:`, err);
          }
        }
        setComposeAttachments(attachmentFiles);
        toast.success(`Đã tải ${attachmentFiles.length} attachments`, { id: 'forward-attachments' });
      } catch (err) {
        console.error('Failed to download attachments:', err);
        toast.error('Không thể tải attachments', { id: 'forward-attachments' });
      }
    } else {
      setComposeAttachments([]);
    }

    setEditingDraftId(null);
    setShowComposeModal(true);
  };

  // Sử dụng hook useComposeHandlers cho xử lý gửi email
  const { handleSendEmail, readFileAsBase64 } = useComposeHandlers({
    composeTo,
    setComposeTo,
    composeCc,
    setComposeCc,
    composeBcc,
    setComposeBcc,
    composeSubject,
    setComposeSubject,
    composeBody,
    setComposeBody,
    composeAttachments,
    setComposeAttachments,
    setShowCc,
    setShowBcc,
    setShowComposeModal,
    setComposeErrors,
    setIsSending,
    editingDraftId,
    setEditingDraftId,
    user,
    onSendSuccess: async () => {
      // Chỉ refresh dữ liệu, KHÔNG chuyển folder
      await handleRefresh(true);
    },
  });

  const getMailboxIcon = (mailbox: any) => {
    const key = mailbox.id?.toUpperCase();
    return mailboxIcons[key] || mailboxIcons.default;
  };



  // Auto-select email on keyboard navigation (Desktop)
  useEffect(() => {
    const isDesktop = window.innerWidth >= 768;

    // Only auto-select if in 'emails' mode, on desktop (split view), list is populated 
    // AND enabled via keyboard interaction
    if (navMode === 'emails' && isDesktop && paginatedEmails && paginatedEmails.length > 0 && enableAutoSelect) {
      const timer = setTimeout(() => {
        const email = paginatedEmails[focusedEmailIndex];
        // Only select if different and valid
        if (email && email.id !== selectedEmail) {
          handleEmailSelect(email.id);
        }
      }, 250); // 250ms debounce to prevent lagging when scrolling fast

      return () => clearTimeout(timer);
    }
  }, [focusedEmailIndex, navMode, paginatedEmails, selectedEmail, enableAutoSelect]);

  // Helper label hiển thị
  const getMailboxLabel = (mailbox: any) => {
    return getMailboxLabelVN(mailbox);
  };



  const currentMailboxLabel =
    getMailboxLabelVN(
      mailboxes?.find((mb: any) => mb.id === selectedMailbox) || { id: selectedMailbox }
    );

  // ======== THỨ TỰ MAILBOX GIỐNG GMAIL =========
  const mailboxOrder = [
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


  return (
    <div
      className="inbox-container flex flex-col h-screen overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}
    >
      {/* MAIN CONTENT: 3 columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Mailboxes */}
        {/* Column 1: Mailboxes + Profile */}
        <div
          className="hidden md:flex md:flex-col overflow-hidden border-r"
          style={{
            width: '260px',
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)'
          }}
        >

          {/* === PROFILE SECTION === */}
          <div
            className="px-3 py-3 border-b flex items-center gap-3 relative"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)'
            }}
          >

            <button
              className="flex items-center gap-2 w-full rounded-lg p-2 transition-all"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <img
                src={user?.picture || "https://www.gravatar.com/avatar?d=mp&s=200"}
                alt="avatar"
                className="w-9 h-9 rounded-full"
                style={{ border: '1px solid var(--border-primary)' }}
              />

              <div className="flex flex-col text-left flex-1 min-w-0">
                <span
                  className="font-medium text-sm truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {user?.name || "User"}
                </span>
                <span
                  className="text-xs truncate"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {user?.email}
                </span>
              </div>

              <IoIosArrowDown style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            </button>

            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowProfileMenu(false)}
                />

                <div
                  className="absolute top-full left-3 mt-2 w-52 rounded-lg shadow-lg border z-20 overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                    boxShadow: 'var(--shadow-lg)'
                  }}
                >

                  <button
                    className="w-full px-4 py-3 flex items-center gap-3 transition-all"
                    style={{ color: 'var(--text-primary)' }}
                    onClick={() => {
                      toggleTheme();
                      setShowProfileMenu(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <MaterialIcon name={theme === 'light' ? 'dark_mode' : 'light_mode'} size={20} />
                    {theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
                  </button>

                  <button
                    className="w-full px-4 py-3 flex items-center gap-3 transition-all"
                    style={{ color: 'var(--text-primary)' }}
                    onClick={() => {
                      navigate('/kanban');
                      setShowProfileMenu(false);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <MaterialIcon name="view_kanban" size={20} />
                    Kanban View
                  </button>

                  <button
                    className="w-full px-4 py-3 flex items-center gap-3 font-medium transition-all"
                    style={{ color: 'var(--error)' }}
                    onClick={handleLogout}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <MaterialIcon name="logout" size={20} />
                    Đăng xuất
                  </button>

                </div>
              </>
            )}

          </div>

          {/* COMPOSE BUTTON */}
          <div className="px-3 pt-3 pb-2">
            <button
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full shadow-sm transition-all font-medium"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'white'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
              onClick={() => {
                setEditingDraftId(null);
                setShowComposeModal(true);
              }}
            >
              <MaterialIcon name="edit" size={18} />
              <span>Soạn thư</span>
            </button>
          </div>

          {/* MAILBOX LIST */}
          <div className="flex-1 overflow-y-auto">
            <MailboxList
              mailboxes={mailboxes || []}
              selectedMailbox={selectedMailbox}
              mailboxOrder={mailboxOrder}
              getMailboxIcon={getMailboxIcon}
              focusedMailboxId={focusedMailboxId}
              getMailboxLabel={getMailboxLabel}
              mailboxesLoading={mailboxesLoading}
              mailboxesError={mailboxesError}
              onSelect={handleMailboxSelect}
            />
          </div>

        </div>

        {/* Column 2: Email List */}
        <div
          className={`border-r flex flex-col ${mobileView === "email" ? "hidden md:flex" : "flex"
            }`}
          style={{
            width: window.innerWidth >= 768 ? '400px' : '100%',
            minWidth: window.innerWidth >= 768 ? '380px' : undefined,
            maxWidth: window.innerWidth >= 768 ? '400px' : undefined,
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-primary)'
          }}
        >
          {/* ===== HEADER ===== */}
          <div
            className="border-b flex-shrink-0"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-primary)'
            }}
          >
            {/* ===== SEARCH BAR ===== */}
            <div className="px-3 pt-3 pb-2">
              <SearchBar
                onSearch={handleSearch}
                isLoading={isSearching}
                onClear={handleClearSearch}
                placeholder="Tìm kiếm..."
                label={selectedMailbox}
                showModeSelector={true}
                value={searchQuery}
              />
            </div>



            {/* ===== ACTION BAR ===== */}
            <div
              className="flex justify-between items-center pl-4 pr-2 py-2 border-b"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)'
              }}
            >

              {/* ===== LEFT (mobile only): Mailbox dropdown ===== */}
              <div className="md:hidden relative">
                <button
                  onClick={() => setShowMailboxMenu(!showMailboxMenu)}
                  className="flex items-center gap-2 text-lg font-semibold hover:text-blue-600"
                >
                  <span>{currentMailboxLabel}</span>
                  <IoIosArrowDown className="text-gray-600" />
                </button>

                {showMailboxMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMailboxMenu(false)}
                    />
                    <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                      {mailboxes
                        ?.filter((mailbox: any) => {
                          const allowed = ["INBOX", "STARRED", "SENT", "DRAFT", "SPAM", "ALL_MAIL"];
                          return allowed.includes(mailbox.id) || !mailbox.id.startsWith("CATEGORY_");
                        })
                        .map((mailbox: any) => (
                          <button
                            key={mailbox.id}
                            onClick={() => {
                              handleMailboxSelect(mailbox.id);
                              setShowMailboxMenu(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center justify-between border-b last:border-b-0 ${selectedMailbox === mailbox.id
                              ? "bg-blue-50 text-blue-600"
                              : ""
                              }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-lg">{getMailboxIcon(mailbox)}</span>
                              <span className="flex-1 min-w-0 truncate">
                                {getMailboxLabel(mailbox)}
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </div>

              {/* ===== CENTER: Title + Refresh (desktop) ===== */}
              <div className="hidden md:flex items-center gap-0">
                <h2
                  className="text-lg font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {currentMailboxLabel}
                </h2>

                <button
                  className="w-9 h-9 flex items-center justify-center rounded-lg transition-all translate-y-[1px]"
                  onClick={() => handleRefresh()}
                  title="Làm mới"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: 'var(--text-primary)', fontSize: '20px' }}
                  >
                    refresh
                  </span>
                </button>
              </div>

              {/* ===== RIGHT: ACTION BUTTONS ===== */}
              <div className="flex items-center gap-0">

                {/* GROUP A: Select All + Refresh (mobile hidden) */}
                <div className="hidden md:flex items-center gap-1.5">

                  {/* SELECT ALL */}
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
                    title="Chọn tất cả"
                    onClick={handleToggleSelectAll}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                      aria-label="Chọn tất cả email"
                      checked={
                        paginatedEmails.length > 0 &&
                        selectedEmails.size === paginatedEmails.length
                      }
                      onChange={handleToggleSelectAll}
                    />
                  </button>

                </div>

                {/* GROUP B: Mark Read/Unread */}
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
                  style={{
                    opacity: selectedEmails.size === 0 && !selectedEmail ? 0.4 : 1,
                    cursor: selectedEmails.size === 0 && !selectedEmail ? 'not-allowed' : 'pointer',
                  }}
                  disabled={selectedEmails.size === 0 && !selectedEmail}
                  title="Đánh dấu đã đọc / chưa đọc"
                  onMouseEnter={(e) => {
                    if (selectedEmails.size > 0 || selectedEmail) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => {
                    const targets =
                      selectedEmails.size > 0
                        ? Array.from(selectedEmails)
                        : selectedEmail
                          ? [selectedEmail]
                          : [];

                    if (targets.length === 0) return;

                    const hasUnread = targets.some((id) => {
                      const email = emails.find((e: any) => e.id === id);
                      return email && !email.read;
                    });

                    handleBulkMarkRead(hasUnread);
                  }}
                >
                  <span className="material-symbols-outlined">
                    {(() => {
                      const targets =
                        selectedEmails.size > 0
                          ? Array.from(selectedEmails)
                          : selectedEmail
                            ? [selectedEmail]
                            : [];

                      const unread = targets.some((id) => {
                        const email = emails.find((e: any) => e.id === id);
                        return email && !email.read;
                      });

                      return unread ? "mark_email_read" : "mark_email_unread";
                    })()}
                  </span>
                </button>

                {/* GROUP C: Delete */}
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-40"
                  disabled={!selectedEmail && selectedEmails.size === 0}
                  title="Xóa email"
                  onClick={() => {
                    if (selectedEmails.size === 0 && !selectedEmail) return;
                    // Không cần xác nhận khi xóa ngoài thùng rác, xác nhận đã xử lý ở EmailDetail

                    if (selectedEmails.size > 0) {
                      selectedEmails.forEach((id) => handleDeleteEmail(id));
                      setSelectedEmails(new Set());
                      setShowCheckboxes(false);
                    } else {
                      handleDeleteEmail(selectedEmail || undefined);
                      setSelectedEmail(null);
                    }
                  }}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>

                {/* GROUP D: Spam */}
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-40"
                  disabled={!selectedEmail && selectedEmails.size === 0}
                  title="Báo cáo spam"
                  onClick={async () => {
                    const targets =
                      selectedEmails.size > 0
                        ? Array.from(selectedEmails)
                        : selectedEmail
                          ? [selectedEmail]
                          : [];

                    for (const id of targets) await handleMarkSpam(id);

                    setSelectedEmails(new Set());
                    setShowCheckboxes(false);
                    setSelectedEmail(null);
                  }}
                >
                  <span className="material-symbols-outlined">report</span>
                </button>

                {/* GROUP E: Move To */}
                <div className="relative">
                  <button
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-200 disabled:opacity-40"
                    disabled={!selectedEmail && selectedEmails.size === 0}
                    title="Chuyển đến..."
                    onClick={() => setShowMoveToMenu((p) => !p)}
                  >
                    <span className="material-symbols-outlined">
                      drive_file_move
                    </span>
                  </button>

                  {showMoveToMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowMoveToMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-52 shadow-lg border rounded z-20">
                        {(() => {
                          let emailObj = null;
                          if (selectedEmail && emails)
                            emailObj = emails.find((e: any) => e.id === selectedEmail);
                          else if (selectedEmails.size > 0 && emails) {
                            const first = Array.from(selectedEmails)[0];
                            emailObj = emails.find((e: any) => e.id === first);
                          }

                          let allowedTargets: string[] = [];
                          if (emailObj) {
                            const labelIds = emailObj.labelIds || [];
                            const isSpam = labelIds.includes("SPAM");
                            const isTrash = labelIds.includes("TRASH");

                            if (isSpam) allowedTargets = ["INBOX", "TRASH"];
                            else if (isTrash) allowedTargets = ["INBOX", "SPAM"];
                            else allowedTargets = ["TRASH", "SPAM"];
                          }

                          return mailboxes
                            ?.filter((mb: any) => allowedTargets.includes(mb.id))
                            .map((mb: any) => (
                              <button
                                key={mb.id}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
                                onClick={() => handleMoveTo(mb.id)}
                              >
                                {getMailboxIcon(mb)}
                                <span>{getMailboxLabel(mb)}</span>
                              </button>
                            ));
                        })()}
                      </div>
                    </>
                  )}
                </div>

              </div>
            </div>


            {/* Mobile select-all */}
            <div
              className="flex items-center gap-3 px-3 py-2 border-t md:hidden"
              style={{
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-primary)'
              }}
            >
              <input
                type="checkbox"
                className="w-4 h-4 cursor-pointer"
                aria-label="Chọn tất cả email trên mobile"
                checked={
                  paginatedEmails.length > 0 &&
                  selectedEmails.size === paginatedEmails.length
                }
                onChange={handleToggleSelectAll}
              />
              <span className="text-sm text-gray-600">
                {selectedEmails.size > 0
                  ? `${selectedEmails.size} selected`
                  : "Chọn tất cả"}
              </span>
            </div>
          </div>

          {/* ===== EMAIL LIST ===== */}
          <div className="flex flex-col h-full overflow-hidden">
            <div ref={emailListRef} className="flex-1 overflow-hidden">
              {/* 🔍 SEARCH RESULTS MODE */}
              {isInSearchMode ? (
                <SearchResultsList
                  results={searchResults}
                  isLoading={isSearching}
                  error={searchError || undefined}
                  onBack={handleClearSearch}
                  onSelectEmail={(email) => {
                    console.log('[Inbox] Search result selected:', email.id);
                    setSelectedEmail(email.id);
                    setMobileView('email');
                  }}
                />
              ) : (
                /* NORMAL INBOX MODE */
                <>
                  {/* LOADING STATE: Show spinner when loading OR fetching without existing data */}
                  {emailsLoading || emailsFetching ? (
                    // If fetching with existing data, show email list + refetch indicator
                    // Otherwise show full loading spinner
                    (emailsFetching && emails && emails.length > 0) ? (
                      // Background refetch - show list with indicator
                      <div className="relative h-full">

                        <EmailList
                          ref={emailListComponentRef}
                          emails={paginatedEmails}
                          selectedEmail={selectedEmail}
                          selectedEmails={selectedEmails}
                          starredState={starredState}
                          readState={readState}
                          showCheckboxes={showCheckboxes}
                          handleToggleCheckbox={handleToggleCheckbox}
                          handleEmailSelect={handleEmailSelect}
                          handleToggleRead={handleToggleRead}
                          handleToggleStar={handleToggleStar}
                          focusedEmailIndex={focusedEmailIndex}
                          user={user}
                          listHeight={listHeight}
                        />
                      </div>
                    ) : (
                      // Initial load - show full spinner
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          width: '100%',
                          minHeight: '320px',
                        }}
                      >
                        <div className="spinner" style={{ marginBottom: '16px' }} />
                        <p style={{ fontSize: '14px', opacity: 0.7, textAlign: 'center' }}>Đang tải email...</p>
                      </div>
                    )
                  ) :
                    /* ERROR STATE: Only show when NOT loading/fetching and there's an actual error */
                    emailsError ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>
                            <MaterialIcon name="error_outline" />
                          </div>
                          <p style={{ fontSize: '14px', fontWeight: 500 }}>Không thể tải email</p>
                          <p style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                            Vui lòng thử lại sau
                          </p>
                        </div>
                      </div>
                    ) :
                      /* EMPTY MAILBOX: No emails at all after successful load */
                      !emails || emails.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
                            <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>
                              <MaterialIcon name={
                                selectedMailbox === 'DRAFT' ? 'draft' :
                                  selectedMailbox === 'SENT' ? 'send' :
                                    selectedMailbox === 'TRASH' ? 'delete' :
                                      selectedMailbox === 'SPAM' ? 'report' :
                                        'inbox'
                              } />
                            </div>
                            <p style={{ fontSize: '16px', fontWeight: 500 }}>
                              Không có email nào trong {currentMailboxLabel}
                            </p>
                            <p style={{ fontSize: '13px', marginTop: '8px', opacity: 0.7 }}>
                              {selectedMailbox === 'DRAFT' && 'Bắt đầu soạn thư nháp mới'}
                              {selectedMailbox === 'SENT' && 'Chưa có email đã gửi'}
                              {selectedMailbox === 'TRASH' && 'Thùng rác trống'}
                              {selectedMailbox === 'SPAM' && 'Không có thư rác'}
                              {selectedMailbox === 'INBOX' && 'Hộp thư đến trống'}
                              {!['DRAFT', 'SENT', 'TRASH', 'SPAM', 'INBOX'].includes(selectedMailbox) && 'Thư mục trống'}
                            </p>
                          </div>
                        </div>
                      ) :
                        /* FILTERED EMPTY: Has emails but filter/search returned nothing */
                        paginatedEmails.length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
                              <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.3 }}>
                                <MaterialIcon name="search" />
                              </div>
                              <p style={{ fontSize: '16px', fontWeight: 500 }}>
                                Không tìm thấy email nào
                              </p>
                              <p style={{ fontSize: '13px', marginTop: '8px', opacity: 0.7 }}>
                                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
                              </p>
                            </div>
                          </div>
                        ) :
                          /* SUCCESS STATE: Display email list */
                          (
                            <EmailList
                              ref={emailListComponentRef}
                              emails={paginatedEmails}
                              selectedEmail={selectedEmail}
                              selectedEmails={selectedEmails}
                              starredState={starredState}
                              readState={readState}
                              showCheckboxes={showCheckboxes}
                              handleToggleCheckbox={handleToggleCheckbox}
                              handleEmailSelect={handleEmailSelect}
                              handleToggleRead={handleToggleRead}
                              handleToggleStar={handleToggleStar}
                              focusedEmailIndex={focusedEmailIndex}
                              user={user}
                              listHeight={listHeight}
                            />
                          )}
                </>
              )}
            </div>

            {/* Pagination - only show in normal mode, not in search mode */}
            {!isInSearchMode && (
              <div
                className="flex items-center text-xs justify-end px-3 border-t "
                style={{
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                <span className="mr-4">
                  {filteredEmails.length === 0
                    ? "0"
                    : `${startIndex + 1}–${Math.min(
                      startIndex + pageSize,
                      filteredEmails.length
                    )} trong ${filteredEmails.length}`}
                </span>

                <button
                  className="px-2 py-1.5 transition-all font-base text-gray-700 text-lg" // <-- text-lg tăng chữ
                  style={{
                    opacity: safeCurrentPage <= 1 ? 0.4 : 1,
                    cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                  disabled={safeCurrentPage <= 1}
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    setFocusedEmailIndex(0);
                  }}
                  onMouseEnter={(e) => {
                    if (safeCurrentPage > 1) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  ‹
                </button>

                <button
                  className="ml-1.5 px-3 rounded-lg transition-all font-medium text-lg" // <-- text-lg tăng chữ
                  style={{
                    opacity: safeCurrentPage >= totalPages ? 0.3 : 1,
                    cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    setFocusedEmailIndex(0);
                  }}
                  onMouseEnter={(e) => {
                    if (safeCurrentPage < totalPages) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  ›
                </button>
              </div>
            )}

          </div>
        </div>


        {/* Column 3: Email detail */}
        <div
          className={`flex flex-col overflow-hidden w-full ${mobileView === 'emails' ? 'hidden md:flex' : 'flex'
            }`}
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          <div className="flex-shrink-0 p-3 pb-0">
            <button
              className="md:hidden mb-3 flex items-center gap-2 font-medium px-3 py-2 rounded transition-all"
              style={{
                color: 'var(--accent-primary)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => setMobileView('emails')}
              aria-label="Back to email list"
            >
              <span className="text-xl">←</span>
              <span>Back to emails</span>
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto px-4 pb-4"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            {emailLoading ? (
              <div className="center-spinner">
                <div className="spinner" />
              </div>
            ) : emailError ? (
              <div>Error loading email</div>
            ) : email ? (
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
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <img
                  src="https://res.public.onecdn.static.microsoft/assets/mail/illustrations/noMailSelected/v2/light.svg"
                  alt="No email selected"
                  style={{ width: '200px', height: '200px' }}
                  className="mb-4"
                />
                <p className="text-lg font-medium text-gray-700">
                  Chọn một email để xem chi tiết
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Chọn một tin nhắn từ danh sách để đọc
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      <ComposeModal
        showComposeModal={showComposeModal}
        setShowComposeModal={handleCloseCompose}
        composeTo={composeTo}
        setComposeTo={setComposeTo}
        composeCc={composeCc}
        setComposeCc={setComposeCc}
        composeBcc={composeBcc}
        setComposeBcc={setComposeBcc}
        composeSubject={composeSubject}
        setComposeSubject={setComposeSubject}
        composeBody={composeBody}
        setComposeBody={setComposeBody}
        composeAttachments={composeAttachments}
        setComposeAttachments={setComposeAttachments}
        showCc={showCc}
        setShowCc={setShowCc}
        showBcc={showBcc}
        setShowBcc={setShowBcc}
        composeErrors={composeErrors}
        setComposeErrors={setComposeErrors}
        isSending={isSending}
        handleSendEmail={handleSendEmail}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Xác nhận xóa"
        message="Thư sẽ được xóa vĩnh viễn. Bạn chắc chắn muốn xóa nó chứ?"
        confirmText="Xóa vĩnh viễn"
        cancelText="Hủy"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDangerous={true}
      />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />

      <KeyboardShortcutsButton onClick={() => setShowKeyboardHelp(true)} />
    </div>
  );
}
