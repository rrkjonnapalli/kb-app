import { ChatOpenAI } from '@langchain/openai';
import { env } from '@config/env';
import { SYSTEM_PROMPT } from '@ai/chat/system_prompt';
import type { ChatModel } from '@ai/chat/chat_model.interface';

/** Default base URLs per provider */
const DEFAULT_BASE_URLS: Record<string, string | undefined> = {
    OPENAI: undefined,  // langchain default (api.openai.com)
    DEEPSEEK: 'https://api.deepseek.com',
    CUSTOM: undefined,  // must be set via CHAT_BASE_URL
};

/**
 * OpenAI-compatible chat model implementation.
 * Covers OPENAI, DEEPSEEK, and CUSTOM providers — all use the OpenAI SDK
 * with an optional custom base URL.
 *
 * Required env:
 *   CHAT_API_KEY      — API key
 *   CHAT_MODEL_NAME   — Model name (e.g. gpt-4, deepseek-chat)
 *   CHAT_BASE_URL     — Optional base URL override (required for CUSTOM)
 */
export class OpenAICompatChatModel implements ChatModel {
    private readonly model: ChatOpenAI;

    constructor(provider: string) {
        const base_url = env.CHAT_BASE_URL || DEFAULT_BASE_URLS[provider];

        this.model = new ChatOpenAI({
            openAIApiKey: env.CHAT_API_KEY,
            modelName: env.CHAT_MODEL_NAME,
            temperature: 0.3,
            ...(base_url ? { configuration: { baseURL: base_url } } : {}),
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
