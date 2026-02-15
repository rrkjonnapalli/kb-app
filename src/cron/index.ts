import { Elysia } from 'elysia';
import { env } from '@config/env';
import { logger } from '@utils/log.util';

/**
 * Cron plugin — mounts scheduled jobs onto the Elysia app.
 *
 * When AZURE_SOURCE is not Y, transcript and DL cron jobs are skipped.
 * Usage: `app.use(cron$jobs)`
 */
export const cron$jobs = new Elysia({ name: 'cron' }).onStart(() => {
    if (!env.AZURE_SOURCE) {
        logger.info('Azure source disabled — skipping transcript/DL cron jobs');
    }
});

// Conditionally mount cron jobs as Elysia plugins
if (env.AZURE_SOURCE) {
    const { cron$transcript } = require('@cron/transcript.cron');
    const { cron$dl } = require('@cron/dl.cron');
    cron$jobs.use(cron$transcript).use(cron$dl);
}
