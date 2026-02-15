import { cron } from '@elysiajs/cron';
import { ingestion } from '@services/ingestion';
import { JobName } from '@enums/jobs.enum';
import { logger } from '@utils/log.util';

/**
 * Transcript ingestion cron plugin.
 * Runs daily at 2 AM — fetches new transcripts since last sync, parses, embeds, stores.
 */
export const cron$transcript = cron({
    name: JobName.INGEST_TRANSCRIPTS,
    pattern: '0 2 * * *',
    async run() {
        logger.info('Cron: starting transcript ingestion');
        try {
            const result = await ingestion.transcripts.run();
            logger.info(
                { processed: result.processed, errors: result.errors },
                'Cron: transcript ingestion complete',
            );
        } catch (error) {
            logger.error({ job: JobName.INGEST_TRANSCRIPTS, error }, 'Cron: transcript ingestion failed');
        }
    },
});
