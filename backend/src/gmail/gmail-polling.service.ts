import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { GmailService } from './gmail.service';
import { SseService } from './sse.service';

@Injectable()
export class GmailPollingService implements OnModuleInit, OnModuleDestroy {
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private readonly POLLING_INTERVAL = 10000; // 10 giây (nhanh hơn cho testing)

  constructor(
    private readonly usersService: UsersService,
    private readonly gmailService: GmailService,
    private readonly sseService: SseService,
  ) {}

  async onModuleInit() {
    console.log('[Gmail Polling] Service initialized');
  }

  onModuleDestroy() {
    // Clear all polling intervals khi service bị destroy
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();
    console.log('[Gmail Polling] All intervals cleared');
  }

  /**
   * Bắt đầu polling cho 1 user
   */
  startPollingForUser(userId: string) {
    // Nếu đã polling rồi thì bỏ qua
    if (this.pollingIntervals.has(userId)) {
      console.log(`[Gmail Polling] User ${userId} already polling`);
      return;
    }

    console.log(`[Gmail Polling] Starting polling for user ${userId}`);

    // Poll ngay lần đầu
    this.pollGmailForUser(userId);

    // Sau đó poll định kỳ mỗi 30s
    const interval = setInterval(() => {
      this.pollGmailForUser(userId);
    }, this.POLLING_INTERVAL);

    this.pollingIntervals.set(userId, interval);
  }

  /**
   * Dừng polling cho 1 user
   */
  stopPollingForUser(userId: string) {
    const interval = this.pollingIntervals.get(userId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(userId);
      console.log(`[Gmail Polling] Stopped polling for user ${userId}`);
    }
  }

  /**
   * Kiểm tra Gmail có email mới không
   */
  private async pollGmailForUser(userId: string) {
    try {
      console.log(`[Gmail Polling] 🔄 Polling for user ${userId}...`);
      
      // 1. Lấy lastHistoryId từ DB
      const lastHistoryId = await this.usersService.getLastHistoryId(userId);
      console.log(`[Gmail Polling] Last historyId: ${lastHistoryId || 'none (will do full sync)'}`);

      // 2. Lấy Gmail client để fetch profile
      const user = await this.usersService.findById(userId);
      if (!user || !user.googleAccessToken) {
        console.warn(`[Gmail Polling] User ${userId} not authenticated`);
        this.stopPollingForUser(userId);
        return;
      }

      // Use GmailService's private method via a workaround
      // Since we can't call private methods, we'll use incrementalSync instead
      const result = await this.gmailService.incrementalSync(userId);
      console.log(`[Gmail Polling] Result:`, JSON.stringify(result));

      // 3. Nếu có thay đổi, broadcast SSE
      // Check if result has 'changed' and 'deleted' properties (incremental sync)
      if (result && 'changed' in result && 'deleted' in result) {
        if (result.changed > 0 || result.deleted > 0) {
          console.log(`[Gmail Polling] User ${userId} has ${result.changed} changes, ${result.deleted} deletions`);
          
          this.sseService.broadcast(userId, {
            type: 'gmail-updated',
            userId,
            data: {
              newMessagesCount: result.changed,
              deletedCount: result.deleted,
            },
          });
        }
      } else if (result && 'emails' in result) {
        // Full sync happened - notify about all emails
        console.log(`[Gmail Polling] User ${userId} full sync: ${result.emails} emails`);
        this.sseService.broadcast(userId, {
          type: 'gmail-updated',
          userId,
          data: {
            fullSync: true,
            totalEmails: result.emails,
          },
        });
      }
    } catch (err: any) {
      console.error(`[Gmail Polling] Error polling for user ${userId}:`, err.message);
      
      // Nếu auth error, dừng polling
      if (err.message?.includes('authentication') || err.message?.includes('invalid_grant')) {
        console.warn(`[Gmail Polling] Auth error for user ${userId}, stopping polling`);
        this.stopPollingForUser(userId);
      }
    }
  }

  /**
   * Lấy số lượng user đang được poll
   */
  getActivePollingCount(): number {
    return this.pollingIntervals.size;
  }
}
