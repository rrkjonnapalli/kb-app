import { ai } from '@ai';
import { store } from '@store';
import { Collections } from '@enums/collections.enum';
import { logger } from '@utils/log.util';
import type { KnowledgeDocument } from '@app-types/document.types';
import type { SearchOptions, SearchResult, SearchFilters } from '@app-types/search.types';

/**
 * Documents entity service — high-level API for vector document operations.
 * Composes the Embedder + VectorStore primitives.
 *
 * Usage:
 *   import { documents } from '@services/document.service';
 *   await documents.add(docs);
 *   const results = await documents.search('query');
 */
export const documents = {
    /**
     * Embed and store documents in the knowledge base.
     * @returns Array of inserted document IDs
     */
    async add(docs: KnowledgeDocument[]): Promise<string[]> {
        if (docs.length === 0) return [];

        const vectorStore = store.get_vector_store(Collections.KNOWLEDGE_BASE);

        const contents = docs.map((d) => d.content);
        const embeddings = await ai.embed.embed_batch(contents);

        const records = docs.map((doc, i) => ({
            content: doc.content,
            embedding: embeddings[i],
            metadata: doc.metadata as unknown as Record<string, unknown>,
        }));

        const ids = await vectorStore.insert(records);
        logger.info({ count: ids.length }, 'Documents added to knowledge base');
        return ids;
    },

    /**
     * Search the knowledge base for documents similar to the query.
     * @returns Array of SearchResult with documents and scores
     */
    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        const vectorStore = store.get_vector_store(Collections.KNOWLEDGE_BASE);

        logger.info({ query, options }, 'Searching knowledge base');
        const embedding = await ai.embed.embed(query);
        return vectorStore.search(embedding, options);
    },

    /**
     * Delete documents from the knowledge base by metadata filter.
     * @returns Number of documents deleted
     */
    async delete(filter: SearchFilters): Promise<number> {
        const vectorStore = store.get_vector_store(Collections.KNOWLEDGE_BASE);
        return vectorStore.delete(filter);
    },
};
