import type { Store } from '@store/store.interface';
import type { FileStatusValue } from '@enums/index';
import type {
    KnowledgeDocument,
    SearchOptions,
    SearchResult,
    SearchFilters,
    FileRecord,
} from '@app-types/index';
import { getPgPool, connectPg, closePg } from '@connection/pg/pg.connection';
import { FileStatus } from '@enums/index';
import { embedText, embedTexts } from '@services/embed.service';
import { logger } from '@utils/log.util';
import { toSql, fromSql } from 'pgvector';

/**
 * PostgreSQL + pgvector implementation of the Store interface.
 * Uses HNSW index with cosine distance for vector search.
 */
export class PgStore implements Store {

    // ─── Lifecycle ───────────────────────────────────────────────────

    async connect(): Promise<void> {
        await connectPg();
        // Register pgvector type with the pool
        const pool = getPgPool();
        const client = await pool.connect();
        try {
            await client.query("SELECT 'vector'::regtype");
        } finally {
            client.release();
        }
        logger.info('PgStore connected with pgvector');
    }

    async close(): Promise<void> {
        await closePg();
    }

    async ensureSchema(): Promise<void> {
        const pool = getPgPool();

        // Run schema creation queries
        await pool.query('CREATE EXTENSION IF NOT EXISTS vector');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS knowledge_base (
                id          BIGSERIAL PRIMARY KEY,
                content     TEXT        NOT NULL,
                embedding   VECTOR(1536) NOT NULL,
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

        logger.info('PgStore schema ensured');
    }

    // ─── Vector Operations ───────────────────────────────────────────

    async addDocuments(docs: KnowledgeDocument[]): Promise<string[]> {
        if (docs.length === 0) return [];

        const pool = getPgPool();
        const contents = docs.map((d) => d.content);
        const embeddings = await embedTexts(contents);

        const ids: string[] = [];

        // Batch insert using a transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            for (let i = 0; i < docs.length; i++) {
                const result = await client.query(
                    `INSERT INTO knowledge_base (content, embedding, metadata)
                     VALUES ($1, $2, $3)
                     RETURNING id`,
                    [docs[i].content, toSql(embeddings[i]), JSON.stringify(docs[i].metadata)],
                );
                ids.push(result.rows[0].id.toString());
            }

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        logger.info({ count: ids.length }, 'Documents added to vector store (pg)');
        return ids;
    }

    async searchDocuments(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        const pool = getPgPool();
        const queryEmbedding = await embedText(query);
        const limit = options?.limit || 5;
        const minScore = options?.minScore || 0.7;

        // Build WHERE clause from filters
        const { whereClause, params } = this.buildWhereClause(options?.filter, 2);

        // Cosine distance: 1 - distance = similarity score
        const sql = `
            SELECT
                content,
                metadata,
                1 - (embedding <=> $1) AS score
            FROM knowledge_base
            ${whereClause ? `WHERE ${whereClause}` : ''}
            ORDER BY embedding <=> $1
            LIMIT $${params.length + 1}
        `;

        const allParams = [toSql(queryEmbedding), ...params, limit];
        const result = await pool.query(sql, allParams);

        return result.rows
            .filter((row) => row.score >= minScore)
            .map((row) => ({
                document: {
                    content: row.content,
                    metadata: row.metadata,
                },
                score: row.score,
            }));
    }

    async deleteDocuments(filter: SearchFilters): Promise<number> {
        const pool = getPgPool();
        const { whereClause, params } = this.buildWhereClause(filter, 1);

        if (!whereClause) {
            logger.warn('deleteDocuments called with empty filter, skipping');
            return 0;
        }

        const sql = `DELETE FROM knowledge_base WHERE ${whereClause}`;
        const result = await pool.query(sql, params);
        const count = result.rowCount || 0;

        logger.info({ count, filter }, 'Documents deleted from vector store (pg)');
        return count;
    }

    // ─── File Records ────────────────────────────────────────────────

