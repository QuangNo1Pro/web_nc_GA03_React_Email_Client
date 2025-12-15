import { IsString, IsOptional, IsNumber, Min, Max, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchQueryDto {
  @IsString()
  q: string; // Search query (required)

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[]; // Fields to search: ['subject', 'sender', 'body']. Defaults to ['subject', 'sender']

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20; // Max results per page

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0; // Pagination offset
}
