// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import type { KnowledgeDocument } from '@app-types/index';

/** Configuration for PDF chunking */
const CHUNK_SIZE_CHARS = 2000;
const CHUNK_OVERLAP_CHARS = 200;

/**
 * Parse a PDF buffer into chunked KnowledgeDocuments.
 *
 * Extracts text from all pages, then splits into overlapping chunks
 * of ~2000 characters to ensure good embedding quality.
 *
 * @param pdfBuffer - The raw PDF file as a Buffer
 * @param fileId - The file record ID for metadata reference
 * @param filename - Original filename for metadata
 * @returns Array of KnowledgeDocument chunks with PDF metadata
 */
export async function parsePdf(
    pdfBuffer: Buffer,
    fileId: string,
    filename: string,
): Promise<KnowledgeDocument[]> {
    const data = await pdfParse(pdfBuffer);
    const fullText = data.text;
    const totalPages = data.numpages;

    if (!fullText || fullText.trim().length === 0) {
        return [];
    }

    const chunks = chunkText(fullText, totalPages);

    return chunks.map((chunk, index) => ({
        content: chunk.text,
        metadata: {
            source_type: 'pdf' as const,
            pdf_filename: filename,
            pdf_file_id: fileId,
            page_start: chunk.estimatedPageStart,
            page_end: chunk.estimatedPageEnd,
            total_pages: totalPages,
            chunk_index: index,
        },
    }));
}

/** A text chunk with estimated page range */
interface TextChunk {
    text: string;
    estimatedPageStart: number;
    estimatedPageEnd: number;
}

/**
 * Split text into overlapping chunks of ~CHUNK_SIZE_CHARS.
 * Avoids splitting mid-sentence by finding the nearest sentence boundary.
 *
 * @param text - Full extracted text
 * @returns Array of TextChunk with estimated page ranges
 */
function chunkText(text: string, totalPages: number): TextChunk[] {
    const chunks: TextChunk[] = [];
    const avgCharsPerPage = Math.max(text.length / Math.max(totalPages, 1), 500);
    let start = 0;

    while (start < text.length) {
        let end = Math.min(start + CHUNK_SIZE_CHARS, text.length);

        // Try to find a sentence boundary near the chunk end
        if (end < text.length) {
            const searchRegion = text.substring(end - 100, end + 100);
            const sentenceEnd = searchRegion.search(/[.!?]\s/);
            if (sentenceEnd !== -1) {
                end = end - 100 + sentenceEnd + 2;
            }
        }

        const chunkText = text.substring(start, end).trim();
        if (chunkText.length > 0) {
            // Estimate page numbers based on character position
            const totalChars = text.length;
            const estPageStart = Math.floor((start / totalChars) * (totalChars / avgCharsPerPage)) + 1;
            const estPageEnd = Math.floor((end / totalChars) * (totalChars / avgCharsPerPage)) + 1;

            chunks.push({
                text: chunkText,
                estimatedPageStart: estPageStart,
                estimatedPageEnd: estPageEnd,
            });
        }

        // Advance; if overlap would cause no progress, skip it
        const nextStart = end - CHUNK_OVERLAP_CHARS;
        start = nextStart > start ? nextStart : end;
    }

    return chunks;
}
