import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { EmbeddingsService } from './embeddings.service';
import { AiController } from './ai.controller';

/**
 * FEATURE IV: AI Module
 * Contains AI-powered services like email summarization and embeddings
 */
@Module({
  providers: [GeminiService, EmbeddingsService],
  controllers: [AiController],
  exports: [GeminiService, EmbeddingsService],
})
export class AiModule {}
