/**
 * Script: query-embed
 * Searches the vector store with a query string and prints matching documents.
 *
 * Usage: bun run query-embed "What was discussed about the migration?"
 */
import { ai } from '@ai';
import { store } from '@store';
import { documents } from '@services/document.service';
import { logger } from '@utils/log.util';

async function main(): Promise<void> {
    const query = process.argv[2];

    if (!query) {
        logger.error('Usage: bun run query-embed "your search query"');
        process.exit(1);
    }

    try {
        logger.info('Connecting to store...');
        await store.connect();
        await store.setup(ai.embed.dimensions);

        logger.info({ query }, 'Searching vector store...');
        const results = await documents.search(query, { limit: 5, min_score: 0.5 });

        if (results.length === 0) {
            logger.info('No matching documents found.');
        } else {
            logger.info({ count: results.length }, 'Found matching documents:');
            for (const [i, result] of results.entries()) {
                /* eslint-disable no-console */
                console.log(`\n--- Result ${i + 1} (score: ${result.score.toFixed(4)}) ---`);
                console.log(`Source: ${result.document.metadata.source_type}`);
                if (result.document.metadata.source_type === 'transcript') {
                    console.log(`Meeting: ${result.document.metadata.meeting_subject}`);
                    console.log(`Date: ${result.document.metadata.meeting_date}`);
                } else if (result.document.metadata.source_type === 'distribution_list') {
                    console.log(`DL: ${result.document.metadata.dl_name}`);
                } else {
                    console.log(`PDF: ${result.document.metadata.pdf_filename}`);
                }
                console.log(`Content: ${result.document.content.substring(0, 200)}...`);
                /* eslint-enable no-console */
            }
        }
    } catch (error) {
        logger.fatal({ error }, 'Query failed');
        process.exit(1);
    } finally {
        await store.close();
    }
}

main();
