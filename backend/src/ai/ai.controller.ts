import { Controller, Get, Logger, UseGuards, Post, Body } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('api/ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly embeddingsService: EmbeddingsService) {}

  // Protected endpoint to list Gemini models available for the configured key
  @UseGuards(JwtAuthGuard)
  @Get('gemini/models')
  async listGeminiModels() {
    this.logger.log('Listing Gemini models');
    const models = await this.embeddingsService.listAvailableModels();
    return { models };
  }

  // Temporary public endpoint to quickly test the configured GEMINI_API_KEY
  // WARNING: public endpoint — remove or protect in production
  @Get('gemini/models/public')
  async listGeminiModelsPublic() {
    this.logger.log('Listing Gemini models (public)');
    const models = await this.embeddingsService.listAvailableModels();
    return { models };
  }

  // Temporary public endpoint to test embedding calls for a given model + text
  // Body: { model: string, text: string }
  // WARNING: public endpoint — remove or protect in production
  @Post('gemini/test-embed')
  async testEmbed(@Body() body: { model?: string; text?: string }) {
    const model = body?.model || this.embeddingsService['geminiModel'] || '';
    const text = body?.text || 'test embedding';
    this.logger.log(`Public test-embed called for model=${model}`);

    if (!model) {
      return { error: 'model required in body' };
    }

    if (!this.embeddingsService['geminiKey']) {
      return { error: 'GEMINI_API_KEY not configured on server' };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedText?key=${this.embeddingsService['geminiKey']}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const textBody = await res.text();
      let jsonBody: any = null;
      try { jsonBody = JSON.parse(textBody); } catch (_) { jsonBody = textBody; }

      return {
        status: res.status,
        ok: res.ok,
        body: jsonBody,
      };
    } catch (err: any) {
      this.logger.error(`test-embed fetch failed: ${err?.message || String(err)}`);
      return { error: err?.message || String(err) };
    }
  }
}
