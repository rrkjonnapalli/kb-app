/** MongoDB collection names */
export const Collections = {
    KNOWLEDGE_BASE: 'knowledge_base',
    SYNC_STATE: 'sync_state',
    FILES: 'files',
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];
