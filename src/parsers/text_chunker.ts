/** Configuration for text chunking */
export interface ChunkOptions {
    chunk_size?: number;
    chunk_overlap?: number;
}

/** A text chunk with position info */
export interface TextChunk {
    text: string;
    index: number;
    start_char: number;
    end_char: number;
}

const DEFAULT_CHUNK_SIZE = 2000;
const DEFAULT_OVERLAP = 200;

/**
 * Split text into overlapping chunks with sentence-boundary awareness.
 * Avoids splitting mid-sentence when possible.
 *
 * @param text - Full text to chunk
 * @param options - Chunk size and overlap configuration
 * @returns Array of TextChunk with position metadata
 */
export function chunk_text(text: string, options?: ChunkOptions): TextChunk[] {
    const chunkSize = options?.chunk_size || DEFAULT_CHUNK_SIZE;
    const overlap = options?.chunk_overlap || DEFAULT_OVERLAP;
    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
        let end = Math.min(start + chunkSize, text.length);

        // Try to find a sentence boundary near the chunk end
        if (end < text.length) {
            const searchStart = Math.max(end - 100, start);
            const searchEnd = Math.min(end + 100, text.length);
            const searchRegion = text.substring(searchStart, searchEnd);
            const sentenceEnd = searchRegion.search(/[.!?]\s/);
            if (sentenceEnd !== -1) {
                end = searchStart + sentenceEnd + 2;
            }
        }

        const chunkText = text.substring(start, end).trim();
        if (chunkText.length > 0) {
            chunks.push({
                text: chunkText,
                index,
                start_char: start,
                end_char: end,
            });
            index++;
        }

        // Advance; if overlap would cause no progress, skip it
        const nextStart = end - overlap;
        start = nextStart > start ? nextStart : end;
    }

    return chunks;
}
