import { Collections } from '@enums/collections.enum';
import { FileStatus } from '@enums/file_status.enum';
import { create_entity_service } from '@services/base.service';
import type { FileRecord } from '@app-types/file.types';
import type { FileStatusValue } from '@enums/file_status.enum';

/**
 * Files entity service — extends base CRUD with domain-specific methods.
 *
 * Usage:
 *   import { files } from '@services/file.service';
 *   const id = await files.create('doc.pdf', 'upload');
 *   await files.update_status(id, 'completed', { chunks_count: 10 });
 */
export const files = {
    ...create_entity_service<FileRecord & Record<string, unknown>>(Collections.FILES),

    /** Create a new file record with pending status */
    async create(
        filename: string,
        source: 'upload' | 'url',
        original_url?: string,
    ): Promise<string> {
        return files.insert({
            filename,
            source,
            original_url,
            status: FileStatus.PENDING,
            created_at: new Date(),
            updated_at: new Date(),
        } as Partial<FileRecord & Record<string, unknown>>);
    },

    /** Update file processing status and optional extra fields */
    async update_status(
        id: string,
        status: FileStatusValue,
        extra?: Partial<Pick<FileRecord, 'error' | 'chunks_count'>>,
    ): Promise<void> {
        await files.update(id, { status, ...extra } as Partial<FileRecord & Record<string, unknown>>);
    },
};
