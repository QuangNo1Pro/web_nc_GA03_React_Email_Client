/**
 * Summary Queue Manager
 * Prevents rate limiting by processing email summaries one at a time
 * with configurable delay between requests
 */

type SummaryTask = {
  emailId: string;
  resolve: (summary: string) => void;
  reject: (error: any) => void;
};

class SummaryQueueManager {
  private queue: SummaryTask[] = [];
  private isProcessing = false;
  private delayBetweenRequests = 1000; // 1 second delay to avoid rate limit
  private maxRetries = 2;

  /**
   * Add email to summary generation queue
   */
  async addToQueue(emailId: string, generateFn: (id: string) => Promise<string>): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ emailId, resolve, reject });
      
      if (!this.isProcessing) {
        this.processQueue(generateFn);
      }
    });
  }

  /**
   * Process queue one by one with delay
   */
  private async processQueue(generateFn: (id: string) => Promise<string>) {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) break;

      let retries = 0;
      let success = false;

      while (retries <= this.maxRetries && !success) {
        try {
          const summary = await generateFn(task.emailId);
          task.resolve(summary);
          success = true;
        } catch (error: any) {
          // If rate limited (429), wait longer before retry
          if (error.response?.status === 429) {
            console.warn(`[SummaryQueue] Rate limited, waiting 5s before retry...`);
            await this.delay(5000);
            retries++;
          } else {
            // Other errors, reject immediately
            task.reject(error);
            success = true; // Exit retry loop
          }
        }
      }

      if (!success) {
        task.reject(new Error('Max retries exceeded'));
      }

      // Delay before next request to avoid rate limiting
      if (this.queue.length > 0) {
        await this.delay(this.delayBetweenRequests);
      }
    }

    this.isProcessing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue
   */
  clearQueue() {
    this.queue.forEach(task => {
      task.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

// Export singleton instance
export const summaryQueue = new SummaryQueueManager();
