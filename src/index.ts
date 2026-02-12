import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { env } from '@config/env';
import { getStore } from '@store/index';
import { chatApi } from '@api/chat.api';
import { triggerApi } from '@api/trigger.api';
import { pdfApi } from '@api/pdf.api';
import { registerTranscriptCron } from '@cron/transcript.cron';
import { registerDLCron } from '@cron/dl.cron';
import { startScheduler } from '@cron/scheduler';
import { logger } from '@utils/log.util';

/**
 * Application entry point.
 * Initializes the configured store (Mongo or Postgres), ensures schema,
 * mounts API routes, starts cron scheduler, and registers graceful shutdown.
 */
async function main(): Promise<void> {
  try {
    const store = getStore();

    // 1. Initialize store connection
    logger.info({ storeType: env.STORE_TYPE }, 'Initializing store connection...');
    await store.connect();

    // 2. Ensure schema (vector index for Mongo, tables for Postgres)
    logger.info('Ensuring store schema...');
    await store.ensureSchema();

    // 3. Create Elysia app with all routes
    const app = new Elysia()
      .use(
        swagger({
          documentation: {
            info: {
              title: 'Knowledge Base RAG Service',
              version: '1.0.0',
              description:
                'Microsoft Knowledge Base RAG Service — ingest Teams transcripts & distribution lists, query via chat',
            },
            tags: [
              { name: 'Chat', description: 'RAG-based knowledge base queries' },
              { name: 'Trigger', description: 'Manual ingestion triggers' },
              { name: 'PDF', description: 'PDF document ingestion' },
            ],
          },
        }),
      )
      .onError(({ error, set }) => {
        const message = 'message' in error ? error.message : 'Unknown error';
        logger.error({ error: message }, 'Unhandled error');
        set.status = 500;
        return { error: 'Internal Server Error' };
      })
      .get('/', () => ({ status: 'ok', service: 'knowledge-base-rag' }))
      .use(chatApi)
      .use(triggerApi)
      .use(pdfApi)
      .listen(env.PORT);

    logger.info(
      { port: env.PORT },
      `🦊 Knowledge Base RAG Service running at http://localhost:${env.PORT}`,
    );
    logger.info(`📚 Swagger docs at http://localhost:${env.PORT}/swagger`);

    // 4. Register and start cron jobs
    registerTranscriptCron();
    registerDLCron();
    startScheduler();
    logger.info('Cron scheduler started');

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
