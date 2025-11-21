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
  constructor(private readonly gmailService: GmailService) {}

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

  @Delete('emails')
  deleteEmails(@Request() req: ExpressRequest, @Body('ids') messageIds: string[]) {
    return this.gmailService.deleteEmails((req.user as any).userId, messageIds);
  }

  @Post('send')
  sendEmail(
    @Request() req: ExpressRequest,
    @Body('to') to: string,
    @Body('subject') subject: string,
    @Body('body') body: string,
    @Body('cc') cc?: string,
    @Body('bcc') bcc?: string,
  ) {
    return this.gmailService.sendEmail(
      (req.user as any).userId,
      to,
      subject,
      body,
      cc,
      bcc,
    );
  }
}
