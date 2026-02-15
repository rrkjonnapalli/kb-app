import { env } from '@config/env';
import { ModelProvider } from '@enums/model_provider.enum';
import { ChatNotConfiguredError, ProviderUnsupportedError } from '@errors/ai.error';
import type { ChatModel } from '@ai/chat/chat_model.interface';

let instance: ChatModel | null = null;

/**
 * Get the singleton ChatModel instance.
 * Selects implementation based on CHAT_MODEL_PROVIDER env var.
 * Throws ChatNotConfiguredError if the provider is not set.
 */
export function get_chat_model(): ChatModel {
    if (!instance) {
        const provider = env.CHAT_MODEL_PROVIDER;

        if (!provider) throw new ChatNotConfiguredError();

        switch (provider) {
            case ModelProvider.AZURE: {
                const { AzureChatModel } = require('@ai/chat/azure.chat_model');
                instance = new AzureChatModel();
                break;
            }
            case ModelProvider.OPENAI:
            case ModelProvider.DEEPSEEK:
            case ModelProvider.CUSTOM: {
                const { OpenAICompatChatModel } = require('@ai/chat/openai_compat.chat_model');
                instance = new OpenAICompatChatModel(provider);
                break;
            }
            case ModelProvider.OLLAMA: {
                const { OllamaChatModel } = require('@ai/chat/ollama.chat_model');
                instance = new OllamaChatModel();
                break;
            }
            default:
                throw new ProviderUnsupportedError('chat', provider);
        }
    }
    return instance!;
}

export type { ChatModel } from '@ai/chat/chat_model.interface';
