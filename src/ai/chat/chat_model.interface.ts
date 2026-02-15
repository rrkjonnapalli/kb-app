/**
 * ChatModel interface — pluggable contract for any chat/LLM provider.
 * Implementations wrap provider-specific SDKs (Azure OpenAI, Ollama, etc.)
 */
export interface ChatModel {
    /** Send a message with optional system context, return the LLM response */
    invoke(input: string, context?: string): Promise<string>;
}
