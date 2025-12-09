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
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Hello' }] }],
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        this.logger.log('✅ Gemini API connection successful (v1 endpoint)!');
      } catch (e: any) {
        this.logger.error(`❌ Gemini API test failed: ${e.message}`);
        this.logger.warn('⚠️ Falling back to local summarization');
        this.hasApiKey = false;
      }
    }
  }

  isAvailable(): boolean {
    return true; 
  }

  async summarizeEmail(
    emailContent: string,
    subject: string,
    maxLength: number = 160,
  ): Promise<string | null> {
    const cleanContent = this.stripHtml(emailContent);
    const truncatedInput = cleanContent.slice(0, 10000);

    // 1. Try Gemini AI via REST API
    if (this.hasApiKey) {
      try {
        const prompt = `Summarize this email in 1-2 sentences (max ${maxLength} chars):\n\nSubject: ${subject}\n\n${truncatedInput}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );

        if (response.ok) {
          const data: any = await response.json();
          const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          
          if (summary) {
            this.logger.log(`✅ Gemini AI Summary (${summary.length} chars)`);
            return this.enforceLength(summary, maxLength);
          }
        }
      } catch (error: any) {
        this.logger.warn(`⚠️ Gemini API failed: ${error.message}`);
      }
    }

    // 2. Fallback Local
    const summary = this.localSummarize(truncatedInput, subject, maxLength);
    this.logger.log(`✅ Local Summary (${summary.length} chars)`);
    return summary;
  }

  private localSummarize(content: string, subject: string, maxLength: number): string {
    const sentences = content
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      // Lọc câu quá ngắn hoặc quá dài (tránh footer)
      .filter(s => s.length > 20 && s.length < 300) 
      // Lọc sơ bộ các câu footer phổ biến
      .filter(s => !s.toLowerCase().includes('unsubscribe') && !s.toLowerCase().includes('confidential'));

    if (sentences.length === 0) {
      return this.enforceLength(content, maxLength);
    }

    // Cải tiến: Ưu tiên câu có chứa từ khóa trong Subject
    const subjectKeywords = subject.toLowerCase().split(' ').filter(w => w.length > 3);
    
    const scoredSentences = sentences.map(s => {
        let score = 0;
        // Điểm cộng cho độ dài hợp lý
        score += s.length; 
        // Điểm cộng lớn nếu khớp từ khóa với Subject
        if (subjectKeywords.some(k => s.toLowerCase().includes(k))) {
            score += 100;
        }
        return { text: s, score };
    });

    // Sort theo điểm cao nhất
    const bestSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 1); // Chỉ lấy 1 câu tốt nhất cho local fallback để an toàn

    const summary = bestSentences.map(s => s.text).join('. ');
    return this.enforceLength(summary, maxLength);
  }

  // Hàm tiện ích cắt chuỗi đẹp
  private enforceLength(text: string, maxLength: number): string {
      if (text.length <= maxLength) return text;
      return text.slice(0, maxLength - 3) + '...';
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ') // Strip tags
      .replace(/&nbsp;/g, ' ') // Handle common entity
      .replace(/\s+/g, ' ')
      .trim();
  }
}