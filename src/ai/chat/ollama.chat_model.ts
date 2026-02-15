import { ChatOllama } from '@langchain/ollama';
import { env } from '@config/env';
import { SYSTEM_PROMPT } from '@ai/chat/system_prompt';
import type { ChatModel } from '@ai/chat/chat_model.interface';

/**
 * Ollama chat model implementation.
 *
 * Required env:
 *   CHAT_MODEL_NAME — Ollama model name (e.g. llama3, mistral)
 *   CHAT_BASE_URL   — Ollama server URL (defaults to http://localhost:11434)
 */
export class OllamaChatModel implements ChatModel {
    private readonly model: ChatOllama;

    constructor() {
        this.model = new ChatOllama({
            baseUrl: env.CHAT_BASE_URL || 'http://localhost:11434',
            model: env.CHAT_MODEL_NAME,
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
