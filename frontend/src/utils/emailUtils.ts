export const mailboxLabelVN: Record<string, string> = {
  CHAT: "Trò chuyện",
  INBOX: "Hộp thư đến",
  STARRED: "Có gắn dấu sao",
  SENT: "Đã gửi",
  DRAFT: "Thư nháp",
  SPAM: "Thư rác",
  IMPORTANT: "Quan trọng",
  ALL_MAIL: "Tất cả thư",
  TRASH: "Thùng rác",
  UNREAD: "Chưa đọc",
};

export const getMailboxLabelVN = (mailbox: any) => {
  return mailboxLabelVN[mailbox.id] || mailbox.id;
};

export const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
  const byteCharacters = atob(b64Data);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers: number[] = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  const blob = new Blob(byteArrays as BlobPart[], { type: contentType });
  return blob;
};

export const parseAttachments = (parts: any[]): any[] => {
  let attachments: any[] = [];
  if (!parts) return attachments;

  parts.forEach((part) => {
    if (part.parts) {
      attachments = attachments.concat(parseAttachments(part.parts));
    }
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size,
      });
    }
  });
  return attachments;
};

export const getAvatarColor = (name: string) => {
  // Single consistent color for all avatars
  return 'bg-blue-500';
};

export const extractEmails = (raw: string = "") => {
  return raw
    .split(",")
    .map((addr) => addr.trim())
    .map((addr) => {
      const m = addr.match(/<(.+?)>/);
      if (m) return m[1];
      return addr;
    })
    .filter(Boolean);
};

export const parseEmail = (email: any) => {
  // If email is already parsed (from draft API or snooze API), return as-is with adjustments
  if (email.sender && email.subject !== undefined && (email.timestamp || email.timestamp === 0) && email.snippet !== undefined) {
    return {
      id: email.id,
      sender: email.sender || '(Không có người gửi)',
      subject: email.subject || '(Không có tiêu đề)',
      // Handle both number and string timestamps
      timestamp: typeof email.timestamp === 'number' ? email.timestamp : new Date(email.timestamp).getTime(),
      starred: email.labelIds?.includes('STARRED') || false,
      read: !email.labelIds?.includes('UNREAD'),
      snippet: email.snippet || '',
      labelIds: email.labelIds || [],
      to: email.to || '',
      cc: email.cc || '',
      bcc: email.bcc || '',
      body: email.body || '',
      attachments: email.attachments || [],
      draftId: email.draftId,
      status: email.status || 'Inbox', // FEATURE II: preserve status
      // FEATURE III: preserve snooze metadata
      snoozed: email.snoozed || false,
      snoozedUntil: email.snoozedUntil || null,
      snoozedFromStatus: email.snoozedFromStatus || null,
    };
  }

  // Otherwise, parse from payload (normal email)
  const payload = email.payload || {};
  const headers = payload.headers || [];
  const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
  const subjectHeader = headers.find((h: any) => h.name === 'Subject')?.value || '';
  const dateHeader = headers.find((h: any) => h.name === 'Date')?.value || '';
  // CRITICAL: Extract To, Cc, Bcc from headers
  const toHeader = headers.find((h: any) => h.name === 'To')?.value || '';
  const ccHeader = headers.find((h: any) => h.name === 'Cc')?.value || '';
  const bccHeader = headers.find((h: any) => h.name === 'Bcc')?.value || '';

  let sender = "";
  const match = fromHeader.match(/^("?)([^"<]*)\1\s*<([^>]+)>$/);
  if (match) {
    sender = match[2].trim() || match[3].trim();
  } else {
    sender = fromHeader.trim();
  }
  const subject = subjectHeader;
  const timestamp = dateHeader ? new Date(dateHeader).getTime() : 0; // ✅ Return number, not ISO string
  const starred = email.labelIds?.includes('STARRED');
  const read = !email.labelIds?.includes('UNREAD');
  const snippet = email.snippet || '';

  return {
    id: email.id,
    sender,
    subject,
    timestamp,
    starred,
    read,
    snippet,
    labelIds: email.labelIds || [],
    to: toHeader,
    cc: ccHeader,
    bcc: bccHeader,
    body: '',
    attachments: [],
    status: email.status || 'Inbox', // FEATURE II: preserve status from DB
    // FEATURE III: preserve snooze metadata from DB
    snoozed: email.snoozed || false,
    snoozedUntil: email.snoozedUntil || null,
    snoozedFromStatus: email.snoozedFromStatus || null,
  };
};
