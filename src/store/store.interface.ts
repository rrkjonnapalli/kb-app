import type { SearchOptions, SearchResult, SearchFilters } from '@app-types/search.types';

/**
 * Store interface — lifecycle management for a storage backend.
 * Provides access to segregated VectorStore and MetaStore instances.
 */
export interface Store {
    /** Open connection pool / client */
    connect(): Promise<void>;

    /** Close all connections gracefully */
    close(): Promise<void>;

    /** Create tables / indexes / vector search indexes as needed */
    setup(dimensions: number): Promise<void>;

    /** Get the vector store instance for a given collection/table */
    get_vector_store(name: string): VectorStore;

    /** Get a typed meta store for a given collection/table */
    get_meta_store<T extends Record<string, unknown>>(name: string): MetaStore<T>;
}

/**
 * VectorStore interface — raw embedding storage and similarity search.
 * Does NOT perform embedding — receives pre-computed vectors.
 */
export interface VectorStore {
    /** Insert documents with pre-computed embeddings. Returns inserted IDs. */
    insert(docs: {
        content: string;
        embedding: number[];
        metadata: Record<string, unknown>;
    }[]): Promise<string[]>;

    /** Search by pre-computed embedding vector */
    search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;

    /** Delete documents matching filter. Returns count deleted. */
    delete(filter: SearchFilters): Promise<number>;
}

/**
 * MetaStore interface — generic CRUD for any entity type.
 * Each entity (files, sync_state, etc.) gets its own MetaStore instance.
 */
export interface MetaStore<T extends Record<string, unknown>> {
    /** Insert a record, return its ID */
    insert(record: Partial<T>): Promise<string>;

    /** Find a record by ID */
    find_by_id(id: string): Promise<T | null>;

    /** Find a single record matching the filter */
    find_one(filter: Partial<T>): Promise<T | null>;

    /** Update a record by ID */
    update(id: string, data: Partial<T>): Promise<void>;

    /** Delete a record by ID */
    delete(id: string): Promise<void>;

    /** Upsert: update if matching filter exists, insert otherwise */
    upsert(filter: Partial<T>, data: Partial<T>): Promise<void>;
}
