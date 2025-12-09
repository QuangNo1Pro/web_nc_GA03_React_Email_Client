import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { google, gmail_v1 } from 'googleapis';
import { UsersService } from '../users/users.service';

/**
 * Gmail Label Service
 * Manages Gmail labels for snooze functionality
 * - Creates SNOOZED label if not exists
 * - Modifies message labels (add/remove INBOX, SNOOZED)
 * - Validates Gmail messageId format
 * - Handles token refresh automatically
 */
@Injectable()
export class GmailLabelService {
  private readonly logger = new Logger(GmailLabelService.name);
  private readonly SNOOZED_LABEL_NAME = 'SNOOZED';
  
  // Cache label IDs per user to reduce API calls
  private labelCache = new Map<string, { snoozedLabelId: string; timestamp: number }>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

  constructor(private readonly usersService: UsersService) {}

  /**
   * Get Gmail client with automatic token refresh
   */
  private async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.googleAccessToken) {
      throw new UnauthorizedException('User not authenticated with Google');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    // Automatic token refresh
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token && user.googleId && user.googleRefreshToken) {
        this.logger.log(`🔄 Token refreshed for user ${userId}`);
        // Update only the access token (keep existing refresh token, picture, name)
        await this.usersService.updateGoogleTokens(
          user.googleId,
          tokens.access_token,
          tokens.refresh_token || user.googleRefreshToken,
          user.picture || '',
          user.name || user.email || '',
        );
      }
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Validate Gmail messageId format
   * Gmail messageIds are typically 16-character hex strings
   */
  validateMessageId(messageId: string): void {
    if (!messageId || typeof messageId !== 'string') {
      throw new BadRequestException('Invalid messageId: must be a non-empty string');
    }

    // Gmail messageIds are typically alphanumeric (base64url-like)
    // Example: 18d4f5c2a3b1e6f7
    if (messageId.length < 10 || !/^[a-zA-Z0-9_-]+$/.test(messageId)) {
      throw new BadRequestException(
        `Invalid Gmail messageId format: "${messageId}". ` +
        `Expected alphanumeric string (10+ chars). ` +
        `Do not use internal database IDs with Gmail API.`
      );
    }
  }

  /**
   * Get or create SNOOZED label
   * Returns the label ID
   */
  async ensureSnoozedLabel(userId: string): Promise<string> {
    try {
      // Check cache first
      const cached = this.labelCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.snoozedLabelId;
      }

      const gmail = await this.getGmailClient(userId);

      // List all labels
      const labelsResponse = await gmail.users.labels.list({
        userId: 'me',
      });

      const labels = labelsResponse.data.labels || [];
      const snoozedLabel = labels.find(
        (label) => label.name === this.SNOOZED_LABEL_NAME
      );

      if (snoozedLabel?.id) {
        // Cache the result
        this.labelCache.set(userId, {
          snoozedLabelId: snoozedLabel.id,
          timestamp: Date.now(),
        });
        return snoozedLabel.id;
      }

      // Create the label
      this.logger.log(`Creating SNOOZED label for user ${userId}`);
      const createResponse = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: this.SNOOZED_LABEL_NAME,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      const labelId = createResponse.data.id;
      if (!labelId) {
        throw new InternalServerErrorException('Failed to create SNOOZED label');
      }

      // Cache the result
      this.labelCache.set(userId, {
        snoozedLabelId: labelId,
        timestamp: Date.now(),
      });

      return labelId;
    } catch (error: any) {
      this.logger.error(`Error ensuring SNOOZED label: ${error.message}`);
      
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        throw new UnauthorizedException('Gmail token expired. Please re-authenticate.');
      }
      
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Failed to ensure SNOOZED label: ${error.message}`
      );
    }
  }

  /**
   * Apply snooze to Gmail message
   * - Adds SNOOZED label
   * - Removes INBOX label (hides from inbox)
   * - Returns updated labelIds
   */
  async applySnoozeLabels(
    userId: string,
    messageId: string,
  ): Promise<string[]> {
    this.validateMessageId(messageId);

    try {
      const gmail = await this.getGmailClient(userId);
      const snoozedLabelId = await this.ensureSnoozedLabel(userId);

      this.logger.log(`Applying snooze labels to ${messageId}`);

      const response = await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [snoozedLabelId],
          removeLabelIds: ['INBOX'], // Hide from inbox
        },
      });

      const updatedLabels = response.data.labelIds || [];
      this.logger.log(`✅ Snooze labels applied to ${messageId}. Labels: ${updatedLabels.join(', ')}`);
      
      return updatedLabels;
    } catch (error: any) {
      this.logger.error(`Error applying snooze labels to ${messageId}: ${error.message}`);
      
      // Handle specific Gmail API errors
      if (error.code === 400 && error.message?.includes('Invalid id value')) {
        throw new BadRequestException(
          `Invalid Gmail messageId: "${messageId}". ` +
          `This appears to be an internal database ID. ` +
          `Gmail API requires the actual Gmail messageId.`
        );
      }
      
      if (error.code === 404) {
        throw new BadRequestException(`Email not found on Gmail: ${messageId}`);
      }
      
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        throw new UnauthorizedException('Gmail token expired. Please re-authenticate.');
      }
      
      // Rethrow known exceptions
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Gmail API error: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Remove snooze from Gmail message (restore to inbox)
   * - Removes SNOOZED label
   * - Re-adds INBOX label (shows in inbox)
   * - Returns updated labelIds
   */
  async removeSnoozeLabels(
    userId: string,
    messageId: string,
  ): Promise<string[]> {
    this.validateMessageId(messageId);

    try {
      const gmail = await this.getGmailClient(userId);
      const snoozedLabelId = await this.ensureSnoozedLabel(userId);

      this.logger.log(`Removing snooze labels from ${messageId}`);

      const response = await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['INBOX'], // Restore to inbox
          removeLabelIds: [snoozedLabelId],
        },
      });

      const updatedLabels = response.data.labelIds || [];
      this.logger.log(`✅ Snooze labels removed from ${messageId}. Labels: ${updatedLabels.join(', ')}`);
      
      return updatedLabels;
    } catch (error: any) {
      this.logger.error(`Error removing snooze labels from ${messageId}: ${error.message}`);
      
      // Handle specific Gmail API errors
      if (error.code === 400 && error.message?.includes('Invalid id value')) {
        throw new BadRequestException(
          `Invalid Gmail messageId: "${messageId}". ` +
          `This appears to be an internal database ID. ` +
          `Gmail API requires the actual Gmail messageId.`
        );
      }
      
      if (error.code === 404) {
        throw new BadRequestException(`Email not found on Gmail: ${messageId}`);
      }
      
      if (error.code === 401 || error.message?.includes('invalid_grant')) {
        throw new UnauthorizedException('Gmail token expired. Please re-authenticate.');
      }
      
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Gmail API error: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Exponential backoff retry wrapper
   * Retries transient errors (429, 503, network errors)
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry client errors (400, 401, 404)
        if (error.code === 400 || error.code === 401 || error.code === 404) {
          throw error;
        }

        // Retry transient errors
        const isTransient = 
          error.code === 429 || // Rate limit
          error.code === 503 || // Service unavailable
          error.code === 500 || // Internal server error
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT');

        if (!isTransient || attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.warn(
          `Transient error (${error.code}). Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Clear label cache for a user (call after re-authentication)
   */
  clearCache(userId: string): void {
    this.labelCache.delete(userId);
  }
}
