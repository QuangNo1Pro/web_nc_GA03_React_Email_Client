import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ReactWindow from 'react-window';
import { api } from '../services/api';
import './Inbox.css';

const FixedSizeList = (ReactWindow as any).FixedSizeList;
import {
  FiInbox,
  FiSend,
  FiFileText,
  FiEdit,
  FiRefreshCw,
  FiMoreVertical,
  FiFolder,
  FiArchive,
  FiTrash2,
} from 'react-icons/fi';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { LuMail, LuMailOpen, LuMails } from 'react-icons/lu';
import { TbMailFilled, TbMailOpenedFilled } from 'react-icons/tb';
import { RiDeleteBin6Line, RiDeleteBin6Fill } from 'react-icons/ri';
import { IoIosArrowDown } from 'react-icons/io';
import { 
  ArrowReply20Regular, 
  ArrowReplyAll20Regular, 
  ArrowForward20Regular,
  Archive20Regular,
  FolderArrowRight20Regular
} from '@fluentui/react-icons';

const mailboxIcons = {
  inbox: <FiInbox />,
  starred: <FaRegStar />,
  sent: <FiSend />,
  drafts: <FiFileText />,
  archive: <FiArchive />,
  trash: <FiTrash2 />,
  spam: <FiFolder />,
  custom1: <FiFolder />,
  custom2: <FiFolder />,
};

const fetchMailboxes = async () => {
  const { data } = await api.get('/mail/mailboxes');
  return data;
};

const fetchEmails = async (mailboxId: string) => {
  const { data } = await api.get(`/mail/mailboxes/${mailboxId}/emails`);
  return data.emails || []; // Backend trả về { emails, total, page, pageSize }
};

const fetchEmail = async (emailId: string) => {
  const { data } = await api.get(`/mail/emails/${emailId}`);
  return data;
};

// Helper function to get consistent color for avatar based on sender name
const getAvatarColor = (name: string) => {
  const colors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500'
  ];
  
  // Generate consistent hash from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// EmailRow component cho virtualized list
