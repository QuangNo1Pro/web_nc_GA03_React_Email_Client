
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly mailboxes = [
    { id: 'inbox', name: 'Inbox', unread: 8 },
    { id: 'starred', name: 'Starred', unread: 4, count: 4 }, // count = tổng số email starred, unread = số email starred chưa đọc
    { id: 'sent', name: 'Sent', unread: 0 },
    { id: 'drafts', name: 'Drafts', unread: 1 },
    { id: 'archive', name: 'Archive', unread: 0 }, // unread = số emails chưa đọc trong archive
    { id: 'trash', name: 'Trash', unread: 0 },
    { id: 'spam', name: 'Spam', unread: 12 },
    { id: 'custom1', name: 'Custom Folder 1', unread: 0 },
    { id: 'custom2', name: 'Custom Folder 2', unread: 5 },
  ];

  private readonly emails: { [key: string]: any[] } = {
    inbox: [
      {
        id: '1',
        sender: 'John Doe',
        subject: 'Hello World',
        preview: 'This is a test email',
        timestamp: '2025-11-15T10:00:00Z',
        starred: true,
        read: false,
      },
      {
        id: '2',
        sender: 'Jane Doe',
        subject: 'Re: Hello World',
        preview: 'This is another test email',
        timestamp: '2025-11-15T11:00:00Z',
        starred: true,
        read: false,
      },
      {
        id: '3',
        sender: 'Peter Jones',
        subject: 'Important Notice',
        preview: 'Please read this important notice',
        timestamp: '2025-11-15T12:00:00Z',
        starred: false,
        read: true,
      },
      {
        id: '5',
        sender: 'Boss',
        subject: 'Urgent: Meeting',
        preview: 'Please join the meeting at 2PM',
        timestamp: '2025-11-15T13:00:00Z',
        starred: true,
        read: false,
      },
      {
        id: '6',
        sender: 'HR',
        subject: 'Policy Update',
        preview: 'Please review the new HR policy',
        timestamp: '2025-11-15T14:00:00Z',
        starred: false,
        read: false,
      },
      {
        id: '7',
        sender: 'Marketing Team',
        subject: 'Q4 Campaign Results',
        preview: 'Our campaign exceeded expectations with a 25% increase in engagement',
        timestamp: '2025-11-15T15:00:00Z',
        starred: false,
        read: false,
      },
      {
        id: '8',
        sender: 'IT Support',
        subject: 'System Maintenance Scheduled',
        preview: 'System maintenance is scheduled for this Saturday from 10 PM to 2 AM',
        timestamp: '2025-11-15T16:00:00Z',
        starred: false,
        read: false,
      },
      {
        id: '9',
        sender: 'Finance Team',
        subject: 'Expense Report Approval',
        preview: 'Your expense report for November has been approved',
        timestamp: '2025-11-15T17:00:00Z',
        starred: false,
        read: true,
      },
      {
        id: '10',
        sender: 'Customer Success',
        subject: 'Client Feedback Summary',
        preview: 'Overall satisfaction rate: 92%. Great job on the recent project delivery!',
        timestamp: '2025-11-15T18:00:00Z',
        starred: false,
        read: false,
      },
      {
        id: '11',
        sender: 'Team Lead',
        subject: 'Project Update - Multiple Recipients',
        preview: 'Quick update on the project status with the entire team',
        timestamp: '2025-11-16T09:00:00Z',
        starred: false,
        read: false,
      },
    ],
    sent: [
      {
        id: '4',
        sender: 'Me',
        subject: 'Test Email',
        preview: 'This is a test email I sent',
        timestamp: '2025-11-15T09:00:00Z',
        starred: true,
        read: true,
      },
    ],
      spam: [],
      drafts: [],
      archive: [],
      trash: [],
    };

    // Thêm phương thức mock cập nhật trạng thái starred cho email
    setEmailStarred(emailId: string, starred: boolean) {
      // Tìm email trong từng mailbox gốc (để cập nhật đúng reference)
      let email: any = null;
      const mailboxKeys = ['inbox', 'sent', 'spam', 'drafts', 'archive', 'trash'];
      
      for (const key of mailboxKeys) {
        const found = this.emails[key]?.find(e => e.id === emailId);
        if (found) {
          email = found;
          break;
        }
      }
      
      if (email) {
        email.starred = starred;
        
        // Gọi recalculateCounts để đảm bảo counts chính xác
        this.recalculateCounts();
        return { success: true, email };
      }
      return { success: false };
    }

    setEmailRead(emailId: string, read: boolean) {
      // Tìm email trong từng mailbox gốc (để cập nhật đúng reference)
      let email: any = null;
      const mailboxKeys = ['inbox', 'sent', 'spam', 'drafts', 'archive', 'trash'];
      
      for (const key of mailboxKeys) {
        const found = this.emails[key]?.find(e => e.id === emailId);
        if (found) {
          email = found;
          break;
        }
      }
      
      if (email) {
        email.read = read;
        
        // Gọi recalculateCounts để đảm bảo counts chính xác
        this.recalculateCounts();
        return { success: true, email };
      }
      return { success: false };
    }

  private readonly emailDetails: { [key: string]: any } = {
    '1': {
      from: 'John Doe <john.doe@example.com>',
      to: 'Me <me@example.com>',
      cc: '',
      subject: 'Hello World',
      received: '2025-11-15T10:00:00Z',
      body: '<p>This is a test email.</p>',
      attachments: [],
    },
    '2': {
      from: 'Jane Doe <jane.doe@example.com>',
      to: 'Me <me@example.com>',
      cc: 'John Doe <john.doe@example.com>',
      subject: 'Re: Hello World',
      received: '2025-11-15T11:00:00Z',
      body: '<p>This is another test email.</p>',
      attachments: [
        { name: 'attachment1.pdf', size: '1.2 MB' },
        { name: 'attachment2.jpg', size: '3.4 MB' },
      ],
    },
    '3': {
      from: 'Peter Jones <peter.jones@example.com>',
      to: 'Me <me@example.com>',
      cc: '',
      subject: 'Important Notice',
      received: '2025-11-15T12:00:00Z',
      body: '<h1>Important Notice</h1><p>Please read this important notice.</p>',
      attachments: [],
    },
    '4': {
      from: 'Me <me@example.com>',
      to: 'test@example.com',
      cc: '',
      subject: 'Test Email',
      received: '2025-11-15T09:00:00Z',
      body: '<p>This is a test email I sent.</p>',
      attachments: [],
    },
    '5': {
      from: 'Boss <boss@company.com>',
      to: 'Me <me@example.com>',
      cc: '',
      subject: 'Urgent: Meeting',
      received: '2025-11-15T13:00:00Z',
      body: '<p>Please join the meeting at 2PM today. We need to discuss the project timeline.</p>',
      attachments: [
        { name: 'meeting-agenda.pdf', size: '500 KB' },
      ],
    },
    '6': {
      from: 'HR <hr@company.com>',
      to: 'Me <me@example.com>',
      cc: '',
      subject: 'Policy Update',
      received: '2025-11-15T14:00:00Z',
      body: '<p>Please review the new HR policy regarding remote work.</p>',
      attachments: [],
    },
    '7': {
      from: 'Marketing Team <marketing@company.com>',
      to: 'Me <me@example.com>',
      cc: 'Boss <boss@company.com>',
      subject: 'Q4 Campaign Results',
      received: '2025-11-15T15:00:00Z',
      body: '<h2>Q4 Results</h2><p>Our campaign exceeded expectations with a 25% increase in engagement.</p>',
      attachments: [
        { name: 'q4-report.xlsx', size: '2.5 MB' },
        { name: 'analytics.pdf', size: '1.8 MB' },
      ],
    },
    '8': {
      from: 'IT Support <support@company.com>',
      to: 'Me <me@example.com>',
      cc: '',
      subject: 'System Maintenance Scheduled',
      received: '2025-11-15T16:00:00Z',
      body: '<p>System maintenance is scheduled for this Saturday from 10 PM to 2 AM. Please save your work.</p>',
      attachments: [],
    },
    '9': {
      from: 'Finance Team <finance@company.com>',
      to: 'Me <me@example.com>',
      cc: 'HR <hr@company.com>',
      subject: 'Expense Report Approval',
      received: '2025-11-15T17:00:00Z',
      body: '<p>Your expense report for November has been approved. Payment will be processed by Friday.</p>',
      attachments: [
        { name: 'expense-report-nov.pdf', size: '850 KB' },
      ],
    },
    '10': {
      from: 'Customer Success <success@company.com>',
      to: 'Me <me@example.com>',
      cc: '',
      subject: 'Client Feedback Summary',
      received: '2025-11-15T18:00:00Z',
      body: '<h3>Client Feedback</h3><p>Overall satisfaction rate: 92%. Great job on the recent project delivery!</p>',
      attachments: [
        { name: 'feedback-summary.pdf', size: '1.1 MB' },
        { name: 'survey-results.xlsx', size: '780 KB' },
      ],
    },
    '11': {
      from: 'Team Lead <lead@company.com>',
      to: 'Me <me@example.com>, Alice <alice@company.com>, Bob <bob@company.com>, Charlie <charlie@company.com>',
      cc: 'Manager <manager@company.com>, HR <hr@company.com>',
      subject: 'Project Update - Multiple Recipients',
      received: '2025-11-16T09:00:00Z',
      body: '<h3>Project Status Update</h3><p>Hi team,</p><p>Here is a quick update on our current project status. We are on track to meet the deadline.</p><p>Key points:</p><ul><li>Phase 1 completed</li><li>Phase 2 in progress</li><li>Testing scheduled for next week</li></ul><p>Please let me know if you have any questions.</p><p>Best regards,<br>Team Lead</p>',
      attachments: [
        { name: 'project-timeline.pdf', size: '650 KB' },
      ],
    },
  };

  getMailboxes() {
    return this.mailboxes;
  }

  getEmails(mailboxId: string, page: number) {
    let emails: any[] = [];
    
    if (mailboxId === 'starred') {
      // Lấy tất cả email có starred=true từ mọi mailbox
      const allEmails = [
        ...(this.emails.inbox || []),
        ...(this.emails.sent || []),
        ...(this.emails.spam || []),
        ...(this.emails.drafts || []),
        ...(this.emails.archive || []),
        ...(this.emails.trash || []),
      ];
      emails = allEmails.filter(e => e.starred);
    } else {
      emails = this.emails[mailboxId] || [];
    }
    
    // Return with pagination info (for frontend virtualization)
    return {
      emails,
      total: emails.length,
      page: page || 1,
      pageSize: 50, // Số email mỗi trang (không dùng trong virtualized list nhưng giữ cho tương lai)
    };
  }

  getEmail(emailId: string) {
    // Tìm email trong inbox
    const inboxEmail = (this.emails.inbox || []).find(e => e.id === emailId);
    if (inboxEmail && !inboxEmail.read) {
      inboxEmail.read = true;
      // Giảm số lượng unread của mailbox inbox
      const inboxBox = this.mailboxes.find(mb => mb.id === 'inbox');
      if (inboxBox && inboxBox.unread > 0) {
        inboxBox.unread -= 1;
      }
    }
    return this.emailDetails[emailId] || null;
  }

  // Bulk delete emails - soft delete (move to trash) or hard delete (permanent from trash)
  deleteEmails(ids: string[]) {
    const mailboxKeys = ['inbox', 'sent', 'spam', 'drafts', 'archive', 'trash'];
    let deletedCount = 0;
    let movedToTrashCount = 0;

    // Tìm emails trong trash - xóa vĩnh viễn
    const trashEmails = (this.emails.trash || []).filter(e => ids.includes(e.id));
    if (trashEmails.length > 0) {
      const trashIds = trashEmails.map(e => e.id);
      const initialLength = this.emails.trash.length;
      this.emails.trash = this.emails.trash.filter(e => !trashIds.includes(e.id));
      deletedCount = initialLength - this.emails.trash.length;
      
      // Xóa email details
      trashIds.forEach(id => {
        if (this.emailDetails[id]) {
          delete this.emailDetails[id];
        }
      });
    }

    // Tìm emails ở các mailbox khác - chuyển vào trash (soft delete)
    const emailsToMove: any[] = [];
    for (const key of mailboxKeys) {
      if (key !== 'trash' && this.emails[key]) {
        const foundEmails = this.emails[key].filter(e => ids.includes(e.id));
        if (foundEmails.length > 0) {
          emailsToMove.push(...foundEmails);
          // Xóa khỏi mailbox gốc
          this.emails[key] = this.emails[key].filter(e => !ids.includes(e.id));
        }
      }
    }

    // Chuyển emails sang trash
    if (emailsToMove.length > 0) {
      if (!this.emails.trash) {
        this.emails.trash = [];
      }
      this.emails.trash.unshift(...emailsToMove);
      movedToTrashCount = emailsToMove.length;
    }

    // Cập nhật counts
    this.recalculateCounts();
    
    // Cập nhật trash unread count
    const trashBox = this.mailboxes.find(mb => mb.id === 'trash');
    if (trashBox) {
      trashBox.unread = (this.emails.trash || []).filter(e => !e.read).length;
    }

    return { 
      success: true, 
      deletedCount, // số emails xóa vĩnh viễn
      movedToTrashCount, // số emails chuyển vào trash
    };
  }

  // Bulk mark read/unread
  bulkSetRead(ids: string[], read: boolean) {
    const mailboxKeys = ['inbox', 'sent', 'spam', 'drafts', 'archive', 'trash'];
    let updatedCount = 0;

    for (const key of mailboxKeys) {
      if (this.emails[key]) {
        this.emails[key].forEach(email => {
          if (ids.includes(email.id)) {
            email.read = read;
            updatedCount++;
          }
        });
      }
    }

    // Cập nhật counts
    this.recalculateCounts();
    return { success: true, updatedCount };
  }

  // Send email
  sendEmail(emailData: { to: string; cc?: string; bcc?: string; subject: string; body: string; attachments?: { name: string; size: number }[] }) {
    const newEmail = {
      id: String(Date.now()),
      sender: 'Me',
      subject: emailData.subject,
      preview: emailData.body.substring(0, 50),
      timestamp: new Date().toISOString(),
      starred: false,
      read: true,
    };

    // Thêm vào sent
    if (!this.emails.sent) {
      this.emails.sent = [];
    }
    this.emails.sent.unshift(newEmail);

    // Helper to format bytes to human readable string
    const formatBytes = (bytes: number) => {
      if (!bytes && bytes !== 0) return '';
      const thresh = 1024;
      if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
      }
      const units = ['KB', 'MB', 'GB', 'TB'];
      let u = -1;
      do {
        bytes /= thresh;
        ++u;
      } while (Math.abs(bytes) >= thresh && u < units.length - 1);
      return bytes.toFixed( (bytes >= 10 || u === 0) ? 0 : 1 ) + ' ' + units[u];
    };

    // Format attachments if provided
    const formattedAttachments = (emailData.attachments || []).map(a => ({
      name: a.name,
      size: formatBytes(a.size),
    }));

    // Thêm email detail
    this.emailDetails[newEmail.id] = {
      from: 'Me <me@example.com>',
      to: emailData.to,
      cc: emailData.cc || '',
      bcc: emailData.bcc || '',
      subject: emailData.subject,
      received: newEmail.timestamp,
      body: emailData.body,
      attachments: formattedAttachments,
    };

    return { success: true, email: newEmail };
  }

  // Archive email - di chuyển email từ mailbox hiện tại sang archive
  archiveEmail(emailId: string) {
    const mailboxKeys = ['inbox', 'sent', 'spam', 'drafts', 'trash'];
    let archivedEmail: any = null;

    // Tìm và xóa email từ mailbox gốc
    for (const key of mailboxKeys) {
      if (this.emails[key]) {
        const emailIndex = this.emails[key].findIndex(e => e.id === emailId);
        if (emailIndex !== -1) {
          archivedEmail = this.emails[key].splice(emailIndex, 1)[0];
          break;
        }
      }
    }

    if (archivedEmail) {
      // Thêm vào archive
      if (!this.emails.archive) {
        this.emails.archive = [];
      }
      this.emails.archive.unshift(archivedEmail);

      // Cập nhật counts
      this.recalculateCounts();
      
      // Cập nhật archive mailbox unread count
      const archiveBox = this.mailboxes.find(mb => mb.id === 'archive');
      if (archiveBox) {
        archiveBox.unread = (this.emails.archive || []).filter(e => !e.read).length;
      }

      return { success: true, message: 'Email archived successfully' };
    }

    return { success: false, message: 'Email not found' };
  }

  // Move email - di chuyển email từ mailbox hiện tại sang mailbox khác
  moveEmail(emailId: string, targetMailbox: string) {
    const mailboxKeys = ['inbox', 'sent', 'spam', 'drafts', 'trash', 'archive'];
    let movedEmail: any = null;
    let sourceMailbox: string = '';

    // Tìm và xóa email từ mailbox gốc
    for (const key of mailboxKeys) {
      if (this.emails[key]) {
        const emailIndex = this.emails[key].findIndex(e => e.id === emailId);
        if (emailIndex !== -1) {
          movedEmail = this.emails[key].splice(emailIndex, 1)[0];
          sourceMailbox = key;
          break;
        }
      }
    }

    if (movedEmail) {
      // Thêm vào target mailbox
      if (!this.emails[targetMailbox]) {
        this.emails[targetMailbox] = [];
      }
      this.emails[targetMailbox].unshift(movedEmail);

      // Cập nhật counts
      this.recalculateCounts();
      
      // Cập nhật unread count cho target mailbox
      const targetBox = this.mailboxes.find(mb => mb.id === targetMailbox);
      if (targetBox) {
        targetBox.unread = (this.emails[targetMailbox] || []).filter(e => !e.read).length;
      }

      return { 
        success: true, 
        message: `Email moved from ${sourceMailbox} to ${targetMailbox} successfully` 
      };
    }

    return { success: false, message: 'Email not found' };
  }

  // Helper: recalculate unread counts
  private recalculateCounts() {
    const inboxBox = this.mailboxes.find(mb => mb.id === 'inbox');
    const starredBox = this.mailboxes.find(mb => mb.id === 'starred');
    const archiveBox = this.mailboxes.find(mb => mb.id === 'archive');
    const trashBox = this.mailboxes.find(mb => mb.id === 'trash');

    if (inboxBox) {
      inboxBox.unread = (this.emails.inbox || []).filter(e => !e.read).length;
    }

    if (starredBox) {
      const allEmails = [
        ...(this.emails.inbox || []),
        ...(this.emails.sent || []),
        ...(this.emails.spam || []),
        ...(this.emails.drafts || []),
        ...(this.emails.archive || []),
        ...(this.emails.trash || []),
      ];
      const starredEmails = allEmails.filter(e => e.starred);
      starredBox.count = starredEmails.length;
      starredBox.unread = starredEmails.filter(e => !e.read).length;
    }

    if (archiveBox) {
      archiveBox.unread = (this.emails.archive || []).filter(e => !e.read).length;
    }

    if (trashBox) {
      trashBox.unread = (this.emails.trash || []).filter(e => !e.read).length;
    }
  }
}