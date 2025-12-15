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
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';

export interface CurrentUserPayload {
  sub: string; // User ID
  email: string;
  iat: number;
  exp: number;
}

@Controller('api/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(private readonly searchService: SearchService) {}

  /**
   * GET /api/search?q=<query>&fields=subject,sender&limit=20&offset=0
   *
   * Fuzzy search over emails.
   * Returns results ranked by relevance with typo tolerance and partial matches.
   *
   * Query params:
   *   - q (required): Search query string
   *   - fields (optional): Comma-separated fields to search (default: subject,sender)
   *   - limit (optional): Max results (default: 20, max: 100)
   *   - offset (optional): Pagination offset (default: 0)
   */
  @Get()
  async search(
    @Query() queryDto: SearchQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    try {
      // Validate query
      if (!queryDto.q || queryDto.q.trim().length === 0) {
        throw new BadRequestException('Query parameter "q" is required and cannot be empty');
      }

      const userId = user.sub;
      const query = queryDto.q.trim();
      const fields = queryDto.fields || ['subject', 'sender'];
      const limit = Math.min(queryDto.limit || 20, 100); // Cap at 100
      const offset = Math.max(queryDto.offset || 0, 0);

      // Perform search
      const result = await this.searchService.search(userId, query, fields, limit, offset);

      return result;
    } catch (error) {
      this.logger.error(`Search endpoint error: ${error instanceof Error ? error.message : String(error)}`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Search failed. Please try again.');
    }
  }
}
