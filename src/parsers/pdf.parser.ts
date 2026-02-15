// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
import type { KnowledgeDocument } from '@app-types/document.types';
import type { Parser } from '@parsers/parser.interface';
import type { PdfExtractResult } from '@extractors/pdf/pdf.extractor';
import { chunk_text } from '@parsers/text_chunker';
import { ParserNotSupportedError } from '@errors/parse.error';

/**
 * PDF parser — converts extracted PDF data into chunked KnowledgeDocuments.
 * Uses the shared text-chunker for overlapping chunk creation.
 */
export class PDFParser implements Parser<PdfExtractResult & { file_id: string }> {
    /** Parse a PDF extract result into chunked documents */
    parse(raw: PdfExtractResult & { file_id: string }): KnowledgeDocument[] {
        // parse_pdf is async, so we need a sync wrapper.
        // The actual parsing is delegated to parse_pdf below.
        // This class method is a structural placeholder — consumers
        // should use parse_pdf() directly for async PDF parsing.
        throw new ParserNotSupportedError('PDFParser.parse()', 'parse_pdf()');
    }
}

/**
 * Parse a PDF buffer into chunked KnowledgeDocuments.
 * Extracts text from all pages, then splits into overlapping chunks.
 *
 * @param pdfBuffer - The raw PDF file as a Buffer
 * @param fileId - The file record ID for metadata reference
 * @param filename - Original filename for metadata
 * @returns Array of KnowledgeDocument chunks with PDF metadata
 */
export async function parse_pdf(
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

    const chunks = chunk_text(fullText, { chunk_size: 1000, chunk_overlap: 200 });
    const avgCharsPerPage = Math.max(fullText.length / Math.max(totalPages, 1), 500);

    return chunks.map((chunk) => ({
        content: chunk.text,
        metadata: {
            source_type: 'pdf' as const,
            pdf_filename: filename,
            pdf_file_id: fileId,
            page_start: Math.floor((chunk.start_char / fullText.length) * (fullText.length / avgCharsPerPage)) + 1,
            page_end: Math.floor((chunk.end_char / fullText.length) * (fullText.length / avgCharsPerPage)) + 1,
            total_pages: totalPages,
            chunk_index: chunk.index,
        },
    }));
}
