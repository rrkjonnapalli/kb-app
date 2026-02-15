import { files } from '@services/file.service';
import { documents } from '@services/document.service';
import { extractors } from '@extractors/index';
import { parse_pdf } from '@parsers/pdf.parser';
import { FileStatus } from '@enums/file_status.enum';
import { logger } from '@utils/log.util';

/**
 * Create a new file record with pending status and return its ID.
 */
export async function create_file_record(
    filename: string,
    source: 'upload' | 'url',
    originalUrl?: string,
): Promise<string> {
    return files.create(filename, source, originalUrl);
}

/**
 * Get a file record by ID.
 */
export async function get_file_record(fileId: string) {
    return files.find_by_id(fileId);
}

/**
 * Process a PDF buffer asynchronously: parse → embed → store.
 * Updates the file record status throughout the process.
 * This runs in the background — the caller does NOT await its completion.
 */
export async function run(
    pdfBuffer: Buffer,
    fileId: string,
    filename: string,
): Promise<void> {
    try {
        await files.update_status(fileId, FileStatus.PROCESSING);
        logger.info({ fileId, filename }, 'Starting PDF processing');

        const _docs = await parse_pdf(pdfBuffer, fileId, filename);

        if (_docs.length === 0) {
            await files.update_status(fileId, FileStatus.COMPLETED, { chunks_count: 0 });
            logger.warn({ fileId, filename }, 'PDF contained no extractable text');
            return;
        }

        await documents.add(_docs);

        await files.update_status(fileId, FileStatus.COMPLETED, { chunks_count: _docs.length });
        logger.info(
            { fileId, filename, chunks: _docs.length },
            'PDF processing completed',
        );
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await files.update_status(fileId, FileStatus.FAILED, { error: errorMsg });
        console.log(`Error processing PDF (fileId: ${fileId}, filename: ${filename}):`, error);
        logger.error({ fileId, filename, error }, 'PDF processing failed');
    }
}

/**
 * Download a PDF from a URL and return it as a Buffer.
 */
export async function download_pdf(url: string): Promise<Buffer> {
    logger.info({ url }, 'Downloading PDF from URL');
    const result = await extractors.pdf.extract({ url });
    return result[0].buffer;
}
