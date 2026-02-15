import { Collections } from '@enums/collections.enum';
import { create_entity_service } from '@services/base.service';
import { logger } from '@utils/log.util';
import type { SyncState } from '@app-types/sync.types';

/**
 * Sync state entity service — extends base CRUD with domain-specific methods.
 *
 * Usage:
 *   import { sync_state } from '@services/sync_state.service';
 *   const since = await sync_state.get_last_sync('transcript');
 *   await sync_state.upsert({ job_name: 'transcript' }, { last_success: new Date() });
 */
export const sync_state = {
    ...create_entity_service<SyncState & Record<string, unknown>>(Collections.SYNC_STATE),

    /**
     * Get the last successful sync time for a source type.
     * Falls back to 24 hours ago if no record exists.
     */
    async get_last_sync(source_type: string): Promise<Date> {
        try {
            const record = await sync_state.find_one(
                { job_name: source_type } as Partial<SyncState & Record<string, unknown>>,
            ) as SyncState | null;
            if (record) return record.last_success;
        } catch (err) {
            logger.warn({ source_type, error: err }, 'Failed to read sync state');
        }
        return new Date(Date.now() - 24 * 60 * 60 * 1000);
    },
};
