import { Elysia, t } from 'elysia';
import { ingestTranscripts, ingestDistributionLists } from '@services/ingest.service';
import { logger } from '@utils/log.util';

/**
 * Trigger API plugin.
 * Provides manual ingestion trigger endpoints.
 *
 * Routes:
 * - POST /api/trigger/transcripts — trigger transcript ingestion
 * - POST /api/trigger/dls — trigger distribution list ingestion
 */
export const triggerApi = new Elysia({ prefix: '/api/trigger' })
    .post(
        '/transcripts',
        async ({ body }) => {
            logger.info({ since: body?.since }, 'Manual transcript ingestion triggered');

            const since = body?.since ? new Date(body.since) : undefined;
            const result = await ingestTranscripts(since ? { since } : undefined);
            return result;
        },
        {
            body: t.Optional(
                t.Object({
                    since: t.Optional(
                        t.String({
                            description: 'ISO date string — only ingest transcripts created after this date',
                        }),
                    ),
                }),
            ),
            detail: {
                summary: 'Trigger transcript ingestion',
                description:
                    'Manually trigger ingestion of meeting transcripts from Microsoft Graph API. Optionally specify a "since" date for incremental sync.',
                tags: ['Trigger'],
            },
        },
    )
    .post(
        '/dls',
        async () => {
            logger.info('Manual DL ingestion triggered');

            const result = await ingestDistributionLists();
            return result;
        },
        {
            detail: {
                summary: 'Trigger distribution list ingestion',
                description:
                    'Manually trigger a full refresh of distribution list data from Microsoft Graph API. Old DL documents are deleted before re-ingestion.',
                tags: ['Trigger'],
            },
        },
    );
