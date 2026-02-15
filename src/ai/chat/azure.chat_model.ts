import { AzureChatOpenAI } from '@langchain/openai';
import { env } from '@config/env';
import { SYSTEM_PROMPT } from '@ai/chat/system_prompt';
import type { ChatModel } from '@ai/chat/chat_model.interface';

/**
 * Azure OpenAI implementation of the ChatModel interface.
 *
 * Required env:
 *   CHAT_API_KEY          — Azure OpenAI API key
 *   CHAT_BASE_URL         — Azure endpoint (e.g. https://my-instance.openai.azure.com/)
 *   CHAT_MODEL_NAME       — Deployment name
 *   AZURE_OPENAI_API_VERSION — API version (default 2024-02-01)
 */
export class AzureChatModel implements ChatModel {
    private readonly model: AzureChatOpenAI;

    constructor() {
        this.model = new AzureChatOpenAI({
            azureOpenAIApiKey: env.CHAT_API_KEY,
            azureOpenAIApiInstanceName: new URL(env.CHAT_BASE_URL).hostname.split('.')[0],
            azureOpenAIApiDeploymentName: env.CHAT_MODEL_NAME,
            azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION,
            temperature: 0.3,
        });
    }

    async invoke(input: string, context?: string): Promise<string> {
        const messages: Array<{ role: string; content: string }> = [];

        if (context) {
            messages.push({
                role: 'system',
                content: SYSTEM_PROMPT.replace('{context}', context),
            });
        }

        messages.push({ role: 'user', content: input });

        const response = await this.model.invoke(messages);
        return typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);
    }
}
