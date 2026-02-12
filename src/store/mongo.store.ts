import type { Store } from '@store/store.interface';
import type { FileStatusValue } from '@enums/index';
import type {
    KnowledgeDocument,
    StoredDocument,
    SearchOptions,
    SearchResult,
    SearchFilters,
    FileRecord,
    SyncState,
} from '@app-types/index';
import { getDb, getCollection, closeMongo } from '@connection/mongo/mongo.connection';
import { ensureVectorIndex } from '@connection/mongo/vector.connection';
import { Collections, VectorIndex, EmbeddingConfig, FileStatus } from '@enums/index';
import { embedText, embedTexts } from '@services/embed.service';
import { logger } from '@utils/log.util';
import { ObjectId } from 'mongodb';

/**
 * MongoDB implementation of the Store interface.
 * Wraps existing Mongo connection, vector index, and CRUD logic.
 */
export class MongoStore implements Store {

    // ─── Lifecycle ───────────────────────────────────────────────────

    async connect(): Promise<void> {
        await getDb();
        logger.info('MongoStore connected');
    }

    async close(): Promise<void> {
        await closeMongo();
    }

    async ensureSchema(): Promise<void> {
        await ensureVectorIndex();
    }

    // ─── Vector Operations ───────────────────────────────────────────

    async addDocuments(docs: KnowledgeDocument[]): Promise<string[]> {
        if (docs.length === 0) return [];

        const collection = await getCollection<StoredDocument>(Collections.KNOWLEDGE_BASE);

        const contents = docs.map((d) => d.content);
        const embeddings = await embedTexts(contents);

        const storedDocs: Omit<StoredDocument, '_id'>[] = docs.map((doc, i) => ({
            content: doc.content,
            embedding: embeddings[i],
            metadata: doc.metadata,
        }));

        const result = await collection.insertMany(storedDocs as StoredDocument[]);
        const ids = Object.values(result.insertedIds).map((id) => id.toString());
        logger.info({ count: ids.length }, 'Documents added to vector store');
        return ids;
    }

    async searchDocuments(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        const collection = await getCollection(Collections.KNOWLEDGE_BASE);

        const queryEmbedding = await embedText(query);
        const limit = options?.limit || 5;
        const minScore = options?.minScore || 0.7;
        const filter = this.buildSearchFilter(options?.filter);

        const pipeline = [
            {
                $vectorSearch: {
                    index: VectorIndex.KNOWLEDGE_BASE,
                    path: EmbeddingConfig.VECTOR_FIELD,
                    queryVector: queryEmbedding,
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

        const results = await collection.aggregate(pipeline).toArray();

        return results.map((doc) => ({
            document: {
                content: doc.content as string,
                metadata: doc.metadata as KnowledgeDocument['metadata'],
            },
            score: doc.score as number,
        }));
    }

    async deleteDocuments(filter: SearchFilters): Promise<number> {
        const collection = await getCollection(Collections.KNOWLEDGE_BASE);
        const mongoFilter = this.buildDeleteFilter(filter);
        const result = await collection.deleteMany(mongoFilter);
        logger.info({ count: result.deletedCount, filter }, 'Documents deleted from vector store');
        return result.deletedCount;
    }

    // ─── File Records ────────────────────────────────────────────────

    async createFileRecord(
        filename: string,
        source: 'upload' | 'url',
        originalUrl?: string,
    ): Promise<string> {
        const collection = await getCollection<FileRecord>(Collections.FILES);

        const record: Omit<FileRecord, '_id'> = {
            filename,
            source,
            original_url: originalUrl,
            status: FileStatus.PENDING,
            created_at: new Date(),
            updated_at: new Date(),
        };

        const result = await collection.insertOne(record as FileRecord);
        const fileId = result.insertedId.toString();
        logger.info({ fileId, filename, source }, 'File record created');
        return fileId;
    }

    async getFileRecord(fileId: string): Promise<FileRecord | null> {
        const collection = await getCollection<FileRecord>(Collections.FILES);
        return collection.findOne({ _id: new ObjectId(fileId) as unknown as FileRecord['_id'] });
    }

    async updateFileStatus(
        fileId: string,
        status: FileStatusValue,
        extra?: Partial<Pick<FileRecord, 'error' | 'chunks_count'>>,
    ): Promise<void> {
        const collection = await getCollection<FileRecord>(Collections.FILES);
        await collection.updateOne(
            { _id: new ObjectId(fileId) as unknown as FileRecord['_id'] },
            {
                $set: {
                    status,
                    updated_at: new Date(),
                    ...extra,
                },
            },
        );
    }

    // ─── Sync State ──────────────────────────────────────────────────

    async getLastSyncTime(sourceType: string): Promise<Date> {
        try {
            const collection = await getCollection<SyncState>(Collections.SYNC_STATE);
            const record = await collection.findOne({ job_name: sourceType });
            if (record) return record.last_success;
        } catch (err) {
            logger.warn({ sourceType, error: err }, 'Failed to read sync state');
        }
        return new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    async updateSyncTime(sourceType: string): Promise<void> {
        try {
            const collection = await getCollection<SyncState>(Collections.SYNC_STATE);
            await collection.updateOne(
                { job_name: sourceType },
                { $set: { last_success: new Date(), updated_at: new Date() } },
                { upsert: true },
            );
        } catch (err) {
            logger.warn({ sourceType, error: err }, 'Failed to update sync state');
        }
    }

    // ─── Private Helpers ─────────────────────────────────────────────

    private buildSearchFilter(filters?: SearchFilters): Record<string, unknown> {
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

    private buildDeleteFilter(filters: SearchFilters): Record<string, unknown> {
        const filter: Record<string, unknown> = {};
        if (filters.source_type) filter['metadata.source_type'] = filters.source_type;
        if (filters.meeting_subject) filter['metadata.meeting_subject'] = filters.meeting_subject;
        if (filters.dl_name) filter['metadata.dl_name'] = filters.dl_name;
        if (filters.pdf_filename) filter['metadata.pdf_filename'] = filters.pdf_filename;
        return filter;
    }
}
