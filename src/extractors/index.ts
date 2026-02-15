import { env } from '@config/env';
import { PDFExtractor } from '@extractors/pdf/pdf.extractor';
import { AzureSourceDisabledError } from '@errors/ai.error';
import type { Extractor } from '@extractors/extractor.interface';
import type { TranscriptExtractResult } from '@extractors/microsoft/transcript.extractor';
import type { RawDLData } from '@app-types/microsoft.types';

/** Stub extractor that throws when Azure source is disabled */
class DisabledExtractor<T> implements Extractor<T> {
    constructor(private readonly feature: string) {}
    async extract(): Promise<T[]> {
        throw new AzureSourceDisabledError(this.feature);
    }
}

function create_transcript_extractor(): Extractor<TranscriptExtractResult> {
    if (!env.AZURE_SOURCE) return new DisabledExtractor('Transcript extraction');
    const { TranscriptExtractor } = require('@extractors/microsoft/transcript.extractor');
    return new TranscriptExtractor();
}

function create_dl_extractor(): Extractor<RawDLData> {
    if (!env.AZURE_SOURCE) return new DisabledExtractor('Distribution list extraction');
    const { DLExtractor } = require('@extractors/microsoft/dl.extractor');
    return new DLExtractor();
}

/**
 * Extractors namespace — singleton instances for each data source.
 *
 * When AZURE_SOURCE is not set to Y, transcript and DL extractors are replaced
 * with stubs that throw AzureSourceDisabledError.
 */
export const extractors = {
    transcripts: create_transcript_extractor(),
    dls: create_dl_extractor(),
    pdf: new PDFExtractor(),
};

export { PDFExtractor } from '@extractors/pdf/pdf.extractor';
export type { Extractor, ExtractOptions } from '@extractors/extractor.interface';
export type { TranscriptExtractResult } from '@extractors/microsoft/transcript.extractor';
export type { PdfExtractResult } from '@extractors/pdf/pdf.extractor';
