import { Controller, Post, Get, Body, UseGuards, Req, Param, NotFoundException } from '@nestjs/common';
import { ImapService } from './imap.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UsersService } from '../users/users.service';
import { EncryptionService } from './encryption.service';

@Controller('imap')
export class ImapController {
  constructor(
    private imapService: ImapService,
    private usersService: UsersService,
    private encryptionService: EncryptionService,
  ) {}

  @Post('connect')
  @UseGuards(JwtAuthGuard)
  async connectImap(
    @Body() config: { user: string; password: string; host: string; port: number; tls?: boolean }
  ) {
    try {
      const connection = await this.imapService.connectImap(config);
      return { success: true, message: 'Connected to IMAP' };
    } catch (error) {
      const err = error as Error;
      return { success: false, message: err.message };
    }
  }

  @Get('mailboxes')
  @UseGuards(JwtAuthGuard)
  async getMailboxes(@Req() req: any) {
    try {
      console.log('[IMAP] 📬 Fetching mailboxes for user:', req.user.sub);
      const userId = req.user.sub;
      const dbUser = await this.usersService.findById(userId);
      
      console.log('[IMAP] User found:', dbUser?.email, 'Has imapConfig:', !!(dbUser as any)?.imapConfig);
      
      if (!dbUser || !(dbUser as any).imapConfig) {
        console.error('[IMAP] ❌ IMAP configuration not found for user:', userId);
        throw new NotFoundException('IMAP configuration not found');
      }

      const imapConfig = (dbUser as any).imapConfig;
      const encryptedPassword = (dbUser as any).imapPassword;
      console.log('[IMAP] Config:', { host: imapConfig.host, port: imapConfig.port, user: imapConfig.user });
      
      const password = this.encryptionService.decrypt(encryptedPassword);
      console.log('[IMAP] Password decrypted successfully');

      console.log('[IMAP] Connecting to IMAP server...');
      const connection = await this.imapService.connectImap({
        user: imapConfig.user || (dbUser as any).email,
        password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
      });
      console.log('[IMAP] Connected! Getting mailboxes...');

      const boxes = await connection.getBoxes();
      console.log('[IMAP] Got boxes:', Object.keys(boxes));
      await this.imapService.closeConnection(connection);

      // Map IMAP mailbox names to Gmail-style IDs
      const normalizeMailboxId = (fullName: string): string => {
        const lower = fullName.toLowerCase();
        
        // Gmail IMAP mappings - check specific phrases first to avoid conflicts
        if (fullName === 'INBOX') return 'INBOX';
        if (lower.includes('sent') || lower.includes('đã gửi')) return 'SENT';
        if (lower.includes('draft') || lower.includes('nháp')) return 'DRAFT';
        if (lower.includes('trash') || lower.includes('thùng rác')) return 'TRASH'; // Check Trash first
        if (lower.includes('spam') || lower.includes('thư rác')) return 'SPAM'; // Then Spam
        if (lower.includes('starred') || lower.includes('gắn dấu sao')) return 'STARRED';
        if (lower.includes('important') || lower.includes('quan trọng')) return 'IMPORTANT';
        if (lower.includes('all') || lower.includes('tất cả')) return 'ALL';
        
        return fullName; // Keep original if no mapping
      };

      // Convert boxes object to array format, including nested mailboxes
      const flattenMailboxes = (boxesObj: any, prefix: string = ''): any[] => {
        const result: any[] = [];
        
        for (const [name, box] of Object.entries(boxesObj)) {
          const boxData = box as any;
          
          // Don't add mailboxes with \Noselect flag (they're just containers)
          if (!boxData.attribs || !boxData.attribs.includes('\\Noselect')) {
            const fullName = prefix ? `${prefix}${boxData.delimiter || '/'}${name}` : name;
            const normalizedId = normalizeMailboxId(fullName);
            
            result.push({
              id: normalizedId,
              name: fullName, // Keep original name for display
              realName: fullName, // Keep for IMAP operations
              messagesTotal: 0,
              messagesUnread: 0,
            });
          }
          
          // Recursively add children if they exist
          if (boxData.children && Object.keys(boxData.children).length > 0) {
            const fullName = prefix ? `${prefix}${boxData.delimiter || '/'}${name}` : name;
            result.push(...flattenMailboxes(boxData.children, fullName));
          }
        }
        
        return result;
      };

      const mailboxes = flattenMailboxes(boxes);
      console.log('[IMAP] Returning mailboxes:', mailboxes.map(m => `${m.id} (${m.name})`));
      return mailboxes;
    } catch (error) {
      console.error('[IMAP Controller] Error getting mailboxes:', error);
      throw error;
    }
  }

