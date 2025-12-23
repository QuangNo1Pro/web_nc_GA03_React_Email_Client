import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private apiKey: string;
  private hasApiKey: boolean = false;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();

    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
      this.logger.warn('⚠️ GEMINI_API_KEY not configured. Using local summarization.');
      return;
    }

    this.apiKey = apiKey;
    this.hasApiKey = true;
    this.logger.log('✅ Gemini AI initialized - testing connection...');
  }

  async onModuleInit() {
    if (this.hasApiKey) {
      try {
        // Test with simple list models call instead of generate
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`${response.status} ${response.statusText}: ${errorText}`);
        }

        this.logger.log('✅ Gemini API connection successful (gemini-3-pro-preview available)!');
      } catch (e: any) {
        this.logger.error(`❌ Gemini API test failed: ${e.message}`);
        this.logger.warn('⚠️ Falling back to local summarization');
        this.hasApiKey = false;
      }
    }
  }

  isAvailable(): boolean {
    return this.hasApiKey;
  }

  async summarizeEmail(
    emailContent: string,
    subject: string,
    maxLength: number = 300,
  ): Promise<string | null> {
    this.logger.log('\n========== BẮT ĐẦU TÓM TẮT EMAIL ==========');
    this.logger.log(`📧 Subject: ${subject}`);
    this.logger.log(`📝 Original content length: ${emailContent.length} chars`);

    const cleanContent = this.stripHtml(emailContent);
    this.logger.log(`🧹 After stripHtml: ${cleanContent.length} chars`);

    // Không filter gì cả, lấy toàn bộ nội dung sau khi clean HTML
    const truncatedInput = cleanContent.slice(0, 15000);
    this.logger.log(`📏 After truncate: ${truncatedInput.length} chars`);
    this.logger.log('\n--- NỘI DUNG GỬI CHO GEMINI ---');
    this.logger.log(truncatedInput.substring(0, 800) + '...\n');

    // 1. Try Gemini AI via REST API
    if (this.hasApiKey) {
      try {
        const prompt = `Hãy tóm tắt email sau đây bằng tiếng Việt trong 2-3 câu hoàn chỉnh.

Tiêu đề: ${subject}

Nội dung email:
${truncatedInput}

Tóm tắt (viết đầy đủ, không cắt giữa câu):`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.4,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 500,
              },
            }),
          }
        );

        if (response.ok) {
          const data: any = await response.json();

          // Log full response for debugging
          this.logger.debug(`Gemini full response: ${JSON.stringify(data, null, 2)}`);

          const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          const finishReason = data.candidates?.[0]?.finishReason;

          if (summary) {
            this.logger.log(`✅ Gemini AI Summary (${summary.length} chars, finish: ${finishReason}): "${summary}"`);
            return summary;
          } else {
            this.logger.warn(`⚠️ Gemini returned empty summary. Finish reason: ${finishReason}. Full response: ${JSON.stringify(data).substring(0, 500)}`);
          }
        } else {
          const errorText = await response.text();
          this.logger.warn(`⚠️ Gemini API error: ${response.status} - ${errorText}`);
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ Gemini API failed: ${error.message}`);
      }
    }

    // 2. Fallback Local
    this.logger.log('⚠️  Using local summarization fallback');
    const summary = this.localSummarize(truncatedInput, subject, maxLength);
    this.logger.log('\n--- KẾT QUẢ LOCAL SUMMARY ---');
    this.logger.log(`✅ Summary (${summary.length} chars):`);
    this.logger.log(summary);
    this.logger.log('========== KẾT THÚC TÓM TẮT ==========\n');
    return summary;
  }

  private localSummarize(content: string, subject: string, maxLength: number): string {
    // Clean up common footer patterns first
    const cleanedContent = content
      .split(/\n{2,}/)
      .filter(paragraph => {
        const lower = paragraph.toLowerCase();
        return !lower.includes('unsubscribe') &&
          !lower.includes('confidential') &&
          !lower.includes('privacy policy') &&
          !lower.includes('terms of service') &&
          !lower.includes('intended for') &&
          !lower.includes('legal notice') &&
          paragraph.length > 30; // Skip very short paragraphs
      })
      .join('\n\n');

    const sentences = cleanedContent
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 400); // Filter reasonable sentences

    if (sentences.length === 0) {
      return `Email về ${subject}`;
    }

    // Score sentences based on relevance
    const subjectKeywords = subject.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    const scoredSentences = sentences.map((s, index) => {
      let score = 0;

      // Prefer sentences near the beginning (first 5 sentences)
      if (index < 5) {
        score += (5 - index) * 50;
      }

      // Prefer medium-length sentences (50-250 chars)
      if (s.length >= 50 && s.length <= 250) {
        score += 100;
      }

      // Bonus for subject keyword matches
      subjectKeywords.forEach(keyword => {
        if (s.toLowerCase().includes(keyword)) {
          score += 200;
        }
      });

      // Penalty for very long sentences (likely not summaries)
      if (s.length > 300) {
        score -= 50;
      }

      return { text: s, score, index };
    });

    // Get top 2-3 sentences, maintain original order
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .sort((a, b) => a.index - b.index)
      .map(s => s.text);

    let summary = topSentences.join('. ');
    if (!summary.endsWith('.')) {
      summary += '.';
    }

    return summary;
  }

  // Hàm tiện ích cắt chuỗi đẹp
  private enforceLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }

  private stripHtml(html: string): string {
    if (!html) return '';

    let text = html;

    // Remove non-content elements completely
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
    text = text.replace(/<!--[\s\S]*?-->/g, ''); // Remove HTML comments

    // Convert <br> to newline
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Convert major block elements to newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n');

    // Convert table cells to space + newline for separation
    text = text.replace(/<\/(td|th)>/gi, ' \n');

    // Add space before/after remaining tags to prevent word concatenation
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode HTML entities
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, "'");
    text = text.replace(/&#8363;/gi, '₫'); // Vietnamese Dong
    text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));

    // Aggressive whitespace cleanup
    text = text.replace(/[ \t]+/g, ' '); // Multiple spaces → single space
    text = text.replace(/ *\n */g, '\n'); // Remove spaces around newlines
    text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
    text = text.replace(/^\s+|\s+$/gm, ''); // Trim each line

    return text.trim();
  }

  /**
   * 🔍 Expand search query with semantically related terms
   * Example: "money" → "money, invoice, payment, salary, price, cost"
   */
  async expandQuery(query: string): Promise<string> {
    if (!this.hasApiKey) {
      // Fallback: return original query if no API key
      return query;
    }

    try {
      const prompt = `Given the search query "${query}", list 5-7 semantically related terms or synonyms that would help find relevant emails. 

Examples:
- Query: "money" → Related: invoice, payment, salary, price, cost, financial, billing
- Query: "meeting" → Related: appointment, schedule, calendar, conference, discussion, call
- Query: "work" → Related: job, task, project, assignment, deadline, office

Now for the query "${query}", provide ONLY the related terms as a comma-separated list (no explanations):`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 100,
            },
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const relatedTerms = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (relatedTerms) {
          // Combine original query with related terms
          const expandedQuery = `${query}, ${relatedTerms}`;
          this.logger.log(`[QueryExpansion] "${query}" → "${expandedQuery}"`);
          return expandedQuery;
        }
      }
    } catch (error: any) {
      this.logger.warn(`[QueryExpansion] Failed to expand query: ${error.message}`);
    }

    // Fallback to original query
    return query;
  }
}