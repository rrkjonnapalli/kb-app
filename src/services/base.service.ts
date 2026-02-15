import { store } from '@store';
import type { MetaStore } from '@store/store.interface';

/**
 * Generic CRUD base for entity services.
 * Write CRUD once, spread into each entity — don't duplicate per file.
 *
 * Usage:
 *   export const files = {
 *       ...create_entity_service<FileRecord>(Collections.FILES),
 *       // domain-specific additions only
 *   };
 */
export function create_entity_service<T extends Record<string, unknown>>(collection: string) {
    const meta = (): MetaStore<T> => store.get_meta_store<T>(collection);

    return {
        insert: (record: Partial<T>) => meta().insert(record),
        find_by_id: (id: string) => meta().find_by_id(id),
        find_one: (filter: Partial<T>) => meta().find_one(filter),
        update: (id: string, data: Partial<T>) => meta().update(id, data),
        delete: (id: string) => meta().delete(id),
        upsert: (filter: Partial<T>, data: Partial<T>) => meta().upsert(filter, data),
    };
}
