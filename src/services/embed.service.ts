import { embedModel } from '@ai/embed.model';

/**
 * Embed a single text string into a vector.
 * Thin wrapper so the rest of the app doesn't import LangChain directly.
 *
 * @param text - The text to embed
 * @returns The embedding vector (1536 dimensions)
 */
export async function embedText(text: string): Promise<number[]> {
    return embedModel.embedQuery(text);
}

/**
 * Embed multiple text strings into vectors (batch).
 *
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
    return embedModel.embedDocuments(texts);
}