  @Get('emails/:mailbox')
  @UseGuards(JwtAuthGuard)
  async getEmails(@Req() req: any, @Param('mailbox') mailbox: string) {
    try {
      console.log('[IMAP] 📧 Fetching emails from mailbox:', mailbox, 'for user:', req.user.sub);
      const userId = req.user.sub;
      const dbUser = await this.usersService.findById(userId);
      
      console.log('[IMAP] User found:', dbUser?.email, 'Has imapConfig:', !!(dbUser as any)?.imapConfig);
      
      if (!dbUser || !(dbUser as any).imapConfig) {
        console.error('[IMAP] ❌ IMAP configuration not found for user:', userId);
        throw new NotFoundException('IMAP configuration not found');
      }

      const imapConfig = (dbUser as any).imapConfig;
      const encryptedPassword = (dbUser as any).imapPassword;
      console.log('[IMAP] Decrypting password...');
      
      const password = this.encryptionService.decrypt(encryptedPassword);
      console.log('[IMAP] Password decrypted');

      console.log('[IMAP] Connecting to IMAP server...');
      const connection = await this.imapService.connectImap({
        user: imapConfig.user || (dbUser as any).email,
        password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
      });
      console.log('[IMAP] Connected! Fetching emails...');

      // Map normalized ID back to real IMAP mailbox name
      const getRealMailboxName = async (normalizedId: string): Promise<string> => {
        if (normalizedId === 'INBOX') return 'INBOX';
        
        // Get mailboxes to find the real name
        const boxes = await connection.getBoxes();
        const findMailbox = (boxesObj: any, prefix: string = ''): string | null => {
          for (const [name, box] of Object.entries(boxesObj)) {
            const boxData = box as any;
            const fullName = prefix ? `${prefix}${boxData.delimiter || '/'}${name}` : name;
            const lower = fullName.toLowerCase();
            
            if (normalizedId === 'SENT' && (lower.includes('sent') || lower.includes('đã gửi'))) return fullName;
            if (normalizedId === 'DRAFT' && (lower.includes('draft') || lower.includes('nháp'))) return fullName;
            if (normalizedId === 'TRASH' && (lower.includes('trash') || lower.includes('thùng rác'))) return fullName;
            if (normalizedId === 'SPAM' && (lower.includes('spam') || lower.includes('thư rác'))) return fullName;
            if (normalizedId === 'STARRED' && (lower.includes('starred') || lower.includes('gắn dấu sao'))) return fullName;
            if (normalizedId === 'IMPORTANT' && (lower.includes('important') || lower.includes('quan trọng'))) return fullName;
            if (normalizedId === 'ALL' && (lower.includes('all') || lower.includes('tất cả'))) return fullName;
            
            if (boxData.children) {
              const found = findMailbox(boxData.children, fullName);
              if (found) return found;
            }
          }
          return null;
        };
        
        return findMailbox(boxes) || normalizedId;
      };

      const realMailboxName = await getRealMailboxName(mailbox);
      console.log('[IMAP] Normalized mailbox:', mailbox, '→ Real mailbox:', realMailboxName);

      const emails = await this.imapService.getEmails(connection, realMailboxName, 50);
      console.log('[IMAP] Fetched', emails.length, 'emails');
      console.log('[IMAP] Sample email:', emails[0]);
      await this.imapService.closeConnection(connection);

      console.log('[IMAP] Returning emails to frontend...');
      return emails;
    } catch (error) {
      console.error('[IMAP Controller] Error getting emails:', error);
      throw error;
    }
  }

  @Get('email/:mailbox/:uid')
  @UseGuards(JwtAuthGuard)
  async getEmailDetail(@Req() req: any, @Param('mailbox') mailbox: string, @Param('uid') uid: string) {
    try {
      console.log('[IMAP] 📧 Fetching email detail - mailbox:', mailbox, 'uid:', uid);
      const userId = req.user.sub;
      const dbUser = await this.usersService.findById(userId);
      
      if (!dbUser || !(dbUser as any).imapConfig) {
        console.error('[IMAP] ❌ IMAP configuration not found for user:', userId);
        throw new NotFoundException('IMAP configuration not found');
      }

      const imapConfig = (dbUser as any).imapConfig;
      const encryptedPassword = (dbUser as any).imapPassword;
      const password = this.encryptionService.decrypt(encryptedPassword);

      const connection = await this.imapService.connectImap({
        user: imapConfig.user || (dbUser as any).email,
        password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
      });

      const emailDetail = await this.imapService.getEmailDetail(connection, mailbox, uid);
      await this.imapService.closeConnection(connection);
      
      console.log('[IMAP] ✅ Email detail fetched:', emailDetail.subject);
      return emailDetail;
    } catch (error) {
      console.error('[IMAP Controller] Error getting email detail:', error);
      throw error;
    }
  }

