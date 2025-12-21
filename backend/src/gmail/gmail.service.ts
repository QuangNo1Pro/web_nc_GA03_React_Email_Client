import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { SseService } from './sse.service';
import { GmailLabelService } from './gmail-label.service'; // FEATURE III: Gmail sync
import { GeminiService } from '../ai/gemini.service'; // FEATURE IV: AI Summarization
import { SummarizationService } from '../summarization/summarization.service'; // FEATURE IV: AI Summarization
// ...existing code...

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  async saveDraft(
    userId: string,
    to: string,
    subject: string,
    body: string,
    cc?: string,
    bcc?: string,
    attachments?: { filename: string; mimeType: string; base64Content: string }[],
    draftId?: string, // Thêm param để update draft
  ) {
    try {
      const gmail = await this.getGmailClient(userId);
      
      // Create email message (from is optional, Gmail will use authenticated user)
      const message = this.createMessage(to, subject, body, cc, bcc, attachments, undefined);
      
      let response;
      
      // Nếu có draftId, update draft cũ
      if (draftId) {
        console.log(`Updating draft ${draftId}...`);
        response = await gmail.users.drafts.update({
          userId: 'me',
          id: draftId,
          requestBody: {
            message: {
              raw: message,
            },
          },
        });
      } else {
        // Tạo draft mới
        console.log('Creating new draft...');
        response = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: message,
            },
          },
        });
      }

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
    private readonly sseService: SseService,
    @Inject(forwardRef(() => GmailLabelService))
    private readonly gmailLabelService: GmailLabelService, // FEATURE III: Gmail sync
    private readonly geminiService: GeminiService, // FEATURE IV: AI Summarization
    private readonly summarizationService: SummarizationService, // FEATURE IV: AI Summarization
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

  /**
   * Update unread counts for mailboxes based on label IDs
   */
  private async updateUnreadCountsForLabels(userId: string, labelIds: string[]) {
    try {
      for (const labelId of labelIds) {
        const unreadCount = await this.usersService.countUnreadByLabel(userId, labelId);
        await this.usersService.updateMailboxUnread(userId, labelId, unreadCount);
      }
    } catch (error: any) {
      this.logger.error(`Failed to update unread counts: ${error?.message || error}`);
    }
  }

  async getMailboxes(userId: string) {
    try {
      // Get mailboxes from database
      const mailboxes = await this.usersService.getMailboxes(userId);

      if (mailboxes && mailboxes.length > 0) {
        // Tính lại unread count từ DB emails cho TẤT CẢ mailboxes
        const mailboxesWithRealUnread = await Promise.all(
          mailboxes.map(async (m) => {
            const unreadCount = await this.usersService.countUnreadByLabel(userId, m.id);
            return {
              id: m.id, // Real Gmail label ID (e.g., "INBOX", "Label_123", "SENT")
              name: m.name, // Human-readable name
              messagesTotal: m.messagesTotal,
              messagesUnread: unreadCount, // Tính lại từ DB emails
            };
          })
        );
        return mailboxesWithRealUnread;
      }

      // If no mailboxes in database, fetch from Gmail API
      console.log('No mailboxes in database, fetching from Gmail API...');
      const gmail = await this.getGmailClient(userId);
      const res = await gmail.users.labels.list({ userId: 'me' });

      const labels = (res.data.labels || []).filter(label => label.id);

      // Save to database - using Gmail's actual label IDs
      const labelsWithUnreadCount = labels.map((label) => {
        return {
          id: label.id!, // Use Gmail's real ID
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

      console.log('✅ Returning mailboxes with real Gmail label IDs:', labelsWithUnreadCount.map(l => ({ id: l.id, name: l.name })));
      return labelsWithUnreadCount;
    } catch (error) {
      console.error('❌ Failed to get mailboxes:', (error as any)?.message || error);
      // Return empty array instead of throwing to prevent frontend crash
      return [];
    }
  }

  async getEmails(userId: string, labelId: string, pageToken?: string) {
    try {
      console.log(`🔍 Getting emails for labelId: "${labelId}"`);

      const gmail = await this.getGmailClient(userId);

      // Gmail uses actual label IDs now (passed from frontend)
      // No need to normalize - use exactly what Gmail API expects
      const formattedLabelId = labelId;

      // For DRAFT, always fetch from Gmail API, SKIP database entirely
      if (formattedLabelId === 'DRAFT') {
        console.log('📧 Fetching drafts from Gmail API (skipping database)');
        // Jump directly to draft fetching logic below
      } else {
        // Get emails from database first for non-draft labels
        const dbEmails = await this.usersService.getEmailsByLabel(userId, formattedLabelId, 1, 200);
        console.log(`📦 Found ${dbEmails?.length || 0} emails in database for label: ${formattedLabelId}`);
        if (dbEmails && dbEmails.length > 0) {
          console.log(`✅ Returning ${dbEmails.length} emails from database for label: ${formattedLabelId}`);
          return {
            messages: dbEmails.map(e => ({
              id: e.messageId,
              snippet: e.snippet,
              payload: e.payload,
              labelIds: e.labelIds,
              internalDate: e.internalDate,
              // FEATURE II & III: Include Kanban status and snooze metadata
              // If status not set, infer from labelIds (matches frontend logic)
              status: e.status || this.inferStatusFromLabels(e.labelIds || []),
              snoozed: e.snoozed || false,
              snoozedUntil: e.snoozedUntil || null,
              snoozedFromStatus: e.snoozedFromStatus || null,
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
        const messages = await Promise.allSettled(
          res.data.drafts.map(async (draft) => {
            if (!draft.id) return null;
            try {
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
              console.warn(`Failed to get draft details for ${draft.id}:`, (err as any)?.message || err);
              return null;
            }
          })
        );
        
        // Extract successful results
        const validMessages = messages
          .filter(result => result.status === 'fulfilled' && result.value !== null)
          .map(result => (result as PromiseFulfilledResult<any>).value);
        
        const failedCount = messages.length - validMessages.length;
        if (failedCount > 0) {
          console.warn(`Successfully fetched ${validMessages.length}/${messages.length} drafts, ${failedCount} failed`);
        }
        
        return {
          messages: validMessages,
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
        
        // Fetch message details with better error handling
        const messages = await Promise.allSettled(
          res.data.messages.map(async (message) => {
            if (!message.id) {
              return null;
            }
            try {
              const msg = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'metadata',
                metadataHeaders: ['From', 'To', 'Subject', 'Date'],
              });
              const status = this.inferStatusFromLabels(msg.data.labelIds || []);
              console.log(`[getEmails] Email ${msg.data.id} labels:`, msg.data.labelIds, '→ status:', status);
              return {
                id: msg.data.id,
                snippet: msg.data.snippet,
                payload: msg.data.payload,
                labelIds: msg.data.labelIds,
                internalDate: msg.data.internalDate,
                // CRITICAL: Infer status for emails fetched from Gmail API (not in DB yet)
                status: status,
              };
            } catch (err) {
              console.warn(`Failed to get message details for ${message.id}:`, (err as any)?.message || err);
              // Return null for failed messages, don't break the whole request
              return null;
            }
          }),
        );
        
        // Extract successful results and filter out nulls
        const validMessages = messages
          .filter(result => result.status === 'fulfilled' && result.value !== null)
          .map(result => (result as PromiseFulfilledResult<any>).value);
        
        const failedCount = messages.length - validMessages.length;
        if (failedCount > 0) {
          console.warn(`Successfully fetched ${validMessages.length}/${messages.length} messages for ${formattedLabelId}, ${failedCount} failed`);
        }
        
        return {
          messages: validMessages,
          nextPageToken: res.data.nextPageToken,
        };
      }
    } catch (error) {
      console.error('Failed to get emails for label:', labelId, (error as any)?.message || error);
      console.error('Error details:', (error as any)?.response?.data || error);
      // Return empty array instead of throwing error to prevent frontend crash
      return {
        messages: [],
        nextPageToken: undefined,
      };
    }
  }

  async getEmail(userId: string, messageId: string) {
    if (!messageId) {
      throw new InternalServerErrorException('Message ID not provided');
    }
    
    // Validate Gmail messageId format (prevent "Invalid id value" error)
    this.gmailLabelService.validateMessageId(messageId);
    
    const gmail = await this.getGmailClient(userId);
    
    // Check if this is a draft ID (starts with 'r')
    const isDraft = messageId.startsWith('r');
    
    if (isDraft) {
      // Fetch draft instead of message
      const res = await gmail.users.drafts.get({
        userId: 'me',
        id: messageId,
      });

      if (!res.data.message?.payload) {
        throw new InternalServerErrorException('Draft payload not found');
      }

      const body = this.parseBody(res.data.message.payload);
      const headers = this.parseHeaders(res.data.message.payload.headers || []);

      return {
        id: res.data.id,
        snippet: res.data.message.snippet,
        payload: res.data.message.payload,
        body,
        headers,
      };
    }
    
    // Regular email
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
        // Normalize to lowercase for consistent access
        headerObject[header.name.toLowerCase()] = header.value;
      }
    });
    return headerObject;
  }

  /**
   * Infer Kanban status from Gmail labelIds
   * Implements strict priority order: Done > In Progress > To Do > Inbox
   * CRITICAL: Must match frontend logic in useEmails.ts
   * 
   * Priority Rules:
   * 1. Done (ARCHIVED)         - Priority 1 (Highest) - Not in INBOX, not system folders
   * 2. In Progress (IMPORTANT) - Priority 2 - Has IMPORTANT + INBOX
   * 3. To Do (STARRED)         - Priority 3 - Has STARRED + INBOX
   * 4. Inbox (INBOX)           - Priority 4 (Lowest) - Default for INBOX emails
   * 
   * @param labelIds - Array of Gmail label IDs
   * @returns EmailStatus string for Kanban column placement
   */
  private inferStatusFromLabels(labelIds: string[]): string {
    // PRIORITY 1: Done (Archived) - highest priority
    // Email is archived if NOT in INBOX and NOT in system folders
    if (!labelIds.includes('INBOX') && 
        !labelIds.includes('TRASH') && 
        !labelIds.includes('SPAM')) {
      console.log('[inferStatus] Done (archived):', labelIds);
      return 'Done';
    }
    
    // PRIORITY 2: In Progress (Important emails in INBOX)
    if (labelIds.includes('IMPORTANT') && labelIds.includes('INBOX')) {
      console.log('[inferStatus] In Progress (important):', labelIds);
      return 'In Progress';
    }
    
    // PRIORITY 3: To Do (Starred emails in INBOX)
    if (labelIds.includes('STARRED') && labelIds.includes('INBOX')) {
      console.log('[inferStatus] To Do (starred):', labelIds);
      return 'To Do';
    }
    
    // PRIORITY 4: Inbox (Default - any email with INBOX label)
    if (labelIds.includes('INBOX')) {
      return 'Inbox';
    }
    
    // FALLBACK: Default to Inbox (should rarely reach here)
    return 'Inbox';
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
    
    // Update unread count for all affected mailboxes
    await this.updateUnreadCountsForLabels(userId, updatedLabelIds);
    
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

  // ========== FEATURE II: UPDATE EMAIL STATUS (KANBAN DRAG & DROP) ==========
  /**
   * Updates email status for Kanban workflow management
   * Maps status to Gmail labels and updates both Gmail API and local DB
   * @param userId - User ID
   * @param messageId - Email message ID
   * @param status - New status: "Inbox" | "To Do" | "In Progress" | "Done" | "Snoozed"
   * @returns Updated email object with new status
   */
  async updateEmailStatus(userId: string, messageId: string, status: string) {
    try {
      const gmail = await this.getGmailClient(userId);

      // Map Kanban status to Gmail labels
      // Note: Cannot add SENT/TRASH labels manually - these are system-managed
      // Using STARRED and IMPORTANT for workflow tracking instead
      const statusToLabelsMap: Record<string, { add: string[], remove: string[] }> = {
        'Inbox': {
          add: ['INBOX'],
          remove: ['STARRED', 'IMPORTANT']
        },
        'To Do': {
          add: ['STARRED', 'INBOX'],
          remove: ['IMPORTANT']
        },
        'In Progress': {
          add: ['IMPORTANT', 'INBOX'],
          remove: ['STARRED']
        },
        'Done': {
          add: [], // Archive - remove from INBOX
          remove: ['INBOX', 'STARRED', 'IMPORTANT']
        },
        'Snoozed': {
          add: ['INBOX'],
          remove: ['STARRED', 'IMPORTANT']
        }
      };

      const labelChanges = statusToLabelsMap[status];
      if (!labelChanges) {
        throw new BadRequestException(`Invalid status: ${status}`);
      }

      // Update Gmail labels
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: labelChanges.add,
          removeLabelIds: labelChanges.remove,
        },
      });

      // Fetch updated email details
      const updatedMessage = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      // Update local DB - BOTH labels AND status
      const updatedLabelIds = updatedMessage.data.labelIds || [];
      
      // Update labels
      await this.usersService.updateEmailLabels(
        userId,
        messageId,
        updatedLabelIds,
      );
      
      // Update status field (CRITICAL for persistence)
      await this.usersService.updateEmailStatus(
        userId,
        messageId,
        status,
      );

      // Parse headers for sender, subject, etc.
      const headers = this.parseHeaders(updatedMessage.data.payload?.headers || []);
      
      // Return email with new status
      return {
        id: messageId,
        sender: headers.from || '',
        subject: headers.subject || '(No subject)',
        body: updatedMessage.data.payload ? this.parseBody(updatedMessage.data.payload) : '',
        snippet: updatedMessage.data.snippet || '',
        timestamp: parseInt(updatedMessage.data.internalDate || '0'),
        status,
        labelIds: updatedLabelIds,
      };
    } catch (err: any) {
      console.error(`[Gmail Service] Error updating email status:`, err);
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException(
        `Failed to update email status: ${err?.message || 'Unknown error'}`
      );
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

  // FEATURE IV: AI Content Summarization
  /**
   * Generate AI summary for an email
   * CRITICAL: Only generates if summary doesn't exist yet
   * @param userId - User ID
   * @param messageId - Email message ID
   * @returns Object with summary and email details
   */
  async generateEmailSummary(userId: string, messageId: string) {
    this.logger.log(`[AI Summary] Generating summary for email ${messageId}`);

    // 1. Fetch email from database
    const email = await this.usersService.findEmailByMessageId(userId, messageId);
    
    if (!email) {
      throw new BadRequestException('Email not found in database');
    }

    // 2. CRITICAL: Check if summary already exists (avoid re-generation)
    if (email.summary && email.summaryGenerated) {
      this.logger.log(`[AI Summary] ✅ Summary already exists (cached), returning`);
      return {
        messageId: email.messageId,
        summary: email.summary,
        cached: true,
      };
    }

    // 3. Extract FULL email body (not snippet!)
    let emailBody = await this.extractFullEmailBody(email);

    // 4. Clean HTML and extract plain text
    const cleanedText = this.summarizationService.cleanHtmlToText(emailBody);

    // CRITICAL: Validate minimum content length (100 chars for meaningful summary)
    if (!cleanedText || cleanedText.trim().length < 100) {
      this.logger.warn(
        `[AI Summary] ❌ Email body too short (${cleanedText?.length || 0} chars). Minimum 100 chars required.`
      );
      
      // Return meaningful rejection message instead of using snippet
      const summary = 'Email không có đủ nội dung để tóm tắt.';
      email.summary = summary;
      email.summaryGenerated = true;
      await email.save();
      
      return {
        messageId: email.messageId,
        summary: summary,
        cached: false,
      };
    }

    emailBody = cleanedText;
    this.logger.log(`[AI Summary] Cleaned email body length: ${emailBody.length} characters`);

    // 5. Generate summary using Summarization Service
    const summary = await this.summarizationService.summarizeEmail(emailBody);

    // 6. Save summary to database (mark as generated to avoid re-processing)
    email.summary = summary;
    email.summaryGenerated = true;
    await email.save();

    this.logger.log(`[AI Summary] ✅ Summary generated and saved for ${messageId}`);

    return {
      messageId: email.messageId,
      summary: summary,
      cached: false,
    };
  }

  /**
   * Extract full email body from payload
   * Handles both simple body.data and multipart/alternative structures
   */
  private async extractFullEmailBody(email: any): Promise<string> {
    let bodyText = '';

    // Try direct body.data first
    if (email.payload?.body?.data) {
      const decoded = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
      bodyText = decoded;
    } 
    // Try multipart (common for Gmail)
    else if (email.payload?.parts && Array.isArray(email.payload.parts)) {
      bodyText = this.extractBodyFromParts(email.payload.parts);
    }

    return bodyText;
  }

  /**
   * Recursively extract body from email parts
   * Prioritize: text/html > text/plain
   */
  private extractBodyFromParts(parts: any[]): string {
    let htmlBody = '';
    let plainBody = '';

    for (const part of parts) {
      // Recursive search in nested parts
      if (part.parts) {
        const nested = this.extractBodyFromParts(part.parts);
        if (nested) {
          if (part.mimeType === 'text/html') htmlBody = nested;
          else if (part.mimeType === 'text/plain') plainBody = nested;
        }
      }

      // Direct body data
      if (part.body?.data) {
        const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
        
        if (part.mimeType === 'text/html') {
          htmlBody = decoded;
        } else if (part.mimeType === 'text/plain') {
          plainBody = decoded;
        }
      }
    }

    // Prefer HTML (usually has more content)
    return htmlBody || plainBody;
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
        // Skip if already in deleted list
        if (deletedMessageIds.has(msgId)) {
          continue;
        }
        
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
        } catch (err: any) {
          // If message not found (404), it was deleted - remove from DB
          if (err.code === 404 || err.status === 404) {
            console.warn(`Message ${msgId} not found (deleted), removing from DB`);
            await this.usersService.deleteEmailById(userId, msgId);
            deletedMessageIds.add(msgId); // Track as deleted
          } else {
            console.error(`Failed to fetch message ${msgId}:`, err.message || err);
          }
        }
      }

      // Save changed emails
      if (changedEmails.length > 0) {
        console.log(`Saving ${changedEmails.length} changed emails to DB...`);
        console.log('Changed email IDs:', changedEmails.map(e => e.id).join(', '));
        await this.usersService.saveEmails(userId, changedEmails);
        console.log(`✅ Saved ${changedEmails.length} emails successfully`);
      }

      // Update mailboxes (CHỈ update messagesTotal, messagesUnread sẽ được tính từ DB)
      const labelsRes = await gmail.users.labels.list({ userId: 'me' });
      const labels = (labelsRes.data.labels || []).filter(label => label.id);
      
      // TODO: Update từng mailbox riêng lẻ để giữ nguyên messagesUnread
      // await this.usersService.updateMailboxTotal() - method doesn't exist
      // For now, just use the labels from API

      // Store new historyId
      await this.usersService.setLastHistoryId(userId, currentHistoryId);

      console.log(`Incremental sync complete: ${changedEmails.length} changed, ${deletedMessageIds.size} deleted`);
      return {
        mailboxes: labels.length,
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

      // Lấy 200 email gần nhất cho mỗi label quan trọng với batch processing
      let totalEmails = 0;
      const labelsToFetch = ['INBOX', 'SENT', 'STARRED', 'SPAM', 'TRASH', 'DRAFT', 'IMPORTANT'];
      const batchSize = 10;

      // Tổng hợp tất cả email từ các label, KHÔNG merge labelIds
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
                    // KHÔNG merge labels - giữ nguyên labelIds từ Gmail API
                    if (!emailMap[emailId]) {
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

  /**
   * Xử lý notification từ Google Pub/Sub khi có email mới
   */
  async processPubSubNotification(emailAddress: string, historyId: string) {
    console.log(`[Gmail] Processing Pub/Sub notification for ${emailAddress}, historyId: ${historyId}`);

    try {
      // 1. Tìm user theo email
      const user = await this.usersService.findByEmail(emailAddress);
      if (!user) {
        console.warn(`[Gmail] User not found: ${emailAddress}`);
        return;
      }

      const userId = user._id.toString();

      // 2. Lấy Gmail client
      const gmail = await this.getGmailClient(userId);

      // 3. Lấy lịch sử thay đổi từ historyId
      const historyResponse = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: historyId,
        historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
      });

      if (!historyResponse.data.history || historyResponse.data.history.length === 0) {
        console.log('[Gmail] No history changes found');
        return;
      }

      // 4. Đếm số email mới
      let newMessagesCount = 0;

      for (const record of historyResponse.data.history) {
        if (record.messagesAdded) {
          newMessagesCount += record.messagesAdded.length;
        }
      }

      console.log(`[Gmail] Found ${newMessagesCount} new messages for user ${userId}`);

      // 5. Broadcast SSE event đến frontend
      this.sseService.broadcast(userId, {
        type: 'gmail-updated',
        userId,
        data: {
          newMessagesCount,
          historyId: historyResponse.data.historyId,
        },
      });

      console.log(`[Gmail] Successfully notified user ${userId} via SSE`);
    } catch (err) {
      console.error(`[Gmail] Failed to process Pub/Sub notification:`, err);
      throw err;
    }
  }

  // ========== FEATURE III: SNOOZE / DEFERRAL MECHANISM ==========

  /**
   * Snooze an email (GMAIL SYNC VERSION)
   * @param userId - User ID
   * @param messageId - Gmail messageId (NOT internal DB id)
   * @param snoozedUntil - ISO timestamp when to wake up
   * @returns Updated email object with snooze metadata
   */
  async snoozeEmail(userId: string, messageId: string, snoozedUntil: string) {
    this.logger.log(`[Snooze] Starting snooze for ${messageId}`);
    
    try {
      // STEP 1: Validate messageId format (prevent "Invalid id value" error)
      this.gmailLabelService.validateMessageId(messageId);

      // STEP 2: Validate snoozedUntil is in the future
      const targetDate = new Date(snoozedUntil);
      if (isNaN(targetDate.getTime())) {
        throw new BadRequestException('Invalid snoozedUntil date format');
      }
      if (targetDate <= new Date()) {
        throw new BadRequestException('snoozedUntil must be in the future');
      }

      // STEP 3: Get current email to save original status
      const email = await this.usersService.findEmailByMessageId(userId, messageId);
      if (!email) {
        throw new BadRequestException(`Email not found in database: ${messageId}`);
      }

      const originalStatus = email.status || 'Inbox';
      this.logger.log(`[Snooze] Original status: ${originalStatus}`);

      // STEP 4: Optimistic local update first (for fast UI response)
      await this.usersService.updateEmailSnooze(
        userId,
        messageId,
        true,
        targetDate,
        originalStatus
      );
      this.logger.log(`[Snooze] ✅ Local DB updated`);

      // STEP 5: Sync with Gmail (add SNOOZED label, remove INBOX)
      // Use retry wrapper for transient errors
      let updatedLabels: string[];
      try {
        updatedLabels = await this.gmailLabelService.retryWithBackoff(
          () => this.gmailLabelService.applySnoozeLabels(userId, messageId),
          3, // maxRetries
          1000 // baseDelay
        );
        this.logger.log(`[Snooze] ✅ Gmail labels synced: ${updatedLabels.join(', ')}`);
      } catch (gmailError: any) {
        // ROLLBACK: Gmail sync failed, revert local changes
        this.logger.error(`[Snooze] ❌ Gmail sync failed, rolling back: ${gmailError.message}`);
        
        await this.usersService.updateEmailSnooze(
          userId,
          messageId,
          false,
          null,
          null
        );
        await this.usersService.updateEmailStatus(userId, messageId, originalStatus);
        
        this.logger.warn(`[Snooze] ⚠️ Rollback complete`);
        
        // Re-throw with user-friendly message
        throw new InternalServerErrorException(
          `Failed to sync snooze with Gmail: ${gmailError.message}. ` +
          `Changes have been rolled back. Please try again or check your Gmail connection.`
        );
      }

      // STEP 6: Get Gmail client and fetch full email details
      const gmail = await this.getGmailClient(userId);
      const updatedMessage = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = this.parseHeaders(updatedMessage.data.payload?.headers || []);

      // STEP 7: Update DB with full payload and labelIds to match Gmail
      await this.usersService.updateEmail(userId, messageId, {
        labelIds: updatedLabels,
        payload: updatedMessage.data.payload,
        internalDate: updatedMessage.data.internalDate,
        snippet: updatedMessage.data.snippet,
      });
      this.logger.log(`[Snooze] ✅ Saved full email payload to DB`);

      // STEP 8: Return updated email with snooze data
      this.logger.log(`[Snooze] ✅ Complete for ${messageId}`);
      return {
        id: messageId,
        sender: headers.from || '',
        subject: headers.subject || '(No subject)',
        body: updatedMessage.data.payload ? this.parseBody(updatedMessage.data.payload) : '',
        snippet: updatedMessage.data.snippet || '',
        timestamp: parseInt(updatedMessage.data.internalDate || '0'),
        status: 'Snoozed',
        labelIds: updatedLabels,
        snoozed: true,
        snoozedUntil: targetDate.toISOString(),
        snoozedFromStatus: originalStatus,
      };
    } catch (err: any) {
      this.logger.error(`[Snooze] Error: ${err.message}`, err.stack);
      
      // Re-throw known exceptions
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
        throw err;
      }
      
      throw new InternalServerErrorException(
        `Failed to snooze email: ${err?.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Unsnooze an email immediately (restore to original status) - GMAIL SYNC VERSION
   * @param userId - User ID
   * @param messageId - Gmail messageId (NOT internal DB id)
   * @returns Updated email object
   */
  async unsnoozeEmail(userId: string, messageId: string) {
    this.logger.log(`[Unsnooze] Starting unsnooze for ${messageId}`);
    
    try {
      // STEP 1: Validate messageId format
      this.gmailLabelService.validateMessageId(messageId);

      // STEP 2: Get current email to retrieve original status
      const email = await this.usersService.findEmailByMessageId(userId, messageId);
      if (!email) {
        throw new BadRequestException(`Email not found in database: ${messageId}`);
      }

      const restoreStatus = email.snoozedFromStatus || 'Inbox';
      this.logger.log(`[Unsnooze] Restoring to status: ${restoreStatus}`);

      // STEP 3: Optimistic local update first
      await this.usersService.updateEmailSnooze(
        userId,
        messageId,
        false,
        null,
        null
      );
      await this.usersService.updateEmailStatus(userId, messageId, restoreStatus);
      this.logger.log(`[Unsnooze] ✅ Local DB updated`);

      // STEP 4: Sync with Gmail (remove SNOOZED label, add INBOX)
      let updatedLabels: string[];
      try {
        updatedLabels = await this.gmailLabelService.retryWithBackoff(
          () => this.gmailLabelService.removeSnoozeLabels(userId, messageId),
          3, // maxRetries
          1000 // baseDelay
        );
        this.logger.log(`[Unsnooze] ✅ Gmail labels synced: ${updatedLabels.join(', ')}`);
      } catch (gmailError: any) {
        // ROLLBACK: Gmail sync failed, revert local changes
        this.logger.error(`[Unsnooze] ❌ Gmail sync failed, rolling back: ${gmailError.message}`);
        
        await this.usersService.updateEmailSnooze(
          userId,
          messageId,
          true,
          email.snoozedUntil || new Date(),
          email.snoozedFromStatus || restoreStatus
        );
        await this.usersService.updateEmailStatus(userId, messageId, 'Snoozed');
        
        this.logger.warn(`[Unsnooze] ⚠️ Rollback complete`);
        
        // Re-throw with user-friendly message
        throw new InternalServerErrorException(
          `Failed to sync unsnooze with Gmail: ${gmailError.message}. ` +
          `Changes have been rolled back. Please try again or check your Gmail connection.`
        );
      }

      // STEP 5: Update labelIds in DB to match Gmail
      await this.usersService.updateEmail(userId, messageId, {
        labelIds: updatedLabels,
      });

      // STEP 6: Get Gmail client and fetch full email details
      const gmail = await this.getGmailClient(userId);
      const updatedMessage = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const headers = this.parseHeaders(updatedMessage.data.payload?.headers || []);

      // Prepare full email object for response and SSE
      const restoredEmail = {
        id: messageId,
        sender: headers.from || '',
        subject: headers.subject || '(No subject)',
        body: updatedMessage.data.payload ? this.parseBody(updatedMessage.data.payload) : '',
        snippet: updatedMessage.data.snippet || '',
        timestamp: parseInt(updatedMessage.data.internalDate || '0'),
        status: restoreStatus,
        labelIds: updatedLabels,
        snoozed: false,
        snoozedUntil: null,
        snoozedFromStatus: null,
      };

      // STEP 7: Broadcast SSE event with FULL email object for auto UI refresh
      this.sseService.broadcast(userId, {
        type: 'gmail-updated',
        action: 'unsnooze',
        email: restoredEmail, // Include full email data
        messageId: messageId,
        originalStatus: restoreStatus,
        timestamp: Date.now(),
      });
      this.logger.log(`[Unsnooze] 📡 SSE event broadcasted to user ${userId} with full email data`);

      // STEP 8: Return updated email
      this.logger.log(`[Unsnooze] ✅ Complete for ${messageId}`);
      return restoredEmail;
    } catch (err: any) {
      this.logger.error(`[Unsnooze] Error: ${err.message}`, err.stack);
      
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
        throw err;
      }
      
      throw new InternalServerErrorException(
        `Failed to unsnooze email: ${err?.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Get all snoozed emails for a user
   * @param userId - User ID
   * @returns Array of snoozed emails
   */
  async getSnoozedEmails(userId: string) {
    console.log('[Gmail Service] 🔍 getSnoozedEmails called for user:', userId);
    
    // CRITICAL: Validate userId first
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('[Gmail Service] ❌ Invalid userId:', userId);
      throw new BadRequestException('Invalid user ID. Please log in again.');
    }
    
    try {
      // Use getSnoozedEmailsWithDetails() to ensure full data projection
      const snoozedEmails = await this.usersService.getSnoozedEmailsWithDetails(userId);
      console.log('[Gmail Service] 📦 Found', snoozedEmails.length, 'snoozed emails in DB');
      
      if (snoozedEmails.length > 0) {
        const sample = snoozedEmails[0];
        const sampleHeaders = sample.payload?.headers || [];
        console.log('[Gmail Service] Sample email from DB:', {
          id: sample.messageId,
          snoozedUntil: sample.snoozedUntil,
          hasPayload: !!sample.payload,
          headersCount: sampleHeaders.length,
          headerNames: sampleHeaders.map((h: any) => h.name).join(', '),
          parsedSubject: this.parseHeaders(sampleHeaders).subject,
          parsedFrom: this.parseHeaders(sampleHeaders).from,
          snippet: sample.snippet?.substring(0, 50),
        });
      }
      
      // Get Gmail client for fetching missing data
      const gmail = await this.getGmailClient(userId);
      
      // Transform to API format and fetch missing data from Gmail
      const result = await Promise.all(snoozedEmails.map(async (email) => {
        // Handle missing payload or headers gracefully
        let headers = email.payload?.headers || [];
        let parsedHeaders = this.parseHeaders(headers);
        
        // If payload is missing or headers are empty, fetch from Gmail API
        if (!email.payload || headers.length === 0 || !parsedHeaders.subject || !parsedHeaders.from) {
          console.log(`[Gmail Service] 🔄 Fetching missing data for ${email.messageId} from Gmail API`);
          try {
            const gmailMessage = await gmail.users.messages.get({
              userId: 'me',
              id: email.messageId,
              format: 'metadata',
              metadataHeaders: ['From', 'To', 'Subject', 'Date'],
            });
            
            console.log(`[Gmail Service] 📥 Gmail API response for ${email.messageId}:`, {
              hasPayload: !!gmailMessage.data.payload,
              headersCount: gmailMessage.data.payload?.headers?.length || 0,
              headers: gmailMessage.data.payload?.headers,
            });
            
            headers = gmailMessage.data.payload?.headers || [];
            parsedHeaders = this.parseHeaders(headers);
            
            console.log(`[Gmail Service] 📋 Parsed headers:`, parsedHeaders);
            
            // Update DB with fetched payload for future requests
            await this.usersService.updateEmail(userId, email.messageId, {
              payload: gmailMessage.data.payload,
              internalDate: gmailMessage.data.internalDate,
              snippet: gmailMessage.data.snippet,
            });
            
            console.log(`[Gmail Service] ✅ Updated ${email.messageId}: ${parsedHeaders.subject} from ${parsedHeaders.from}`);
          } catch (fetchError: any) {
            console.error(`[Gmail Service] ⚠️ Failed to fetch ${email.messageId}:`, fetchError.message);
            // Continue with fallback values
          }
        }
        
        // Ensure we have valid data before returning
        const sender = parsedHeaders.from || 'Unknown Sender';
        const subject = parsedHeaders.subject || '(No subject)';
        const snippet = email.snippet || '';
        
        console.log(`[Gmail Service] 📧 Email ${email.messageId}: "${subject}" from "${sender}"`);
        
        return {
          id: email.messageId, // This is the Gmail messageId
          sender: sender,
          subject: subject,
          snippet: snippet,
          timestamp: parseInt(email.internalDate || '0'),
          status: 'Snoozed',
          labelIds: email.labelIds || [],
          snoozed: email.snoozed,
          snoozedUntil: email.snoozedUntil?.toISOString() || null,
          snoozedFromStatus: email.snoozedFromStatus || 'Inbox',
        };
      }));
      
      console.log('[Gmail Service] ✅ Returning', result.length, 'transformed emails with full data');
      return result;
    } catch (err: any) {
      console.error(`[Gmail Service] ❌ Error getting snoozed emails:`, err);
      throw new InternalServerErrorException(
        `Failed to get snoozed emails: ${err?.message || 'Unknown error'}`
      );
    }
  }

  // ========== FEATURE IV: AI SUMMARIZATION ==========

  /**
   * Generate AI summary for an email
   * @param userId - User ID
   * @param messageId - Gmail message ID
   * @returns Updated email with summary
   */
  async summarizeEmail(userId: string, messageId: string) {
    try {
      // Get email details
      const emailData = await this.getEmail(userId, messageId);
      
      const subject = emailData.headers?.subject || '(No subject)';
      const body = emailData.body || '';
      const snippet = emailData.snippet || '';
      
      // Try to get content from body, fallback to snippet
      let content = body;
      if (!content || content.trim().length < 10) {
        content = snippet;
      }
      
      if (!content || content.trim().length < 10) {
        // Return a default summary for empty emails
        const defaultSummary = 'Email không có nội dung hoặc chỉ chứa hình ảnh/tệp đính kèm.';
        await this.usersService.updateEmail(userId, messageId, {
          summary: defaultSummary,
          summarizedAt: new Date(),
        });
        return {
          id: messageId,
          summary: defaultSummary,
          summarizedAt: new Date().toISOString(),
        };
      }

      // Generate summary using Gemini AI (with automatic local fallback)
      this.logger.log(`📝 Generating summary for email: ${messageId}`);
      const summary = await this.geminiService.summarizeEmail(content, subject);

      if (!summary) {
        throw new InternalServerErrorException('Failed to generate summary');
      }

      this.logger.log(`📄 Summary generated (${summary.length} chars): ${summary.substring(0, 100)}...`);

      // Save summary to database
      await this.usersService.updateEmail(userId, messageId, {
        summary,
        summarizedAt: new Date(),
      });

      this.logger.log(`✅ Summary saved for email: ${messageId}`);

      return {
        id: messageId,
        summary,
        summarizedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      this.logger.error(`❌ Error summarizing email ${messageId}:`, error.message);
      throw error;
    }
  }
}
