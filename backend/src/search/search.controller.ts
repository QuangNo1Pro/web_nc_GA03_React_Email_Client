import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

interface CurrentUserPayload {
  sub: string;
  email: string;
}

interface SearchQueryDto {
  q?: string;
  fields?: string;
  limit?: string | number;
  offset?: string | number;
}

@Controller('/api/search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  /**
   * 🔍 GET /api/search?q=<query>&fields=subject,sender&limit=20&offset=0
   * 
   * Fuzzy search emails với typo tolerance + partial match
   * 
   * Query params:
   *   - q (required): Search query
   *   - fields (optional): Comma-separated fields (default: subject,sender)
   *   - limit (optional): Max results (default: 20, max: 100)
   *   - offset (optional): Pagination offset (default: 0)
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async search(
    @Query() query: SearchQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    try {
      // 🔐 Debug JWT + user
      this.logger.log(`[Search] Request: q="${query.q}", user=${user?.sub || 'UNDEFINED'}`);
      
      if (!user || !user.sub) {
        this.logger.error('[Search] ❌ User not authenticated or missing sub');
        throw new BadRequestException('JWT token không hợp lệ hoặc đã hết hạn');
      }

      // 1️⃣ Validate query
      if (!query.q || query.q.trim().length === 0) {
        throw new BadRequestException('Tham số "q" bắt buộc không được để trống');
      }

      const userId = user.sub;
      const searchQuery = query.q.trim();
      const fields = query.fields ? query.fields.split(',').map(f => f.trim()) : ['subject', 'sender'];
      const limit = Math.min(Number(query.limit) || 20, 100);
      const offset = Math.max(Number(query.offset) || 0, 0);

      this.logger.log(`🔍 Search: user=${userId}, query="${searchQuery}", fields=${fields.join(',')}`);

      // 2️⃣ Thực hiện search
      const result = await this.searchService.search(userId, searchQuery, fields, limit, offset);

      return {
        success: true,
        data: {
          total: result.total,
          results: result.results,
        },
      };
    } catch (error) {
      this.logger.error(`Search error: ${error instanceof Error ? error.message : String(error)}`);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Lỗi tìm kiếm. Vui lòng thử lại.');
    }
  }

  /**
   * 🧪 TEST ENDPOINT - không cần JWT, để verify API hoạt động
   * GET /api/search/test
   */
  @Get('test')
  test() {
    return {
      success: true,
      message: '✅ Search API hoạt động bình thường',
      timestamp: new Date().toISOString(),
    };
  }
}
