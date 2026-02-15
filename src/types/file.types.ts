import type { FileStatusValue } from '@enums/file_status.enum';

/** Record tracking a file upload/URL import and its processing status */
export interface FileRecord {
    _id?: string;
    filename: string;
    original_url?: string;
    source: 'upload' | 'url';
    status: FileStatusValue;
    error?: string;
    chunks_count?: number;
    created_at: Date;
    updated_at: Date;
}
