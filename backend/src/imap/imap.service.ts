import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import * as Imap from 'imap-simple';

interface ImapConfig {
  user: string;
  password: string;
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
      const connection = await Imap.connect({
        imap: {
          user: config.user,
          password: config.password,
          host: config.host,
          port: config.port,
          tls: config.tls !== false,
          tlsOptions: { rejectUnauthorized: false },
        },
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



  async sendEmail(config: ImapConfig, to: string, subject: string, body: string, html?: string): Promise<any> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.tls !== false,
        auth: {
          user: config.user,
          pass: config.password,
        },
      });

      const result = await transporter.sendMail({
        from: config.user,
        to,
        subject,
        text: body,
        html: html || body,
      });

      await transporter.close();
      return result;
    } catch (error) {
      const err = error as Error;
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
}
