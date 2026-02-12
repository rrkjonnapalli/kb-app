import { env } from '@config/env';
import type { Store } from '@store/store.interface';
import { MongoStore } from '@store/mongo.store';
import { PgStore } from '@store/pg.store';
import { logger } from '@utils/log.util';

let store: Store | null = null;

/**
 * Get the singleton Store instance.
 *
 * Returns either MongoStore or PgStore based on the `STORE_TYPE` env var.
 * The store is created once and reused for the lifetime of the process.
 *
 * @returns The Store instance
 */
export function getStore(): Store {
    if (!store) {
        const storeType = env.STORE_TYPE;

        if (storeType === 'postgres') {
            store = new PgStore();
            logger.info('Using PostgreSQL store');
        } else {
            store = new MongoStore();
            logger.info('Using MongoDB store');
        }
    }
    return store;
}

/** Re-export the Store interface for convenience */
export type { Store } from '@store/store.interface';
