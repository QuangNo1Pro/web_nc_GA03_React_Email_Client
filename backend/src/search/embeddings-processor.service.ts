import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmbeddingsService } from '../ai/embeddings.service';

/**
 * 🧠 EmbeddingsProcessorService
 * 
 * Generates and stores vector embeddings for emails asynchronously.
 * Used for Semantic Search (Feature I).
 * 
 * Workflow:
 * 1. When emails are saved via incrementalSync or prefetch
 * 2. This service generates embeddings for emails WITHOUT embeddings
 * 3. Embeddings are stored in MongoDB for semantic search
 * 4. Process runs in background (non-blocking)
 */
@Injectable()
export class EmbeddingsProcessorService {
  private readonly logger = new Logger(EmbeddingsProcessorService.name);
  private processingQueue: Set<string> = new Set(); // Track emails being processed

  constructor(
    @InjectModel('Email') private emailModel: Model<any>,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  /**
   * 🎯 Generate embeddings for new/updated emails (non-blocking)
   * Called after emails are saved to database
   */
  async processEmailEmbeddings(userId: string, emailIds?: string[]): Promise<void> {
    try {
      this.logger.log(`[EmbeddingsProcessor] Starting for user ${userId}${emailIds ? ` (${emailIds.length} emails)` : ''}`);

      // If specific emailIds provided, process those
      // Otherwise, find emails without embeddings
      let emailsToProcess;

      if (emailIds && emailIds.length > 0) {
        emailsToProcess = await this.emailModel
          .find({ userId, _id: { $in: emailIds } })
          .select('_id messageId payload snippet')
          .lean()
          .exec();
      } else {
        // Find emails without embeddings (limit to 50 per run to avoid overload)
        emailsToProcess = await this.emailModel
          .find({ userId, embedding: { $exists: false } })
          .select('_id messageId payload snippet')
          .limit(50)
          .lean()
          .exec();
      }

      if (emailsToProcess.length === 0) {
        this.logger.log(`[EmbeddingsProcessor] No emails to process for user ${userId}`);
        return;
      }

      this.logger.log(`[EmbeddingsProcessor] Processing ${emailsToProcess.length} emails for user ${userId}`);

      // Process embeddings in parallel (max 5 at a time to avoid API rate limits)
      const batchSize = 5;
      for (let i = 0; i < emailsToProcess.length; i += batchSize) {
        const batch = emailsToProcess.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(email => this.generateEmbeddingForEmail(email))
        );

        // Rate limiting
        if (i + batchSize < emailsToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      this.logger.log(`[EmbeddingsProcessor] ✅ Completed processing ${emailsToProcess.length} emails for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`[EmbeddingsProcessor] Error: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw - let the process continue. Embedding generation is optional.
    }
  }

  /**
   * 🔄 Process single email embedding
   */
  private async generateEmbeddingForEmail(email: any): Promise<void> {
    const emailId = email._id?.toString() || email.messageId;

    // Skip if already processing
    if (this.processingQueue.has(emailId)) {
      return;
    }

    this.processingQueue.add(emailId);

    try {
      // Extract subject and body
      const subject = this.extractSubject(email.payload) || '';
      const body = email.snippet || '';

      // Combine subject + snippet for embedding
      const textToEmbed = `${subject} ${body}`.trim();

      if (!textToEmbed || textToEmbed.length < 5) {
        this.logger.warn(`[EmbeddingsProcessor] Skipping email ${emailId}: insufficient text`);
        return;
      }

      // Generate embedding
      const embedding = await this.embeddingsService.embedText(textToEmbed);

      if (!embedding || embedding.length === 0) {
        this.logger.warn(`[EmbeddingsProcessor] Failed to generate embedding for email ${emailId}`);
        return;
      }

      // Store embedding in database
      await this.emailModel.updateOne(
        { _id: email._id },
        { $set: { embedding, embeddingGeneratedAt: new Date() } }
      );

      this.logger.debug(`[EmbeddingsProcessor] ✅ Generated embedding for email ${emailId} (${embedding.length}D)`);
    } catch (error: any) {
      this.logger.error(`[EmbeddingsProcessor] Error processing email ${emailId}: ${error.message}`);
      // Don't rethrow - continue with next email
    } finally {
      this.processingQueue.delete(emailId);
    }
  }

  /**
   * Extract subject from email payload headers
   */
  private extractSubject(payload: any): string {
    if (!payload) return '';
    const headers = payload.headers || [];
    const subjectHeader = headers.find((h: any) => h.name === 'Subject');
    return subjectHeader?.value || '';
  }

  /**
   * 🗑️ Clean up embeddings for deleted emails
   */
  async cleanupDeletedEmails(userId: string): Promise<void> {
    try {
      // This would be called periodically to clean up embeddings
      // for emails that no longer exist in database
      this.logger.log(`[EmbeddingsProcessor] Running cleanup for user ${userId}`);
      // Implementation depends on your cleanup strategy
    } catch (error: any) {
      this.logger.error(`[EmbeddingsProcessor] Cleanup error: ${error.message}`);
    }
  }
}
