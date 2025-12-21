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
    // Only Gemini is supported now
    if (!this.geminiKey) {
      this.logger.error('Cannot create embedding: GEMINI_API_KEY not configured');
      throw new Error('Embeddings unavailable: GEMINI_API_KEY not set');
    }

    // Use Google Generative Language embeddings endpoint
    const baseModel = this.geminiModel || 'embedding-gecko-001';

    // Try both variants: plain and with 'models/' prefix (some APIs return names with 'models/...' while others expect the short name)
    const candidates = baseModel.startsWith('models/')
      ? [baseModel, baseModel.replace(/^models\//, '')]
      : [baseModel, `models/${baseModel}`];

    const body = { text: text };
    const errors: string[] = [];

    const maxAttempts = 4;
    const baseDelayMs = 300; // initial backoff

    const endpointSuffixes = ['embedText', 'embed', 'embeddings', 'embedContent'];
    const bodyVariants = [
      (t: string) => ({ text: t }),
      (t: string) => ({ input: t }),
      (t: string) => ({ content: [{ text: t }] }),
      // Some Gemini embedding models expect the `content.parts` shape similar to generateContent
      (t: string) => ({ content: [{ parts: [{ text: t }] }] }),
    ];

    for (const modelVariant of candidates) {
      this.logger.log(`Attempting Gemini embed with model variant: ${modelVariant}`);

      let modelAttemptError: string | null = null;

      for (const suffix of endpointSuffixes) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVariant}:${suffix}?key=${this.geminiKey}`;
        this.logger.log(`Trying endpoint ${url}`);

        let attempt = 0;
        while (attempt < maxAttempts) {
          attempt += 1;
          for (const makeBody of bodyVariants) {
            const bodyTry = makeBody(text);
            try {
              const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyTry),
              });

              if (!res.ok) {
                const txt = await res.text();
                const status = res.status;
                const errMsg = `Gemini embeddings failed (model=${modelVariant}, endpoint=${suffix}, body=${Object.keys(bodyTry).join(',')}): ${status} ${txt}`;

                if (status === 400 || status === 401 || status === 403 || status === 404) {
                  this.logger.error(errMsg);
                  errors.push(errMsg);
                  modelAttemptError = errMsg;
                  // Non-retriable for this endpoint/body; break inner loops to try next endpoint
                  attempt = maxAttempts;
                  break;
                }

                if (status === 429 || (status >= 500 && status < 600)) {
                  this.logger.warn(`${errMsg} — will retry (attempt ${attempt}/${maxAttempts})`);
                  const jitter = Math.floor(Math.random() * 100);
                  const delay = Math.min(5000, baseDelayMs * Math.pow(2, attempt - 1)) + jitter;
                  await new Promise((r) => setTimeout(r, delay));
                  continue; // retry same endpoint/body
                }

                this.logger.error(errMsg);
                errors.push(errMsg);
                modelAttemptError = errMsg;
                attempt = maxAttempts;
                break;
              }

              const data: any = await res.json();
              const embedding = data?.embeddings?.[0]?.embedding || data?.data?.[0]?.embedding;
              if (!embedding || !Array.isArray(embedding)) {
                const errMsg = `Invalid Gemini embedding response (model=${modelVariant}, endpoint=${suffix}): ${JSON.stringify(data).substring(0,200)}`;
                this.logger.error(errMsg);
                errors.push(errMsg);
                modelAttemptError = errMsg;
                // try next body variant or endpoint
                continue;
              }

              // Success
              return embedding as number[];
            } catch (err: any) {
              const errMsg = `Gemini embed attempt failed (model=${modelVariant}, endpoint=${suffix}): ${err?.message || String(err)}`;
              this.logger.error(errMsg);
              modelAttemptError = errMsg;
              const jitter = Math.floor(Math.random() * 100);
              const delay = Math.min(5000, baseDelayMs * Math.pow(2, attempt - 1)) + jitter;
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }
          }
        }
      }

      if (modelAttemptError) errors.push(modelAttemptError);
      // try next modelVariant
    }

    // If we reach here, all Gemini attempts failed
    this.logger.error(`All Gemini model variants failed: ${errors.join(' || ')}`);

    const isAllNotFound = errors.every(e => /404/.test(e));
    if (isAllNotFound) {
      throw new Error(`Gemini embedding API error: model not found. Try a different GEMINI_EMBEDDING_MODEL or verify GEMINI_API_KEY permissions. Errors: ${errors[0]}`);
    }

    throw new Error(`Gemini embedding API error: ${errors[0] || 'unknown error'}`);
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
