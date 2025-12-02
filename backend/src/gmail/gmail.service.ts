
import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
// ...existing code...



@Injectable()
export class GmailService {
  async saveDraft(
    userId: string,
    to: string,
    subject: string,
    body: string,
    cc?: string,
    bcc?: string,
    attachments?: { filename: string; mimeType: string; base64Content: string }[],
  ) {
    try {
      const gmail = await this.getGmailClient(userId);
      
      // Create email message (from is optional, Gmail will use authenticated user)
      const message = this.createMessage(to, subject, body, cc, bcc, attachments, undefined);
      
      // Create draft on Gmail
      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: message,
          },
        },
      });

      // Save to MongoDB for faster access
      if (response.data.message?.id) {
        const draftEmail = {
          userId,
          messageId: response.data.message.id,
          snippet: body?.slice(0, 100) || '',
          labelIds: ['DRAFT'],
          payload: {
            to,
            subject,
            body,
            cc,
            bcc,
            attachments,
          },
          internalDate: Date.now().toString(),
        };
        await this.usersService.saveEmails(userId, [draftEmail]);
      }
      
      return { success: true, draft: response.data };
    } catch (error: any) {
      console.error('Error saving draft:', error);
      console.error('Error details:', error.response?.data || error.message);
      throw new InternalServerErrorException(`Failed to save draft: ${error.message}`);
    }
  }
  
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) { }

  private async getGmailClient(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.googleAccessToken) {
      throw new InternalServerErrorException(
        'User not found or not authenticated with Google',
      );
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new InternalServerErrorException('Google credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      callbackUrl,
    );

    const credentials: any = {
      access_token: user.googleAccessToken,
    };

    if (user.googleRefreshToken) {
      credentials.refresh_token = user.googleRefreshToken;
    }

    oauth2Client.setCredentials(credentials);

    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await this.usersService.setGoogleTokens(
          userId,
          tokens.access_token,
          tokens.refresh_token || user.googleRefreshToken || ''
        );
      }
    });

    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      await gmail.users.getProfile({ userId: 'me' });
      return gmail;
    } catch (error: any) { // Explicitly type error as 'any' for simpler property access for now
      if (error.response && error.response.status === 401) {
        console.error(`Authentication error for user ${userId}:`, error.message);
        await this.usersService.setGoogleTokens(userId, '', '');
        throw new ForbiddenException(
          'Google authentication expired or invalid. Please re-authenticate.',
        );
      }
      console.error('Error in getGmailClient:', error);
      throw new InternalServerErrorException('Failed to initialize Gmail client');
    }
  }

  async getMailboxes(userId: string) {
    try {
      // Get mailboxes from database
      const mailboxes = await this.usersService.getMailboxes(userId);

      // Always recalculate unread count for INBOX from DB
      let inboxUnread = 0;
      const inboxMailbox = mailboxes.find(m => m.id === 'INBOX');
      if (inboxMailbox) {
        inboxUnread = await this.usersService.countUnreadInboxEmails(userId);
      }

      if (mailboxes && mailboxes.length > 0) {
        return mailboxes.map(m => ({
          id: m.id,
          name: m.name,
          messagesTotal: m.messagesTotal,
          messagesUnread: m.id === 'INBOX' ? inboxUnread : m.messagesUnread,
        }));
      }

      // If no mailboxes in database, fetch from Gmail API
      console.log('No mailboxes in database, fetching from Gmail API...');
      const gmail = await this.getGmailClient(userId);
      const res = await gmail.users.labels.list({ userId: 'me' });

      const labels = (res.data.labels || []).filter(label => label.id);

      // Save to database
      const labelsWithUnreadCount = labels.map((label) => {
        return {
          id: label.id!,
          name: label.name || 'Unknown',
          messagesTotal: label.messagesTotal || 0,
          messagesUnread: label.messagesUnread || 0,
        };
      });
      await this.usersService.saveMailboxes(userId, labelsWithUnreadCount.map(l => ({ userId, ...l })));

      // Recalculate unread for INBOX after initial save
      let inboxUnreadApi = 0;
      const inboxLabel = labelsWithUnreadCount.find(l => l.id === 'INBOX');
      if (inboxLabel) {
        inboxUnreadApi = await this.usersService.countUnreadInboxEmails(userId);
        inboxLabel.messagesUnread = inboxUnreadApi;
      }

      return labelsWithUnreadCount;
    } catch (error) {
      console.error('Failed to get mailboxes:', error);
      throw new InternalServerErrorException('Failed to get mailboxes');
    }
  }

  async getEmails(userId: string, labelId: string, pageToken?: string) {
    try {
      // Chuẩn hóa labelId
      let formattedLabelId = labelId;
      const systemLabels = ['inbox', 'sent', 'trash', 'spam', 'draft', 'starred', 'unread', 'important'];

      if (systemLabels.includes(labelId.toLowerCase())) {
        formattedLabelId = labelId.toUpperCase();
      }

      console.log(`Getting emails for labelId: ${labelId} -> formatted: ${formattedLabelId}`);

      const gmail = await this.getGmailClient(userId);

      // For DRAFT, always fetch from Gmail API, SKIP database entirely
      if (formattedLabelId === 'DRAFT') {
        console.log('Fetching drafts from Gmail API (skipping database)');
        // Jump directly to draft fetching logic below
      } else {
        // Get emails from database first for non-draft labels
        const dbEmails = await this.usersService.getEmailsByLabel(userId, formattedLabelId, 1, 200);
        console.log(`Found ${dbEmails?.length || 0} emails in database for label: ${formattedLabelId}`);
        if (dbEmails && dbEmails.length > 0) {
          console.log(`Returning ${dbEmails.length} emails from database for label: ${formattedLabelId}`);
          return {
            messages: dbEmails.map(e => ({
              id: e.messageId,
              snippet: e.snippet,
              payload: e.payload,
              labelIds: e.labelIds,
            })),
            nextPageToken: undefined,
          };
        }
        // If no emails in database, fetch from Gmail API
        console.log(`No emails in database, fetching from Gmail API for label: ${formattedLabelId}`);
      }

      if (formattedLabelId === 'DRAFT') {
        // Fetch drafts using gmail.users.drafts.list
        const res = await gmail.users.drafts.list({
          userId: 'me',
          pageToken,
        });
        if (!res.data.drafts) {
          console.log('No drafts found');
          return {
            messages: [],
            nextPageToken: res.data.nextPageToken,
          };
        }
        console.log(`Found ${res.data.drafts.length} drafts`);
        const messages = await Promise.all(
          res.data.drafts.map(async (draft) => {
            try {
              if (!draft.id) return null;
              const msg = await gmail.users.drafts.get({
                userId: 'me',
                id: draft.id,
              });
              // Extract headers
              const headers = (msg.data.message?.payload?.headers || []).reduce((acc: Record<string, string>, h) => {
                if (h.name && h.value) {
                  acc[h.name.toLowerCase()] = h.value;
                }
                return acc;
              }, {});
              // Extract body (text/html preferred)
              let body = '';
              const payload = msg.data.message?.payload;
              if (payload?.parts) {
                for (const part of payload.parts) {
                  if (part.mimeType === 'text/html' && part.body?.data) {
                    body = Buffer.from(part.body.data, 'base64').toString();
                    break;
                  }
                }
              } else if (payload?.body?.data) {
                body = Buffer.from(payload.body.data, 'base64').toString();
              }
              // Compose preview
              const preview = msg.data.message?.snippet || body.slice(0, 120);
              // Compose timestamp
              const timestamp = msg.data.message?.internalDate ? Number(msg.data.message.internalDate) : Date.now();
              return {
                id: msg.data.id,
                draftId: draft.id,
                subject: headers['subject'] || '(Không có tiêu đề)',
                sender: headers['from'] || '',
                to: headers['to'] || '',
                cc: headers['cc'] || '',
                bcc: headers['bcc'] || '',
                body,
                labelIds: msg.data.message?.labelIds,
                timestamp,
                preview,
                attachments: [], // TODO: parse attachments if needed
              };
            } catch (err) {
              console.error(`Failed to get draft details for ${draft.id}:`, err);
              return null;
            }
          })
        );
        return {
          messages: messages.filter((m) => m),
          nextPageToken: res.data.nextPageToken,
        };
      } else {
        // Fetch normal emails using gmail.users.messages.list
        const res = await gmail.users.messages.list({
          userId: 'me',
          labelIds: [formattedLabelId],
          pageToken,
        });
        if (!res.data.messages) {
          console.log('No messages found for label:', formattedLabelId);
          return {
            messages: [],
            nextPageToken: res.data.nextPageToken,
          };
        }
        console.log(`Found ${res.data.messages.length} messages for label: ${formattedLabelId}`);
        const messages = await Promise.all(
          res.data.messages.map(async (message) => {
            try {
              if (!message.id) {
                return null;
              }
              const msg = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'metadata',
                metadataHeaders: ['From', 'To', 'Subject', 'Date'],
              });
              return {
                id: msg.data.id,
                snippet: msg.data.snippet,
                payload: msg.data.payload,
                labelIds: msg.data.labelIds,
              };
            } catch (err) {
              console.error(`Failed to get message details for ${message.id}:`, err);
              return null;
            }
          }),
        );
        return {
          messages: messages.filter((m) => m),
          nextPageToken: res.data.nextPageToken,
        };
      }
    } catch (error) {
      console.error('Failed to get emails:', error);
      throw new InternalServerErrorException('Failed to get emails');
    }
  }

  async getEmail(userId: string, messageId: string) {
    if (!messageId) {
      throw new InternalServerErrorException('Message ID not provided');
    }
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    if (!res.data.payload) {
      throw new InternalServerErrorException('Email payload not found');
    }

    const body = this.parseBody(res.data.payload);
    const headers = this.parseHeaders(res.data.payload.headers || []);

    return {
      id: res.data.id,
      snippet: res.data.snippet,
      payload: res.data.payload,
      body,
      headers,
    };
  }

  private parseBody(payload: gmail_v1.Schema$MessagePart) {
    let body = '';
    if (payload.parts) {
      payload.parts.forEach((part) => {
        if (part.mimeType === 'text/html' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
        }
      });
    } else if (payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString();
    }
    return body;
  }

  private parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[]) {
    const headerObject: { [key: string]: string } = {};
    headers.forEach((header) => {
      if (header.name && header.value) {
        headerObject[header.name] = header.value;
      }
    });
    return headerObject;
  }

  async setEmailStarred(
    userId: string,
    messageId: string,
    starred: boolean,
  ) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: starred ? ['STARRED'] : [],
        removeLabelIds: starred ? [] : ['STARRED'],
      },
    });
    return res.data;
  }

  async setEmailRead(userId: string, messageId: string, read: boolean) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: read ? [] : ['UNREAD'],
        removeLabelIds: read ? ['UNREAD'] : [],
      },
    });
    // Fetch updated labels from Gmail và lưu DB
    const updatedMsg = await gmail.users.messages.get({ userId: 'me', id: messageId });
    const updatedLabelIds = updatedMsg.data.labelIds || [];
    await this.usersService.updateEmailLabels(userId, messageId, updatedLabelIds);
    return res.data;
  }

  async bulkSetEmailRead(userId: string, ids: string[], read: boolean) {
    const gmail = await this.getGmailClient(userId);
    
    try {
      // Use Gmail API batchModify for efficiency
      await gmail.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: ids,
          addLabelIds: read ? [] : ['UNREAD'],
          removeLabelIds: read ? ['UNREAD'] : [],
        },
      });

      // Update MongoDB for each message
      for (const messageId of ids) {
        try {
          const email = await this.usersService.getEmailById(userId, messageId);
          if (email) {
            let updatedLabels = [...(email.labelIds || [])];
            if (read) {
              updatedLabels = updatedLabels.filter(l => l !== 'UNREAD');
            } else {
              if (!updatedLabels.includes('UNREAD')) {
                updatedLabels.push('UNREAD');
              }
            }
            await this.usersService.updateEmailLabels(userId, messageId, updatedLabels);
          }
        } catch (err) {
          console.error(`Failed to update DB for ${messageId}:`, err);
        }
      }

      console.log(`Bulk ${read ? 'read' : 'unread'}: ${ids.length} emails for user ${userId}`);
      return { success: true, count: ids.length };
    } catch (err: any) {
      console.error('Bulk mark read error:', err);
      throw new InternalServerErrorException(
        `Failed to bulk mark ${read ? 'read' : 'unread'}: ${err.message}`
      );
    }
  }

  async deleteEmail(userId: string, messageId: string) {
    try {
      let gmail;
      let authError = false;
      
      // Try to get Gmail client
      try {
        gmail = await this.getGmailClient(userId);
      } catch (err: any) {
        console.error('Failed to get Gmail client:', err.message);
        authError = true;
        // If auth error, we'll still try to update DB
      }
      
      const email = await this.usersService.getEmailById(userId, messageId);
      
      // Check if email is in TRASH
      const isInTrash = email && email.labelIds && email.labelIds.includes('TRASH');
      
      if (isInTrash) {
        // Nếu đã ở TRASH, xóa vĩnh viễn
        if (!authError && gmail) {
          try {
            await gmail.users.messages.delete({
              userId: 'me',
              id: messageId,
            });
            console.log(`Deleted email ${messageId} from Gmail`);
          } catch (err: any) {
            // Nếu lỗi do không tìm thấy email trên Gmail hoặc auth error, vẫn xóa khỏi database
            if (err?.code === 404 || err?.response?.status === 404) {
              console.warn(`Email ${messageId} not found on Gmail, deleting from DB only.`);
            } else if (err?.code === 401 || err?.code === 403 || err.message?.includes('invalid_grant')) {
              console.warn(`Auth error when deleting ${messageId}, deleting from DB only.`);
            } else {
              console.error(`Gmail delete error for ${messageId}:`, err.message);
              // Continue to delete from DB anyway
            }
          }
        } else {
          console.warn(`No Gmail client available, deleting ${messageId} from DB only.`);
        }
        
        // Always delete from database
        await this.usersService.deleteEmailById(userId, messageId);
        console.log(`Permanently deleted email ${messageId} for user ${userId}`);
        return { success: true, message: 'Email permanently deleted' };
        
      } else {
        // Nếu chưa ở TRASH, chuyển vào TRASH
        if (!authError && gmail) {
          try {
            await gmail.users.messages.trash({
              userId: 'me',
              id: messageId,
            });
            console.log(`Moved email ${messageId} to TRASH on Gmail`);
          } catch (err: any) {
            // If email not found on Gmail or auth error, just update DB
            if (err?.code === 404 || err?.response?.status === 404) {
              console.warn(`Email ${messageId} not found on Gmail, updating DB only.`);
            } else if (err?.code === 401 || err?.code === 403 || err.message?.includes('invalid_grant')) {
              console.warn(`Auth error when trashing ${messageId}, updating DB only.`);
            } else {
              console.error(`Gmail trash error for ${messageId}:`, err.message);
              // Continue to update DB anyway
            }
          }
        } else {
          console.warn(`No Gmail client available, updating DB only for ${messageId}.`);
        }
        
        // Cập nhật labelIds trong database
        if (email && email.labelIds) {
          const systemLabels = [
            'INBOX', 'SENT', 'STARRED', 'DRAFT', 'SPAM', 'IMPORTANT', 'UNREAD', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'ALL_MAIL'
          ];
          let updatedLabels = email.labelIds.filter(label => !systemLabels.includes(label));
          updatedLabels = updatedLabels.filter(label => label !== 'TRASH');
          updatedLabels.push('TRASH');
          await this.usersService.updateEmailLabels(userId, messageId, updatedLabels);
          console.log(`Updated email ${messageId} to TRASH in DB for user ${userId}`);
        } else {
          // If email not in DB, try to fetch from Gmail (if available) and update
          if (!authError && gmail) {
            try {
              const msg = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
              });
              const labelIds = msg.data.labelIds || ['TRASH'];
              await this.usersService.updateEmailLabels(userId, messageId, labelIds);
            } catch (err) {
              console.warn(`Could not fetch email ${messageId} from Gmail:`, err);
            }
          }
        }
        return { success: true, message: 'Email moved to trash' };
      }
    } catch (error: any) {
      // Only throw error if it's a critical DB error, not auth error
      if (error.message?.includes('insufficient authentication scopes')) {
        console.warn('Insufficient permissions, but operation may have partially succeeded');
        return { success: true, message: 'Email deleted from database. Please re-authenticate for full Gmail sync.' };
      }
      console.error('Error deleting email:', error.message);
      console.error('Error stack:', error.stack);
      
      // Try to at least delete from DB as fallback
      try {
        await this.usersService.deleteEmailById(userId, messageId);
        console.log(`Fallback: Deleted email ${messageId} from DB despite errors`);
        return { success: true, message: 'Email deleted from database. Gmail sync may be required.' };
      } catch (dbError) {
        console.error('Failed to delete from DB:', dbError);
        throw new InternalServerErrorException(`Failed to delete email: ${error.message || 'Unknown error'}`);
      }
    }
  }

  async archiveEmail(userId: string, messageId: string) {
    try {
      const gmail = await this.getGmailClient(userId);
      const res = await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['INBOX'],
        },
      });
      return res.data;
    } catch (error: any) {
      if (error.message?.includes('insufficient authentication scopes')) {
        throw new InternalServerErrorException('Insufficient permissions. Please re-authenticate to grant archive access.');
      }
      console.error('Error archiving email:', error);
      throw new InternalServerErrorException('Failed to archive email');
    }
  }

  async moveEmailToSpam(userId: string, messageId: string) {
  try {
    const gmail = await this.getGmailClient(userId);

    // Gmail API: thêm SPAM, bỏ INBOX
    const res = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: ['SPAM'],
        removeLabelIds: ['INBOX'],
      },
    });

    // Đồng bộ DB
    const updatedMsg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    const updatedLabelIds = updatedMsg.data.labelIds || [];
    await this.usersService.updateEmailLabels(
      userId,
      messageId,
      updatedLabelIds,
    );

    return { success: true };
  } catch (err) {
    console.error('Error moving email to spam:', err);
    throw new InternalServerErrorException('Failed to mark email as spam');
  }
}