  @Post('emails/:mailbox/:uid/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(
    @Req() req: any,
    @Param('mailbox') mailbox: string,
    @Param('uid') uid: string,
    @Body() body: { read: boolean }
  ) {
    try {
      const userId = req.user.sub;
      const dbUser = await this.usersService.findById(userId);
      
      if (!dbUser || !(dbUser as any).imapConfig) {
        throw new NotFoundException('IMAP configuration not found');
      }

      const imapConfig = (dbUser as any).imapConfig;
      const password = this.encryptionService.decrypt((dbUser as any).imapPassword);

      const connection = await this.imapService.connectImap({
        user: imapConfig.user || dbUser.email,
        password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
      });

      // Map normalized mailbox ID to real IMAP name
      const getRealMailboxName = async (normalizedId: string): Promise<string> => {
        if (normalizedId === 'INBOX') return 'INBOX';
        const boxes = await connection.getBoxes();
        const findMailbox = (boxesObj: any, prefix: string = ''): string | null => {
          for (const [name, box] of Object.entries(boxesObj)) {
            const boxData = box as any;
            const fullName = prefix ? `${prefix}${boxData.delimiter || '/'}${name}` : name;
            const lower = fullName.toLowerCase();
            if (normalizedId === 'SENT' && (lower.includes('sent') || lower.includes('đã gửi'))) return fullName;
            if (normalizedId === 'DRAFT' && (lower.includes('draft') || lower.includes('nháp'))) return fullName;
            if (normalizedId === 'TRASH' && (lower.includes('trash') || lower.includes('thùng rác'))) return fullName;
            if (normalizedId === 'SPAM' && (lower.includes('spam') || lower.includes('thư rác'))) return fullName;
            if (normalizedId === 'STARRED' && (lower.includes('starred') || lower.includes('gắn dấu sao'))) return fullName;
            if (boxData.children) {
              const found = findMailbox(boxData.children, fullName);
              if (found) return found;
            }
          }
          return null;
        };
        return findMailbox(boxes) || normalizedId;
      };
      const realMailboxName = await getRealMailboxName(mailbox);

      await this.imapService.markAsRead(connection, realMailboxName, uid, body.read);
      await this.imapService.closeConnection(connection);

      return { success: true };
    } catch (error) {
      console.error('[IMAP Controller] Error marking email:', error);
      throw error;
    }
  }

  @Post('emails/:mailbox/:uid/star')
  @UseGuards(JwtAuthGuard)
  async toggleStar(
    @Req() req: any,
    @Param('mailbox') mailbox: string,
    @Param('uid') uid: string,
    @Body() body: { starred: boolean }
  ) {
    try {
      const userId = req.user.sub;
      const dbUser = await this.usersService.findById(userId);
      
      if (!dbUser || !(dbUser as any).imapConfig) {
        throw new NotFoundException('IMAP configuration not found');
      }

      const imapConfig = (dbUser as any).imapConfig;
      const password = this.encryptionService.decrypt((dbUser as any).imapPassword);

      const connection = await this.imapService.connectImap({
        user: imapConfig.user || dbUser.email,
        password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
      });

      // Map normalized mailbox ID to real IMAP name
      const getRealMailboxName = async (normalizedId: string): Promise<string> => {
        if (normalizedId === 'INBOX') return 'INBOX';
        const boxes = await connection.getBoxes();
        const findMailbox = (boxesObj: any, prefix: string = ''): string | null => {
          for (const [name, box] of Object.entries(boxesObj)) {
            const boxData = box as any;
            const fullName = prefix ? `${prefix}${boxData.delimiter || '/'}${name}` : name;
            const lower = fullName.toLowerCase();
            if (normalizedId === 'SENT' && (lower.includes('sent') || lower.includes('đã gửi'))) return fullName;
            if (normalizedId === 'DRAFT' && (lower.includes('draft') || lower.includes('nháp'))) return fullName;
            if (normalizedId === 'TRASH' && (lower.includes('trash') || lower.includes('thùng rác'))) return fullName;
            if (normalizedId === 'SPAM' && (lower.includes('spam') || lower.includes('thư rác'))) return fullName;
            if (normalizedId === 'STARRED' && (lower.includes('starred') || lower.includes('gắn dấu sao'))) return fullName;
            if (boxData.children) {
              const found = findMailbox(boxData.children, fullName);
              if (found) return found;
            }
          }
          return null;
        };
        return findMailbox(boxes) || normalizedId;
      };
      const realMailboxName = await getRealMailboxName(mailbox);

      await this.imapService.toggleStar(connection, realMailboxName, uid, body.starred);
      await this.imapService.closeConnection(connection);

      return { success: true };
    } catch (error) {
      console.error('[IMAP Controller] Error toggling star:', error);
      throw error;
    }
  }

