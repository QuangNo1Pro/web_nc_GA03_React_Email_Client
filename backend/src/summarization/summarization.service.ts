import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class SummarizationService {
  private readonly logger = new Logger(SummarizationService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private readonly MAX_SUMMARY_WORDS = 25;
  private readonly API_TIMEOUT = 10000; // 10 seconds

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      this.logger.warn('⚠️  GEMINI_API_KEY not found - summarization will use fallback mode');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('✅ Summarization service initialized with Gemini AI');
    }
  }

  /**
   * Main entry point for email summarization
   * @param emailBody - Cleaned email body text
   * @returns Short, meaningful summary (1-2 sentences, max 25 words)
   */
  async summarizeEmail(emailBody: string): Promise<string> {
    // Validate input - require minimum 50 chars for meaningful summary
    if (!emailBody || emailBody.trim().length < 50) {
      return 'Email không có đủ nội dung để tóm tắt.';
    }

    // Check if it's a marketing/notification template
    if (this.isMarketingOrTemplate(emailBody)) {
      return 'Email thông báo tự động từ hệ thống. Không có nội dung quan trọng.';
    }

    // Generate summary with Gemini AI
    try {
      const summary = await this.generateWithAI(emailBody);
      
      // Validate summary quality
      if (this.isValidSummary(summary, emailBody)) {
        return summary;
      }
      
      // Fallback if AI generates poor quality
      this.logger.warn('[Summarization] AI generated poor quality summary, using fallback');
      return this.generateFallbackSummary(emailBody);
      
    } catch (error: any) {
      this.logger.error('[Summarization] AI generation failed:', error?.message || String(error));
      return this.generateFallbackSummary(emailBody);
    }
  }

  /**
   * Generate summary using Gemini AI with strict constraints
   */
  private async generateWithAI(emailBody: string): Promise<string> {
    if (!this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    // Truncate to avoid token limits (keep first 2000 chars for context)
    const truncated = emailBody.length > 2000 
      ? emailBody.substring(0, 2000) + '...' 
      : emailBody;

    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      generationConfig: {
        temperature: 0.3, // Lower temperature for more focused summaries
        maxOutputTokens: 100, // Strict limit
      }
    });

    const prompt = `Bạn là trợ lý tóm tắt email chuyên nghiệp.

YÊU CẦU BẮT BUỘC:
- Tóm tắt nội dung email thành 1-2 câu NGẮN GỌN, tối đa 25 từ
- Chỉ nêu ý chính, hành động cần làm, hoặc thông tin quan trọng
- KHÔNG lặp lại nguyên văn nội dung email
- KHÔNG thêm ý không có trong email gốc
- KHÔNG tóm tắt thành câu vô nghĩa
- Viết bằng tiếng Việt rõ ràng, súc tích

Email cần tóm tắt:
${truncated}

Tóm tắt (chỉ trả về summary, không có phần giải thích):`;

    const result = await Promise.race([
      model.generateContent(prompt),
      this.timeout(this.API_TIMEOUT)
    ]);

    if (result === 'timeout') {
      throw new Error('AI generation timeout');
    }

    const response = await (result as any).response;
    const summary = response.text().trim();

    // Remove quotes if AI wraps response in them
    return summary.replace(/^["']|["']$/g, '');
  }

  /**
   * Validate summary quality
   */
  private isValidSummary(summary: string, originalBody: string): boolean {
    if (!summary || summary.length < 10) return false;
    
    // Check word count (should be under 25 words)
    const wordCount = summary.split(/\s+/).length;
    if (wordCount > this.MAX_SUMMARY_WORDS + 5) return false; // Allow 5 word buffer
    
    // Check if summary is just repeating original text (more than 70% overlap)
    const overlapRatio = this.calculateTextOverlap(summary, originalBody);
    if (overlapRatio > 0.7) return false;
    
    // Check for meaningless patterns
    const meaninglessPatterns = [
      /^(no content|không có nội dung|empty|trống)/i,
      /^(email|message|thư)/i, // Just repeating "email" or "message"
      /^[.\s]+$/, // Only dots and spaces
    ];
    
    if (meaninglessPatterns.some(pattern => pattern.test(summary))) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate text overlap ratio (simple approach)
   */
  private calculateTextOverlap(summary: string, original: string): number {
    const summaryWords = new Set(summary.toLowerCase().split(/\s+/));
    const originalWords = original.toLowerCase().split(/\s+/);
    
    let matches = 0;
    summaryWords.forEach(word => {
      if (originalWords.includes(word) && word.length > 3) { // Ignore short words
        matches++;
      }
    });
    
    return matches / Math.max(summaryWords.size, 1);
  }

  /**
   * Detect marketing/template emails
   */
  private isMarketingOrTemplate(emailBody: string): boolean {
    const lowerBody = emailBody.toLowerCase();
    
    // Marketing indicators
    const marketingKeywords = [
      'unsubscribe', 'click here', 'shop now', 'buy now',
      'special offer', 'limited time', 'discount', 'sale',
      'promotional', 'newsletter', 'update your preferences',
      'pinterest', 'shopee', 'lazada', 'tiki', 'sendo',
      'if you no longer wish to receive', 'this is an automated message'
    ];
    
    const hasMarketingKeywords = marketingKeywords.some(keyword => 
      lowerBody.includes(keyword)
    );
    
    // Check if body is mostly HTML/links (template characteristic)
    const linkCount = (emailBody.match(/https?:\/\//gi) || []).length;
    const hasExcessiveLinks = linkCount > 5;
    
    return hasMarketingKeywords || hasExcessiveLinks;
  }

  /**
   * Fallback summary when AI fails or generates poor quality
   */
  private generateFallbackSummary(emailBody: string): string {
    // Clean text
    const cleaned = emailBody
      .replace(/\s+/g, ' ')
      .trim();

    // Extract first meaningful sentence
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
    
    if (sentences.length === 0) {
      // No sentences found, take first 100 chars
      const preview = cleaned.substring(0, 100).trim();
      return preview + (cleaned.length > 100 ? '...' : '');
    }

    // Get first 1-2 sentences, limit to ~25 words
    let summary = sentences[0] ? sentences[0].trim() : cleaned.substring(0, 100);
    const words = summary.split(/\s+/);
    
    if (words.length > this.MAX_SUMMARY_WORDS) {
      summary = words.slice(0, this.MAX_SUMMARY_WORDS).join(' ') + '...';
    } else if (sentences.length > 1 && words.length < 15) {
      // If first sentence is too short, add second
      const secondSentence = sentences[1].trim();
      const combined = summary + ' ' + secondSentence;
      const combinedWords = combined.split(/\s+/);
      
      if (combinedWords.length <= this.MAX_SUMMARY_WORDS) {
        summary = combined;
      }
    }

    return summary;
  }

  /**
   * Timeout helper
   */
  private timeout(ms: number): Promise<string> {
    return new Promise(resolve => {
      setTimeout(() => resolve('timeout'), ms);
    });
  }

  /**
   * Clean HTML and extract plain text
   */
  cleanHtmlToText(html: string): string {
    if (!html) return '';
    
    let text = html;
    
    // Remove style blocks
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove script blocks
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // Remove email signatures (common patterns)
    text = text.replace(/--\s*$/gm, ''); // -- signature delimiter
    text = text.replace(/Best regards,[\s\S]*$/i, '');
    text = text.replace(/Sent from my (iPhone|iPad|Android)/gi, '');
    
    // Remove disclaimers
    text = text.replace(/This email and any attachments[\s\S]*$/i, '');
    text = text.replace(/CONFIDENTIAL[\s\S]*$/i, '');
    
    // Convert <br> to newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    
    // Remove all HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Normalize whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }
}
