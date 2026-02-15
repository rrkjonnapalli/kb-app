import { logger } from '@utils/log.util';
import { PDFOptionsRequiredError, PDFSourceMissingError, PDFDownloadError } from '@errors/pdf.error';
import type { Extractor, ExtractOptions } from '@extractors/extractor.interface';

/** Raw PDF data: the buffer + filename */
export interface PdfExtractResult {
    buffer: Buffer;
    filename: string;
}

/**
 * PDF extractor — fetches PDF data from a URL or accepts a buffer directly.
 */
export class PDFExtractor implements Extractor<PdfExtractResult> {
    /**
     * Extract PDF data.
     * Provide either `options.url` (downloads) or `options.buffer` (direct).
     */
    async extract(options?: ExtractOptions): Promise<PdfExtractResult[]> {
        if (!options) {
            throw new PDFOptionsRequiredError();
        }

        if (options.buffer) {
            return [{
                buffer: options.buffer as Buffer,
                filename: (options.filename as string) || 'document.pdf',
            }];
        }

        if (options.url) {
            const buffer = await this.download(options.url);
            const filename = (options.filename as string) || this.extract_filename(options.url);
            return [{ buffer, filename }];
        }

        throw new PDFSourceMissingError();
    }

    /** Download a PDF from a URL */
    private async download(url: string): Promise<Buffer> {
        logger.info({ url }, 'Downloading PDF from URL');

        const response = await fetch(url);
        if (!response.ok) {
            throw new PDFDownloadError(response.status, response.statusText);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /** Extract filename from URL */
    private extract_filename(url: string): string {
        try {
            const pathname = new URL(url).pathname;
            const segments = pathname.split('/');
            const last = segments[segments.length - 1];
            return last || 'document.pdf';
        } catch {
            return 'document.pdf';
        }
    }
}
