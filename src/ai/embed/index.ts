import { env } from '@config/env';
import { ModelProvider } from '@enums/model_provider.enum';
import { EmbedNotConfiguredError, ProviderUnsupportedError } from '@errors/ai.error';
import type { Embedder } from '@ai/embed/embedder.interface';

let instance: Embedder | null = null;

/**
 * Get the singleton Embedder instance.
 * Selects implementation based on EMBED_MODEL_PROVIDER env var.
 * Throws EmbedNotConfiguredError if the provider is not set.
 */
export function get_embedder(): Embedder {
    if (!instance) {
        const provider = env.EMBED_MODEL_PROVIDER;

        if (!provider) throw new EmbedNotConfiguredError();

        switch (provider) {
            case ModelProvider.AZURE: {
                const { AzureEmbedder } = require('@ai/embed/azure.embedder');
                instance = new AzureEmbedder();
                break;
            }
            case ModelProvider.OPENAI:
            case ModelProvider.DEEPSEEK:
            case ModelProvider.CUSTOM: {
                const { OpenAICompatEmbedder } = require('@ai/embed/openai_compat.embedder');
                instance = new OpenAICompatEmbedder(provider);
                break;
            }
            case ModelProvider.OLLAMA: {
                const { OllamaEmbedder } = require('@ai/embed/ollama.embedder');
                instance = new OllamaEmbedder();
                break;
            }
            default:
                throw new ProviderUnsupportedError('embed', provider);
        }
    }
    return instance!;
}

export type { Embedder } from '@ai/embed/embedder.interface';
