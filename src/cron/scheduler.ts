import { logger } from '@utils/log.util';

/** A registered cron job */
interface CronJob {
    name: string;
    pattern: string;
    handler: () => Promise<void>;
}

const jobs: CronJob[] = [];

/**
 * Register a cron job. Jobs are collected and started when `startScheduler()` is called.
 *
 * @param name - Human-readable job name
 * @param pattern - Cron pattern (e.g., '0 2 * * *' for daily at 2 AM)
 * @param handler - Async function to execute
 */
export function registerJob(
    name: string,
    pattern: string,
    handler: () => Promise<void>,
): void {
    jobs.push({ name, pattern, handler });
    logger.info({ name, pattern }, 'Cron job registered');
}

/**
 * Start all registered cron jobs using Bun's built-in CronJob API.
 * This is the pluggable entry point — swap this function's internals
 * to use Agenda or another scheduler without changing job definitions.
 */
export function startScheduler(): void {
    if (typeof Bun === 'undefined' || !('CronJob' in Bun)) {
        // Fallback: use setInterval-based scheduling
        logger.warn('Bun.CronJob not available, using setInterval fallback');
        for (const job of jobs) {
            const intervalMs = cronPatternToMs(job.pattern);
            setInterval(async () => {
                logger.info({ job: job.name }, 'Running scheduled job (setInterval)');
                try {
                    await job.handler();
                } catch (error) {
                    logger.error({ job: job.name, error }, 'Scheduled job failed');
                }
            }, intervalMs);
            logger.info({ job: job.name, intervalMs }, 'Started job with setInterval');
        }
        return;
    }

    // Use Bun's built-in cron
    for (const job of jobs) {
        // @ts-expect-error — Bun.CronJob may not be typed yet
        new Bun.CronJob(job.pattern, async () => {
            logger.info({ job: job.name }, 'Running scheduled job');
            try {
                await job.handler();
            } catch (error) {
                logger.error({ job: job.name, error }, 'Scheduled job failed');
            }
        });
        logger.info({ job: job.name, pattern: job.pattern }, 'Started cron job');
    }
}

/**
 * Convert a simple cron pattern to a rough interval in milliseconds.
 * Only handles common daily/hourly patterns as a fallback.
 * @param pattern - Cron pattern string
 * @returns Interval in milliseconds
 */
function cronPatternToMs(pattern: string): number {
    const parts = pattern.trim().split(/\s+/);

    // Daily: 0 2 * * * → 24h
    if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
        return 24 * 60 * 60 * 1000;
    }

    // Hourly: 0 * * * * → 1h
    if (parts.length === 5 && parts[1] === '*') {
        return 60 * 60 * 1000;
    }

    // Default: run daily
    return 24 * 60 * 60 * 1000;
}
