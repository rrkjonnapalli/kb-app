import { env } from '@config/env';
import type { Store } from '@store/store.interface';
import { MongoStore } from '@store/mongo/mongo.store';
import { PGStore } from '@store/pg/pg.store';
import { logger } from '@utils/log.util';

let instance: Store | null = null;

/**
 * Get the singleton Store instance.
 * Returns MongoStore or PgStore based on `STORE_TYPE` env var.
 */
export function get_store(): Store {
    if (!instance) {
        if (env.STORE_TYPE === 'postgres') {
            instance = new PGStore();
            logger.info('Using PostgreSQL store');
        } else {
            instance = new MongoStore();
            logger.info('Using MongoDB store');
        }
    }
    return instance;
}

/**
 * Store namespace — lifecycle + accessor for the singleton store.
 *
 * Usage:
 *   import { store } from '@store';
 *   await store.connect();
 *   await store.setup(ai.embed.dimensions);
 *   const vs = store.get_vector_store('kb');
 */
export const store = {
    connect: () => get_store().connect(),
    close: () => get_store().close(),
    setup: (dimensions: number) => get_store().setup(dimensions),
    get_vector_store: (name: string) => get_store().get_vector_store(name),
    get_meta_store: <T extends Record<string, unknown>>(name: string) =>
        get_store().get_meta_store<T>(name),
};

export type { Store, VectorStore, MetaStore } from '@store/store.interface';
