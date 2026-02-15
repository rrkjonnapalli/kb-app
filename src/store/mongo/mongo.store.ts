import type { Db } from 'mongodb';
import type { Store, VectorStore, MetaStore } from '@store/store.interface';
import { get_db, close_mongo } from '@connection/mongo/mongo.connection';
import { MongoVectorStore } from '@store/mongo/mongo.vector_store';
import { MongoMetaStore } from '@store/mongo/mongo.meta_store';
import { StoreNotConnectedError } from '@errors/store.error';
import { logger } from '@utils/log.util';

const VECTOR_INDEX_NAME = 'knowledge_base_vector_index';
const VECTOR_FIELD = 'embedding';

/**
 * MongoDB implementation of the Store interface.
 * Manages lifecycle and provides access to segregated vector/meta stores.
 */
export class MongoStore implements Store {
    private db: Db | null = null;

    /** Connect to MongoDB and cache the db reference */
    async connect(): Promise<void> {
        this.db = await get_db();
        logger.info('MongoStore connected');
    }

    /** Close the MongoDB connection */
    async close(): Promise<void> {
        await close_mongo();
        this.db = null;
    }

    /**
     * Ensure vector search index and other schema requirements.
     * @param dimensions - Vector dimensions from the embedder
     */
    async setup(dimensions: number): Promise<void> {
        const db = this.require_db();
        const collection = db.collection('knowledge_base');

        try {
            const indexes = await collection.listSearchIndexes().toArray();
            const exists = indexes.some(
                (idx: { name: string }) => idx.name === VECTOR_INDEX_NAME,
            );

            if (exists) {
                logger.info({ index: VECTOR_INDEX_NAME }, 'Vector search index already exists');
                return;
            }

            await collection.createSearchIndex({
                name: VECTOR_INDEX_NAME,
                type: 'vectorSearch',
                definition: {
                    fields: [
                        {
                            type: 'vector',
                            path: VECTOR_FIELD,
                            numDimensions: dimensions,
                            similarity: 'cosine',
                        },
                        { type: 'filter', path: 'metadata.source_type' },
                        { type: 'filter', path: 'metadata.meeting_date' },
                        { type: 'filter', path: 'metadata.meeting_subject' },
                        { type: 'filter', path: 'metadata.dl_name' },
                    ],
                },
            });

            logger.info({ index: VECTOR_INDEX_NAME, dimensions }, 'Vector search index created');
        } catch (error) {
            logger.error({ error }, 'Failed to ensure vector search index');
            throw error;
        }
    }

    /** Get a MongoVectorStore for the named collection */
    get_vector_store(name: string): VectorStore {
        const db = this.require_db();
        return new MongoVectorStore(db.collection(name), VECTOR_INDEX_NAME);
    }

    /** Get a MongoMetaStore for the named collection */
    get_meta_store<T extends Record<string, unknown>>(name: string): MetaStore<T> {
        const db = this.require_db();
        return new MongoMetaStore<T>(db.collection(name));
    }

    /** Ensure db is connected, throw if not */
    private require_db(): Db {
        if (!this.db) {
            throw new StoreNotConnectedError('MongoStore');
        }
        return this.db;
    }
}
