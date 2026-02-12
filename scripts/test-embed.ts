/**
 * Script: test-embed
 * Embeds sample documents and stores them in the vector store.
 *
 * Usage:
 *   bun run test-embed                           # uses sample data
 *   bun run test-embed "Custom text to embed"    # uses provided text
 */
import { getStore } from '@store/index';
import { addDocuments } from '@services/vector.service';
import { logger } from '@utils/log.util';
import type { KnowledgeDocument } from '@app-types/index';

async function main(): Promise<void> {
    try {
        logger.info('Connecting to store...');
        const store = getStore();
        await store.connect();

        const customText = process.argv[2];
        let docs: KnowledgeDocument[];

        if (customText) {
            docs = [
                {
                    content: customText,
                    metadata: {
                        source_type: 'transcript',
                        meeting_subject: 'Test Meeting',
                        meeting_date: new Date().toISOString(),
                        meeting_id: 'test-meeting-001',
                        speakers: ['Test User'],
                        timestamp_start: '00:00:00.000',
                        timestamp_end: '00:05:00.000',
                        attendees: ['Test User'],
                    },
                },
            ];
        } else {
            docs = [
                {
                    content:
                        '[John Smith] (00:00:05.000): Good morning everyone. Let\'s start with the migration update. The database migration to PostgreSQL is 80% complete. We expect to finish by end of week.\n[Jane Doe] (00:00:25.000): Great progress. Any blockers? I want to make sure the API team is aligned.',
                    metadata: {
                        source_type: 'transcript',
                        meeting_subject: 'Weekly Standup - Engineering',
                        meeting_date: '2024-01-15T10:00:00Z',
                        meeting_id: 'meeting-001',
                        speakers: ['John Smith', 'Jane Doe'],
                        timestamp_start: '00:00:05.000',
                        timestamp_end: '00:00:45.000',
                        attendees: ['John Smith', 'Jane Doe', 'Bob Wilson'],
                    },
                },
                {
                    content:
                        'Distribution List: Engineering Team (engineering@contoso.com). Description: All engineering department members. Members (3): John Smith (Senior Engineer), Jane Doe (Engineering Manager), Bob Wilson (DevOps Lead).',
                    metadata: {
                        source_type: 'distribution_list',
                        dl_name: 'Engineering Team',
                        dl_email: 'engineering@contoso.com',
                        dl_id: 'dl-001',
                        member_count: 3,
                    },
                },
            ];
        }

        logger.info({ count: docs.length }, 'Embedding and storing documents...');
        const ids = await addDocuments(docs);
        logger.info({ ids }, 'Documents stored successfully');
    } catch (error) {
        logger.fatal({ error }, 'Test embed failed');
        process.exit(1);
    } finally {
        await getStore().close();
    }
}

main();
