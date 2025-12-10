import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class SummarizationService {
  private readonly logger = new Logger(SummarizationService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      this.logger.warn('⚠️  GEMINI_API_KEY not found');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('✅ Summarization service initialized with Gemini AI');
    }
  }

  async summarizeEmail(emailBody: string): Promise<string> {
    this.logger.log('\n========== [SummarizationService] BẮT ĐẦU TÓM TẮT ==========');
    this.logger.log(`📝 Input length: ${emailBody.length} chars`);
    
    if (!emailBody || emailBody.trim().length < 50) {
      return 'Email không có đủ nội dung để tóm tắt.';
    }

    if (!this.genAI) {
      return 'Gemini AI chưa được cấu hình.';
    }

    try {
      const truncated = emailBody.length > 15000 
        ? emailBody.substring(0, 15000) 
        : emailBody;

      this.logger.log(`✂️  Truncated to: ${truncated.length} chars`);
      this.logger.log('\n--- NỘI DUNG GỬI CHO GEMINI (first 500 chars) ---');
      this.logger.log(truncated.substring(0, 500) + '...\n');

      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-3-pro-preview',
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
        }
      });

      const prompt = `Bạn là trợ lý email thông minh. Hãy tóm tắt email này bằng tiếng Việt một cách THIẾT THỰC và DỄ HIỂU nhất.

NGUYÊN TẮC TÓM TẮT:
1. Viết bằng 100% TIẾNG VIỆT (chỉ giữ nguyên tên riêng như tên công ty, sản phẩm, người)
2. Tóm tắt thành 2-4 câu NGẮN GỌN, SÚC TÍCH, DỄ ĐỌC
3. Tập trung vào: MỤC ĐÍCH email, THÔNG TIN QUAN TRỌNG, HÀNH ĐỘNG cần làm
4. BỎ QUA hoàn toàn: chữ ký, footer, thông tin liên hệ, disclaimer, unsubscribe
5. Dùng ngôn ngữ TỰ NHIÊN, THÂN THIỆN như nói chuyện hàng ngày
6. Nếu có số liệu, thời gian, địa điểm quan trọng thì GHI RÕ

VÍ DỤ TÓM TẮT TỐT:
- "Công ty thông báo nâng cấp hệ thống vào 15/12, dịch vụ sẽ tạm ngưng 2 tiếng. Khách hàng cần hoàn tất giao dịch trước 14h."
- "Email xác nhận đơn hàng #12345 trị giá 2.5 triệu đồng. Dự kiến giao hàng trong 3-5 ngày làm việc."
- "Nhắc nhở thanh toán hóa đơn tháng 11 số tiền 500k, hạn chót 20/12. Có thể thanh toán qua chuyển khoản hoặc ví điện tử."

---

EMAIL CẦN TÓM TẮT:
${truncated}

---

Hãy viết tóm tắt bằng tiếng Việt (2-4 câu ngắn gọn):`;

      this.logger.log('🤖 Calling Gemini 3 Pro Preview...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text().trim();

      this.logger.log('\n--- KẾT QUẢ TỪ GEMINI ---');
      this.logger.log(`✅ Summary (${summary.length} chars):`);
      this.logger.log(summary);
      this.logger.log('========== [SummarizationService] KẾT THÚC ==========\n');
      return summary;

    } catch (error: any) {
      this.logger.error(`❌ Gemini AI failed: ${error?.message}`);
      this.logger.log('========== [SummarizationService] KẾT THÚC (LỖI) ==========\n');
      return 'Không thể tóm tắt email lúc này.';
    }
  }

  cleanHtmlToText(html: string): string {
    if (!html) return '';
    
    let text = html;
    
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ' ');
    
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }
}
