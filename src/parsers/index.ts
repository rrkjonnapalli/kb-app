import { TranscriptParser } from '@parsers/transcript.parser';
import { DLParser } from '@parsers/dl.parser';

/**
 * Parsers namespace — singleton instances for each data type.
 *
 * Usage:
 *   import { parsers } from '@parsers';
 *   const docs = parsers.transcripts.parse(rawTranscript);
 *   const docs = parsers.dls.parse(rawDL);
 */
export const parsers = {
    transcripts: new TranscriptParser(),
    dls: new DLParser(),
};

export { TranscriptParser, parse_transcript } from '@parsers/transcript.parser';
export { DLParser, parse_distribution_list } from '@parsers/dl.parser';
export { parse_pdf, PDFParser } from '@parsers/pdf.parser';
export { chunk_text } from '@parsers/text_chunker';
export type { Parser } from '@parsers/parser.interface';
export type { ChunkOptions, TextChunk } from '@parsers/text_chunker';