async moveEmail(userId: string, messageId: string, targetLabel: string) {
  const gmail = await this.getGmailClient(userId);

  // Lấy metadata
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["From"],
  });

  const currentLabels = msg.data.labelIds || [];

  // Xác định folder hiện tại
  const isInbox = currentLabels.includes("INBOX");
  const isSpam = currentLabels.includes("SPAM");
  const isTrash = currentLabels.includes("TRASH");

  // Chỉ cho chuyển hợp lệ
  let allowedTargets = [];
  if (isSpam) allowedTargets = ["INBOX", "TRASH"];
  else if (isTrash) allowedTargets = ["INBOX", "SPAM"];
  else allowedTargets = ["TRASH", "SPAM"];

  if (!allowedTargets.includes(targetLabel)) {
    throw new BadRequestException(
      `Chỉ được chuyển đến: ${allowedTargets.join(", ")}`
    );
  }

  // new labels
  let newLabels: string[] = [];

switch (targetLabel) {
  case "INBOX":
    newLabels = ["INBOX"];
    break;
  case "SPAM":
    newLabels = ["SPAM"];
    break;
  case "TRASH":
    newLabels = ["TRASH"];
    break;
  default:
    newLabels = [targetLabel];
    break;
}

// Giữ lại UNREAD + STARRED
if (currentLabels.includes("UNREAD")) newLabels.push("UNREAD");
if (currentLabels.includes("STARRED")) newLabels.push("STARRED");

