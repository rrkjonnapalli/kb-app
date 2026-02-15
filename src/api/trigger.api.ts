import { Elysia, t } from 'elysia';
import { env } from '@config/env';
import { ingestion } from '@services/ingestion';
import { AzureSourceDisabledError } from '@errors/ai.error';
import { logger } from '@utils/log.util';

/**
 * Trigger API plugin.
 * Provides manual ingestion trigger endpoints.
 *
 * When AZURE_SOURCE is not Y, transcript and DL endpoints return 503.
 */
export const api$trigger = new Elysia({ prefix: '/api/trigger' })
    .post(
        '/transcripts',
        async ({ body }) => {
            if (!env.AZURE_SOURCE) throw new AzureSourceDisabledError('Transcript ingestion');
            logger.info({ since: body?.since }, 'Manual transcript ingestion triggered');
            const since = body?.since ? new Date(body.since) : undefined;
            const result = await ingestion.transcripts.run(since ? { since } : undefined);
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
            if (!env.AZURE_SOURCE) throw new AzureSourceDisabledError('Distribution list ingestion');
            logger.info('Manual DL ingestion triggered');
            const result = await ingestion.dls.run();
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
