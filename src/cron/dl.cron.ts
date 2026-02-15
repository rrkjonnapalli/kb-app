import { cron } from '@elysiajs/cron';
import { ingestion } from '@services/ingestion';
import { JobName } from '@enums/jobs.enum';
import { logger } from '@utils/log.util';

/**
 * Distribution list ingestion cron plugin.
 * Runs daily at 3 AM — full refresh of all DLs (delete + re-ingest).
 */
export const cron$dl = cron({
    name: JobName.INGEST_DLS,
    pattern: '0 3 * * *',
    async run() {
        logger.info('Cron: starting DL ingestion');
        try {
            const result = await ingestion.dls.run();
            logger.info(
                { processed: result.processed, errors: result.errors },
                'Cron: DL ingestion complete',
            );
        } catch (error) {
            logger.error({ job: JobName.INGEST_DLS, error }, 'Cron: DL ingestion failed');
        }
    },
});