  @Post('emails/:mailbox/:uid/delete')
  @UseGuards(JwtAuthGuard)
  async deleteEmail(
    @Req() req: any,
    @Param('mailbox') mailbox: string,
    @Param('uid') uid: string
  ) {
    try {
      const userId = req.user.sub;
      const dbUser = await this.usersService.findById(userId);
      
      if (!dbUser || !(dbUser as any).imapConfig) {
        throw new NotFoundException('IMAP configuration not found');
      }

      const imapConfig = (dbUser as any).imapConfig;
      const password = this.encryptionService.decrypt((dbUser as any).imapPassword);

      const connection = await this.imapService.connectImap({
        user: imapConfig.user || dbUser.email,
        password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.tls,
      });

      // Map normalized mailbox ID to real IMAP name
      const getRealMailboxName = async (normalizedId: string): Promise<string> => {
        if (normalizedId === 'INBOX') return 'INBOX';
        const boxes = await connection.getBoxes();
        const findMailbox = (boxesObj: any, prefix: string = ''): string | null => {
          for (const [name, box] of Object.entries(boxesObj)) {
            const boxData = box as any;
            const fullName = prefix ? `${prefix}${boxData.delimiter || '/'}${name}` : name;
            const lower = fullName.toLowerCase();
            if (normalizedId === 'SENT' && (lower.includes('sent') || lower.includes('đã gửi'))) return fullName;
            if (normalizedId === 'DRAFT' && (lower.includes('draft') || lower.includes('nháp'))) return fullName;
            if (normalizedId === 'TRASH' && (lower.includes('trash') || lower.includes('thùng rác'))) return fullName;
            if (normalizedId === 'SPAM' && (lower.includes('spam') || lower.includes('thư rác'))) return fullName;
            if (normalizedId === 'STARRED' && (lower.includes('starred') || lower.includes('gắn dấu sao'))) return fullName;
            if (boxData.children) {
              const found = findMailbox(boxData.children, fullName);
              if (found) return found;
            }
          }
          return null;
        };
        return findMailbox(boxes) || normalizedId;
      };
      const realMailboxName = await getRealMailboxName(mailbox);

      await this.imapService.deleteEmail(connection, realMailboxName, uid);
      await this.imapService.closeConnection(connection);

      return { success: true };
    } catch (error) {
      console.error('[IMAP Controller] Error deleting email:', error);
      throw error;
    }
  }

  @Post('send')
  @UseGuards(JwtAuthGuard)
  async sendEmail(
    @Req() req: any,
    @Body() data: { to: string; subject: string; body: string; html?: string; cc?: string; bcc?: string }
  ) {
    try {
      const userId = req.user.sub;
      const dbUser = await this.usersService.findById(userId);
      
      if (!dbUser || (!(dbUser as any).smtpConfig && !(dbUser as any).imapConfig)) {
        throw new NotFoundException('SMTP/IMAP configuration not found');
      }

      // Use SMTP config if available, otherwise derive from IMAP config
      let smtpConfig = (dbUser as any).smtpConfig;
      if (!smtpConfig && (dbUser as any).imapConfig) {
        const imapConfig = (dbUser as any).imapConfig;
        // Derive SMTP config from IMAP (typically same host, different port)
        smtpConfig = {
          host: imapConfig.host.replace('imap', 'smtp'),
          port: 587, // Standard SMTP port with STARTTLS
          tls: true,
        };
        console.log('[IMAP] No SMTP config found, derived from IMAP:', smtpConfig);
      }

      const password = this.encryptionService.decrypt((dbUser as any).imapPassword);

      console.log('[IMAP] Sending email with config:', {
        user: dbUser.email,
        smtpHost: smtpConfig.host,
        smtpPort: smtpConfig.port,
        smtpTls: smtpConfig.tls,
        to: data.to,
        subject: data.subject,
        hasHtml: !!data.html,
        hasCc: !!data.cc,
        hasBcc: !!data.bcc,
      });

      const result = await this.imapService.sendEmail(
        {
          user: dbUser.email,
          password,
          host: smtpConfig.host,
          port: smtpConfig.port,
          tls: smtpConfig.tls,
        },
        data.to,
        data.subject,
        data.body,
        data.html,
        data.cc,
        data.bcc,
      );

      console.log('[IMAP] Email sent successfully:', result);
      return result;
    } catch (error) {
      const err = error as any;
      console.error('[IMAP Controller] ❌ Error sending email:', {
        message: err.message,
        code: err.code,
        command: err.command,
        response: err.response,
        stack: err.stack,
      });
      throw error;
    }
  }
}
