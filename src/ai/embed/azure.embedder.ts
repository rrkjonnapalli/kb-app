import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { env } from '@config/env';
import type { Embedder } from '@ai/embed/embedder.interface';

/**
 * Azure OpenAI implementation of the Embedder interface.
 *
 * Required env:
 *   EMBED_API_KEY              — Azure OpenAI API key
 *   EMBED_BASE_URL             — Azure endpoint
 *   EMBED_MODEL_NAME           — Deployment name
 *   AZURE_OPENAI_API_VERSION   — API version
 *   EMBED_DIMENSIONS           — Vector dimensions (default 1536)
 */
export class AzureEmbedder implements Embedder {
    private readonly model: AzureOpenAIEmbeddings;
    readonly dimensions: number;

    constructor() {
        this.dimensions = env.EMBED_DIMENSIONS;

        this.model = new AzureOpenAIEmbeddings({
            azureOpenAIApiKey: env.EMBED_API_KEY,
            azureOpenAIApiInstanceName: new URL(env.EMBED_BASE_URL).hostname.split('.')[0],
            azureOpenAIApiDeploymentName: env.EMBED_MODEL_NAME,
            azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION,
        });
    }

    async embed(text: string): Promise<number[]> {
        return this.model.embedQuery(text);
    }

    async embed_batch(texts: string[]): Promise<number[][]> {
        return this.model.embedDocuments(texts);
    }
}
