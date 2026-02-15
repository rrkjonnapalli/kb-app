/**
 * Script: test-synthesizer
 * Full RAG test: takes a question, retrieves context, generates answer via LLM.
 *
 * Usage: bun run test-synthesizer "What topics were discussed in the Jan standup?"
 */
import { ai } from '@ai';
import { store } from '@store';
import { chat } from '@services/chat.service';
import { logger } from '@utils/log.util';

async function main(): Promise<void> {
    const question = process.argv[2];

    if (!question) {
        logger.error('Usage: bun run test-synthesizer "your question"');
        process.exit(1);
    }

    try {
        logger.info('Connecting to store...');
        await store.connect();
        await store.setup(ai.embed.dimensions);

        logger.info({ question }, 'Running RAG pipeline...');
        const response = await chat(question);

        /* eslint-disable no-console */
        console.log('\n=== RAG Response ===');
        console.log(`\nAnswer:\n${response.answer}`);

        if (response.sources.length > 0) {
            console.log('\nSources:');
            for (const source of response.sources) {
                const date = source.date ? ` (${source.date})` : '';
                console.log(`  - [${source.source_type}] ${source.title}${date} — score: ${source.relevance_score.toFixed(4)}`);
            }
        } else {
            console.log('\nNo sources referenced.');
        }
        /* eslint-enable no-console */
    } catch (error) {
        logger.fatal({ error }, 'Synthesizer test failed');
        process.exit(1);
    } finally {
        await store.close();
    }
}

main();
