import type { Pool } from 'pg';
import type { VectorStore } from '@store/store.interface';
import type { SearchOptions, SearchResult, SearchFilters } from '@app-types/search.types';
import type { KnowledgeDocument } from '@app-types/document.types';
import { toSql } from 'pgvector';
import { logger } from '@utils/log.util';

/**
 * PostgreSQL + pgvector implementation of VectorStore.
 * Uses HNSW index with cosine distance for similarity search.
 */
export class PGVectorStore implements VectorStore {
    private readonly pool: Pool;
    private readonly table: string;

    constructor(pool: Pool, table: string) {
        this.pool = pool;
        this.table = table;
    }

    /** Insert documents with pre-computed embeddings */
    async insert(docs: {
        content: string;
        embedding: number[];
        metadata: Record<string, unknown>;
    }[]): Promise<string[]> {
        if (docs.length === 0) return [];

        const ids: string[] = [];
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            for (const doc of docs) {
                const result = await client.query(
                    `INSERT INTO ${this.table} (content, embedding, metadata)
                     VALUES ($1, $2, $3)
                     RETURNING id`,
                    [doc.content, toSql(doc.embedding), JSON.stringify(doc.metadata)],
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

        logger.info({ count: ids.length }, 'Documents inserted into vector store (pg)');
        return ids;
    }

    /** Similarity search using pgvector cosine distance */
    async search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]> {
        const limit = options?.limit || 5;
        const minScore = options?.min_score || 0.7;

        const { whereClause, params } = this.build_where_clause(options?.filter, 2);

        const sql = `
            SELECT
                content,
                metadata,
                1 - (embedding <=> $1) AS score
            FROM ${this.table}
            ${whereClause ? `WHERE ${whereClause}` : ''}
            ORDER BY embedding <=> $1
            LIMIT $${params.length + 2}
        `;

        const allParams = [toSql(embedding), ...params, limit];

        // console.log('Executing vector search query (pg):', { sql, params: allParams });
        logger.info({sql}, 'Executing vector search query (pg)');
        const result = await this.pool.query(sql, allParams);

        logger.info(
            { total: result.rows.length, scores: result.rows.map((r) => r.score), minScore },
            'Vector search raw results (pg)',
        );

        const data = result.rows
            .filter((row) => row.score >= minScore)
            .map((row) => ({
                document: {
                    content: row.content,
                    metadata: row.metadata as KnowledgeDocument['metadata'],
                },
                score: row.score,
            }));
        console.log(`Vector search returned ${data.length} results (pg)`, data);
        return data;
    }

    /** Delete documents matching metadata filter */
    async delete(filter: SearchFilters): Promise<number> {
        const { whereClause, params } = this.build_where_clause(filter, 1);

        if (!whereClause) {
            logger.warn('deleteDocuments called with empty filter, skipping');
            return 0;
        }

        const sql = `DELETE FROM ${this.table} WHERE ${whereClause}`;
        const result = await this.pool.query(sql, params);
        const count = result.rowCount || 0;

        logger.info({ count, filter }, 'Documents deleted from vector store (pg)');
        return count;
    }

    private build_where_clause(
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
