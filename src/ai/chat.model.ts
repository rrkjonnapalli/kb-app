import { AzureChatOpenAI } from '@langchain/openai';
import { env } from '@config/env';

/**
 * Singleton AzureChatOpenAI instance.
 * Configured for gpt-4o with temperature 0.3.
 * Uses Azure OpenAI credentials from environment configuration.
 */
export const chatModel = new AzureChatOpenAI({
    azureOpenAIApiKey: env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: new URL(env.AZURE_OPENAI_ENDPOINT).hostname.split('.')[0],
    azureOpenAIApiDeploymentName: env.AZURE_OPENAI_CHAT_DEPLOYMENT,
    azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION,
    temperature: 0.3,
});
