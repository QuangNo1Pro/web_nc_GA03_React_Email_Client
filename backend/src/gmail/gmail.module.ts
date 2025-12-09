import { Module } from '@nestjs/common';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';
import { SseService } from './sse.service';
import { GmailPollingService } from './gmail-polling.service';
import { SnoozeSchedulerService } from './snooze-scheduler.service'; // FEATURE III
import { GmailLabelService } from './gmail-label.service'; // FEATURE III: Gmail label sync
import { UsersModule } from '../users/users.module';
import { SummarizationModule } from '../summarization/summarization.module'; // FEATURE IV: AI Summarization

@Module({
  imports: [UsersModule, SummarizationModule],
  controllers: [GmailController],
  providers: [
    GmailService,
    SseService,
    GmailPollingService,
    SnoozeSchedulerService, // FEATURE III: Snooze scheduler
    GmailLabelService, // FEATURE III: Gmail label operations
  ],
  exports: [GmailService, SseService, GmailPollingService, SnoozeSchedulerService, GmailLabelService],
})
export class GmailModule {}