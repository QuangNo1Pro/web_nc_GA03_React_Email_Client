/**
 * FEATURE III: Snooze Scheduler Service
 * 
 * Background worker that periodically checks for expired snoozed emails
 * and automatically restores them to their original status.
 * 
 * PRODUCTION: Use node-cron for scheduled jobs or Bull/Redis for distributed queue
 * DEMO: Simple setInterval for local testing
 */

import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GmailService } from './gmail.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class SnoozeSchedulerService {
  private readonly logger = new Logger(SnoozeSchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly usersService: UsersService,
    private readonly gmailService: GmailService,
  ) {}

  /**
   * Cron job that runs every minute to check for expired snoozes
   * Uses @nestjs/schedule (built on node-cron)
   * 
   * For production: Consider Bull/Redis for distributed task queue
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredSnoozes() {
    // Prevent concurrent executions
    if (this.isProcessing) {
      this.logger.debug('Snooze processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    this.logger.log('🔔 Checking for expired snoozed emails...');

    try {
      // Find all emails where snoozed=true AND snoozedUntil <= now
      const expiredEmails = await this.usersService.findExpiredSnoozedEmails();

      if (expiredEmails.length === 0) {
        this.logger.debug('No expired snoozed emails found');
        return;
      }

      this.logger.log(`Found ${expiredEmails.length} expired snoozed emails`);

      // Process each expired email
      const results = await Promise.allSettled(
        expiredEmails.map(async (email) => {
          try {
            this.logger.log(`Unsnoozing email ${email.messageId} for user ${email.userId}`);
            
            // Call unsnooze service (handles restore logic)
            await this.gmailService.unsnoozeEmail(email.userId, email.messageId);
            
            this.logger.log(`✅ Successfully unsnoozed ${email.messageId}`);
            return { success: true, messageId: email.messageId };
          } catch (err: any) {
            this.logger.error(`❌ Failed to unsnooze ${email.messageId}: ${err.message}`);
            return { success: false, messageId: email.messageId, error: err.message };
          }
        })
      );

      // Log summary
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      this.logger.log(`Snooze processing complete: ${successful} successful, ${failed} failed`);

    } catch (err: any) {
      this.logger.error(`Error processing expired snoozes: ${err.message}`, err.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manual trigger for testing (called via API endpoint if needed)
   */
  async triggerManualCheck() {
    this.logger.log('📞 Manual snooze check triggered');
    return this.processExpiredSnoozes();
  }
}
