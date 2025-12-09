import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';

/**
 * FEATURE IV: AI Module
 * Contains AI-powered services like email summarization
 */
@Module({
  providers: [GeminiService],
  exports: [GeminiService],
})
export class AiModule {}