// Danh sách label không được xóa
const protectedLabels: string[] = [
  "SENT",
  "DRAFT",
  "CHAT",
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_PROMOTIONS",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
  "IMPORTANT",
  "ALL_MAIL"
];

const finalRemoveLabels = currentLabels.filter(
  lbl => !newLabels.includes(lbl) && !protectedLabels.includes(lbl)
);

await gmail.users.messages.modify({
  userId: "me",
  id: messageId,
  requestBody: {
    addLabelIds: newLabels,
    removeLabelIds: finalRemoveLabels
  }
});

  return { success: true };
}


  async sendEmail(
    userId: string,
    to: string,
    subject: string,
    body: string,
    cc?: string,
    bcc?: string,
    attachments?: { filename: string; mimeType: string; base64Content: string }[],
  ) {
    const gmail = await this.getGmailClient(userId);
    // Lấy tên người gửi từ user
    const user = await this.usersService.findById(userId);
    // Encode name if contains non-ASCII
    function encodeMimeWord(str: string) {
      return /[^ -]/.test(str)
        ? `=?UTF-8?B?${Buffer.from(str, 'utf8').toString('base64')}?=`
        : str;
    }
    let fromField = user?.name
      ? `${encodeMimeWord(user.name)} <${user.email}>`
      : user?.email;
    const rawStandardBase64 = this.createMessage(to, subject, body, cc, bcc, attachments, fromField);

    // Convert standard base64 to base64url for Gmail API
    // base64url: replace + with -, / with _, and remove padding =
    let base64UrlEncodedEmail = rawStandardBase64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64UrlEncodedEmail,
      },
    });
    return res.data;
  }

  private createMessage(
    to: string,
    subject: string,
    body: string,
    cc?: string,
    bcc?: string,
    attachments?: { filename: string; mimeType: string; base64Content: string }[],
    from?: string,
  ) {
    const emailLines = [];

    // Add sender, recipients
    if (from) {
      emailLines.push(`From: ${from}`);
    }
    // Only add 'To' header if it's a valid email address
    // Gmail draft allows omitting 'To' header
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (to && emailRegex.test(to.trim())) {
      emailLines.push(`To: ${to.trim()}`);
    }
    if (cc && cc.trim()) {
      emailLines.push(`Cc: ${cc.trim()}`);
    }
    if (bcc && bcc.trim()) {
      emailLines.push(`Bcc: ${bcc.trim()}`);
    }
    
    // RFC 2047 encoding for subject with UTF-8
    // Format: =?UTF-8?B?{base64}?=
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
    emailLines.push(`Subject: ${encodedSubject}`);
    emailLines.push('MIME-Version: 1.0');

    if (attachments && attachments.length > 0) {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      emailLines.push('');
      emailLines.push(`--${boundary}`);
      emailLines.push('Content-Type: text/html; charset=UTF-8');
      emailLines.push('Content-Transfer-Encoding: base64');
      emailLines.push('');
      
      // Encode body as base64 for proper UTF-8 handling
      const bodyBase64 = Buffer.from(body, 'utf-8').toString('base64');
      const bodyLines = bodyBase64.match(/.{1,76}/g) || [];
      emailLines.push(...bodyLines);
      emailLines.push('');

      attachments.forEach((attachment) => {
        emailLines.push(`--${boundary}`);
        emailLines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
        emailLines.push('Content-Transfer-Encoding: base64');
        emailLines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
        emailLines.push('');

        // Split base64 content into 76-character lines (RFC 2045)
        const base64Lines = attachment.base64Content.match(/.{1,76}/g) || [];
        emailLines.push(...base64Lines);
        emailLines.push('');
      });

      emailLines.push(`--${boundary}--`); // Closing boundary
    } else {
      // Simple text/html message with proper UTF-8 encoding
      emailLines.push('Content-Type: text/html; charset=UTF-8');
      emailLines.push('Content-Transfer-Encoding: base64');
      emailLines.push('');
      
      // Encode body as base64 for UTF-8
      const bodyBase64 = Buffer.from(body, 'utf-8').toString('base64');
      const bodyLines = bodyBase64.match(/.{1,76}/g) || [];
      emailLines.push(...bodyLines);
    }

    return Buffer.from(emailLines.join('\r\n')).toString('base64');
  }

  async revokeToken(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.googleRefreshToken) {
      return;
    }

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_CALLBACK_URL'),
    );

    try {
      await oauth2Client.revokeToken(user.googleRefreshToken);
    } catch (error) {
    }
  }

  async getAttachment(
    userId: string,
    messageId: string,
    attachmentId: string,
  ) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId,
    });
    return res.data;
  }

  async incrementalSync(userId: string) {
    try {
      console.log(`Starting incremental sync for user ${userId}...`);
      const gmail = await this.getGmailClient(userId);
      
      // Get last historyId
      const lastHistoryId = await this.usersService.getLastHistoryId(userId);
      
      if (!lastHistoryId) {
        console.log('No historyId found, performing full sync...');
        return this.prefetchMailboxesAndEmails(userId);
      }

      // Get profile to get current historyId
      const profile = await gmail.users.getProfile({ userId: 'me' });
      const currentHistoryId = profile.data.historyId;
      
      if (!currentHistoryId) {
        console.log('No current historyId, performing full sync...');
        return this.prefetchMailboxesAndEmails(userId);
      }

      // Fetch history changes
      console.log(`Fetching history from ${lastHistoryId} to ${currentHistoryId}...`);
      const historyRes = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: lastHistoryId,
        historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
        maxResults: 500,
      });

      const history = historyRes.data.history || [];
      console.log(`Found ${history.length} history records`);

      // Process history changes
      const changedMessageIds = new Set<string>();
      const deletedMessageIds = new Set<string>();

      for (const record of history) {
        if (record.messagesAdded) {
          record.messagesAdded.forEach(m => m.message?.id && changedMessageIds.add(m.message.id));
        }
        if (record.messagesDeleted) {
          record.messagesDeleted.forEach(m => m.message?.id && deletedMessageIds.add(m.message.id));
        }
        if (record.labelsAdded) {
          record.labelsAdded.forEach(m => m.message?.id && changedMessageIds.add(m.message.id));
        }
        if (record.labelsRemoved) {
          record.labelsRemoved.forEach(m => m.message?.id && changedMessageIds.add(m.message.id));
        }
      }

      // Delete removed messages from database
      for (const msgId of deletedMessageIds) {
        await this.usersService.deleteEmailById(userId, msgId);
      }

      // Fetch changed messages (metadata only)
      const changedEmails = [];
      for (const msgId of changedMessageIds) {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date'],
          });
          changedEmails.push({
            id: msg.data.id,
            snippet: msg.data.snippet,
            payload: msg.data.payload,
            labelIds: msg.data.labelIds || [],
            internalDate: msg.data.internalDate,
          });
        } catch (err) {
          console.error(`Failed to fetch message ${msgId}:`, err);
        }
      }

      // Save changed emails
      if (changedEmails.length > 0) {
        await this.usersService.saveEmails(userId, changedEmails);
      }

      // Update mailboxes (quick count update)
      const labelsRes = await gmail.users.labels.list({ userId: 'me' });
      const labels = (labelsRes.data.labels || []).filter(label => label.id);
      const mailboxes = labels.map(label => ({
        userId,
        id: label.id!,
        name: label.name || 'Unknown',
        messagesTotal: label.messagesTotal || 0,
        messagesUnread: label.messagesUnread || 0,
      }));
      await this.usersService.saveMailboxes(userId, mailboxes);

      // Store new historyId
      await this.usersService.setLastHistoryId(userId, currentHistoryId);

      console.log(`Incremental sync complete: ${changedEmails.length} changed, ${deletedMessageIds.size} deleted`);
      return {
        mailboxes: mailboxes.length,
        changed: changedEmails.length,
        deleted: deletedMessageIds.size,
      };
    } catch (error: any) {
      console.error('Incremental sync failed:', error.message);
      // Fallback to full sync if history is expired
      if (error.code === 404 || error.message?.includes('history')) {
        console.log('History expired, performing full sync...');
        return this.prefetchMailboxesAndEmails(userId);
      }
      throw new InternalServerErrorException('Failed to perform incremental sync');
    }
  }

  async prefetchMailboxesAndEmails(userId: string) {
    try {
      console.log(`Prefetching mailboxes and emails for user ${userId}...`);

      // Get all labels/mailboxes
      const gmail = await this.getGmailClient(userId);
      const labelsRes = await gmail.users.labels.list({ userId: 'me' });
      const labels = (labelsRes.data.labels || []).filter(label => label.id);

      const mailboxes = labels.map(label => ({
        userId,
        id: label.id!,
        name: label.name || 'Unknown',
        messagesTotal: label.messagesTotal || 0,
        messagesUnread: label.messagesUnread || 0,
      }));

      // Save mailboxes to database
      await this.usersService.saveMailboxes(userId, mailboxes);
      console.log(`Saved ${mailboxes.length} mailboxes for user ${userId}`);

      // Lấy 200 email gần nhất cho mỗi label INBOX, SENT, SPAM, TRASH với batch processing
      let totalEmails = 0;
      const labelsToFetch = ['INBOX', 'SENT', 'SPAM', 'TRASH'];
      const batchSize = 10;

      // Tổng hợp tất cả email từ các label, lưu labelIds đầy đủ
      const emailMap: Record<string, any> = {};
      for (const label of labelsToFetch) {
        console.log(`Fetching emails from ${label}...`);
        const res = await gmail.users.messages.list({
          userId: 'me',
          labelIds: [label],
          maxResults: 200,
        });
        console.log(`Found ${res.data.messages?.length || 0} emails in ${label}`);
        if (res.data.messages && res.data.messages.length > 0) {
          for (let i = 0; i < res.data.messages.length; i += batchSize) {
            const batch = res.data.messages.slice(i, i + batchSize);
            await Promise.all(
              batch.map(async (message) => {
                try {
                  if (!message.id) return null;
                  const msg = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'To', 'Subject', 'Date'],
                  });
                  const emailId = msg.data.id;
                  if (typeof emailId === 'string' && emailId.length > 0) {
                    if (emailMap[emailId]) {
                      const oldLabels = emailMap[emailId].labelIds || [];
                      emailMap[emailId].labelIds = Array.from(new Set([...(msg.data.labelIds || []), ...oldLabels]));
                    } else {
                      emailMap[emailId] = {
                        id: emailId,
                        snippet: msg.data.snippet,
                        payload: msg.data.payload,
                        labelIds: msg.data.labelIds || [],
                        internalDate: msg.data.internalDate,
                      };
                    }
                  }
                  return null;
                } catch (err) {
                  console.error(`Failed to get message details for ${message.id}:`, err);
                  return null;
                }
              }),
            );
            // Small delay between batches to avoid quota issues
            if (i + batchSize < res.data.messages.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      }
      // Lưu tất cả email vào database
      const allEmails = Object.values(emailMap);
      await this.usersService.saveEmails(userId, allEmails);
      totalEmails = allEmails.length;
      // Xóa các email không còn tồn tại trên Gmail khỏi database
      const allMessageIds = allEmails.map(e => e.id);
      await this.usersService.deleteEmailsNotInList(userId, allMessageIds);

      // Store historyId for incremental sync
      const profile = await gmail.users.getProfile({ userId: 'me' });
      if (profile.data.historyId) {
        await this.usersService.setLastHistoryId(userId, profile.data.historyId);
      }

      return { mailboxes: mailboxes.length, emails: totalEmails };
    } catch (error) {
      console.error('Failed to prefetch mailboxes and emails:', error);
      throw new InternalServerErrorException('Failed to prefetch mailboxes and emails');
    }
  }
}