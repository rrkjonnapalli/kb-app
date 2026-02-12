import { Elysia, t } from 'elysia';
import {
    createFileRecord,
    getFileRecord,
    processPdfAsync,
    downloadPdf,
} from '@services/pdf.ingest.service';
import { logger } from '@utils/log.util';

/**
 * PDF API plugin.
 * Provides endpoints for ingesting PDF documents into the knowledge base.
 *
 * Routes:
 * - POST /api/pdf/url    — ingest a PDF from a URL (async)
 * - POST /api/pdf/upload — ingest an uploaded PDF file (async)
 * - GET  /api/pdf/:id    — get the processing status of a PDF
 */
export const pdfApi = new Elysia({ prefix: '/api/pdf' })
    .post(
        '/url',
        async ({ body }) => {
            const { url, filename } = body;
            const resolvedFilename = filename || extractFilename(url);

            // Create file record
            const fileId = await createFileRecord(resolvedFilename, 'url', url);

            // Fire and forget — do NOT await
            downloadPdf(url)
                .then((buffer) => processPdfAsync(buffer, fileId, resolvedFilename))
                .catch((err) => {
                    logger.error({ fileId, url, error: err }, 'PDF URL ingestion failed');
                });

            return {
                file_id: fileId,
                filename: resolvedFilename,
                status: 'pending',
                message: 'PDF ingestion started. Use GET /api/pdf/:id to check status.',
            };
        },
        {
            body: t.Object({
                url: t.String({ description: 'URL of the PDF to ingest' }),
                filename: t.Optional(
                    t.String({ description: 'Optional filename override' }),
                ),
            }),
            detail: {
                summary: 'Ingest PDF from URL',
                description:
                    'Download a PDF from the given URL and ingest it into the knowledge base. Processing happens asynchronously — returns immediately with a file_id to track status.',
                tags: ['PDF'],
            },
        },
    )
    .post(
        '/upload',
        async ({ body }) => {
            const file = body.file;
            const filename = file.name || 'uploaded.pdf';

            // Create file record
            const fileId = await createFileRecord(filename, 'upload');

            // Read file into buffer and fire async processing
            const buffer = Buffer.from(await file.arrayBuffer());

            // Fire and forget — do NOT await
            processPdfAsync(buffer, fileId, filename).catch((err) => {
                logger.error({ fileId, filename, error: err }, 'PDF upload ingestion failed');
            });

            return {
                file_id: fileId,
                filename,
                status: 'pending',
                message: 'PDF ingestion started. Use GET /api/pdf/:id to check status.',
            };
        },
        {
            body: t.Object({
                file: t.File({
                    description: 'PDF file to upload and ingest',
                }),
            }),
            detail: {
                summary: 'Ingest uploaded PDF',
                description:
                    'Upload a PDF file and ingest it into the knowledge base. Processing happens asynchronously — returns immediately with a file_id to track status.',
                tags: ['PDF'],
            },
        },
    )
    .get(
        '/:id',
        async ({ params }) => {
            const record = await getFileRecord(params.id);

            if (!record) {
                return { error: 'File record not found' };
            }

            return {
                file_id: params.id,
                filename: record.filename,
                source: record.source,
                status: record.status,
                chunks_count: record.chunks_count,
                error: record.error,
                created_at: record.created_at,
                updated_at: record.updated_at,
            };
        },
        {
            params: t.Object({
                id: t.String({ description: 'File record ID' }),
            }),
            detail: {
                summary: 'Get PDF processing status',
                description: 'Check the processing status of a previously submitted PDF.',
                tags: ['PDF'],
            },
        },
    );

/**
 * Extract a filename from a URL.
 * @param url - The URL to extract from
 * @returns The extracted filename or a default
 */
function extractFilename(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const segments = pathname.split('/');
        const last = segments[segments.length - 1];
        return last && last.includes('.') ? decodeURIComponent(last) : 'document.pdf';
    } catch {
        return 'document.pdf';
    }
}
