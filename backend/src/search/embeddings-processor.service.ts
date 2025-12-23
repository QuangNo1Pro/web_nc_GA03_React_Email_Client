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
  ) { }

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
        // Find emails without embeddings OR with empty embedding arrays
        // (limit to 50 per run to avoid overload)
        emailsToProcess = await this.emailModel
          .find({
            userId,
            $or: [
              { embedding: { $exists: false } },
              { embedding: null },
              { embedding: [] },
              { embedding: { $size: 0 } }
            ]
          })
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
      // Extract subject
      const subject = this.extractSubject(email.payload) || '';

      // Extract full body (not just snippet) for better semantic understanding
      const fullBody = this.extractEmailBody(email.payload);

      // Use full body if available, fallback to snippet
      const body = fullBody || email.snippet || '';

      // Limit to 2000 chars to avoid token limits (Gemini has 2048 token limit)
      const truncatedBody = body.substring(0, 2000);

      // Combine subject + body for embedding
      const textToEmbed = `${subject} ${truncatedBody}`.trim();

      if (!textToEmbed || textToEmbed.length < 5) {
        this.logger.warn(`[EmbeddingsProcessor] Skipping email ${emailId}: insufficient text`);
        return;
      }

      this.logger.debug(`[EmbeddingsProcessor] Embedding text for ${emailId}: ${textToEmbed.length} chars (subject: ${subject.length}, body: ${truncatedBody.length})`);

      // Generate embedding
      const embedding = await this.embeddingsService.embedText(textToEmbed);

      if (!embedding || embedding.length === 0) {
        this.logger.warn(`[EmbeddingsProcessor] Failed to generate embedding for email ${emailId}`);
        return;
      }

      // Debug: Log embedding details before saving
      this.logger.debug(`[EmbeddingsProcessor] About to save embedding for ${emailId}: length=${embedding.length}, first 3 values=[${embedding.slice(0, 3).join(', ')}]`);

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
   * Extract full email body from payload
   * Recursively extracts text from parts (text/plain or text/html)
   */
  private extractEmailBody(payload: any): string {
    if (!payload) return '';

    // If payload has body.data directly
    if (payload.body?.data) {
      try {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } catch (e) {
        this.logger.warn('[EmbeddingsProcessor] Failed to decode body.data');
      }
    }

    // If payload has parts, recursively extract
    if (payload.parts && Array.isArray(payload.parts)) {
      let textContent = '';

      for (const part of payload.parts) {
        // Prioritize text/plain
        if (part.mimeType === 'text/plain' && part.body?.data) {
          try {
            const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
            textContent += decoded + ' ';
          } catch (e) {
            // Ignore decode errors
          }
        }
        // Fallback to text/html
        else if (part.mimeType === 'text/html' && part.body?.data && !textContent) {
          try {
            const decoded = Buffer.from(part.body.data, 'base64').toString('utf-8');
            // Simple HTML tag removal (not perfect but good enough)
            const stripped = decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
            textContent += stripped + ' ';
          } catch (e) {
            // Ignore decode errors
          }
        }
        // Recursively check nested parts
        else if (part.parts) {
          textContent += this.extractEmailBody(part) + ' ';
        }
      }

      return textContent.trim();
    }

    return '';
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
