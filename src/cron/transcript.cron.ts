import { registerJob } from '@cron/scheduler';
import { ingestTranscripts } from '@services/ingest.service';
import { JobName } from '@enums/index';
import { logger } from '@utils/log.util';

/**
 * Register the daily transcript ingestion cron job.
 * Runs daily at 2:00 AM. Fetches new transcripts since last successful sync.
 */
export function registerTranscriptCron(): void {
    registerJob(
        JobName.INGEST_TRANSCRIPTS,
        '0 2 * * *', // Daily at 2 AM
        async () => {
            logger.info('Cron: starting transcript ingestion');
            const result = await ingestTranscripts();
            logger.info(
                { processed: result.processed, errors: result.errors },
                'Cron: transcript ingestion complete',
            );
        },
    );
}
