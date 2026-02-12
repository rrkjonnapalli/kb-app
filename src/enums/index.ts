/** MongoDB collection names */
export const Collections = {
    KNOWLEDGE_BASE: 'knowledge_base',
    SYNC_STATE: 'sync_state',
    FILES: 'files',
} as const;

/** Source types for documents in the knowledge base */
export const SourceType = {
    TRANSCRIPT: 'transcript',
    DISTRIBUTION_LIST: 'distribution_list',
    PDF: 'pdf',
} as const;

/** File processing status */
export const FileStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
} as const;
export type FileStatusValue = (typeof FileStatus)[keyof typeof FileStatus];

/** Agenda/Cron job names */
export const JobName = {
    INGEST_TRANSCRIPTS: 'ingest-transcripts',
    INGEST_DLS: 'ingest-dls',
} as const;

/** Vector search index name */
export const VectorIndex = {
    KNOWLEDGE_BASE: 'knowledge_base_vector_index',
} as const;

/** Vector embedding config */
export const EmbeddingConfig = {
    DIMENSIONS: 1536,
    SIMILARITY: 'cosine',
    VECTOR_FIELD: 'embedding',
} as const;

/** Type helpers for extracting values from const objects */
export type CollectionName = (typeof Collections)[keyof typeof Collections];
export type SourceTypeValue = (typeof SourceType)[keyof typeof SourceType];
export type JobNameValue = (typeof JobName)[keyof typeof JobName];
