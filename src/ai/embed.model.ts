import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { env } from '@config/env';

/**
 * Singleton AzureOpenAIEmbeddings instance.
 * Configured for the `text-embedding-3-small` model (1536 dimensions).
 * Uses Azure OpenAI credentials from environment configuration.
 */
export const embedModel = new AzureOpenAIEmbeddings({
    azureOpenAIApiKey: env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: new URL(env.AZURE_OPENAI_ENDPOINT).hostname.split('.')[0],
    azureOpenAIApiDeploymentName: env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT,
    azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION,
});