    async createFileRecord(
        filename: string,
        source: 'upload' | 'url',
        originalUrl?: string,
    ): Promise<string> {
        const pool = getPgPool();
        const result = await pool.query(
            `INSERT INTO files (filename, source, original_url, status)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [filename, source, originalUrl || null, FileStatus.PENDING],
        );
        const fileId = result.rows[0].id.toString();
        logger.info({ fileId, filename, source }, 'File record created (pg)');
        return fileId;
    }

    async getFileRecord(fileId: string): Promise<FileRecord | null> {
        const pool = getPgPool();
        const result = await pool.query(
            `SELECT id as _id, filename, original_url, source, status,
                    error, chunks_count, created_at, updated_at
             FROM files WHERE id = $1`,
            [parseInt(fileId, 10)],
        );

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        return {
            _id: row._id.toString(),
            filename: row.filename,
            original_url: row.original_url,
            source: row.source,
            status: row.status,
            error: row.error,
            chunks_count: row.chunks_count,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
    }

    async updateFileStatus(
        fileId: string,
        status: FileStatusValue,
        extra?: Partial<Pick<FileRecord, 'error' | 'chunks_count'>>,
    ): Promise<void> {
        const pool = getPgPool();
        const setClauses: string[] = ['status = $2', 'updated_at = NOW()'];
        const params: unknown[] = [parseInt(fileId, 10), status];
        let paramIdx = 3;

        if (extra?.error !== undefined) {
            setClauses.push(`error = $${paramIdx}`);
            params.push(extra.error);
            paramIdx++;
        }
        if (extra?.chunks_count !== undefined) {
            setClauses.push(`chunks_count = $${paramIdx}`);
            params.push(extra.chunks_count);
            paramIdx++;
        }

        await pool.query(
            `UPDATE files SET ${setClauses.join(', ')} WHERE id = $1`,
            params,
        );
    }

    // ─── Sync State ──────────────────────────────────────────────────

    async getLastSyncTime(sourceType: string): Promise<Date> {
        try {
            const pool = getPgPool();
            const result = await pool.query(
                'SELECT last_success FROM sync_state WHERE job_name = $1',
                [sourceType],
            );
            if (result.rows.length > 0) {
                return new Date(result.rows[0].last_success);
            }
        } catch (err) {
            logger.warn({ sourceType, error: err }, 'Failed to read sync state (pg)');
        }
        return new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    async updateSyncTime(sourceType: string): Promise<void> {
        try {
            const pool = getPgPool();
            await pool.query(
                `INSERT INTO sync_state (job_name, last_success, updated_at)
                 VALUES ($1, NOW(), NOW())
                 ON CONFLICT (job_name) DO UPDATE SET last_success = NOW(), updated_at = NOW()`,
                [sourceType],
            );
        } catch (err) {
            logger.warn({ sourceType, error: err }, 'Failed to update sync state (pg)');
        }
    }

    // ─── Private Helpers ─────────────────────────────────────────────

    /**
     * Build a WHERE clause from SearchFilters.
     * @param filter - The filters to convert
     * @param startParamIdx - Starting parameter index (1-based)
     * @returns Object with whereClause string and params array
     */
    private buildWhereClause(
        filter?: SearchFilters,
        startParamIdx: number = 1,
    ): { whereClause: string; params: unknown[] } {
        if (!filter) return { whereClause: '', params: [] };

        const conditions: string[] = [];
        const params: unknown[] = [];
        let idx = startParamIdx;

        if (filter.source_type) {
            conditions.push(`metadata->>'source_type' = $${idx}`);
            params.push(filter.source_type);
            idx++;
        }
        if (filter.meeting_subject) {
            conditions.push(`metadata->>'meeting_subject' = $${idx}`);
            params.push(filter.meeting_subject);
            idx++;
        }
        if (filter.dl_name) {
            conditions.push(`metadata->>'dl_name' = $${idx}`);
            params.push(filter.dl_name);
            idx++;
        }
        if (filter.pdf_filename) {
            conditions.push(`metadata->>'pdf_filename' = $${idx}`);
            params.push(filter.pdf_filename);
            idx++;
        }
        if (filter.date_from) {
            conditions.push(`metadata->>'meeting_date' >= $${idx}`);
            params.push(filter.date_from);
            idx++;
        }
        if (filter.date_to) {
            conditions.push(`metadata->>'meeting_date' <= $${idx}`);
            params.push(filter.date_to);
            idx++;
        }

        return {
            whereClause: conditions.join(' AND '),
            params,
        };
    }
}
