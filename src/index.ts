import { Elysia, file } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { opentelemetry } from '@elysiajs/opentelemetry'
import { env } from '@config/env';
import { ai } from '@ai';
import { store } from '@store';
import { api$chat } from '@api/chat.api';
import { api$trigger } from '@api/trigger.api';
import { api$pdf } from '@api/pdf.api';
import { api$search } from '@api/search.api';
import { AppError } from '@errors/app.error';
import { health_check } from '@services/health.service';
import { cron$jobs } from '@cron/index';
import { logger } from '@utils/log.util';

/**
 * Application entry point.
 * Initializes store, sets up schema, mounts API routes,
 * starts cron scheduler, and registers graceful shutdown.
 */
async function main(): Promise<void> {
    try {
        // 1. Connect to store
        logger.info({ storeType: env.STORE_TYPE }, 'Initializing store connection...');
        await store.connect();

        // 2. Setup schema with dynamic embedding dimensions (only when embed is configured)
        if (env.EMBED_MODEL_PROVIDER) {
            const dimensions = ai.embed.dimensions;
            logger.info({ dimensions, provider: env.EMBED_MODEL_PROVIDER }, 'Setting up store schema...');
            await store.setup(dimensions);
        } else {
            logger.warn('EMBED_MODEL_PROVIDER not set — embedding/RAG features are unavailable');
        }

        if (!env.CHAT_MODEL_PROVIDER) {
            logger.warn('CHAT_MODEL_PROVIDER not set — chat features are unavailable');
        }

        // 3. Create Elysia app
        const app = new Elysia()
            .use(opentelemetry())
            .use(
                openapi({
                    documentation: {
                        info: {
                            title: 'Knowledge Base RAG Service',
                            version: '1.0.0',
                            description:
                                'Microsoft Knowledge Base RAG Service — ingest Teams transcripts & distribution lists, query via chat',
                        },
                        tags: [
                            { name: 'Health', description: 'Service health checks' },
                            { name: 'Search', description: 'Raw vector similarity search' },
                            { name: 'Chat', description: 'RAG-based knowledge base queries' },
                            { name: 'Trigger', description: 'Manual ingestion triggers' },
                            { name: 'PDF', description: 'PDF document ingestion' },
                        ],
                    },
                }),
            )
            .onError(({ error, path, set }) => {
                const message = 'message' in error ? error.message : 'Unknown error';
                const status = error instanceof AppError ? error.status : 500;
                logger.error({ status, error: message, code: error instanceof AppError ? error.code : undefined, path }, 'Unhandled error');
                set.status = status;
                return { error: status === 500 ? 'Internal Server Error' : message };
            })
            // take favicon from assets/favicon.ico if exists, otherwise return 204 No Content to avoid 404 errors in logs
            .get('/favicon.ico', () => file(__dirname + '/assets/favicon.ico')) // Avoid 404 errors for favicon requests
            .get('/', () => ({ status: 'ok', service: 'knowledge-base-rag' }))
            .get('/health', async () => await health_check(), { detail: { tags: ['Health'] } })
            .use(api$search)
            .use(api$chat)
            .use(api$trigger)
            .use(api$pdf)
            .use(cron$jobs)
            .listen(env.PORT);

        logger.info(
            { port: env.PORT },
            `Knowledge Base RAG Service running at http://localhost:${env.PORT}`,
        );
        logger.info(`Swagger docs at http://localhost:${env.PORT}/swagger`);

        // 4. Cron jobs (registered via Elysia plugin above)
        logger.info('Cron jobs registered via @elysiajs/cron');

        // 5. Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info({ signal }, 'Shutdown signal received');
            await store.close();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    } catch (error) {
        logger.fatal({ error }, 'Failed to start application');
        process.exit(1);
    }
}

main();
