import { Injectable, InternalServerErrorException } from '@nestjs/common';
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
    
    // FIX 1: Chỉ bắt buộc phải có access token. 
    // Refresh token có thể thiếu nếu user chưa re-consent, nhưng vẫn cho phép chạy tạm.
    if (!user || !user.googleAccessToken) {
      throw new InternalServerErrorException(
        'User not found or not authenticated with Google',
      );
    }

    const clientId = this.configService.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get('GOOGLE_CLIENT_SECRET');
    const callbackUrl = this.configService.get('GOOGLE_CALLBACK_URL');

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new InternalServerErrorException('Google credentials not configured');
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      callbackUrl,
    );

    // FIX 2: Tạo object credentials an toàn
    const credentials: any = {
      access_token: user.googleAccessToken,
    };
    
    // Chỉ thêm refresh_token nếu nó tồn tại trong DB
    if (user.googleRefreshToken) {
      credentials.refresh_token = user.googleRefreshToken;
    }

    oauth2Client.setCredentials(credentials);

    // Setup listener để lưu token mới nếu có (quan trọng cho auto-refresh)
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await this.usersService.setGoogleTokens(
          userId,
          tokens.access_token,
          // Nếu Google trả về refresh token mới thì lưu, không thì giữ cái cũ (nếu có)
          tokens.refresh_token || user.googleRefreshToken || '' 
        );
      }
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  async getMailboxes(userId: string) {
    try {
      const gmail = await this.getGmailClient(userId);
      const res = await gmail.users.labels.list({ userId: 'me' });
      return res.data.labels;
    } catch (error) {
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

      const res = await gmail.users.messages.list({
        userId: 'me',
        labelIds: [formattedLabelId], // Sử dụng biến đã format
        pageToken,
      });

      if (!res.data.messages) {
        return {
          messages: [],
          nextPageToken: res.data.nextPageToken,
        };
      }
      
      const messages = await Promise.all(
        res.data.messages.map(async (message) => {
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
        }),
      );

      return {
        messages: messages.filter((m) => m),
        nextPageToken: res.data.nextPageToken,
      };
    } catch (error) {
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

  async deleteEmails(userId: string, messageIds: string[]) {
    const gmail = await this.getGmailClient(userId);
    const res = await gmail.users.messages.batchDelete({
      userId: 'me',
      requestBody: {
        ids: messageIds,
      },
    });
    return res.data;
  }

  async sendEmail(
    userId: string,
    to: string,
    subject: string,
    body: string,
    cc?: string,
    bcc?: string,
  ) {
    const gmail = await this.getGmailClient(userId);
    const raw = this.createMessage(to, subject, body, cc, bcc);
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
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
  ) {
    const emailLines = [];
    emailLines.push(`To: ${to}`);
    if (cc) {
      emailLines.push(`Cc: ${cc}`);
    }
    if (bcc) {
      emailLines.push(`Bcc: ${bcc}`);
    }
    emailLines.push(`Subject: ${subject}`);
    emailLines.push('Content-Type: text/html; charset=utf-8');
    emailLines.push('');
    emailLines.push(body);

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
}