import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Fuse from 'fuse.js';
import { EmbeddingsService } from '../ai/embeddings.service';
import { EmbeddingsProcessorService } from './embeddings-processor.service';
import { GeminiService } from '../ai/gemini.service';

// Email Schema interface
interface Email {
  _id: string;
  userId: string;
  messageId: string; // Gmail message ID
  snippet: string;
  body?: string;
  payload?: any;
  labelIds?: string[];
  embedding?: number[];
}

export interface SearchResult {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  score: number; // 0-1, 1 là perfect match
  matchedFields: string[]; // ['subject', 'sender', 'body']
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private fuseInstances = new Map<string, Fuse<Email>>(); // Key: "userId:label"

  constructor(
    @InjectModel('Email') private emailModel: Model<Email>,
    private readonly embeddingsService: EmbeddingsService,
    private readonly embeddingsProcessor: EmbeddingsProcessorService,
    private readonly geminiService: GeminiService,
  ) { }

  /**
   * 🔍 Thực hiện fuzzy search trên emails của user
   * - Hỗ trợ typo tolerance
   * - Hỗ trợ partial match
   * - Trả về kết quả xếp hạng theo relevance
   * - Hỗ trợ lọc theo label/mailbox
   */
  async search(
    userId: string,
    query: string,
    fields: string[] = ['subject', 'sender'],
    limit: number = 20,
    offset: number = 0,
    label?: string, // Optional: filter by label (e.g., 'INBOX', 'SENT', 'DRAFT')
  ): Promise<{ total: number; results: SearchResult[] }> {
    try {
      // 1️⃣ Lấy emails của user từ MongoDB
      const filter: any = { userId };

      // Nếu có label, lọc theo labelIds
      if (label) {
        if (label === 'UNREAD') {
          // UNREAD là virtual label - không phải Gmail label
          filter.unread = true;
        } else if (label === 'STARRED') {
          // STARRED là virtual label
          filter.starred = true;
        } else if (label === 'ALL_MAIL') {
          // ALL_MAIL không lọc gì, lấy tất cả emails của user
          // (giữ nguyên filter chỉ có userId)
        } else {
          // Gmail labels: INBOX, SENT, DRAFT, TRASH, SPAM, etc.
          // labelIds là array, nên dùng $in để check nếu label có trong array
          filter.labelIds = { $in: [label] };
        }
      }

      const emails = await this.emailModel
        .find(filter)
        .select('messageId snippet body payload labelIds unread starred')
        .lean()
        .exec();

      this.logger.log(`[Search] User ${userId}, label="${label || 'ALL'}": Loaded ${emails.length} emails`);

      if (emails.length === 0) {
        return { total: 0, results: [] };
      }

      // 🔍 Extract sender + subject from payload headers cho Fuse search
      const enrichedEmails = emails.map((email) => {
        const { sender, subject } = this.extractEmailInfo(email);
        return {
          ...email,
          sender,
          subject,
        };
      });

      // 2️⃣ Build Fuse.js index (cache theo userId:label để tránh xung đột)
      const cacheKey = `${userId}:${label || 'ALL'}`;
      let fuse = this.fuseInstances.get(cacheKey);

      if (!fuse) {
        fuse = new Fuse(enrichedEmails, {
          keys: [
            { name: 'subject', weight: 0.7 }, // Subject quan trọng hơn
            { name: 'sender', weight: 0.6 },
            { name: 'snippet', weight: 0.4 },
            { name: 'body', weight: 0.3 },
          ],
          threshold: 0.4, // 🧪 0.4 = typo tolerance (0=exact, 1=loose)
          ignoreLocation: true,
          minMatchCharLength: 2,
          includeScore: true,
          includeMatches: true,
        });
        this.fuseInstances.set(cacheKey, fuse);
        this.logger.log(`[Search] Built Fuse index for ${cacheKey}`);
      } else {
        this.logger.log(`[Search] Using cached Fuse index for ${cacheKey}`);
      }

      // 3️⃣ Thực hiện search
      const searchResults = fuse.search(query);
      this.logger.log(`[Search] Query "${query}" in ${cacheKey}: Found ${searchResults.length} matches`);

      // 4️⃣ Format kết quả
      const results: SearchResult[] = searchResults
        .slice(offset, offset + limit)
        .map((result) => {
          const matchedFields = (result.matches
            ?.map((m) => m.key)
            .filter((v, i, a) => a.indexOf(v) === i) || []) as string[];

          const { sender, subject } = this.extractEmailInfo(result.item);

          return {
            id: result.item.messageId, // Use messageId (Gmail message ID)
            sender,
            subject,
            snippet: result.item.snippet || '',
            score: result.score || 0, // 0=perfect match, 1=no match
            matchedFields,
          };
        });

      return {
        total: searchResults.length,
        results,
      };
    } catch (error) {
      this.logger.error(`Search error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Semantic search using vector embeddings stored on emails.embedding
   */
  async semanticSearch(
    userId: string,
    query: string,
    limit: number = 20,
    offset: number = 0,
    label?: string,
  ): Promise<{ total: number; results: SearchResult[] }> {
    try {
      // 1. Load ALL emails for user (with and without embeddings)
      const filter: any = { userId };
      if (label) {
        if (label === 'UNREAD') filter.unread = true;
        else if (label === 'STARRED') filter.starred = true;
        else if (label !== 'ALL_MAIL') filter.labelIds = { $in: [label] };
      }

      const allEmails = await this.emailModel
        .find(filter)
        .select('messageId snippet body payload embedding labelIds')
        .lean()
        .exec();

      if (!allEmails || allEmails.length === 0) {
        this.logger.warn(`[SemanticSearch] No emails found for user ${userId}`);
        return { total: 0, results: [] };
      }

      // 2. Separate emails with and without embeddings
      const emailsWithEmbeddings = allEmails.filter(e => e.embedding && Array.isArray(e.embedding));
      const emailsWithoutEmbeddings = allEmails.filter(e => !e.embedding || !Array.isArray(e.embedding));

      this.logger.log(`[SemanticSearch] User ${userId}, label="${label || 'ALL'}": ${emailsWithEmbeddings.length}/${allEmails.length} emails have embeddings`);

      // 3. Auto-generate embeddings for emails that don't have them (async, non-blocking for first request)
      if (emailsWithoutEmbeddings.length > 0) {
        this.logger.log(`[SemanticSearch] Triggering background embedding generation for ${emailsWithoutEmbeddings.length} emails`);
        // Fire and forget - don't wait for this
        this.embeddingsProcessor.processEmailEmbeddings(
          userId,
          emailsWithoutEmbeddings.map(e => e._id?.toString()).filter(Boolean)
        ).catch(err => {
          this.logger.error(`[SemanticSearch] Background embedding generation failed: ${err.message}`);
        });
      }

      // 4. If no emails have embeddings yet, return empty results with helpful message
      if (emailsWithEmbeddings.length === 0) {
        this.logger.warn(`[SemanticSearch] No emails with embeddings yet. Embeddings are being generated in the background. Please try again in a few moments.`);
        return { total: 0, results: [] };
      }

      // 5. Expand query with semantically related terms using AI
      const expandedQuery = await this.geminiService.expandQuery(query);
      const queryToEmbed = expandedQuery || query; // Fallback to original if expansion fails

      this.logger.log(`[SemanticSearch] Query expansion: "${query}" → "${queryToEmbed}"`);

      // 6. Generate embedding for the (expanded) query
      const qEmbedding = await this.embeddingsService.embedText(queryToEmbed);

      // 7. Helper functions for cosine similarity
      const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
      const norm = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));

      this.logger.debug(`[SemanticSearch] Query embedding: length=${qEmbedding.length}, first 3 values=[${qEmbedding.slice(0, 3).join(', ')}], norm=${norm(qEmbedding).toFixed(3)}`);

      const scored = emailsWithEmbeddings.map((e, idx) => {
        const emb = e.embedding as number[];

        // Debug first email
        if (idx === 0) {
          this.logger.debug(`[SemanticSearch] First email embedding: length=${emb?.length || 0}, first 3 values=[${emb?.slice(0, 3).join(', ') || 'N/A'}], norm=${emb ? norm(emb).toFixed(3) : 'N/A'}`);
        }

        const similarity = (emb && qEmbedding) ? (dot(emb, qEmbedding) / (norm(emb) * norm(qEmbedding))) : -1;
        return { email: e, similarity: Number.isFinite(similarity) ? similarity : -1 };
      });

      scored.sort((a, b) => b.similarity - a.similarity);

      // Log top 5 scores BEFORE filtering to see what we're getting
      if (scored.length > 0) {
        const topScoresAll = scored.slice(0, 5).map(s => s.similarity.toFixed(3)).join(', ');
        this.logger.log(`[SemanticSearch] Top 5 similarities (unfiltered): [${topScoresAll}]`);
      }

      // Minimum similarity threshold for results (increased to 0.35 for high precision)
      // Only show emails with strong semantic match
      const MIN_SIMILARITY = 0.35; // Cosine similarity threshold (range: -1 to 1)
      const filtered = scored.filter(s => s.similarity >= MIN_SIMILARITY);

      this.logger.log(`[SemanticSearch] Query "${query}": ${filtered.length}/${scored.length} results above threshold (${MIN_SIMILARITY})`);

      // Log top 5 similarity scores for debugging
      if (filtered.length > 0) {
        const topScores = filtered.slice(0, 5).map(s => s.similarity.toFixed(3)).join(', ');
        this.logger.log(`[SemanticSearch] Top 5 similarities: [${topScores}]`);
      }

      const total = filtered.length;
      const page = filtered.slice(offset, offset + limit);

      const results: SearchResult[] = page.map((s) => {
        const sender = this.extractEmailInfo(s.email).sender;
        const subject = this.extractEmailInfo(s.email).subject;
        // Convert cosine (-1..1) -> score similar to existing format where 0 is perfect
        const score = 1 - ((s.similarity + 1) / 2); // similarity 1 => score 0, similarity -1 => score 1
        return {
          id: s.email.messageId,
          sender,
          subject,
          snippet: s.email.snippet || '',
          score,
          matchedFields: ['body', 'subject'],
        };
      });

      return { total, results };
    } catch (error) {
      this.logger.error(`semanticSearch error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 🧠 Generate embeddings for all user emails that don't have them yet
   * Delegates to EmbeddingsProcessorService
   */
  async generateEmbeddingsForUser(userId: string): Promise<void> {
    this.logger.log(`[GenerateEmbeddings] Starting for user ${userId}`);
    await this.embeddingsProcessor.processEmailEmbeddings(userId);
    this.logger.log(`[GenerateEmbeddings] Completed for user ${userId}`);
  }

  /**
   * 📧 Extract sender + subject từ payload.headers (Gmail API structure)
   */
  private extractEmailInfo(email: any): { sender: string; subject: string } {
    const headers = email.payload?.headers || [];

    const fromHeader = headers.find((h: any) => h.name === 'From')?.value || '';
    const subjectHeader = headers.find((h: any) => h.name === 'Subject')?.value || '';

    // Parse "From" header: "Name <email@domain.com>" → "Name"
    const senderMatch = fromHeader.match(/^([^<]+)/);
    const sender = senderMatch ? senderMatch[1].trim() : fromHeader || 'Unknown';

    const subject = subjectHeader || '(No Subject)';

    return { sender, subject };
  }

  /**
   * 💡 Get auto-suggestion candidates (senders, subjects) for type-ahead search
   * Returns unique sender names + subject keywords matching the query prefix
   */
  async getSuggestions(
    userId: string,
    prefix: string,
    limit: number = 5,
    label?: string,
  ): Promise<{
    senders: string[];
    subjects: string[];
  }> {
    try {
      // 1️⃣ Build filter
      const filter: any = { userId };
      if (label) {
        if (label === 'UNREAD') filter.unread = true;
        else if (label === 'STARRED') filter.starred = true;
        else if (label !== 'ALL_MAIL') filter.labelIds = { $in: [label] };
      }

      // 2️⃣ Fetch emails with minimal fields
      const emails = await this.emailModel
        .find(filter)
        .select('payload')
        .lean()
        .exec();

      if (!emails || emails.length === 0) {
        return { senders: [], subjects: [] };
      }

      // 3️⃣ Extract senders and subjects
      const senderSet = new Set<string>();
      const subjectSet = new Set<string>();
      const prefixLower = prefix.toLowerCase();

      emails.forEach((email) => {
        const { sender, subject } = this.extractEmailInfo(email);

        // Add sender if it matches prefix
        if (sender && sender.toLowerCase().includes(prefixLower)) {
          senderSet.add(sender);
        }

        // Add subject keywords if they match prefix
        if (subject && subject.toLowerCase().includes(prefixLower)) {
          subjectSet.add(subject);
        }
      });

      // 4️⃣ Return unique, sorted suggestions
      return {
        senders: Array.from(senderSet)
          .sort()
          .slice(0, Math.ceil(limit / 2)),
        subjects: Array.from(subjectSet)
          .sort()
          .slice(0, Math.ceil(limit / 2)),
      };
    } catch (error) {
      this.logger.error(`getSuggestions error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  clearCache(userId: string, label?: string): void {
    if (label) {
      // Clear specific label cache
      const cacheKey = `${userId}:${label}`;
      this.fuseInstances.delete(cacheKey);
      this.logger.log(`[Search] Cleared cache for ${cacheKey}`);
    } else {
      // Clear all caches for user
      const keysToDelete = Array.from(this.fuseInstances.keys()).filter(key =>
        key.startsWith(`${userId}:`)
      );
      keysToDelete.forEach(key => this.fuseInstances.delete(key));
      this.logger.log(`[Search] Cleared all caches for user ${userId}`);
    }
  }
}
