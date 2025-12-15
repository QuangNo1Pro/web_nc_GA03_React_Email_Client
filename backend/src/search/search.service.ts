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
  private fuseInstances = new Map<string, Fuse<Email>>();

  constructor(
    @InjectModel('Email') private emailModel: Model<Email>,
  ) {}

  /**
   * 🔍 Thực hiện fuzzy search trên emails của user
   * - Hỗ trợ typo tolerance
   * - Hỗ trợ partial match
   * - Trả về kết quả xếp hạng theo relevance
   */
  async search(
    userId: string,
    query: string,
    fields: string[] = ['subject', 'sender'],
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ total: number; results: SearchResult[] }> {
    try {
      // 1️⃣ Lấy tất cả emails của user từ MongoDB
      const emails = await this.emailModel
        .find({ userId })
        .select('messageId snippet body payload')
        .lean()
        .exec();

      this.logger.log(`[Search] User ${userId}: Loaded ${emails.length} emails`);

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

      // 2️⃣ Build Fuse.js index (hoặc dùng cached instance)
      let fuse = this.fuseInstances.get(userId);
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
        this.fuseInstances.set(userId, fuse);
        this.logger.log(`[Search] Built Fuse index for user ${userId}`);
      }

      // 3️⃣ Thực hiện search
      const searchResults = fuse.search(query);
      this.logger.log(`[Search] Query "${query}": Found ${searchResults.length} matches`);

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

  clearCache(userId: string): void {
    this.fuseInstances.delete(userId);
    this.logger.log(`[Search] Cleared cache for user ${userId}`);
  }
}
