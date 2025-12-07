import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
  Query,
  Patch,
  Body,
  Delete,
  Post,
  Res,
  Req,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GmailService } from './gmail.service';
import { SseService } from './sse.service';
import { GmailPollingService } from './gmail-polling.service';
import { UsersService } from '../users/users.service';
import { Request as ExpressRequest, Response } from 'express';

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly sseService: SseService,
    private readonly gmailPollingService: GmailPollingService,
    private readonly usersService: UsersService,
  ) { }

  // ========== SSE ENDPOINT (Real-time updates) ==========
  @Get('events')
  @UseGuards(AuthGuard('jwt'))
  async streamEvents(@Req() req: ExpressRequest, @Res() res: Response) {
    const userId = (req.user as any).userId;

    console.log(`[SSE] ✅ Client connecting: ${userId}`);
    console.log(`[SSE] Request headers:`, req.headers);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Prevent response timeout
    res.setTimeout(0);

    // Register connection
    this.sseService.addConnection(userId, res);

    // Get user to check provider
    const user = await this.usersService.findById(userId);
    const provider = user ? ((user as any).provider || 'google') : 'google';

    // Start polling based on provider
    console.log(`[Polling] ⏰ Starting polling for user ${userId} (provider: ${provider})`);
    this.gmailPollingService.startPollingForUser(userId);

    // Send initial connected event with provider info
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ type: 'connected', userId, provider })}\n\n`);

    // Heartbeat every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (err) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      this.sseService.removeConnection(userId, res);
      console.log(`[SSE] Client disconnected: ${userId}`);
      
      // Stop polling if user has no more SSE connections
      if (this.sseService.getConnectionCount(userId) === 0) {
        this.gmailPollingService.stopPollingForUser(userId);
        console.log(`[Polling] Stopped for user ${userId} (no connections)`);
      }
    });
  }

  // ========== WEBHOOK ENDPOINT (Pub/Sub notifications) ==========
  @Post('webhook/pubsub')
  async handlePubSubWebhook(
    @Headers('authorization') auth: string,
    @Body() body: any,
  ) {
    console.log('[Webhook] Received Pub/Sub notification');

    try {
      // TODO: Add PubSubGuard để verify token từ Google
      // Hiện tại skip verification cho testing

      const message = body.message;
      if (!message || !message.data) {
        console.warn('[Webhook] Invalid message format');
        return { success: false, error: 'Invalid message format' };
      }

      // Decode base64 data
      const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
      const notification = JSON.parse(decodedData);

      console.log('[Webhook] Decoded notification:', notification);

      const { emailAddress, historyId } = notification;

      if (!emailAddress || !historyId) {
        console.warn('[Webhook] Missing emailAddress or historyId');
        return { success: false, error: 'Missing required fields' };
      }

      // Process asynchronously (fire-and-forget)
      this.gmailService.processPubSubNotification(emailAddress, historyId)
        .catch(err => console.error('[Webhook] Processing error:', err));

      return { success: true };
    } catch (err) {
      console.error('[Webhook] Parse error:', err);
      return { success: false, error: (err as any).message };
    }
  }

  // ========== DEBUG ENDPOINTS ==========
  @Get('debug/polling-status')
  @UseGuards(AuthGuard('jwt'))
  getPollingStatus(@Request() req: ExpressRequest) {
    const userId = (req.user as any).userId;
    const activeCount = this.gmailPollingService.getActivePollingCount();
    const sseCount = this.sseService.getConnectionCount(userId);
    
    return {
      userId,
      activePollingUsers: activeCount,
      userSseConnections: sseCount,
      isPolling: activeCount > 0,
    };
  }

  @Post('debug/force-poll')
  @UseGuards(AuthGuard('jwt'))
  async forcePoll(@Request() req: ExpressRequest) {
    const userId = (req.user as any).userId;
    // Trigger incremental sync manually
    const result = await this.gmailService.incrementalSync(userId);
    return {
      success: true,
      result,
    };
  }

  // ========== EXISTING ENDPOINTS ==========
  @Get('mailboxes')
  @UseGuards(AuthGuard('jwt'))
  async getMailboxes(@Request() req: ExpressRequest) {
    const user = await this.usersService.findById((req.user as any).userId);
    const provider = user ? (user as any).provider : null;
    
    // If IMAP user, return empty to prevent errors
    if (provider === 'imap') {
      console.log('[Gmail Controller] IMAP user accessing Gmail endpoint, returning empty');
      return [];
    }
    
    return this.gmailService.getMailboxes((req.user as any).userId);
  }

  @Get('mailboxes/:labelId/emails')
  @UseGuards(AuthGuard('jwt'))
  async getEmails(
    @Request() req: ExpressRequest,
    @Param('labelId') labelId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    const user = await this.usersService.findById((req.user as any).userId);
    const provider = user ? (user as any).provider : null;
    
    // If IMAP user, return empty to prevent errors
    if (provider === 'imap') {
      console.log('[Gmail Controller] IMAP user accessing Gmail endpoint, returning empty');
      return { messages: [], nextPageToken: undefined };
    }
    
    return this.gmailService.getEmails(
      (req.user as any).userId,
      labelId,
      pageToken,
    );
  }

  @Get('emails/:messageId')
  @UseGuards(AuthGuard('jwt'))
  getEmail(@Request() req: ExpressRequest, @Param('messageId') messageId: string) {
    return this.gmailService.getEmail((req.user as any).userId, messageId);
  }

  @Patch('emails/:messageId/star')
  @UseGuards(AuthGuard('jwt'))
  setStarred(
    @Request() req: ExpressRequest,
    @Param('messageId') messageId: string,
    @Body('starred') starred: boolean,
  ) {
    return this.gmailService.setEmailStarred(
      (req.user as any).userId,
      messageId,
      starred,
    );
  }

  @Patch('emails/:messageId/read')
  @UseGuards(AuthGuard('jwt'))
  setRead(
    @Request() req: ExpressRequest,
    @Param('messageId') messageId: string,
    @Body('read') read: boolean,
  ) {
    return this.gmailService.setEmailRead(
      (req.user as any).userId,
      messageId,
      read,
    );
  }

  @Patch('emails/bulk-read')
  @UseGuards(AuthGuard('jwt'))
  async bulkSetRead(
    @Request() req: ExpressRequest,
    @Body('ids') ids: string[],
    @Body('read') read: boolean,
  ) {
    return this.gmailService.bulkSetEmailRead(
      (req.user as any).userId,
      ids,
      read,
    );
  }

  @Delete('emails/:messageId')
  @UseGuards(AuthGuard('jwt'))
  deleteEmail(
    @Request() req: ExpressRequest,
    @Param('messageId') messageId: string,
  ) {
    return this.gmailService.deleteEmail(
      (req.user as any).userId,
      messageId,
    );
  }

  @Patch('emails/:messageId/archive')
  @UseGuards(AuthGuard('jwt'))
  archiveEmail(
    @Request() req: ExpressRequest,
    @Param('messageId') messageId: string,
  ) {
    return this.gmailService.archiveEmail(
      (req.user as any).userId,
      messageId,
    );
  }

  @Patch('emails/:messageId/spam')
  @UseGuards(AuthGuard('jwt'))
  moveToSpam(
  @Request() req: ExpressRequest,
  @Param('messageId') messageId: string,
) {
  return this.gmailService.moveEmailToSpam(
    (req.user as any).userId,
    messageId,
  );
}

  @Post("emails/:id/move")
  @UseGuards(AuthGuard('jwt'))
  async moveEmail(
  @Request() req: ExpressRequest,
  @Param("id") id: string,
  @Body() body: { label: string }
) {
  return this.gmailService.moveEmail(
    (req.user as any).userId,
    id,
    body.label
  );
}

  @Post('draft')
  @UseGuards(AuthGuard('jwt'))
  async saveDraft(
  @Request() req: ExpressRequest,
  @Body() body: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachments?: { filename: string; mimeType: string; base64Content: string }[];
    draftId?: string; // Thêm draftId để update draft
  }
) {
  return this.gmailService.saveDraft(
    (req.user as any).userId,
    body.to,
    body.subject,
    body.body,
    body.cc,
    body.bcc,
    body.attachments,
    body.draftId, // Pass draftId
  );
}

  @Post('send')
  @UseGuards(AuthGuard('jwt'))
  sendEmail(
    @Request() req: ExpressRequest,
    @Body('to') to: string,
    @Body('subject') subject: string,
    @Body('body') body: string,
    @Body('cc') cc?: string,
    @Body('bcc') bcc?: string,
    @Body('attachments') attachments?: { filename: string; mimeType: string; base64Content: string }[],
  ) {
    return this.gmailService.sendEmail(
      (req.user as any).userId,
      to,
      subject,
      body,
      cc,
      bcc,
      attachments,
    );
  }

  @Get('attachments/:messageId/:attachmentId')
  @UseGuards(AuthGuard('jwt'))
  getAttachment(
    @Request() req: ExpressRequest,
    @Param('messageId') messageId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.gmailService.getAttachment(
      (req.user as any).userId,
      messageId,
      attachmentId,
    );
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt'))
  refreshMailboxesAndEmails(@Request() req: ExpressRequest) {
    return this.gmailService.incrementalSync((req.user as any).userId);
  }
}
