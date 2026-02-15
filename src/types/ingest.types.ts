/** Result summary from an ingestion run */
export interface IngestResult {
    processed: number;
    errors: number;
    details?: string[];
}
