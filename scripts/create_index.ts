/**
 * Script: create-index
 * Creates/verifies the vector store schema (indexes, tables).
 *
 * Usage: bun run create-index
 */
import { ai } from '@ai';
import { store } from '@store';
import { logger } from '@utils/log.util';

async function main(): Promise<void> {
    try {
        logger.info('Connecting to store...');
        await store.connect();

        logger.info({ dimensions: ai.embed.dimensions }, 'Setting up schema...');
        await store.setup(ai.embed.dimensions);

        logger.info('Done!');
    } catch (error) {
        logger.fatal({ error }, 'Failed to create index');
        process.exit(1);
    } finally {
        await store.close();
    }
}

main();
