import { AppError } from '@errors/app.error';

/** PDF extraction requires options with url or buffer */
export class PDFOptionsRequiredError extends AppError {
    constructor() {
        super('PDF_OPTIONS_REQUIRED', 'PDFExtractor: options with url or buffer required', 400);
        this.name = 'PDFOptionsRequiredError';
    }
}

/** PDF extraction source missing — either url or buffer must be provided */
export class PDFSourceMissingError extends AppError {
    constructor() {
        super('PDF_SOURCE_MISSING', 'PDFExtractor: either url or buffer must be provided', 400);
        this.name = 'PDFSourceMissingError';
    }
}

/** PDF download failed — HTTP error */
export class PDFDownloadError extends AppError {
    constructor(status: number, status_text: string) {
        super('PDF_DOWNLOAD_FAILED', `Failed to download PDF: ${status} ${status_text}`);
        this.name = 'PDFDownloadError';
    }
}
