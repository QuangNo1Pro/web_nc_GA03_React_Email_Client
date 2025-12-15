import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Fuse from 'fuse.js';
import { SearchQueryDto } from './dto/search-query.dto';

export interface SearchResult {
  id: string;
  sender: string; // "Name <email@example.com>"
  subject: string;
  snippet?: string;
  score: number; // Fuse score (0 = perfect match, 1 = worst match)
  matchedFields: string[]; // Which fields matched: ['subject', 'sender', 'body']
}

export interface SearchResponse {
  total: number;
  results: SearchResult[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private fuseIndex: Fuse<any>;
  private emails: any[] = [];

  constructor(@InjectModel('Email') private emailModel: Model<any>) {
    this.initializeFuseIndex();
  }

  /**
   * Initialize Fuse index from MongoDB on service startup.
   * Loads all emails into memory and builds a Fuse index.
   */
  private async initializeFuseIndex(): Promise<void> {
    try {
      // For now, we'll lazy-load emails when search is called.
      // In production, consider periodic re-indexing or event-driven updates.
      this.logger.log('SearchService initialized (Fuse index will be built on first search)');
    } catch (error) {
      this.logger.error('Failed to initialize Fuse index', error);
    }
  }

  /**
   * Perform fuzzy search on emails.
   * Supports typo tolerance, partial matches, and relevance ranking.
   */
  async search(
    userId: string,
    query: string,
    fields: string[] = ['subject', 'sender'],
    limit: number = 20,
    offset: number = 0,
  ): Promise<SearchResponse> {
    try {
      // Validate query
      if (!query || query.trim().length === 0) {
        return { total: 0, results: [] };
      }

      const trimmedQuery = query.trim();

      // Load emails from MongoDB for this user (could be cached/indexed in production)
      const emails = await this.emailModel
        .find({ userId })
        .select('_id subject snippet payload status snoozedUntil summary')
        .lean()
        .exec();

      // Transform emails to searchable format
      const searchableEmails = emails.map((email) => ({
        id: email._id.toString(),
        subject: email.subject || '',
        sender: this.extractSender(email.payload),
        body: email.summary || email.snippet || '', // Use summary if available, else snippet
        originalEmail: email, // Keep reference for later
      }));

      // Build or update Fuse index
      // Note: In production, this could be cached and updated incrementally
      const fuseOptions = {
        keys: [
          { name: 'subject', weight: 0.4 },
          { name: 'sender', weight: 0.4 },
          { name: 'body', weight: 0.2 },
        ],
        threshold: 0.4, // Allow up to 60% mismatch for typo tolerance
        distance: 100, // For partial matches
        minMatchCharLength: 2, // Min chars to match
        includeScore: true,
      } as any;

      const fuse = new Fuse(searchableEmails, fuseOptions);

      // Perform search
      const searchResults = fuse.search(trimmedQuery);

      // Transform results to response format
      const results: SearchResult[] = searchResults
        .slice(offset, offset + limit)
        .map((result) => {
          const item = result.item;
          const matchedFields = this.getMatchedFields(result.matches);

          return {
            id: item.id,
            sender: item.sender,
            subject: item.subject,
            snippet: this.createSnippet(item.body, trimmedQuery),
            score: result.score ?? 0,
            matchedFields,
          };
        });

      return {
        total: searchResults.length,
        results,
      };
    } catch (error) {
      this.logger.error(`Search failed: ${error instanceof Error ? error.message : String(error)}`, error);
      throw error;
    }
  }

  /**
   * Extract sender from email payload.
   * Email payload has headers with 'from' field containing "Name <email@example.com>"
   */
  private extractSender(payload: any): string {
    try {
      if (!payload || !payload.headers) return '';

      const fromHeader = payload.headers.find(
        (h: any) => h.name && h.name.toLowerCase() === 'from',
      );
      return fromHeader?.value || '';
    } catch {
      return '';
    }
  }

  /**
   * Determine which fields matched based on Fuse result matches.
   */
  private getMatchedFields(matches?: any[] | readonly any[]): string[] {
    if (!matches) return [];

    const uniqueKeys = new Set<string>();
    matches.forEach((match: any) => {
      if (match.key) {
        uniqueKeys.add(match.key);
      }
    });

    return Array.from(uniqueKeys);
  }

  /**
   * Create a snippet around the matched query term.
   */
  private createSnippet(text: string, query: string, contextLength: number = 50): string {
    if (!text || !query) return text.substring(0, 100);

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) {
      // No exact match, return first 100 chars
      return text.substring(0, 100) + (text.length > 100 ? '...' : '');
    }

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + query.length + contextLength);
    const snippet = text.substring(start, end);

    return (start > 0 ? '...' : '') + snippet + (end < text.length ? '...' : '');
  }
}
