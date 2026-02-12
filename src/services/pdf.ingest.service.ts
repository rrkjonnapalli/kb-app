import { FileStatus } from '@enums/index';
import { parsePdf } from '@parsers/pdf.parser';
import { addDocuments } from '@services/vector.service';
import { getStore } from '@store/index';
import { logger } from '@utils/log.util';
import type { FileRecord } from '@app-types/index';

/**
 * Create a new file record in the store and return its ID.
 * The record starts with `pending` status.
 *
 * @param filename - Original filename
 * @param source - How the file was provided ('upload' or 'url')
 * @param originalUrl - Optional URL if source is 'url'
 * @returns The inserted file record ID as a string
 */
export async function createFileRecord(
    filename: string,
    source: 'upload' | 'url',
    originalUrl?: string,
): Promise<string> {
    return getStore().createFileRecord(filename, source, originalUrl);
}

/**
 * Get a file record by ID.
 *
 * @param fileId - The file record ID
 * @returns The file record or null
 */
export async function getFileRecord(fileId: string): Promise<FileRecord | null> {
    return getStore().getFileRecord(fileId);
}

/**
 * Process a PDF buffer asynchronously: parse → embed → store in vector DB.
 * Updates the file record status throughout the process.
 * This runs in the background — the caller does NOT await its completion.
 *
 * @param pdfBuffer - The raw PDF data
 * @param fileId - The file record ID for status tracking
 * @param filename - Original filename for metadata
 */
export async function processPdfAsync(
    pdfBuffer: Buffer,
    fileId: string,
    filename: string,
): Promise<void> {
    const store = getStore();

    try {
        // Mark as processing
        await store.updateFileStatus(fileId, FileStatus.PROCESSING);
        logger.info({ fileId, filename }, 'Starting PDF processing');

        // Parse PDF into chunks
        const docs = await parsePdf(pdfBuffer, fileId, filename);

        if (docs.length === 0) {
            await store.updateFileStatus(fileId, FileStatus.COMPLETED, { chunks_count: 0 });
            logger.warn({ fileId, filename }, 'PDF contained no extractable text');
            return;
        }

        // Embed and store
        await addDocuments(docs);

        // Mark as completed
        await store.updateFileStatus(fileId, FileStatus.COMPLETED, { chunks_count: docs.length });
        logger.info(
            { fileId, filename, chunks: docs.length },
            'PDF processing completed',
        );
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await store.updateFileStatus(fileId, FileStatus.FAILED, { error: errorMsg });
        logger.error(
            { fileId, filename, error },
            'PDF processing failed',
        );
    }
}

/**
 * Download a PDF from a URL and return it as a Buffer.
 *
 * @param url - The PDF URL
 * @returns The PDF content as a Buffer
 * @throws Error if download fails or response is not OK
 */
export async function downloadPdf(url: string): Promise<Buffer> {
    logger.info({ url }, 'Downloading PDF from URL');

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
