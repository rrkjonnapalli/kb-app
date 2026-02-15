import type { Collection, Document } from 'mongodb';
import type { VectorStore } from '@store/store.interface';
import type { SearchOptions, SearchResult, SearchFilters } from '@app-types/search.types';
import type { KnowledgeDocument } from '@app-types/document.types';
import { logger } from '@utils/log.util';

const VECTOR_FIELD = 'embedding';

/**
 * MongoDB Atlas Vector Search implementation of VectorStore.
 * Operates on pre-computed embeddings — no embedding logic here.
 */
export class MongoVectorStore implements VectorStore {
    private readonly collection: Collection<Document>;
    private readonly indexName: string;

    constructor(collection: Collection<Document>, indexName: string) {
        this.collection = collection;
        this.indexName = indexName;
    }

    /** Insert documents with pre-computed embeddings */
    async insert(docs: {
        content: string;
        embedding: number[];
        metadata: Record<string, unknown>;
    }[]): Promise<string[]> {
        if (docs.length === 0) return [];

        const result = await this.collection.insertMany(docs);
        const ids = Object.values(result.insertedIds).map((id) => id.toString());
        logger.info({ count: ids.length }, 'Documents inserted into vector store');
        return ids;
    }

    /** Similarity search using Atlas $vectorSearch */
    async search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]> {
        const limit = options?.limit || 5;
        const minScore = options?.min_score || 0.7;
        const filter = this.build_search_filter(options?.filter);

        const pipeline = [
            {
                $vectorSearch: {
                    index: this.indexName,
                    path: VECTOR_FIELD,
                    queryVector: embedding,
                    numCandidates: limit * 10,
                    limit,
                    ...(Object.keys(filter).length > 0 && { filter }),
                },
            },
            {
                $project: {
                    content: 1,
                    metadata: 1,
                    score: { $meta: 'vectorSearchScore' },
                },
            },
            {
                $match: {
                    score: { $gte: minScore },
                },
            },
        ];

        const results = await this.collection.aggregate(pipeline).toArray();

        return results.map((doc) => ({
            document: {
                content: doc.content as string,
                metadata: doc.metadata as KnowledgeDocument['metadata'],
            },
            score: doc.score as number,
        }));
    }

    /** Delete documents matching metadata filter */
    async delete(filter: SearchFilters): Promise<number> {
        const mongoFilter = this.build_delete_filter(filter);
        const result = await this.collection.deleteMany(mongoFilter);
        logger.info({ count: result.deletedCount, filter }, 'Documents deleted from vector store');
        return result.deletedCount;
    }

    private build_search_filter(filters?: SearchFilters): Record<string, unknown> {
        if (!filters) return {};
        const filter: Record<string, unknown> = {};
        if (filters.source_type) filter['metadata.source_type'] = { $eq: filters.source_type };
        if (filters.meeting_subject) filter['metadata.meeting_subject'] = { $eq: filters.meeting_subject };
        if (filters.dl_name) filter['metadata.dl_name'] = { $eq: filters.dl_name };
        if (filters.pdf_filename) filter['metadata.pdf_filename'] = { $eq: filters.pdf_filename };
        if (filters.date_from || filters.date_to) {
            const dateFilter: Record<string, string> = {};
            if (filters.date_from) dateFilter['$gte'] = filters.date_from;
            if (filters.date_to) dateFilter['$lte'] = filters.date_to;
            filter['metadata.meeting_date'] = dateFilter;
        }
        return filter;
    }

    private build_delete_filter(filters: SearchFilters): Record<string, unknown> {
        const filter: Record<string, unknown> = {};
        if (filters.source_type) filter['metadata.source_type'] = filters.source_type;
        if (filters.meeting_subject) filter['metadata.meeting_subject'] = filters.meeting_subject;
        if (filters.dl_name) filter['metadata.dl_name'] = filters.dl_name;
        if (filters.pdf_filename) filter['metadata.pdf_filename'] = filters.pdf_filename;
        return filter;
    }
}
