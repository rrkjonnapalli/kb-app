import type { Pool } from 'pg';
import type { Store, VectorStore, MetaStore } from '@store/store.interface';
import { get_pg, connect_pg, close_pg } from '@connection/pg/pg.connection';
import { PGVectorStore } from '@store/pg/pg.vector_store';
import { PGMetaStore } from '@store/pg/pg.meta_store';
import { StoreNotConnectedError } from '@errors/store.error';
import { logger } from '@utils/log.util';

/**
 * PostgreSQL + pgvector implementation of the Store interface.
 * Manages lifecycle and provides access to segregated vector/meta stores.
 */
export class PGStore implements Store {
    private pool: Pool | null = null;

    /** Connect to PostgreSQL and verify pgvector extension */
    async connect(): Promise<void> {
        await connect_pg();
        this.pool = get_pg();

        const client = await this.pool.connect();
        try {
            await client.query("SELECT 'vector'::regtype");
        } finally {
            client.release();
        }

        logger.info('PGStore connected with pgvector');
    }

    /** Close the PostgreSQL pool */
    async close(): Promise<void> {
        await close_pg();
        this.pool = null;
    }

    /**
     * Create tables, indexes, and extensions.
     * @param dimensions - Vector dimensions from the embedder
     */
    async setup(dimensions: number): Promise<void> {
        const pool = this.require_pool();

        await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS knowledge_base (
                id          BIGSERIAL PRIMARY KEY,
                content     TEXT        NOT NULL,
                embedding   VECTOR(${dimensions}) NOT NULL,
                metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_kb_source_type
            ON knowledge_base ((metadata->>'source_type'))
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_kb_meeting_date
            ON knowledge_base ((metadata->>'meeting_date'))
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_kb_embedding_hnsw
            ON knowledge_base
            USING hnsw (embedding vector_cosine_ops)
            WITH (m = 16, ef_construction = 64)
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS files (
                id            BIGSERIAL PRIMARY KEY,
                filename      TEXT        NOT NULL,
                original_url  TEXT,
                source        TEXT        NOT NULL CHECK (source IN ('upload', 'url')),
                status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
                error         TEXT,
                chunks_count  INTEGER,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sync_state (
                job_name      TEXT        PRIMARY KEY,
                last_success  TIMESTAMPTZ NOT NULL,
                updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        logger.info({ dimensions }, 'PGStore schema ensured');
    }

    /** Get a PGVectorStore for the named table */
    get_vector_store(name: string): VectorStore {
        return new PGVectorStore(this.require_pool(), name);
    }

    /** Get a PGMetaStore for the named table */
    get_meta_store<T extends Record<string, unknown>>(name: string): MetaStore<T> {
        return new PGMetaStore<T>(this.require_pool(), name);
    }

    private require_pool(): Pool {
        if (!this.pool) {
            throw new StoreNotConnectedError('PGStore');
        }
        return this.pool;
    }
}
