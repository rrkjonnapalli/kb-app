/** Sync state record for tracking cron job progress */
export interface SyncState {
    job_name: string;
    last_success: Date;
    updated_at: Date;
}
