import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import * as Imap from 'imap-simple';

interface ImapConfig {
  user: string;
  password?: string;
  accessToken?: string; // For XOAUTH2
  host: string;
  port: number;
  tls?: boolean;
}

interface Email {
  id: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  labels: string[];
  read: boolean;
  starred: boolean;
}

@Injectable()
export class ImapService {
  async connectImap(config: ImapConfig) {
    try {
      const imapConfig: any = {
        user: config.user,
        host: config.host,
        port: config.port,
        tls: config.tls !== false,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
        connTimeout: 10000,
      };

      // Use XOAUTH2 if accessToken is provided, otherwise use password
      if (config.accessToken) {
        // Format XOAUTH2 string properly for Gmail
        const xoauth2String = this.buildXOAuth2String(config.user, config.accessToken);
        imapConfig.xoauth2 = xoauth2String;
      } else if (config.password) {
        imapConfig.password = config.password;
      } else {
        throw new Error('Either password or accessToken must be provided');
      }

      const connection = await Imap.connect({
        imap: imapConfig,
      });
      return connection;
    } catch (error) {
      const err = error as Error;
      throw new Error(`IMAP connection failed: ${err.message}`);
    }
  }

  async getMailboxes(connection: any): Promise<any[]> {
    try {
      const boxes = await connection.getBoxes();
      return boxes;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to get mailboxes: ${err.message}`);
    }
  }

  async getEmails(connection: any, mailbox: string, limit: number = 20): Promise<Email[]> {
    try {
      await connection.openBox(mailbox, false);
      
      const results = await connection.search(['ALL'], { bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)' });
      
      const emails: Email[] = [];
      
      for (let i = Math.max(0, results.length - limit); i < results.length; i++) {
        const message = results[i];
        const emailData = await this.parseEmail(message, connection);
        emails.unshift(emailData); // Add to beginning to reverse order
      }

      return emails;
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to get emails: ${err.message}`);
    }
  }



  async markAsRead(connection: any, mailbox: string, uid: string, read: boolean): Promise<void> {
    try {
      await connection.openBox(mailbox, false); // false = writable mode
      
      if (read) {
        await connection.addFlags(uid, ['\\Seen']);
      } else {
        await connection.delFlags(uid, ['\\Seen']);
      }
    } catch (error) {
      console.error('[IMAP] Error marking as read:', error);
      throw error;
    }
  }

  async toggleStar(connection: any, mailbox: string, uid: string, starred: boolean): Promise<void> {
    try {
      await connection.openBox(mailbox, false); // false = writable mode
      
      if (starred) {
        await connection.addFlags(uid, ['\\Flagged']);
      } else {
        await connection.delFlags(uid, ['\\Flagged']);
      }
    } catch (error) {
      console.error('[IMAP] Error toggling star:', error);
      throw error;
    }
  }

  async deleteEmail(connection: any, mailbox: string, uid: string): Promise<void> {
    try {
      await connection.openBox(mailbox, false); // false = writable mode
      await connection.addFlags(uid, ['\\Deleted']);
      await connection.expunge();
    } catch (error) {
      console.error('[IMAP] Error deleting email:', error);
      throw error;
    }
  }

  async sendEmail(
    config: ImapConfig,
    to: string,
    subject: string,
    body: string,
    html?: string,
    cc?: string,
    bcc?: string,
  ): Promise<any> {
    try {
      console.log('[IMAP Service] Creating SMTP transporter with config:', {
        host: config.host,
        port: config.port,
        secure: config.tls !== false,
        user: config.user,
        authType: config.accessToken ? 'XOAUTH2' : 'password',
      });

      const authConfig: any = {
        user: config.user,
      };

      // Use XOAUTH2 if accessToken is provided, otherwise use password
      if (config.accessToken) {
        authConfig.type = 'OAuth2';
        authConfig.accessToken = config.accessToken;
      } else if (config.password) {
        authConfig.pass = config.password;
      } else {
        throw new Error('Either password or accessToken must be provided');
      }

      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465, // Use secure for port 465, STARTTLS for 587
        auth: authConfig,
        tls: {
          rejectUnauthorized: false, // Allow self-signed certificates
        },
      });

      // Verify connection
      try {
        await transporter.verify();
      } catch (verifyError: any) {
        throw new Error(`SMTP verification failed: ${verifyError.message}`);
      }

      const mailOptions: any = {
        from: config.user,
        to,
        subject,
        text: body,
        html: html || body,
      };

      if (cc) mailOptions.cc = cc;
      if (bcc) mailOptions.bcc = bcc;

      const result = await transporter.sendMail(mailOptions);
      await transporter.close();
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      const err = error as any;
      throw new Error(`Failed to send email: ${err.message}`);
    }
  }

  private async parseEmail(message: any, connection: any): Promise<Email> {
    try {
      // Extract basic info from the message parts
      const parts = message.parts;
      let from = 'Unknown';
      let to = '';
      let subject = '(No Subject)';
      let date = new Date().toISOString();
      
      // Parse headers if available
      if (parts && parts.length > 0) {
        for (const part of parts) {
          if (part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)') {
            const headers = part.body;
            if (headers.from && headers.from[0]) {
              from = headers.from[0];
            }
            if (headers.to && headers.to[0]) {
              to = headers.to[0];
            }
            if (headers.subject && headers.subject[0]) {
              subject = headers.subject[0];
            }
            if (headers.date && headers.date[0]) {
              date = new Date(headers.date[0]).toISOString();
            }
          }
        }
      }

      return {
        id: message.attributes.uid.toString(),
        messageId: message.attributes.uid.toString(),
        from: from,
        to: to,
        subject: subject,
        date: date,
        snippet: subject.substring(0, 200),
        labels: ['INBOX'],
        read: !message.attributes.flags.includes('\\Unseen'),
        starred: message.attributes.flags.includes('\\Flagged'),
      };
    } catch (error) {
      console.error('Error parsing email:', error);
      // Return a fallback email object when parsing fails
      return {
        id: message.attributes?.uid?.toString() || 'unknown',
        messageId: '',
        from: 'Unknown',
        to: '',
        subject: '(Error parsing email)',
        date: new Date().toISOString(),
        snippet: 'This email could not be parsed',
        labels: ['INBOX'],
        read: message.attributes?.flags?.includes?.('\\Unseen') === false,
        starred: message.attributes?.flags?.includes?.('\\Flagged') || false,
      };
    }
  }

  async getEmailDetail(connection: any, mailbox: string, uid: string): Promise<any> {
    try {
      await connection.openBox(mailbox);
      
      // Fetch complete email with all parts
      const messages = await connection.search([['UID', uid]], {
        bodies: [''],
        struct: true,
      });

      if (!messages || messages.length === 0) {
        throw new Error(`Email with UID ${uid} not found`);
      }

      const message = messages[0];
      
      // Parse the full message using mailparser
      const fullEmailPart = message.parts.find((part: any) => part.which === '');
      if (!fullEmailPart) {
        throw new Error('Could not find email body');
      }

      const parsed = await simpleParser(fullEmailPart.body);
      
      const from = parsed.from?.text || 'Unknown';
      const toObj = parsed.to;
      const to = Array.isArray(toObj) ? toObj.map((a: any) => a.text).join(', ') : (toObj as any)?.text || '';
      const ccObj = parsed.cc;
      const cc = Array.isArray(ccObj) ? ccObj.map((a: any) => a.text).join(', ') : (ccObj as any)?.text || '';
      const bccObj = parsed.bcc;
      const bcc = Array.isArray(bccObj) ? bccObj.map((a: any) => a.text).join(', ') : (bccObj as any)?.text || '';
      const subject = parsed.subject || '(No Subject)';
      const date = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
      
      // Get HTML or text body
      let bodyHtml = '';
      if (parsed.html) {
        bodyHtml = parsed.html.toString();
      } else if (parsed.textAsHtml) {
        bodyHtml = parsed.textAsHtml;
      } else if (parsed.text) {
        // Convert plain text to HTML with better formatting
        const textBody = parsed.text;
        bodyHtml = textBody
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>')
          .replace(/  /g, '&nbsp;&nbsp;');
        bodyHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; padding: 20px;"><p>${bodyHtml}</p></div>`;
      }

      const snippet = parsed.text ? parsed.text.substring(0, 200) : '';
      
      // Parse attachments
      const attachments = (parsed.attachments || []).map((att: any) => ({
        filename: att.filename || 'attachment',
        mimeType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        attachmentId: att.contentId || att.checksum,
      }));

      return {
        id: uid,
        messageId: uid,
        from,
        to,
        cc,
        bcc,
        subject,
        date,
        body: bodyHtml,
        htmlBody: bodyHtml,
        snippet,
        labels: [mailbox],
        read: message.attributes?.flags?.includes?.('\\Seen') || false,
        starred: message.attributes?.flags?.includes?.('\\Flagged') || false,
        attachments,
        headers: {
          From: from,
          To: to,
          Cc: cc,
          Bcc: bcc,
          Subject: subject,
          Date: date,
        },
        payload: {
          parts: [],
          body: {
            data: bodyHtml,
          },
        },
      };
    } catch (error) {
      console.error('[IMAP] Error getting email detail:', error);
      throw error;
    }
  }

  async closeConnection(connection: any): Promise<void> {
    try {
      await connection.end();
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }

  private buildXOAuth2String(user: string, accessToken: string): string {
    // Build XOAUTH2 SASL string
    // Format: user={user}\x01auth=Bearer {token}\x01\x01
    const authString = `user=${user}\x01auth=Bearer ${accessToken}\x01\x01`;
    return Buffer.from(authString).toString('base64');
  }
}
