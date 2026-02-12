/**
 * Script: create-index
 * Creates/verifies the MongoDB Atlas Vector Search index.
 *
 * Usage: bun run create-index
 */
import { getStore } from '@store/index';
import { logger } from '@utils/log.util';

async function main(): Promise<void> {
    try {
        logger.info('Connecting to store...');
        const store = getStore();
        await store.connect();

        logger.info('Creating/verifying schema...');
        await store.ensureSchema();

        logger.info('Done!');
    } catch (error) {
        logger.fatal({ error }, 'Failed to create index');
        process.exit(1);
    } finally {
        await getStore().close();
    }
}

main();
