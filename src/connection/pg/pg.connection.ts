import { Pool, type PoolConfig } from 'pg';
import { env } from '@config/env';
import { logger } from '@utils/log.util';

let pool: Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool singleton.
 * @returns The shared Pool instance
 */
export function getPgPool(): Pool {
    if (!pool) {
        const config: PoolConfig = {
            connectionString: env.POSTGRES_URL,
            max: 20,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 5_000,
        };
        pool = new Pool(config);
        logger.info('PostgreSQL pool created');
    }
    return pool;
}

/**
 * Connect to PostgreSQL (verify the pool is reachable).
 */
export async function connectPg(): Promise<void> {
    const p = getPgPool();
    const client = await p.connect();
    client.release();
    logger.info('Connected to PostgreSQL');
}

/**
 * Close the PostgreSQL connection pool gracefully.
 */
export async function closePg(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('PostgreSQL pool closed');
    }
}
