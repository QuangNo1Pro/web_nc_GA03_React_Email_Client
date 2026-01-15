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
    @InjectModel('EmailVector') private emailVectorModel: Model<any>,
    private readonly embeddingsService: EmbeddingsService,
    private readonly embeddingsProcessor: EmbeddingsProcessorService,
    private readonly geminiService: GeminiService,
  ) { }

  /**
   * 🇻🇳 Normalize Vietnamese text by removing diacritics
   * Allows "quan" to match "Quân", "nguyen" to match "Nguyễn"
   */
  private normalizeVietnamese(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFD') // Decompose into base char + combining marks
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
      .replace(/đ/g, 'd') // Handle đ separately
      .replace(/Đ/g, 'D')
      .toLowerCase();
  }

  /**
   * 🧹 Strip HTML tags and extract plain text
   * Handles complex email HTML with style/script removal
   */
  private stripHtml(html: string): string {
    if (!html) return '';

    let text = html;
    // Remove style tags and content
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // Remove script tags and content
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove HTML comments (including conditional comments)
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }


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
          // Loại bỏ Trash và Spam
          filter.labelIds = { $nin: ['TRASH', 'SPAM'] };
        } else if (label === 'STARRED') {
          // STARRED là virtual label
          filter.starred = true;
          // Loại bỏ Trash và Spam
          filter.labelIds = { $nin: ['TRASH', 'SPAM'] };
        } else if (label === 'ALL_MAIL') {
          // ALL_MAIL không lọc gì, lấy tất cả emails của user
          // NHƯNG thường All Mail cũng không bao gồm Trash/Spam
          filter.labelIds = { $nin: ['TRASH', 'SPAM'] };
        } else {
          // Gmail labels: INBOX, SENT, DRAFT, TRASH, SPAM, etc.
          // labelIds là array, nên dùng $in để check nếu label có trong array
          filter.labelIds = { $in: [label] };
        }
      }

      const emails = await this.emailModel
        .find(filter)
        .select('messageId snippet textContent payload labelIds unread starred')
        .lean()
        .exec();

      this.logger.log(`[Search] User ${userId}, label="${label || 'ALL'}": Loaded ${emails.length} emails`);

      if (emails.length === 0) {
        return { total: 0, results: [] };
      }

      // 🔍 Extract sender + subject from payload headers cho Fuse search
      // Also add normalized (no-accent) versions for Vietnamese support
      const enrichedEmails = emails.map((email) => {
        const { sender, subject } = this.extractEmailInfo(email);
        // Use textContent (full body) if available, fallback to snippet
        // Use textContent (full body) if available, fallback to snippet
        const rawContent = (email as any).textContent || email.snippet || '';
        // 🧹 Clean HTML tags to get plain text for better search matching
        const bodyContent = this.stripHtml(rawContent);

        return {
          ...email,
          sender,
          subject,
          bodyContent: bodyContent.slice(0, 10000), // Limit raw body size too
          // Normalized versions for accent-insensitive search
          senderNorm: this.normalizeVietnamese(sender),
          subjectNorm: this.normalizeVietnamese(subject),
          bodyContentNorm: this.normalizeVietnamese(bodyContent.slice(0, 5000)), // Limit to 5000 chars for performance
        };
      });

      // 2️⃣ Build 3 separate Fuse.js indexes for MAX score logic
      // Instead of weighted average, we search each field separately and take the BEST score
      const cacheKey = `${userId}:${label || 'ALL'}`;

      const fuseConfig = {
        threshold: 0.6, // Per-field threshold (relaxed from 0.5)
        ignoreLocation: true,
        minMatchCharLength: 2,
        includeScore: true,
        includeMatches: true,
      };

      // Create Fuse instances for each field group
      const fuseSubject = new Fuse(enrichedEmails, {
        ...fuseConfig,
        keys: ['subject', 'subjectNorm'],
      });

      const fuseSender = new Fuse(enrichedEmails, {
        ...fuseConfig,
        keys: ['sender', 'senderNorm'],
      });

      const fuseBody = new Fuse(enrichedEmails, {
        ...fuseConfig,
        keys: ['bodyContent', 'bodyContentNorm'],
      });

      this.logger.log(`[Search] Built 3 Fuse indexes for ${cacheKey} (MAX score logic)`);

      // 3️⃣ Search each field separately with both original and normalized query
      const normalizedQuery = this.normalizeVietnamese(query);
      const queries = [query];
      if (normalizedQuery !== query) queries.push(normalizedQuery);

      // Search all 3 fields
      const subjectResults: any[] = [];
      const senderResults: any[] = [];
      const bodyResults: any[] = [];

      queries.forEach(q => {
        subjectResults.push(...fuseSubject.search(q));
        senderResults.push(...fuseSender.search(q));
        bodyResults.push(...fuseBody.search(q));
      });

      // 4️⃣ Merge results: for each email, take the BEST (lowest) score across all fields
      const bestScoreMap = new Map<string, { score: number; item: any; matchedField: string }>();

      const processResults = (results: any[], fieldName: string) => {
        results.forEach(r => {
          const id = r.item.messageId;
          const score = r.score || 1;
          const existing = bestScoreMap.get(id);

          if (!existing || score < existing.score) {
            bestScoreMap.set(id, { score, item: r.item, matchedField: fieldName });
          }
        });
      };

      processResults(subjectResults, 'subject');
      processResults(senderResults, 'sender');
      processResults(bodyResults, 'body');

      // 5️⃣ Filter by MAX score threshold and sort
      const MAX_SCORE_THRESHOLD = 0.5; // Consistent with fuse threshold
      const searchResults = Array.from(bestScoreMap.values())
        .filter(r => r.score <= MAX_SCORE_THRESHOLD)
        .sort((a, b) => a.score - b.score);

      this.logger.log(`[Search] Query "${query}" in ${cacheKey}: Subject=${subjectResults.length}, Sender=${senderResults.length}, Body=${bodyResults.length} → ${searchResults.length} after MAX score filter`);

      // 6️⃣ Format kết quả
      const results: SearchResult[] = searchResults
        .slice(offset, offset + limit)
        .map((result) => {
          const { sender, subject } = this.extractEmailInfo(result.item);

          return {
            id: result.item.messageId,
            sender,
            subject,
            snippet: result.item.snippet || '',
            score: result.score, // 0=perfect match, 1=no match
            matchedFields: [result.matchedField], // Which field had the best match
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
   * Semantic search using vector embeddings stored in email_vectors collection
   */
  async semanticSearch(
    userId: string,
    query: string,
    limit: number = 20,
    offset: number = 0,
    label?: string,
  ): Promise<{ total: number; results: SearchResult[] }> {
    try {
      // 1. Determine candidate emails based on filters (Label, etc.)
      const filter: any = { userId };
      if (label) {
        if (label === 'UNREAD') {
          filter.unread = true;
          filter.labelIds = { $nin: ['TRASH', 'SPAM'] };
        } else if (label === 'STARRED') {
          filter.starred = true;
          filter.labelIds = { $nin: ['TRASH', 'SPAM'] };
        } else if (label === 'ALL_MAIL') {
          filter.labelIds = { $nin: ['TRASH', 'SPAM'] };
        } else {
          filter.labelIds = { $in: [label] };
        }
      }

      // Fetch ONLY messageIds to minimize data transfer
      const candidateEmails = await this.emailModel
        .find(filter)
        .select('messageId')
        .lean()
        .exec();

      if (!candidateEmails || candidateEmails.length === 0) {
        this.logger.warn(`[SemanticSearch] No emails found for user ${userId} with filter ${label || 'ALL'}`);
        return { total: 0, results: [] };
      }

      const candidateMessageIds = candidateEmails.map(e => e.messageId);

      // 2. Fetch vectors for these candidates
      const vectors = await this.emailVectorModel
        .find({
          userId,
          messageId: { $in: candidateMessageIds }
        })
        .select('messageId embedding')
        .lean()
        .exec();

      this.logger.log(`[SemanticSearch] User ${userId}, label="${label || 'ALL'}": Found ${vectors.length} vectors for ${candidateMessageIds.length} candidate emails`);

      // 3. Trigger background generation for missing vectors
      if (vectors.length < candidateMessageIds.length) {
        const existingVectorIds = new Set(vectors.map(v => v.messageId));
        const missingIds = candidateMessageIds.filter(id => !existingVectorIds.has(id));

        if (missingIds.length > 0) {
          this.logger.log(`[SemanticSearch] Triggering background embedding generation for ${missingIds.length} emails`);
          // Use the internal IDs from candidateEmails to match what processEmailEmbeddings expects (which usually takes _id)
          // But processEmailEmbeddings logic in previous step was updated to accept _id list.
          // However, here we have messageIds.
          // EmbeddingsProcessor expects _id list.
          // Let's refactor processEmailEmbeddings or mapping.
          // Actually, let's look at candidateEmails - it has _id (default).
          const missingEmailDocs = candidateEmails.filter(e => !existingVectorIds.has(e.messageId));
          const missingInternalIds = missingEmailDocs.map(e => e._id.toString());

          this.embeddingsProcessor.processEmailEmbeddings(userId, missingInternalIds).catch(err => {
            this.logger.error(`[SemanticSearch] Background embedding generation failed: ${err.message}`);
          });
        }
      }

      if (vectors.length === 0) {
        this.logger.warn(`[SemanticSearch] No embeddings found yet. Please try again later.`);
        return { total: 0, results: [] };
      }

      // 4. Expand query
      const expandedQuery = await this.geminiService.expandQuery(query);
      const queryToEmbed = expandedQuery || query;
      this.logger.log(`[SemanticSearch] Query expansion: "${query}" → "${queryToEmbed}"`);

      // 5. Generate embedding for query
      const qEmbedding = await this.embeddingsService.embedText(queryToEmbed);

      // 6. Cosine Similarity
      const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
      const norm = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));

      const scored = vectors.map((v) => {
        const emb = v.embedding;
        const similarity = (emb && qEmbedding) ? (dot(emb, qEmbedding) / (norm(emb) * norm(qEmbedding))) : -1;
        return { messageId: v.messageId, similarity: Number.isFinite(similarity) ? similarity : -1 };
      });

      // Sort
      scored.sort((a, b) => b.similarity - a.similarity);

      // Phase 1: High Recall Retrieval
      // Use moderate threshold to balance recall and precision
      const MIN_SIMILARITY = 0.40; // Increased from 0.25 to reduce noise
      const filtered = scored.filter(s => s.similarity >= MIN_SIMILARITY);

      this.logger.log(`[SemanticSearch] Recall Phase: "${query}" found ${filtered.length} candidates > ${MIN_SIMILARITY}`);

      // Take Top 50 for Reranking
      const topCandidates = filtered.slice(0, 50);

      // Fetch details for reranking
      const candidateIds = topCandidates.map(c => c.messageId);
      const emailDetails = await this.emailModel
        .find({ userId, messageId: { $in: candidateIds } })
        .select('messageId snippet payload')
        .lean()
        .exec();

      const emailMap = new Map(emailDetails.map(e => [e.messageId, e]));

      // Phase 2: AI Reranking (Precision)
      // Prepare items for Gemini to rank
      const rerankItems = topCandidates.map(c => {
        const email = emailMap.get(c.messageId);
        if (!email) return null;

        const { subject, sender } = this.extractEmailInfo(email);
        const content = `Sender: ${sender}\nSubject: ${subject}\nSnippet: ${email.snippet || ''}`;

        return {
          id: c.messageId,
          content
        };
      }).filter(Boolean) as { id: string; content: string }[];

      // Call reranker
      const rankedIds = await this.geminiService.rerankSearchResults(query, rerankItems);

      // If reranker failed/returned all items (quota issue), limit to top 10 by similarity
      const MAX_FALLBACK_RESULTS = 10;
      const isLikelyFallback = rankedIds.length === rerankItems.length && rankedIds.length > MAX_FALLBACK_RESULTS;
      const finalRankedIds = isLikelyFallback
        ? rankedIds.slice(0, MAX_FALLBACK_RESULTS)
        : rankedIds;

      this.logger.log(`[SemanticSearch] Reranker returned ${rankedIds.length} IDs${isLikelyFallback ? ` (limited to ${MAX_FALLBACK_RESULTS} due to fallback)` : ''}`);

      // Map back to results
      const results: SearchResult[] = [];
      const addedIds = new Set<string>();

      // 1. Add ranked items first
      for (const id of finalRankedIds) {
        const email = emailMap.get(id);
        const originalScore = topCandidates.find(c => c.messageId === id)?.similarity || 0;

        if (email) {
          const { sender, subject } = this.extractEmailInfo(email);
          results.push({
            id: email.messageId,
            sender,
            subject,
            snippet: email.snippet || '',
            score: 1 - ((originalScore + 1) / 2),
            matchedFields: ['body', 'subject', 'semantic_rerank'],
          });
          addedIds.add(id);
        }
      }

      // 2. Add any remaining candidates that weren't in ranked list (Safety Fallback)
      for (const candidate of topCandidates) {
        if (!addedIds.has(candidate.messageId)) {
          const email = emailMap.get(candidate.messageId);
          if (email) {
            const { sender, subject } = this.extractEmailInfo(email);
            results.push({
              id: email.messageId,
              sender,
              subject,
              snippet: email.snippet || '',
              score: 1 - ((candidate.similarity + 1) / 2),
              matchedFields: ['body', 'subject'],
            });
          }
        }
      }

      this.logger.log(`[SemanticSearch] Returning ${results.length} results`);
      return { total: results.length, results: results.slice(offset, offset + limit) };
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
