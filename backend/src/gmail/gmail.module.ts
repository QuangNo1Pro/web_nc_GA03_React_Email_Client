import { Module } from '@nestjs/common';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';
import { SseService } from './sse.service';
import { GmailPollingService } from './gmail-polling.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [GmailController],
  providers: [GmailService, SseService, GmailPollingService],
  exports: [GmailService, SseService, GmailPollingService],
})
export class GmailModule {}