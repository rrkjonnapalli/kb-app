/** Options for data extraction */
export interface ExtractOptions {
    since?: Date;
    url?: string;
    buffer?: Buffer;
    [key: string]: unknown;
}

/**
 * Extractor interface — fetches raw data from an external source.
 * Each source type (transcripts, DLs, PDF) has its own extractor.
 */
export interface Extractor<TRaw> {
    /** Extract raw data from the external source */
    extract(options?: ExtractOptions): Promise<TRaw[]>;
}
