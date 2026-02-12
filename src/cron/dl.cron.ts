import { registerJob } from '@cron/scheduler';
import { ingestDistributionLists } from '@services/ingest.service';
import { JobName } from '@enums/index';
import { logger } from '@utils/log.util';

/**
 * Register the daily distribution list sync cron job.
 * Runs daily at 3:00 AM. Does a full refresh of all DLs.
 */
export function registerDLCron(): void {
    registerJob(
        JobName.INGEST_DLS,
        '0 3 * * *', // Daily at 3 AM
        async () => {
            logger.info('Cron: starting DL ingestion');
            const result = await ingestDistributionLists();
            logger.info(
                { processed: result.processed, errors: result.errors },
                'Cron: DL ingestion complete',
            );
        },
    );
}
