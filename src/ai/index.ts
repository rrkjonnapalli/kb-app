import { get_embedder, type Embedder } from '@ai/embed';
import { get_chat_model, type ChatModel } from '@ai/chat';

/**
 * AI namespace — provides access to embed and chat model singletons.
 *
 * Usage:
 *   import { ai } from '@ai';
 *   const vec = await ai.embed.embed('some text');
 *   const answer = await ai.chat.invoke(question, context);
 */
export const ai = {
    get embed(): Embedder {
        return get_embedder();
    },
    get chat(): ChatModel {
        return get_chat_model();
    },
};

export { get_embedder, type Embedder } from '@ai/embed';
export { get_chat_model, type ChatModel } from '@ai/chat';
