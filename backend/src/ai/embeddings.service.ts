import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private geminiKey: string | undefined;
  private geminiModel: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.geminiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    this.geminiModel = this.configService.get<string>('GEMINI_EMBEDDING_MODEL')?.trim();
    this.logger.log('Embeddings configured to use Gemini only');
    if (this.geminiKey) {
      this.logger.log('Using Gemini for embeddings (GEMINI_API_KEY provided)');
      if (this.geminiModel) {
        this.logger.log(`Gemini embedding model: ${this.geminiModel}`);
      } else {
        this.logger.log('No GEMINI_EMBEDDING_MODEL configured — using default model (may be invalid)');
      }
    } else {
      this.logger.warn('No GEMINI_API_KEY configured — embeddings will fail until GEMINI_API_KEY is set');
    }
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.geminiKey) {
      this.logger.error('Cannot create embedding: GEMINI_API_KEY not configured');
      throw new Error('Embeddings unavailable: GEMINI_API_KEY not set');
    }

    // Use text-embedding-004 with v1 API (not v1beta)
    const model = 'text-embedding-004';
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${this.geminiKey}`;

    const requestBody = {
      model: `models/${model}`,
      content: {
        parts: [
          {
            text: text
          }
        ]
      }
    };

    this.logger.log(`Calling Gemini embedding API with model: ${model}`);
    this.logger.log(`Endpoint: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Gemini embedding API error (${response.status}): ${errorText}`);
        throw new Error(`Gemini embedding API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();

      // Response format: { embedding: { values: [...] } }
      const embedding = data?.embedding?.values;

      if (!embedding || !Array.isArray(embedding)) {
        const errMsg = `Invalid Gemini embedding response: ${JSON.stringify(data).substring(0, 200)}`;
        this.logger.error(errMsg);
        throw new Error(errMsg);
      }

      this.logger.log(`Successfully generated embedding with ${embedding.length} dimensions`);
      return embedding as number[];

    } catch (error: any) {
      const errMsg = `Gemini embedding failed: ${error?.message || String(error)}`;
      this.logger.error(errMsg);
      throw new Error(errMsg);
    }
  }

  /**
   * List available Gemini models for the configured API key.
   * Useful to discover a valid embedding model name (callable from an authenticated admin UI).
   */
  async listAvailableModels(): Promise<string[]> {
    if (!this.geminiKey) {
      this.logger.error('Cannot list Gemini models: GEMINI_API_KEY not configured');
      throw new Error('GEMINI_API_KEY not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.geminiKey}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
      const txt = await res.text();
      this.logger.error(`Failed to fetch Gemini models: ${res.status} ${txt}`);
      throw new Error(`Failed to fetch Gemini models: ${res.status}`);
    }
    const data: any = await res.json();
    // data.models is expected to be an array with model objects that include a 'name' field
    const models: string[] = (data?.models || []).map((m: any) => m?.name || m?.model || JSON.stringify(m));
    this.logger.log(`Gemini models: ${models.join(', ')}`);
    return models;
  }
}
