import { OpenAIEmbeddings } from '@langchain/openai';
import { env } from '@config/env';
import type { Embedder } from '@ai/embed/embedder.interface';

/** Default base URLs per provider */
const DEFAULT_BASE_URLS: Record<string, string | undefined> = {
    OPENAI: undefined,
    DEEPSEEK: 'https://api.deepseek.com',
    CUSTOM: undefined,
};

/**
 * OpenAI-compatible embedding implementation.
 * Covers OPENAI, DEEPSEEK, and CUSTOM providers.
 *
 * Required env:
 *   EMBED_API_KEY      — API key
 *   EMBED_MODEL_NAME   — Model name (e.g. text-embedding-3-small)
 *   EMBED_BASE_URL     — Optional base URL override (required for CUSTOM)
 *   EMBED_DIMENSIONS   — Vector dimensions (default 1536)
 */
export class OpenAICompatEmbedder implements Embedder {
    private readonly model: OpenAIEmbeddings;
    readonly dimensions: number;

    constructor(provider: string) {
        this.dimensions = env.EMBED_DIMENSIONS;
        const base_url = env.EMBED_BASE_URL || DEFAULT_BASE_URLS[provider];

        this.model = new OpenAIEmbeddings({
            openAIApiKey: env.EMBED_API_KEY,
            modelName: env.EMBED_MODEL_NAME,
            dimensions: this.dimensions,
            ...(base_url ? { configuration: { baseURL: base_url } } : {}),
        });
    }

    async embed(text: string): Promise<number[]> {
        return this.model.embedQuery(text);
    }

    async embed_batch(texts: string[]): Promise<number[][]> {
        return this.model.embedDocuments(texts);
    }
}