const EmailRow = ({ index, style, data }: any) => {
  const {
    emails,
    selectedEmail,
    selectedMailbox,
    selectedEmails,
    starredState,
    focusedEmailIndex,
    showCheckboxes,
    handleToggleCheckbox,
    handleEmailSelect,
    handleToggleRead,
    handleToggleStar,
    handleDeleteEmail,
  } = data;

  const email = emails[index];
  if (!email) return null;

  const isFocused = index === focusedEmailIndex;

  return (
    <div
      style={style}
      role="button"
      tabIndex={isFocused ? 0 : -1}
      aria-label={`Email from ${email.sender}: ${email.subject}`}
      className={`flex items-start p-3 cursor-pointer hover:bg-gray-100 border-b ${
        selectedEmail === email.id ? 'bg-blue-50' : ''
      } ${isFocused ? 'ring-2 ring-blue-400' : ''} ${!email.read && selectedMailbox !== 'trash' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
    >
      {/* Avatar container với checkbox */}
      <div className="relative mr-3 flex-shrink-0">
        {showCheckboxes || selectedEmail === email.id ? (
          <div className="w-10 h-10 flex items-center justify-center">
            <input
              type="checkbox"
              className="w-4 h-4 cursor-pointer"
              checked={selectedEmails.has(email.id)}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleCheckbox(email.id);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${getAvatarColor(email.sender)}`}>
            {email.sender.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      
      <div className="flex-grow min-w-0" onClick={() => handleEmailSelect(email.id)}>
        {/* Hàng đầu tiên: tên người gửi + action icons */}
        <div className="flex justify-between items-center mb-1 gap-2">
          <span className={`email-sender truncate ${!email.read ? 'font-semibold' : 'font-normal'}`}>{email.sender}</span>
          <span className="flex items-center gap-3 flex-shrink-0">
            {/* Icon sao */}
            <button
              className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
              title={starredState[email.id] ? 'Bỏ gắn sao' : 'Gắn sao'}
              onClick={e => {
                e.stopPropagation();
                handleToggleStar(email.id);
              }}
            >
              {starredState[email.id] ? (
                <FaStar className="text-yellow-400 hover:text-yellow-500" size={16} />
              ) : (
                <FaRegStar className="text-gray-500 hover:text-yellow-400" size={16} />
              )}
            </button>
            {/* Icon đánh dấu đã đọc/chưa đọc */}
            <button
              className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
              title={email.read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
              onClick={e => {
                e.stopPropagation();
                handleToggleRead(email.id);
              }}
            >
              {email.read ? (
                <LuMail className="text-gray-500 hover:text-gray-700" size={16} />
              ) : (
                <LuMailOpen className="text-blue-500 hover:text-blue-600" size={16} />
              )}
            </button>
            {/* Icon delete */}
            <button
              className="opacity-60 hover:opacity-100 hover:text-red-600 transition-all p-0.5"
              title="Xóa"
              onClick={e => {
                e.stopPropagation();
                handleDeleteEmail(email.id);
              }}
            >
              <RiDeleteBin6Line className="text-gray-500 hover:text-red-600" size={16} />
            </button>
          </span>
        </div>
        {/* Hàng thứ hai: subject + timestamp */}
        <div className="flex justify-between items-center mb-1 gap-2">
          <span className={`email-subject truncate flex-1 ${!email.read ? 'font-semibold' : 'font-normal'}`}>{email.subject}</span>
          <span className="email-timestamp text-xs text-gray-500 flex-shrink-0">
            {(() => {
              const date = new Date(email.timestamp);
              const weekday = date.toLocaleString('vi-VN', { weekday: 'short' }).replace(/^\w/, c => c.toUpperCase());
              const time = date.toLocaleString('vi-VN', { hour: 'numeric', minute: '2-digit', hour12: true });
              return `${weekday} ${time}`;
            })()}
          </span>
        </div>
        {/* Hàng thứ ba: preview */}
        <div className="email-preview truncate text-sm text-gray-600">{email.preview}</div>
      </div>
    </div>
  );
};

export default function Inbox() {
  const queryClient = useQueryClient();
  const [selectedMailbox, setSelectedMailbox] = useState('inbox');
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState('emails'); // emails or email (default: emails)
  const [starredState, setStarredState] = useState<{ [id: string]: boolean }>({});
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showCheckboxes, setShowCheckboxes] = useState(false); // Hiển thị checkbox khi user tick vào 1 checkbox
  const [mailboxWidth, setMailboxWidth] = useState(20); // % width
  const [emailListWidth, setEmailListWidth] = useState(40); // % width
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [focusedEmailIndex, setFocusedEmailIndex] = useState(0);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showMailboxMenu, setShowMailboxMenu] = useState(false);
  const [showMoveToMenu, setShowMoveToMenu] = useState(false);
  const [showReadFilterMenu, setShowReadFilterMenu] = useState(false);
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');
  const emailListRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(500);
  const [isMailHoveredDetail, setIsMailHoveredDetail] = useState(false);
  const [isStarHoveredDetail, setIsStarHoveredDetail] = useState(false);
  const [isDeleteHoveredNavbar, setIsDeleteHoveredNavbar] = useState(false);
  const [isRefreshHovered, setIsRefreshHovered] = useState(false);
  const [isArchiveHovered, setIsArchiveHovered] = useState(false);
  const [isReplyHovered, setIsReplyHovered] = useState(false);
  const [isReplyAllHovered, setIsReplyAllHovered] = useState(false);
  const [isForwardHovered, setIsForwardHovered] = useState(false);
  const [isReplyHoveredDetail, setIsReplyHoveredDetail] = useState(false);
  const [isReplyAllHoveredDetail, setIsReplyAllHoveredDetail] = useState(false);
  const [isForwardHoveredDetail, setIsForwardHoveredDetail] = useState(false);

  const {
    data: mailboxes,
    isLoading: mailboxesLoading,
    error: mailboxesError,
  } = useQuery({
    queryKey: ['mailboxes'],
    queryFn: fetchMailboxes,
  });

  const {
    data: emails,
    isLoading: emailsLoading,
    error: emailsError,
  } = useQuery({
    queryKey: ['emails', selectedMailbox],
    queryFn: () => fetchEmails(selectedMailbox),
    enabled: !!selectedMailbox,
  });

  const {
    data: emailDetail,
    isLoading: emailLoading,
    error: emailError,
  } = useQuery({
    queryKey: ['email', selectedEmail],
    queryFn: () => fetchEmail(selectedEmail!),
    enabled: !!selectedEmail,
  });

  // Lấy email từ list để có read/starred state mới nhất
  const email = selectedEmail 
    ? (() => {
        const listEmail = emails?.find((e: any) => e.id === selectedEmail);
        if (!listEmail && !emailDetail) return null;
        
        // Ưu tiên read/starred từ list (đã được update optimistically)
        return {
          ...emailDetail,
          ...listEmail,
          // Giữ lại body/attachments/cc từ detail (list không có)
          body: emailDetail?.body || listEmail?.body || '',
          attachments: emailDetail?.attachments || listEmail?.attachments || [],
          cc: emailDetail?.cc || listEmail?.cc || '',
          bcc: emailDetail?.bcc || listEmail?.bcc || '',
        };
      })()
    : null;

  const handleMailboxSelect = (mailboxId: string) => {
    setSelectedMailbox(mailboxId);
    setSelectedEmail(null);
    setMobileView('emails');
    setStarredState({}); // reset starred state when switching mailbox
    setSelectedEmails(new Set()); // reset selected emails when switching mailbox
    setShowCheckboxes(false); // reset checkbox mode when switching mailbox
    setFocusedEmailIndex(0); // reset focus to first email
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!emails || emails.length === 0) return;
      
      const filteredEmails = emails.filter((email: any) => {
        if (selectedMailbox === 'starred') return starredState[email.id];
        return true;
      });
      
      if (filteredEmails.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedEmailIndex(prev => Math.min(prev + 1, filteredEmails.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedEmailIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredEmails[focusedEmailIndex]) {
            handleEmailSelect(filteredEmails[focusedEmailIndex].id);
          }
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleRefresh();
          }
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
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
  }, [emails, selectedMailbox, starredState, focusedEmailIndex, selectedEmail, showComposeModal]);

  // Update list height when container size changes
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

  // Khi fetch emails, cập nhật trạng thái starred từ dữ liệu backend
  useEffect(() => {
    if (emails) {
      const newState: { [id: string]: boolean } = {};
      emails.forEach((email: any) => {
        newState[email.id] = email.starred;
      });
      setStarredState(newState);
    }
  }, [emails]);

  // Hàm toggle starred cho email, đồng bộ với backend
  const handleToggleStar = async (emailId: string) => {
    const newStarred = !starredState[emailId];
    console.log(`Toggle star for email ${emailId}: ${starredState[emailId]} -> ${newStarred}`);
    
    setStarredState((prev) => ({
      ...prev,
      [emailId]: newStarred,
    }));
    
    // Optimistic update: cập nhật TẤT CẢ cache liên quan
    queryClient.setQueryData(['emails', selectedMailbox], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((e: any) => 
        e.id === emailId ? { ...e, starred: newStarred } : e
      );
    });
    
    // Update cache của starred mailbox luôn
    queryClient.setQueryData(['emails', 'starred'], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((e: any) => 
        e.id === emailId ? { ...e, starred: newStarred } : e
      );
    });
    
    try {
      await api.patch(`/mail/emails/${emailId}/star`, { starred: newStarred });
      // Invalidate TẤT CẢ để đồng bộ với backend
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
      queryClient.invalidateQueries({ queryKey: ['emails', 'starred'] });
      // Nếu đang xem email này ở Column 3, re-fetch để update UI
      if (selectedEmail === emailId) {
        queryClient.invalidateQueries({ queryKey: ['email', emailId] });
      }
    } catch (err) {
      console.error('Star API error:', err);
      // Nếu lỗi, revert lại state và cache
      setStarredState((prev) => ({
        ...prev,
        [emailId]: !newStarred,
      }));
      queryClient.setQueryData(['emails', selectedMailbox], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((e: any) => 
          e.id === emailId ? { ...e, starred: !newStarred } : e
        );
      });
      alert('Lỗi cập nhật trạng thái starred!');
    }
  };

  // Hàm toggle trạng thái đã đọc/chưa đọc cho email
  const handleToggleRead = async (emailId: string) => {
    if (!emails) return;
    const emailObj = emails.find((e: any) => e.id === emailId);
    if (!emailObj) return;
    const newRead = !emailObj.read;
    
    // Optimistic update: cập nhật TẤT CẢ cache liên quan
    queryClient.setQueryData(['emails', selectedMailbox], (oldData: any) => {
      if (!oldData) return oldData;
      return oldData.map((e: any) => 
        e.id === emailId ? { ...e, read: newRead } : e
      );
    });
    
    // Update cache của starred mailbox nếu email có starred
    if (emailObj.starred) {
      queryClient.setQueryData(['emails', 'starred'], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((e: any) => 
          e.id === emailId ? { ...e, read: newRead } : e
        );
      });
    }
    
    try {
      await api.patch(`/mail/emails/${emailId}/read`, { read: newRead });
      // Invalidate TẤT CẢ để đồng bộ với backend (backend đã tự động cập nhật count)
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
      if (emailObj.starred) {
        queryClient.invalidateQueries({ queryKey: ['emails', 'starred'] });
      }
      // Nếu đang xem email này ở Column 3, re-fetch để update UI
      if (selectedEmail === emailId) {
        queryClient.invalidateQueries({ queryKey: ['email', emailId] });
      }
    } catch (err) {
      // Nếu lỗi, revert lại cache
      queryClient.setQueryData(['emails', selectedMailbox], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((e: any) => 
          e.id === emailId ? { ...e, read: !newRead } : e
        );
      });
      alert('Lỗi cập nhật trạng thái đã đọc/chưa đọc!');
    }
  };

  const handleEmailSelect = (emailId: string) => {
    // Click vào email sẽ mở email detail
    // KHÔNG thêm vào selectedEmails (chưa tick checkbox)
    setSelectedEmail(emailId);
    setMobileView('email');
    // Tự động đánh dấu đã đọc khi click vào email chưa đọc
    if (emails) {
      const emailObj = emails.find((e: any) => e.id === emailId);
      if (emailObj && !emailObj.read) {
        handleToggleRead(emailId);
      }
    }
  };

  // Hàm toggle checkbox
  const handleToggleCheckbox = (emailId: string) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
        // Tắt checkbox mode nếu không còn email nào được chọn
        if (newSet.size === 0) {
          setShowCheckboxes(false);
          setSelectedEmail(null); // Clear selectedEmail để tất cả email hiện avatar
        }
      } else {
        newSet.add(emailId);
        // Bật checkbox mode khi user tick vào checkbox
        setShowCheckboxes(true);
      }
      return newSet;
    });
  };

  // Hàm select all / deselect all
  const handleToggleSelectAll = () => {
    if (!emails) return;
    const visibleEmails = emails.filter((email: any) => {
      if (selectedMailbox === 'starred') {
        return starredState[email.id];
      }
      return true;
    });
    
    if (selectedEmails.size === visibleEmails.length) {
      // Deselect all
      setSelectedEmails(new Set());
      setShowCheckboxes(false); // Tắt checkbox mode khi deselect all
    } else {
      // Select all
      setShowCheckboxes(true); // Bật checkbox mode
      setSelectedEmails(new Set(visibleEmails.map((e: any) => e.id)));
    }
  };

  // Hàm xử lý resize columns
  const handleMouseDown = (dividerIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startMailboxWidth = mailboxWidth;
    const startEmailListWidth = emailListWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const containerWidth = window.innerWidth;
      const deltaPercent = (deltaX / containerWidth) * 100;

      if (dividerIndex === 1) {
        // Resize mailbox column
        const newMailboxWidth = Math.max(15, Math.min(30, startMailboxWidth + deltaPercent));
        setMailboxWidth(newMailboxWidth);
      } else if (dividerIndex === 2) {
        // Resize email list column
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
  };

  // Hàm xử lý bulk delete
  const handleBulkDelete = async () => {
    const emailsToDelete = selectedEmails.size > 0 
      ? Array.from(selectedEmails) 
      : selectedEmail ? [selectedEmail] : [];
    
    if (emailsToDelete.length === 0) return;
    
    const isInTrash = selectedMailbox === 'trash';
    const confirmMessage = isInTrash 
      ? `Xóa vĩnh viễn ${emailsToDelete.length} email? (Không thể khôi phục)`
      : `Chuyển ${emailsToDelete.length} email vào thùng rác?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      await api.delete('/mail/emails', { 
        data: { ids: emailsToDelete } 
      });
      
      // Invalidate cache để refresh danh sách
      queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      
      // Nếu chuyển vào trash, invalidate trash queries
      if (!isInTrash) {
        queryClient.invalidateQueries({ queryKey: ['emails', 'trash'] });
      }
      
      // Clear selection
      setSelectedEmails(new Set());
      setShowCheckboxes(false);
      if (selectedEmail && emailsToDelete.includes(selectedEmail)) {
        setSelectedEmail(null);
      }
      
      const successMessage = isInTrash 
        ? 'Đã xóa vĩnh viễn!'
        : 'Đã chuyển vào thùng rác!';
      alert(successMessage);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Lỗi khi xóa email!');
    }
  };

  // Hàm xử lý delete single email từ Column 2
  const handleDeleteEmail = async (emailId: string) => {
    const isInTrash = selectedMailbox === 'trash';
    const confirmMessage = isInTrash 
      ? 'Xóa vĩnh viễn email này? (Không thể khôi phục)'
      : 'Chuyển email vào thùng rác?';
    
    if (!confirm(confirmMessage)) return;
    
    try {
      await api.delete('/mail/emails', { 
        data: { ids: [emailId] } 
      });
      
      // Invalidate cache để refresh danh sách
      queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      queryClient.invalidateQueries({ queryKey: ['emails', 'starred'] });
      
      // Nếu chuyển vào trash, invalidate trash queries
      if (!isInTrash) {
        queryClient.invalidateQueries({ queryKey: ['emails', 'trash'] });
      }
      
      // Nếu đang xem email này ở Column 3, đóng nó
      if (selectedEmail === emailId) {
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Lỗi khi xóa email!');
    }
  };

  // Hàm xử lý bulk mark read/unread
  const handleBulkMarkRead = async (read: boolean) => {
    if (selectedEmails.size === 0) return;
    
    try {
      await api.patch('/mail/emails/bulk-read', {
        ids: Array.from(selectedEmails),
        read
      });
      
      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      // Không unselect - giữ nguyên selection
    } catch (err) {
      console.error('Bulk mark read error:', err);
      alert('Lỗi khi cập nhật trạng thái!');
    }
  };

  // Hàm refresh emails
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
    queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
  };

  // Hàm Reply - trả lời email
  const handleReply = () => {
    if (!email) return;
    
    // Mở compose modal với To = sender của email gốc
    setComposeTo(email.from);
    setComposeSubject(`Re: ${email.subject.replace(/^Re:\s*/i, '')}`);
    setComposeBody(''); // Để trống cho user tự gõ
    setShowComposeModal(true);
  };

  // Hàm Reply All - trả lời tất cả
  const handleReplyAll = () => {
    if (!email) return;
    
    // To = người gửi gốc + tất cả người nhận khác (trừ mình - "Me <me@example.com>")
    const allRecipients = [email.from];
    
    // Thêm tất cả người trong To (trừ mình)
    if (email.to) {
      const toList = email.to.split(',').map((e: string) => e.trim());
      // Loại bỏ email của mình (Me <me@example.com> hoặc me@example.com)
      const otherRecipients = toList.filter((e: string) => 
        !e.toLowerCase().includes('me@example.com') && 
        !e.toLowerCase().startsWith('me <')
      );
      allRecipients.push(...otherRecipients);
    }
    
    setComposeTo(allRecipients.join(', '));
    
    // Giữ lại Cc từ email gốc
    if (email.cc) {
      setComposeCc(email.cc);
      setShowCc(true);
    }
    
    setComposeSubject(`Re: ${email.subject.replace(/^Re:\s*/i, '')}`);
    setComposeBody(''); // Để trống cho user tự gõ
    setShowComposeModal(true);
  };

  // Hàm Forward - chuyển tiếp email
  const handleForward = () => {
    if (!email) return;
    
    // Clear To (user needs to fill), keep subject with Fwd:, include original content
    setComposeTo('');
    setComposeSubject(`Fwd: ${email.subject.replace(/^Fwd:\s*/i, '')}`);
    setComposeBody(`\n\n--- Forwarded message ---\nFrom: ${email.from}\nDate: ${new Date(email.received).toLocaleString('vi-VN')}\nSubject: ${email.subject}\nTo: ${email.to}\n\n${email.body.replace(/<[^>]*>/g, '')}`);
    setShowComposeModal(true);
  };

  // Hàm gửi email
  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }
    
    try {
      await api.post('/mail/send', {
        to: composeTo,
        cc: composeCc,
        bcc: composeBcc,
        subject: composeSubject,
        body: composeBody,
        // Send attachments as objects with name and size (bytes)
        attachments: composeAttachments.map(f => ({ name: f.name, size: f.size }))
      });
      
      // Reset form và đóng modal
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setComposeSubject('');
      setComposeBody('');
      setComposeAttachments([]);
      setShowCc(false);
      setShowBcc(false);
      setShowComposeModal(false);
      
      // Refresh sent mailbox
      queryClient.invalidateQueries({ queryKey: ['emails', 'sent'] });
      alert('Gửi email thành công!');
    } catch (err) {
      console.error('Send email error:', err);
      alert('Lỗi khi gửi email!');
    }
  };

  return (
    <div className="inbox-container flex flex-col h-[calc(100vh-65px)] bg-white">
      {/* Action Bar - ngang hàng với navbar, ở trên cùng */}
      <div className="border-b bg-white">
        {/* Hàng 1: Action buttons */}
        <div className="flex items-center gap-2 px-4 py-2">
          {/* Compose button */}
          <button
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={() => setShowComposeModal(true)}
          >
            <FiEdit size={16} />
            <span className="text-sm">Thư mới</span>
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1" />
          
          {/* Refresh */}
          <button
            className="p-2 hover:bg-gray-200 rounded"
            onClick={handleRefresh}
            title="Làm mới"
            onMouseEnter={() => setIsRefreshHovered(true)}
            onMouseLeave={() => setIsRefreshHovered(false)}
          >
            <FiRefreshCw size={16} className={isRefreshHovered ? "text-blue-700" : "text-blue-600"} />
          </button>
          
          {/* Delete */}
          <button
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleBulkDelete}
            disabled={selectedEmails.size === 0 && !selectedEmail}
            title="Xóa"
            onMouseEnter={() => setIsDeleteHoveredNavbar(true)}
            onMouseLeave={() => setIsDeleteHoveredNavbar(false)}
          >
            {isDeleteHoveredNavbar ? (
              <RiDeleteBin6Fill className="text-red-700" size={18} />
            ) : (
              <RiDeleteBin6Line className="text-red-600" size={18} />
            )}
          </button>
          
          {/* Archive */}
          <button
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={async () => {
              if (selectedEmails.size === 0 && !selectedEmail) return;
              
              const emailsToArchive = selectedEmails.size > 0 
                ? Array.from(selectedEmails) 
                : selectedEmail ? [selectedEmail] : [];
              
              if (emailsToArchive.length === 0) return;
              if (!confirm(`Lưu trữ ${emailsToArchive.length} email?`)) return;
              
              try {
                // Archive từng email
                for (const emailId of emailsToArchive) {
                  await api.patch(`/mail/emails/${emailId}/archive`);
                }
                
                // Invalidate queries để refresh
                queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
                queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
                queryClient.invalidateQueries({ queryKey: ['emails', 'starred'] });
                queryClient.invalidateQueries({ queryKey: ['emails', 'archive'] });
                
                // Clear selection
                setSelectedEmails(new Set());
                setShowCheckboxes(false);
                if (selectedEmail && emailsToArchive.includes(selectedEmail)) {
                  setSelectedEmail(null);
                }
                
                alert('Đã lưu trữ email thành công!');
              } catch (error) {
                console.error('Archive error:', error);
                alert('Lỗi khi lưu trữ email!');
              }
            }}
            disabled={selectedEmails.size === 0 && !selectedEmail}
            title="Lưu trữ"
            onMouseEnter={() => setIsArchiveHovered(true)}
            onMouseLeave={() => setIsArchiveHovered(false)}
          >
            <Archive20Regular className={isArchiveHovered ? "text-green-700" : "text-green-600"} />
          </button>
          
          {/* Move to folder */}
          <div className="relative">
            <button
              className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              onClick={() => setShowMoveToMenu(!showMoveToMenu)}
              disabled={selectedEmails.size === 0 && !selectedEmail}
              title="Chuyển đến một thư mục"
            >
              <FolderArrowRight20Regular className="text-blue-600" />
              <span className="text-xs text-blue-600">▼</span>
            </button>
            
            {showMoveToMenu && (selectedEmails.size > 0 || selectedEmail) && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMoveToMenu(false)}
                ></div>
                <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-96 overflow-y-auto">
                  {mailboxes?.filter((mb: any) => {
                    // Chỉ cho phép chuyển đến: archive, trash, hoặc custom folders
                    const allowedMailboxes = ['archive', 'trash', 'custom1', 'custom2'];
                    return allowedMailboxes.includes(mb.id) && mb.id !== selectedMailbox;
                  }).map((mailbox: any) => (
                    <button
                      key={mailbox.id}
                      onClick={async () => {
                        setShowMoveToMenu(false);
                        
                        const emailsToMove = selectedEmails.size > 0 
                          ? Array.from(selectedEmails) 
                          : selectedEmail ? [selectedEmail] : [];
                        
                        if (emailsToMove.length === 0) return;
                        if (!confirm(`Di chuyển ${emailsToMove.length} email đến ${mailbox.name}?`)) return;
                        
                        try {
                          // Di chuyển từng email
                          for (const emailId of emailsToMove) {
                            await api.patch(`/mail/emails/${emailId}/move`, { 
                              targetMailbox: mailbox.id 
                            });
                          }
                          
                          // Invalidate queries
                          queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
                          queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
                          queryClient.invalidateQueries({ queryKey: ['emails', mailbox.id] });
                          queryClient.invalidateQueries({ queryKey: ['emails', 'starred'] });
                          
                          // Clear selection
                          setSelectedEmails(new Set());
                          setShowCheckboxes(false);
                          if (selectedEmail && emailsToMove.includes(selectedEmail)) {
                            setSelectedEmail(null);
                          }
                          
                          alert(`Đã di chuyển ${emailsToMove.length} email đến ${mailbox.name}!`);
                        } catch (error) {
                          console.error('Move error:', error);
                          alert('Lỗi khi di chuyển email!');
                        }
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-3 border-b last:border-b-0"
                    >
                      <span>{mailboxIcons[mailbox.id as keyof typeof mailboxIcons]}</span>
                      <span>{mailbox.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <div className="h-6 w-px bg-gray-300 mx-1" />
          
          {/* Reply, Reply All, Forward buttons - chỉ enabled khi chọn đúng 1 email */}
          <button
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleReply}
            disabled={!((selectedEmail && selectedEmails.size === 0) || selectedEmails.size === 1)}
            title="Trả lời"
            onMouseEnter={() => setIsReplyHovered(true)}
            onMouseLeave={() => setIsReplyHovered(false)}
          >
            <ArrowReply20Regular className={isReplyHovered && ((selectedEmail && selectedEmails.size === 0) || selectedEmails.size === 1) ? "text-blue-700" : "text-blue-600"} />
          </button>
          <button
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleReplyAll}
            disabled={!((selectedEmail && selectedEmails.size === 0) || selectedEmails.size === 1)}
            title="Trả lời tất cả"
            onMouseEnter={() => setIsReplyAllHovered(true)}
            onMouseLeave={() => setIsReplyAllHovered(false)}
          >
            <ArrowReplyAll20Regular className={isReplyAllHovered && ((selectedEmail && selectedEmails.size === 0) || selectedEmails.size === 1) ? "text-blue-700" : "text-blue-600"} />
          </button>
          <button
            className="p-2 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleForward}
            disabled={!((selectedEmail && selectedEmails.size === 0) || selectedEmails.size === 1)}
            title="Chuyển tiếp"
            onMouseEnter={() => setIsForwardHovered(true)}
            onMouseLeave={() => setIsForwardHovered(false)}
          >
            <ArrowForward20Regular className={isForwardHovered && ((selectedEmail && selectedEmails.size === 0) || selectedEmails.size === 1) ? "text-blue-700" : "text-blue-600"} />
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-1" />
          
          {/* Read Toggle Button - Thay đổi theo việc có chọn email hay không */}
          {selectedEmails.size === 0 ? (
            // Không chọn email - Nút "Đánh dấu tất cả"
            <button
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-200 rounded text-sm"
              onClick={async () => {
                if (!emails || emails.length === 0) return;
                if (!confirm('Đánh dấu tất cả email là đã đọc?')) return;
                
                try {
                  // Đánh dấu tất cả email là đã đọc
                  for (const email of emails) {
                    if (!email.read) {
                      await api.patch(`/mail/emails/${email.id}/read`, { read: true });
                    }
                  }
                  
                  // Invalidate queries
                  queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
                  queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
                  queryClient.invalidateQueries({ queryKey: ['emails', 'starred'] });
                  
                  alert('Đã đánh dấu tất cả email là đã đọc!');
                } catch (error) {
                  console.error('Mark all as read error:', error);
                  alert('Lỗi khi đánh dấu email!');
                }
              }}
              title="Đánh dấu tất cả là đã đọc"
            >
              <LuMails className="text-gray-600" size={18} />
              <span className="text-gray-700">Đánh dấu tất cả là đã đọc</span>
            </button>
          ) : (
            // Có chọn email - Toggle Đã đọc/Chưa đọc
            <button
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-200 rounded text-sm"
              onClick={() => {
                // Kiểm tra xem có email nào chưa đọc không
                const hasUnread = Array.from(selectedEmails).some(id => {
                  const email = emails?.find((e: any) => e.id === id);
                  return email && !email.read;
                });
                
                // Nếu có email chưa đọc → đánh dấu tất cả là đã đọc
                // Nếu tất cả đã đọc → đánh dấu tất cả là chưa đọc
                handleBulkMarkRead(hasUnread);
              }}
              title="Toggle đã đọc/chưa đọc"
            >
              <LuMailOpen className="text-gray-600" size={18} />
              <span className="text-gray-700">Đã đọc/Chưa đọc</span>
            </button>
          )}
          
          <div className="flex-1" />
          
          {/* Keyboard shortcuts help */}
          <button
            className="p-2 hover:bg-gray-200 rounded text-gray-600 text-sm"
            onClick={() => setShowKeyboardHelp(true)}
            title="Keyboard shortcuts (Shift + ?)"
          >
            <span className="font-semibold">?</span>
          </button>
          
          {selectedEmails.size > 0 && (
            <span className="text-sm text-gray-600">
              {selectedEmails.size} đã chọn
            </span>
          )}
        </div>
      </div>

      {/* Main content: 3 columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* Column 1: Mailboxes - Always hidden on mobile, show on desktop */}
        <div
          className="hidden md:flex md:flex-col bg-gray-50 overflow-hidden border-r"
          style={{ width: `${mailboxWidth}%` }}
        >
        <div className="flex justify-between items-center p-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">Mailboxes</h2>
          <FiEdit className="cursor-pointer" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
        {mailboxesLoading ? (
          <div className="center-spinner">
            <div className="spinner"></div>
          </div>
        ) : mailboxesError ? (
          <div>Error loading mailboxes</div>
        ) : (
          <ul>
            {mailboxes?.map((mailbox: any) => (
              <li
                key={mailbox.id}
                role="button"
                tabIndex={0}
                aria-label={`${mailbox.name} mailbox${mailbox.unread > 0 ? `, ${mailbox.unread} unread` : ''}`}
                aria-current={selectedMailbox === mailbox.id ? 'page' : undefined}
                className={`flex items-center p-2 mb-1 rounded cursor-pointer hover:bg-gray-200 focus:outline-none ${
                  selectedMailbox === mailbox.id ? 'bg-blue-100 text-blue-600' : ''
                }`}
                onClick={() => handleMailboxSelect(mailbox.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMailboxSelect(mailbox.id);
                  }
                }}
              >
                <span className="mr-2">{mailboxIcons[mailbox.id as keyof typeof mailboxIcons]}</span>
                <span>{mailbox.name}</span>
                {/* Chỉ hiển thị unread count cho inbox */}
                {mailbox.id === 'inbox' && mailbox.unread > 0 && (
                  <span className="ml-auto bg-blue-500 text-white text-xs rounded-full px-2">
                    {mailbox.unread}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>

      {/* Divider 1 */}
      <div
        className="hidden md:block w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize"
        onMouseDown={handleMouseDown(1)}
      />

      {/* Column 2: Email List - Show by default on mobile, hide when email is selected */}
      <div
        className={`border-r flex flex-col w-full ${
          mobileView === 'email' ? 'hidden md:flex' : 'flex'
        }`}
        style={{ width: window.innerWidth >= 768 ? `${emailListWidth}%` : undefined }}
      >
        {/* Header đơn giản - chỉ title và select all */}
        <div className="border-b flex-shrink-0">
          {/* Title */}
          <div className="flex justify-between items-center px-4 py-2">
            {/* Mobile: Mailbox dropdown menu */}
            <div className="md:hidden relative">
              <button
                onClick={() => setShowMailboxMenu(!showMailboxMenu)}
                className="flex items-center gap-2 text-lg font-semibold hover:text-blue-600"
              >
                <span>{selectedMailbox.charAt(0).toUpperCase() + selectedMailbox.slice(1)}</span>
                <IoIosArrowDown className="text-gray-600" />
              </button>
              
              {showMailboxMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowMailboxMenu(false)}
                  ></div>
                  <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                    {mailboxes?.map((mailbox: any) => (
                      <button
                        key={mailbox.id}
                        onClick={() => {
                          handleMailboxSelect(mailbox.id);
                          setShowMailboxMenu(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3 border-b last:border-b-0 ${
                          selectedMailbox === mailbox.id ? 'bg-blue-50 text-blue-600' : ''
                        }`}
                      >
                        <span className="text-lg">{mailboxIcons[mailbox.id as keyof typeof mailboxIcons]}</span>
                        <span className="flex-1">{mailbox.name}</span>
                        {mailbox.id === 'starred' && (mailbox as any).count > 0 && (
                          <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                            {(mailbox as any).count}
                          </span>
                        )}
                        {mailbox.id !== 'starred' && mailbox.unread > 0 && (
                          <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                            {mailbox.unread}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {/* Desktop: Static title */}
            <h2 className="hidden md:block text-lg font-semibold">
              {selectedMailbox.charAt(0).toUpperCase() + selectedMailbox.slice(1)}
            </h2>
            <div className="flex items-center gap-2">
              {/* Select all checkbox - luôn hiển thị */}
              <input
                type="checkbox"
                className="w-4 h-4 cursor-pointer hidden md:block"
                checked={!!(emails && selectedEmails.size > 0 && selectedEmails.size === emails.filter((email: any) => {
                  if (selectedMailbox === 'starred') return starredState[email.id];
                  return true;
                }).length)}
                onChange={handleToggleSelectAll}
                title={selectedEmails.size > 0 ? `${selectedEmails.size} selected` : 'Chọn tất cả'}
              />
              <FiMoreVertical className="cursor-pointer text-gray-600" />
            </div>
          </div>
          
          {/* Select all checkbox - mobile only, luôn hiển thị */}
          <div className="flex items-center gap-3 px-4 py-2 border-t md:hidden">
            <input
              type="checkbox"
              className="w-4 h-4 cursor-pointer"
              checked={!!(emails && selectedEmails.size > 0 && selectedEmails.size === emails.filter((email: any) => {
                if (selectedMailbox === 'starred') return starredState[email.id];
                return true;
              }).length)}
              onChange={handleToggleSelectAll}
            />
            <span className="text-sm text-gray-600">
              {selectedEmails.size > 0 ? `${selectedEmails.size} selected` : 'Chọn tất cả'}
            </span>
          </div>
        </div>
        
        {/* Email list content with overflow */}
        <div ref={emailListRef} className="flex-1">
        {emailsLoading ? (
          <div className="center-spinner">
            <div className="spinner"></div>
          </div>
        ) : emailsError ? (
          <div>Error loading emails</div>
        ) : (
          <div className="h-full">
            <FixedSizeList
              height={listHeight}
              itemCount={emails?.filter((email: any) => {
                if (selectedMailbox === 'starred') {
                  if (!starredState[email.id]) return false;
                }
                // Áp dụng read filter
                if (readFilter === 'read' && !email.read) return false;
                if (readFilter === 'unread' && email.read) return false;
                return true;
              }).length || 0}
              itemSize={110}
              width="100%"
              itemData={{
                emails: emails?.filter((email: any) => {
                  if (selectedMailbox === 'starred') {
                    if (!starredState[email.id]) return false;
                  }
                  // Áp dụng read filter
                  if (readFilter === 'read' && !email.read) return false;
                  if (readFilter === 'unread' && email.read) return false;
                  return true;
                }),
                selectedEmail,
                selectedMailbox,
                selectedEmails,
                starredState,
                showCheckboxes,
                handleToggleCheckbox,
                handleEmailSelect,
                handleToggleRead,
                handleToggleStar,
                handleDeleteEmail,
              }}
            >
              {EmailRow}
            </FixedSizeList>
          </div>
        )}
        </div>
      </div>

      {/* Divider 2 */}
      <div
        className="hidden md:block w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize"
        onMouseDown={handleMouseDown(2)}
      />

      {/* Column 3: Email Detail - Show on mobile only when email selected */}
      <div
        className={`flex flex-col overflow-hidden w-full ${
          mobileView === 'emails' ? 'hidden md:flex' : 'flex'
        }`}
        style={{ width: window.innerWidth >= 768 ? `${100 - mailboxWidth - emailListWidth}%` : undefined }}
      >
        <div className="flex-shrink-0 p-4 pb-0">
        <button
          className="md:hidden mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium px-3 py-2 rounded hover:bg-blue-50"
          onClick={() => setMobileView('emails')}
          aria-label="Back to email list"
        >
          <span className="text-xl">←</span>
          <span>Back to emails</span>
        </button>
        </div>
        
        {/* Email detail content with overflow */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
        {emailLoading ? (
          <div className="center-spinner">
            <div className="spinner"></div>
          </div>
        ) : emailError ? (
          <div>Error loading email</div>
        ) : email ? (
          <div>
            {/* Subject Header - Separate box */}
            <div className="mb-4 p-4 bg-gray-50 rounded border border-gray-200">
              <h2 className="text-xl font-semibold">{email.subject}</h2>
            </div>
            
            {/* Main email content box - includes sender info, actions, body, attachments */}
            <div className="bg-white border border-gray-200 rounded">
              {/* Email metadata with actions */}
              <div className="p-4 pb-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left side: Avatar + Sender info */}
                  <div className="flex items-start flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 mr-3 flex items-center justify-center font-bold text-white ${getAvatarColor(email.from)}`}>
                      {email.from.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base">{email.from}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Tới:</span> {email.to}
                      </div>
                      {email.cc && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Cc:</span> {email.cc}
                        </div>
                      )}
                      {email.bcc && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Bcc:</span> {email.bcc}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        {(() => {
                          const date = new Date(email.received);
                          const weekday = date.toLocaleString('vi-VN', { weekday: 'short' }).replace(/^\w/, c => c.toUpperCase());
                          const dateTime = date.toLocaleString('vi-VN', {
                            day: 'numeric',
                            month: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          });
                          return `${weekday}, ${dateTime}`;
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Right side: Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button 
                      onClick={handleReply}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Trả lời"
                      onMouseEnter={() => setIsReplyHoveredDetail(true)}
                      onMouseLeave={() => setIsReplyHoveredDetail(false)}
                    >
                      <ArrowReply20Regular className={isReplyHoveredDetail ? "text-blue-600" : "text-gray-600"} />
                    </button>
                    <button 
                      onClick={handleReplyAll}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Trả lời tất cả"
                      onMouseEnter={() => setIsReplyAllHoveredDetail(true)}
                      onMouseLeave={() => setIsReplyAllHoveredDetail(false)}
                    >
                      <ArrowReplyAll20Regular className={isReplyAllHoveredDetail ? "text-blue-600" : "text-gray-600"} />
                    </button>
                    <button 
                      onClick={handleForward}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="Chuyển tiếp"
                      onMouseEnter={() => setIsForwardHoveredDetail(true)}
                      onMouseLeave={() => setIsForwardHoveredDetail(false)}
                    >
                      <ArrowForward20Regular className={isForwardHoveredDetail ? "text-blue-600" : "text-gray-600"} />
                    </button>
                    
                    <div className="h-6 w-px bg-gray-300 mx-1" />
                    
                    <button 
                      onClick={() => handleToggleRead(email.id)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title={email.read ? "Đánh dấu chưa đọc" : "Đánh dấu đã đọc"}
                      onMouseEnter={() => setIsMailHoveredDetail(true)}
                      onMouseLeave={() => setIsMailHoveredDetail(false)}
                    >
                      {email.read ? (
                        isMailHoveredDetail ? <TbMailFilled className="w-5 h-5" /> : <LuMail className="w-5 h-5" />
                      ) : (
                        isMailHoveredDetail ? <TbMailOpenedFilled className="w-5 h-5" /> : <LuMailOpen className="w-5 h-5" />
                      )}
                    </button>
                    <button 
                      onClick={() => handleToggleStar(email.id)}
                      className="p-2 hover:bg-gray-100 rounded"
                      title={starredState[email.id] ? "Bỏ gắn sao" : "Gắn sao"}
                      onMouseEnter={() => setIsStarHoveredDetail(true)}
                      onMouseLeave={() => setIsStarHoveredDetail(false)}
                    >
                      {starredState[email.id] || isStarHoveredDetail ? (
                        <FaStar className="w-5 h-5 text-yellow-400" />
                      ) : (
                        <FaRegStar className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                    
                    {/* More Menu with Delete */}
                    <div className="relative">
                      <button 
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        className="p-2 hover:bg-gray-100 rounded" 
                        title="Thêm"
                      >
                        <FiMoreVertical className="w-5 h-5" />
                      </button>
                      
                      {showMoreMenu && (
                        <>
                          {/* Overlay để đóng menu khi click bên ngoài */}
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowMoreMenu(false)}
                          ></div>
                          
                          {/* Dropdown Menu */}
                          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-20">
                            <button
                              onClick={async () => {
                                setShowMoreMenu(false);
                                
                                const isInTrash = selectedMailbox === 'trash';
                                const confirmMessage = isInTrash 
                                  ? 'Xóa vĩnh viễn email này? (Không thể khôi phục)'
                                  : 'Chuyển email vào thùng rác?';
                                
                                if (confirm(confirmMessage)) {
                                  try {
                                    await api.delete('/mail/emails', { 
                                      data: { ids: [email.id] } 
                                    });
                                    
                                    // Invalidate tất cả queries để refresh
                                    queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
                                    queryClient.invalidateQueries({ queryKey: ['emails', selectedMailbox] });
                                    queryClient.invalidateQueries({ queryKey: ['emails', 'starred'] });
                                    
                                    // Nếu chuyển vào trash, invalidate trash queries
                                    if (!isInTrash) {
                                      queryClient.invalidateQueries({ queryKey: ['emails', 'trash'] });
                                    }
                                    
                                    // Đóng email detail
                                    setSelectedEmail(null);
                                    
                                    const successMessage = isInTrash 
                                      ? 'Đã xóa vĩnh viễn!'
                                      : 'Đã chuyển vào thùng rác!';
                                    alert(successMessage);
                                  } catch (error) {
                                    console.error('Delete error:', error);
                                    alert('Lỗi khi xóa email!');
                                  }
                                }
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-red-600"
                            >
                              <RiDeleteBin6Line className="w-4 h-4" />
                              {selectedMailbox === 'trash' ? 'Xóa vĩnh viễn' : 'Xóa'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email body */}
              <div className="p-6 pt-4">
                <div
                  className="email-body prose max-w-none mb-4"
                  dangerouslySetInnerHTML={{ __html: email.body }}
                />

                {/* Attachments */}
                {email.attachments && email.attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h3 className="text-sm font-semibold mb-3">
                      Tệp đính kèm ({email.attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {email.attachments.map((attachment: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 border rounded hover:bg-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            <FiFileText className="text-gray-500" size={20} />
                            <div>
                              <div className="text-sm font-medium">{attachment.name}</div>
                              <div className="text-xs text-gray-500">{attachment.size}</div>
                            </div>
                          </div>
                          <button
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                            onClick={() => alert(`Download ${attachment.name}`)}
                          >
                            Tải xuống
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <img 
              src="https://res.public.onecdn.static.microsoft/assets/mail/illustrations/noMailSelected/v2/light.svg" 
              alt="No email selected" 
              style={{ width: '200px', height: '200px' }}
              className="mb-4"
            />
            <p className="text-lg font-medium text-gray-700">Select an email to view details</p>
            <p className="text-sm text-gray-500 mt-2">Choose a message from the list to read</p>
          </div>
        )}
        </div>
      </div>
      
      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowComposeModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Thư mới</h3>
              <button onClick={() => setShowComposeModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium">Tới:</label>
                  <div className="flex gap-2 text-xs">
                    {!showCc && <button onClick={() => setShowCc(true)} className="text-blue-500 hover:underline">Cc</button>}
                    {!showBcc && <button onClick={() => setShowBcc(true)} className="text-blue-500 hover:underline">Bcc</button>}
                  </div>
                </div>
                <input 
                  type="email" 
                  className="w-full border rounded px-3 py-2" 
                  placeholder="email@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                />
              </div>
              
              {showCc && (
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Cc:</label>
                  <input 
                    type="email" 
                    className="w-full border rounded px-3 py-2" 
                    placeholder="email@example.com"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                  />
                </div>
              )}
              
              {showBcc && (
                <div className="mb-3">
                  <label className="block text-sm font-medium mb-1">Bcc:</label>
                  <input 
                    type="email" 
                    className="w-full border rounded px-3 py-2" 
                    placeholder="email@example.com"
                    value={composeBcc}
                    onChange={(e) => setComposeBcc(e.target.value)}
                  />
                </div>
              )}
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Chủ đề:</label>
                <input 
                  type="text" 
                  className="w-full border rounded px-3 py-2" 
                  placeholder="Nhập chủ đề..."
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Nội dung:</label>
                <textarea 
                  className="w-full border rounded px-3 py-2" 
                  rows={6} 
                  placeholder="Nhập nội dung email..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                ></textarea>
              </div>
              
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Tập đính kèm:</label>
                <input 
                  type="file" 
                  multiple
                  className="w-full border rounded px-3 py-2"
                  onChange={(e) => {
                    if (e.target.files) {
                      setComposeAttachments(Array.from(e.target.files));
                    }
                  }}
                />
                {composeAttachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {composeAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
                        <span className="truncate">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                        <button 
                          onClick={() => setComposeAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowComposeModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">
                  Hủy
                </button>
                <button onClick={handleSendEmail} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Keyboard Shortcuts</h3>
              <button onClick={() => setShowKeyboardHelp(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Navigate emails</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">↑ / ↓</kbd>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Open email</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Enter</kbd>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Compose new email</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + C</kbd>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Refresh</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + R</kbd>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Toggle star</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + S</kbd>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Toggle read/unread</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Ctrl + U</kbd>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Close / Go back</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Esc</kbd>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Show shortcuts</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Shift + ?</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
