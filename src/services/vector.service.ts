import { getStore } from '@store/index';
import { logger } from '@utils/log.util';
import type {
    KnowledgeDocument,
    SearchOptions,
    SearchResult,
    SearchFilters,
} from '@app-types/index';

/**
 * Add documents to the vector store.
 * Embeds the content of each document and stores it with metadata.
 *
 * @param docs - Array of KnowledgeDocument to embed and store
 * @returns Array of inserted document IDs
 */
export async function addDocuments(
    docs: KnowledgeDocument[],
): Promise<string[]> {
    return getStore().addDocuments(docs);
}

/**
 * Search the vector store for documents similar to the query.
 * Uses the configured backend's vector search with optional metadata filters.
 *
 * @param query - The search query string
 * @param options - Search options (limit, minScore, filter)
 * @returns Array of SearchResult with documents and scores
 */
export async function searchDocuments(
    query: string,
    options?: SearchOptions,
): Promise<SearchResult[]> {
    return getStore().searchDocuments(query, options);
}

/**
 * Delete documents from the vector store by metadata filter.
 * Useful for re-ingestion (e.g., removing stale DL docs before refresh).
 *
 * @param filter - Metadata filter to match documents for deletion
 * @returns Number of documents deleted
 */
export async function deleteDocuments(
    filter: SearchFilters,
): Promise<number> {
    return getStore().deleteDocuments(filter);
}
