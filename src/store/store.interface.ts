import type { FileStatusValue } from '@enums/index';
import type {
    KnowledgeDocument,
    SearchOptions,
    SearchResult,
    SearchFilters,
    FileRecord,
} from '@app-types/index';

/**
 * Store interface — unified contract for all data operations.
 *
 * Both MongoStore and PgStore implement this interface identically,
 * so consumers can call `getStore()` and never know which backend is in use.
 */
export interface Store {
    // ─── Lifecycle ───────────────────────────────────────────────────
    /** Open connection pool / client. */
    connect(): Promise<void>;
    /** Close all connections gracefully. */
    close(): Promise<void>;
    /** Create tables / indexes / vector search indexes as needed. */
    ensureSchema(): Promise<void>;

    // ─── Vector Operations ───────────────────────────────────────────
    /**
     * Embed and store documents in the knowledge base.
     * @returns Array of inserted document IDs.
     */
    addDocuments(docs: KnowledgeDocument[]): Promise<string[]>;

    /**
     * Search the knowledge base for documents similar to the query.
     * @returns Array of SearchResult (document + score).
     */
    searchDocuments(query: string, options?: SearchOptions): Promise<SearchResult[]>;

    /**
     * Delete documents matching the given filter.
     * @returns Number of documents deleted.
     */
    deleteDocuments(filter: SearchFilters): Promise<number>;

    // ─── File Records ────────────────────────────────────────────────
    /**
     * Create a file record for tracking PDF ingestion status.
     * @returns The new file record ID.
     */
    createFileRecord(
        filename: string,
        source: 'upload' | 'url',
        originalUrl?: string,
    ): Promise<string>;

    /** Get a file record by ID. */
    getFileRecord(fileId: string): Promise<FileRecord | null>;

    /** Update file processing status. */
    updateFileStatus(
        fileId: string,
        status: FileStatusValue,
        extra?: Partial<Pick<FileRecord, 'error' | 'chunks_count'>>,
    ): Promise<void>;

    // ─── Sync State ──────────────────────────────────────────────────
    /** Get last successful sync time for a source type. Falls back to 24h ago. */
    getLastSyncTime(sourceType: string): Promise<Date>;

    /** Update last successful sync time for a source type. */
    updateSyncTime(sourceType: string): Promise<void>;
}
