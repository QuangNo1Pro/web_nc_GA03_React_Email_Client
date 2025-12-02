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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GmailService } from './gmail.service';
import { Request as ExpressRequest } from 'express';

@Controller('gmail')
@UseGuards(AuthGuard('jwt'))
export class GmailController {
  constructor(private readonly gmailService: GmailService) { }

  @Get('mailboxes')
  getMailboxes(@Request() req: ExpressRequest) {
    return this.gmailService.getMailboxes((req.user as any).userId);
  }

  @Get('mailboxes/:labelId/emails')
  getEmails(
    @Request() req: ExpressRequest,
    @Param('labelId') labelId: string,
    @Query('pageToken') pageToken?: string,
  ) {
    return this.gmailService.getEmails(
      (req.user as any).userId,
      labelId,
      pageToken,
    );
  }

  @Get('emails/:messageId')
  getEmail(@Request() req: ExpressRequest, @Param('messageId') messageId: string) {
    return this.gmailService.getEmail((req.user as any).userId, messageId);
  }

  @Patch('emails/:messageId/star')
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
async saveDraft(
  @Request() req: ExpressRequest,
  @Body() body: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachments?: { filename: string; mimeType: string; base64Content: string }[];
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
  );
}

  @Post('send')
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
  refreshMailboxesAndEmails(@Request() req: ExpressRequest) {
    return this.gmailService.incrementalSync((req.user as any).userId);
  }
}
