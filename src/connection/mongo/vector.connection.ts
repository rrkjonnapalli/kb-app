import { getDb } from '@connection/mongo/mongo.connection';
import { Collections, VectorIndex, EmbeddingConfig } from '@enums/index';
import { logger } from '@utils/log.util';

/**
 * Ensures the MongoDB Atlas Vector Search index exists on the knowledge_base collection.
 * Creates the index if it doesn't exist. Logs the outcome.
 *
 * Index configuration:
 * - Vector field: `embedding` (1536 dimensions, cosine similarity)
 * - Filter fields: `metadata.source_type`, `metadata.meeting_date`,
 *   `metadata.meeting_subject`, `metadata.dl_name`
 *
 * @throws Error if the index creation fails
 */
export async function ensureVectorIndex(): Promise<void> {
    const db = await getDb();
    const collection = db.collection(Collections.KNOWLEDGE_BASE);

    try {
        // List existing search indexes to check if ours already exists
        const indexes = await collection.listSearchIndexes().toArray();
        const exists = indexes.some(
            (idx: { name: string }) => idx.name === VectorIndex.KNOWLEDGE_BASE,
        );

        if (exists) {
            logger.info(
                { index: VectorIndex.KNOWLEDGE_BASE },
                'Vector search index already exists',
            );
            return;
        }

        // Create the Atlas Vector Search index
        await collection.createSearchIndex({
            name: VectorIndex.KNOWLEDGE_BASE,
            type: 'vectorSearch',
            definition: {
                fields: [
                    {
                        type: 'vector',
                        path: EmbeddingConfig.VECTOR_FIELD,
                        numDimensions: EmbeddingConfig.DIMENSIONS,
                        similarity: EmbeddingConfig.SIMILARITY,
                    },
                    {
                        type: 'filter',
                        path: 'metadata.source_type',
                    },
                    {
                        type: 'filter',
                        path: 'metadata.meeting_date',
                    },
                    {
                        type: 'filter',
                        path: 'metadata.meeting_subject',
                    },
                    {
                        type: 'filter',
                        path: 'metadata.dl_name',
                    },
                ],
            },
        });

        logger.info(
            { index: VectorIndex.KNOWLEDGE_BASE },
            'Vector search index created successfully',
        );
    } catch (error) {
        logger.error({ error }, 'Failed to ensure vector search index');
        throw error;
    }
}
