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

      // Convert boxes object to array format similar to Gmail
      const mailboxes = Object.keys(boxes).map((name) => ({
        id: name,
        name: name,
        messagesTotal: 0,
        messagesUnread: 0,
      }));

      console.log('[IMAP] Returning mailboxes:', mailboxes);
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

      const emails = await this.imapService.getEmails(connection, mailbox, 50);
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

  @Post('send')
  @UseGuards(JwtAuthGuard)
  async sendEmail(
    @Req() req: any,
    @Body() data: { to: string; subject: string; body: string; html?: string }
  ) {
    try {
      const user = req.user;
      // TODO: Retrieve IMAP config from database for this user
      // const result = await this.imapService.sendEmail(
      //   user.imapConfig,
      //   data.to,
      //   data.subject,
      //   data.body,
      //   data.html
      // );
      // return result;
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
}
