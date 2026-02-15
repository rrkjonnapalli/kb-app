import { OllamaEmbeddings } from '@langchain/ollama';
import { env } from '@config/env';
import type { Embedder } from '@ai/embed/embedder.interface';

/**
 * Ollama embedding implementation.
 *
 * Required env:
 *   EMBED_MODEL_NAME — Ollama model name (e.g. nomic-embed-text, mxbai-embed-large)
 *   EMBED_BASE_URL   — Ollama server URL (defaults to http://localhost:11434)
 *   EMBED_DIMENSIONS — Vector dimensions (must match the model output)
 */
export class OllamaEmbedder implements Embedder {
    private readonly model: OllamaEmbeddings;
    readonly dimensions: number;

    constructor() {
        this.dimensions = env.EMBED_DIMENSIONS;

        this.model = new OllamaEmbeddings({
            baseUrl: env.EMBED_BASE_URL || 'http://localhost:11434',
            model: env.EMBED_MODEL_NAME,
            dimensions: this.dimensions,
        });
    }

    async embed(text: string): Promise<number[]> {
        return this.model.embedQuery(text);
    }

    async embed_batch(texts: string[]): Promise<number[][]> {
        return this.model.embedDocuments(texts);
    }
}
