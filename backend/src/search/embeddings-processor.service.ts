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
    @InjectModel('EmailVector') private emailVectorModel: Model<any>,
    private readonly embeddingsService: EmbeddingsService,
  ) { }

  /**
   * 🎯 Generate embeddings for new/updated emails (non-blocking)
   * Called after emails are saved to database
   */
  async processEmailEmbeddings(userId: string, emailIds?: string[]): Promise<void> {
    try {
      this.logger.log(`[EmbeddingsProcessor] Starting for user ${userId}${emailIds ? ` (${emailIds.length} emails)` : ''}`);

      let emailsToProcess: any[] = [];

      if (emailIds && emailIds.length > 0) {
        emailsToProcess = await this.emailModel
          .find({ userId, _id: { $in: emailIds } })
          .select('_id messageId payload snippet userId')
          .lean()
          .exec();
      } else {
        // Find emails that do NOT have a corresponding entry in email_vectors
        emailsToProcess = await this.emailModel.aggregate([
          { $match: { userId } },
          {
            $lookup: {
              from: 'email_vectors',
              localField: 'messageId',
              foreignField: 'messageId',
              as: 'vector'
            }
          },
          { $match: { vector: { $size: 0 } } }, // Filter where no vector found
          { $limit: 50 },
          { $project: { _id: 1, messageId: 1, payload: 1, snippet: 1, userId: 1 } }
        ]);
      }

      if (emailsToProcess.length === 0) {
        this.logger.log(`[EmbeddingsProcessor] No emails to process for user ${userId}`);
        return;
      }

      this.logger.log(`[EmbeddingsProcessor] Processing ${emailsToProcess.length} emails for user ${userId}`);

      // Process embeddings in parallel (max 5 at a time)
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

      // Extract sender
      const sender = this.extractSender(email.payload) || '';

      // Extract full body
      const fullBody = this.extractEmailBody(email.payload);

      // Use full body if available, fallback to snippet
      const body = fullBody || email.snippet || '';

      // Limit to 8000 chars
      const truncatedBody = body.substring(0, 8000);

      // Combine Sender + Subject + Body for embedding
      // Structured format helps the model understand context
      const textToEmbed = `Sender: ${sender}\nSubject: ${subject}\n\n${truncatedBody}`.trim();

      if (!textToEmbed || textToEmbed.length < 5) {
        this.logger.warn(`[EmbeddingsProcessor] Skipping email ${emailId}: insufficient text`);
        return;
      }

      this.logger.debug(`[EmbeddingsProcessor] Embedding text for ${emailId}: ${textToEmbed.length} chars (subject: ${subject.length})`);

      // Generate embedding
      const embedding = await this.embeddingsService.embedText(textToEmbed);

      if (!embedding || embedding.length === 0) {
        this.logger.warn(`[EmbeddingsProcessor] Failed to generate embedding for email ${emailId}`);
        return;
      }

      // Store in email_vectors collection
      await this.emailVectorModel.findOneAndUpdate(
        { userId: email.userId, messageId: email.messageId },
        {
          $set: {
            userId: email.userId,
            messageId: email.messageId,
            embedding,
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true, new: true }
      );

      this.logger.debug(`[EmbeddingsProcessor] ✅ Saved embedding to email_vectors for ${email.messageId}`);
    } catch (error: any) {
      this.logger.error(`[EmbeddingsProcessor] Error processing email ${emailId}: ${error.message}`);
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
   * Extract sender from email payload headers
   */
  private extractSender(payload: any): string {
    if (!payload) return '';
    const headers = payload.headers || [];
    const fromHeader = headers.find((h: any) => h.name === 'From');
    if (!fromHeader) return '';

    // Parse "Name <email>" format
    const match = fromHeader.value.match(/^([^<]+)/);
    return match ? match[1].trim() : fromHeader.value;
  }

  /**
   * Extract full email body from payload
   * Recursively extracts text from parts (text/plain or text/html)
   */
  /**
   * Extract full email body from payload
   * Recursively extracts text from parts (text/plain or text/html)
   * Handles base64url decoding
   */
  private extractEmailBody(payload: any): string {
    if (!payload) return '';

    // Helper to decode base64url
    const decodeBase64 = (data: string): string => {
      if (!data) return '';
      try {
        // Replace base64url chars with standard base64 chars
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        // Decode
        return Buffer.from(base64, 'base64').toString('utf-8');
      } catch (e) {
        return '';
      }
    };

    let body = '';

    // 1. Direct body.data (rare in multipart, common in simple msgs)
    if (payload.body?.data) {
      return decodeBase64(payload.body.data);
    }

    // 2. Recursive parts traversal
    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body += decodeBase64(part.body.data) + '\n';
        }
        else if (part.mimeType === 'text/html' && part.body?.data) {
          // If we haven't found plain text yet, or want to append content
          // Usually getting plain text is enough, but some emails are HTML only
          const html = decodeBase64(part.body.data);
          // Strip tags for embedding
          const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          if (text) body += text + '\n';
        }
        else if (part.parts) {
          // Nested multipart/alternative or mixed
          body += this.extractEmailBody(part) + '\n';
        }
      }
    }

    return body.trim();
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
