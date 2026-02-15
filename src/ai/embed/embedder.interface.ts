/**
 * Embedder interface — pluggable contract for any embedding provider.
 * Implementations wrap provider-specific SDKs (Azure OpenAI, Ollama, etc.)
 */
export interface Embedder {
    /** Number of dimensions the model produces */
    readonly dimensions: number;

    /** Embed a single text string into a vector */
    embed(text: string): Promise<number[]>;

    /** Embed multiple texts in a batch */
    embed_batch(texts: string[]): Promise<number[][]>;
}
