import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Fuse from 'fuse.js';

// Email Schema interface
interface Email {
  _id: string;
  userId: string;
  messageId: string; // Gmail message ID
  snippet: string;
  body?: string;
  payload?: any;
  labelIds?: string[];
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
  ) {}

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
   * � Extract sender + subject từ payload.headers (Gmail API structure)
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
