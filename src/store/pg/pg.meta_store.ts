import type { Pool } from 'pg';
import type { MetaStore } from '@store/store.interface';

/**
 * PostgreSQL implementation of MetaStore — generic CRUD on a Postgres table.
 * Used for files, sync_state, and any other non-vector entity.
 */
export class PGMetaStore<T extends Record<string, unknown>> implements MetaStore<T> {
    private readonly pool: Pool;
    private readonly table: string;

    constructor(pool: Pool, table: string) {
        this.pool = pool;
        this.table = table;
    }

    /** Insert a record, return its ID as string */
    async insert(record: Partial<T>): Promise<string> {
        const keys = Object.keys(record);
        const values = Object.values(record);
        const placeholders = keys.map((_, i) => `$${i + 1}`);

        const sql = `INSERT INTO ${this.table} (${keys.join(', ')})
                     VALUES (${placeholders.join(', ')})
                     RETURNING id`;

        const result = await this.pool.query(sql, values);
        return result.rows[0].id.toString();
    }

    /** Find a record by its id */
    async find_by_id(id: string): Promise<T | null> {
        const result = await this.pool.query(
            `SELECT * FROM ${this.table} WHERE id = $1`,
            [id],
        );
        if (result.rows.length === 0) return null;
        return this.map_row(result.rows[0]);
    }

    /** Find a single record matching key/value filter */
    async find_one(filter: Partial<T>): Promise<T | null> {
        const { whereClause, params } = this.build_filter(filter);
        const result = await this.pool.query(
            `SELECT * FROM ${this.table} WHERE ${whereClause} LIMIT 1`,
            params,
        );
        if (result.rows.length === 0) return null;
        return this.map_row(result.rows[0]);
    }

    /** Update a record by id */
    async update(id: string, data: Partial<T>): Promise<void> {
        const entries = Object.entries(data);
        const setClauses = entries.map((_, i) => `${entries[i][0]} = $${i + 2}`);
        setClauses.push(`updated_at = NOW()`);
        const values = entries.map(([, v]) => v);

        await this.pool.query(
            `UPDATE ${this.table} SET ${setClauses.join(', ')} WHERE id = $1`,
            [id, ...values],
        );
    }

    /** Delete a record by id */
    async delete(id: string): Promise<void> {
        await this.pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
    }

    /** Upsert: update if matching filter exists, insert otherwise */
    async upsert(filter: Partial<T>, data: Partial<T>): Promise<void> {
        const filterKeys = Object.keys(filter);
        const dataKeys = Object.keys(data);
        const allKeys = [...new Set([...filterKeys, ...dataKeys])];
        const allValues = allKeys.map((k) => (data as Record<string, unknown>)[k] ?? (filter as Record<string, unknown>)[k]);

        const conflictKeys = filterKeys.join(', ');
        const placeholders = allKeys.map((_, i) => `$${i + 1}`);
        const updateClauses = dataKeys.map((k) => {
            const idx = allKeys.indexOf(k);
            return `${k} = $${idx + 1}`;
        });
        updateClauses.push('updated_at = NOW()');

        const sql = `INSERT INTO ${this.table} (${allKeys.join(', ')})
                     VALUES (${placeholders.join(', ')})
                     ON CONFLICT (${conflictKeys}) DO UPDATE SET ${updateClauses.join(', ')}`;

        await this.pool.query(sql, allValues);
    }

    private build_filter(filter: Partial<T>): { whereClause: string; params: unknown[] } {
        const entries = Object.entries(filter);
        const conditions = entries.map(([key], i) => `${key} = $${i + 1}`);
        const params = entries.map(([, val]) => val);
        return { whereClause: conditions.join(' AND '), params };
    }

    private map_row(row: Record<string, unknown>): T {
        return { ...row, _id: row.id?.toString() } as unknown as T;
    }
}
