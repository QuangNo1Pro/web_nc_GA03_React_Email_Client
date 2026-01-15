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
    this.logger.log('\n--- NỘI DUNG GỬI CHO GEMINI/CUSTOM AI ---');
    this.logger.log(truncatedInput.substring(0, 800) + '...\n');

    // 1. Try Gemini AI via REST API
    if (this.hasApiKey) {
      try {
        const prompt = `Hãy tóm tắt nội dung chính của email này bằng tiếng Việt trong đúng 1 câu duy nhất, ngắn gọn và tổng quát nhất có thể.

Tiêu đề: ${subject}

Nội dung email:
${truncatedInput}

Tóm tắt (1 câu duy nhất):`;

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

    // 2. Fallback to Custom AI Provider (Ngrok/Kaggle) if Gemini fails
    const customAiUrl = this.configService.get<string>('CUSTOM_AI_API_URL');
    if (customAiUrl) {
      this.logger.log(`🔄 Falling back to Custom AI Provider at: ${customAiUrl}`);
      console.log(`Debug: Calling Custom AI at ${customAiUrl}`); // Direct console log for visibility

      try {
        const prompt = `Hãy tóm tắt nội dung chính của email này bằng tiếng Việt trong đúng 1 câu duy nhất, ngắn gọn và tổng quát nhất có thể.

Tiêu đề: ${subject}

Nội dung email:
${truncatedInput}

Tóm tắt (1 câu duy nhất):`;

        // Log headers for debugging
        this.logger.debug('Sending aggressive headers to bypass Ngrok...');

        // Define headers reusable for redirect (Postman UA + Bypass keys)
        const headers = {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Ngrok-Skip-Browser-Warning': 'true',
          'Bypass-Tunnel-Reminder': 'true',
          'User-Agent': 'PostmanRuntime/7.29.0',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Cookie': 'ngrok-skip-browser-warning=1' // Critical for Ngrok bypass
        };

        const body = JSON.stringify({
          model: "llama3.2",
          prompt: prompt,
          stream: false,
          text: prompt,
          input: prompt
        });

        let response = await fetch(customAiUrl, {
          method: 'POST',
          headers: headers,
          body: body,
          redirect: 'manual'
        });

        // Handle Redirects manually to preserve headers
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          this.logger.warn(`⚠️ Custom AI Redirecting to: ${location}. Following manually...`);
          if (location) {
            response = await fetch(location, {
              method: 'POST',
              headers: headers, // Reuse robust headers
              body: body,
            });
          }
        }

        if (response.ok) {
          const responseText = await response.text();
          try {
            const data: any = JSON.parse(responseText);
            this.logger.debug(`Custom AI full response: ${JSON.stringify(data).slice(0, 200)}...`);

            // Try to find the output in common fields
            const summary = data.response || data.generated_text || data.output || data.text || (data.candidates && data.candidates[0]?.content);

            if (summary && typeof summary === 'string') {
              this.logger.log(`✅ Custom AI Summary: "${summary.substring(0, 100)}..."`);
              return summary.trim();
            } else {
              this.logger.warn(`⚠️ Custom AI returned unknown format: ${responseText.substring(0, 200)}`);
              // return 'Lỗi: Custom AI trả về định dạng không hỗ trợ.'; 
              // Don't return error string, let it fall through to null
            }
          } catch (parseError) {
            this.logger.error(`❌ Custom AI Parse Error: Response is not JSON. Likely an HTML error page.`);
            this.logger.error(`Response content start: ${responseText.substring(0, 500)}`);
          }
        } else {
          const errText = await response.text();
          this.logger.error(`❌ Custom AI API error: ${response.status} - ${errText}`);
        }
      } catch (error: any) {
        this.logger.error(`❌ Custom AI request failed: ${error.message}`);
      }
    }

    this.logger.warn('⚠️ All AI providers failed. Returning null.');
    return null;
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

  // Hàm tiện ích cắt chuỗi đẹp
  private enforceLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
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

  /**
   * 🏆 Rerank search results using Gemini
   * This improves accuracy by asking the LLM to judge specific relevance
   */
  async rerankSearchResults(query: string, items: { id: string; content: string }[]): Promise<string[]> {
    if (!this.hasApiKey || items.length === 0) return items.map(i => i.id);

    try {
      this.logger.log(`[Rerank] Reranking ${items.length} items for query "${query}"`);

      // ⚠️ Critical: "Sort" instead of "Filter". We trust the vector search found good candidates.
      // We just want to bubble the best ones to the top.
      const prompt = `You are an expert search ranking system.
Query: "${query}"

Rank the following email snippets by relevance to the query. 
Return a JSON array of the IDs in order of decreasing relevance (most relevant first).
INCLUDE ALL ITEMS in the returned array. Do not exclude any items.

Items:
${items.map((item, index) => `${index + 1}. [ID: ${item.id}] Content: ${item.content.substring(0, 300)}...`).join('\n')}

Return ONLY the JSON array of strings (e.g. ["id1", "id2"]). No markdown blocks.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.0, // Zero temp for max determinism
              responseMimeType: "application/json"
            },
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (rawText) {
          try {
            // 🧹 Sanitize: Remove markdown code blocks if present
            rawText = rawText.replace(/```json\n?|\n?```/g, '').trim();

            const rankedIds = JSON.parse(rawText);
            if (Array.isArray(rankedIds) && rankedIds.length > 0) {
              this.logger.log(`[Rerank] Success. Top result: ${rankedIds[0]}`);
              return rankedIds;
            } else {
              this.logger.warn(`[Rerank] Received empty or invalid array. Falling back.`);
            }
          } catch (e) {
            this.logger.warn(`[Rerank] Failed to parse JSON: ${rawText}`);
          }
        }
      } else {
        const err = await response.text();
        this.logger.error(`[Rerank] API error: ${err}`);
      }
    } catch (error: any) {
      this.logger.error(`[Rerank] Error: ${error.message}`);
    }

    // Fallback: return original order
    return items.map(i => i.id);
  }
}