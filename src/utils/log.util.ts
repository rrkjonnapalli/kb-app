import pino from 'pino';
import { env } from '@config/env';

/**
 * Application-wide Pino logger singleton.
 * Uses pino-pretty transport in development for human-readable output.
 * Log level is configured via the LOG_LEVEL environment variable.
 *
 * Import this logger everywhere — do NOT use console.log.
 */
export const logger = pino({
    level: env.LOG_LEVEL,
    transport:
        env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            }
            : undefined,
});
