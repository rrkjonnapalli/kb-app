/** Cron job names */
export const JobName = {
    INGEST_TRANSCRIPTS: 'ingest-transcripts',
    INGEST_DLS: 'ingest-dls',
} as const;

export type JobNameValue = (typeof JobName)[keyof typeof JobName];
