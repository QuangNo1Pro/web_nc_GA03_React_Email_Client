import { Injectable, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GmailService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

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
      const gmail = await this.getGmailClient(userId);
      const res = await gmail.users.labels.list({ userId: 'me' });
      
      const labels = (res.data.labels || []).filter(label => label.id);
      const labelsWithUnreadCount = await Promise.all(
        labels.map(async (label) => {
          try {
            // Get all message IDs for this label (paginated)
            let allMessageIds: string[] = [];
            let pageToken: string | undefined = undefined;
            
            do {
              const messagesRes: any = await gmail.users.messages.list({
                userId: 'me',
                labelIds: [label.id!],
                pageToken,
                maxResults: 100,
              });
              
              allMessageIds.push(
                ...(messagesRes.data?.messages?.map((m: any) => m.id || '') || [])
              );
              pageToken = messagesRes.data?.nextPageToken;
            } while (pageToken && allMessageIds.length < 1000); // Limit to 1000 for performance

            if (allMessageIds.length === 0) {
              return {
                id: label.id!,
                name: label.name || 'Unknown',
                messagesTotal: label.messagesTotal || 0,
                messagesUnread: 0,
              };
            }

            // Get details of all messages to check if they have UNREAD label
            const messageDetails = await Promise.all(
              allMessageIds.map(msgId =>
                gmail.users.messages.get({
                  userId: 'me',
                  id: msgId,
                  format: 'minimal',
                })
              )
            );

            // Count how many have UNREAD label
            const unreadCount = messageDetails.filter(msg =>
              msg.data.labelIds?.includes('UNREAD')
            ).length;

            return {
              id: label.id!,
              name: label.name || 'Unknown',
              messagesTotal: label.messagesTotal || 0,
              messagesUnread: unreadCount,
            };
          } catch (error) {
            console.error(`Failed to get unread count for label ${label.id}:`, error);
            return {
              id: label.id!,
              name: label.name || 'Unknown',
              messagesTotal: label.messagesTotal || 0,
              messagesUnread: 0,
            };
          }
        })
      );
      
      return labelsWithUnreadCount;
    } catch (error) {
      console.error('Failed to get mailboxes:', error);
      throw new InternalServerErrorException('Failed to get mailboxes');
    }
  }

  async getEmails(userId: string, labelId: string, pageToken?: string) {
    try {
      const gmail = await this.getGmailClient(userId);
      
      // --- FIX LỖI TẠI ĐÂY ---
      // Chuẩn hóa labelId: Nếu là inbox, sent, trash... thì chuyển thành INBOX, SENT...
      let formattedLabelId = labelId;
      const systemLabels = ['inbox', 'sent', 'trash', 'spam', 'draft', 'starred', 'unread', 'important'];
      
      if (systemLabels.includes(labelId.toLowerCase())) {
        formattedLabelId = labelId.toUpperCase();
      }
      // -----------------------
      
      console.log(`Fetching emails for label: ${formattedLabelId}`);

      const res = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [formattedLabelId], // Sử dụng biến đã format
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
    return res.data;
  }

  async deleteEmail(userId: string, messageId: string) {
    try {
      const gmail = await this.getGmailClient(userId);
      await gmail.users.messages.delete({
        userId: 'me',
        id: messageId,
      });
      return { success: true };
    } catch (error: any) {
      if (error.message?.includes('insufficient authentication scopes')) {
        throw new InternalServerErrorException('Insufficient permissions. Please re-authenticate to grant delete access.');
      }
      console.error('Error deleting email:', error);
      throw new InternalServerErrorException('Failed to delete email');
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
    const rawStandardBase64 = this.createMessage(to, subject, body, cc, bcc, attachments);
    
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
  ) {
    const emailLines = [];
    
    // Add recipients and subject
    emailLines.push(`To: ${to}`);
    if (cc) {
      emailLines.push(`Cc: ${cc}`);
    }
    if (bcc) {
      emailLines.push(`Bcc: ${bcc}`);
    }
    emailLines.push(`Subject: ${subject}`);

    if (attachments && attachments.length > 0) {
      const boundary = 'frontier'; // A unique string to separate parts

      emailLines.push('MIME-Version: 1.0');
      emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      emailLines.push('');
      emailLines.push(`--${boundary}`);
      emailLines.push('Content-Type: text/html; charset=utf-8');
      emailLines.push('Content-Transfer-Encoding: 8bit');
      emailLines.push('');
      emailLines.push(body); // Email body
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
      // Simple text/html message if no attachments
      emailLines.push('Content-Type: text/html; charset=utf-8');
      emailLines.push('Content-Transfer-Encoding: 8bit');
      emailLines.push('');
      emailLines.push(body);
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
}