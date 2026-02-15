/** File processing status */
export const FileStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
} as const;

export type FileStatusValue = (typeof FileStatus)[keyof typeof FileStatus];
