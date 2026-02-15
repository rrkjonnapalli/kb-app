import type { KnowledgeDocument, TranscriptMetadata } from '@app-types/document.types';
import type { Parser } from '@parsers/parser.interface';
import type { TranscriptExtractResult } from '@extractors/microsoft/transcript.extractor';
import { mapper$transcript } from '@mappers/microsoft/transcript.mapper';

/** Parsed VTT utterance */
interface VttUtterance {
    start_time: string;
    end_time: string;
    speaker: string;
    text: string;
}

/**
 * Transcript parser — converts extracted transcript data into KnowledgeDocuments.
 *
 * Chunking strategy:
 * - Groups utterances into ~4 minute windows
 * - Keeps speaker attribution intact
 * - Never splits mid-sentence
 */
export class TranscriptParser implements Parser<TranscriptExtractResult> {
    /** Parse a transcript extract result into chunked documents */
    parse(raw: TranscriptExtractResult): KnowledgeDocument[] {
        const utterances = parse_vtt(raw.vttContent);
        if (utterances.length === 0) return [];

        const metadata = mapper$transcript.to_metadata(raw.meeting);
        const chunks = chunk_utterances(utterances);

        return chunks.map((chunk) => {
            const speakers = [...new Set(chunk.map((u) => u.speaker))];
            const content = chunk
                .map((u) => `[${u.speaker}] (${u.start_time}): ${u.text}`)
                .join('\n');

            return {
                content,
                metadata: {
                    source_type: 'transcript' as const,
                    meeting_subject: metadata.meeting_subject,
                    meeting_date: metadata.meeting_date,
                    meeting_id: metadata.meeting_id,
                    speakers,
                    timestamp_start: chunk[0].start_time,
                    timestamp_end: chunk[chunk.length - 1].end_time,
                    attendees: metadata.attendees,
                },
            };
        });
    }
}

/**
 * Legacy function interface — parse VTT content with pre-mapped metadata.
 * Kept for backward compatibility during migration.
 */
export function parse_transcript(
    vttContent: string,
    metadata: Omit<TranscriptMetadata, 'source_type' | 'speakers' | 'timestamp_start' | 'timestamp_end'>,
): KnowledgeDocument[] {
    const utterances = parse_vtt(vttContent);
    if (utterances.length === 0) return [];

    const chunks = chunk_utterances(utterances);

    return chunks.map((chunk) => {
        const speakers = [...new Set(chunk.map((u) => u.speaker))];
        const content = chunk
            .map((u) => `[${u.speaker}] (${u.start_time}): ${u.text}`)
            .join('\n');

        return {
            content,
            metadata: {
                source_type: 'transcript' as const,
                meeting_subject: metadata.meeting_subject,
                meeting_date: metadata.meeting_date,
                meeting_id: metadata.meeting_id,
                speakers,
                timestamp_start: chunk[0].start_time,
                timestamp_end: chunk[chunk.length - 1].end_time,
                attendees: metadata.attendees,
            },
        };
    });
}

/**
 * Parse raw VTT content into an array of utterances.
 * @param vttContent - The raw VTT string
 * @returns Array of parsed utterances
 */
function parse_vtt(vttContent: string): VttUtterance[] {
    const utterances: VttUtterance[] = [];
    const lines = vttContent.split('\n');

    let i = 0;
    // Skip WEBVTT header
    while (i < lines.length && !lines[i].includes('-->')) {
        i++;
    }

    while (i < lines.length) {
        const line = lines[i].trim();

        // Look for timestamp line: 00:00:00.000 --> 00:00:05.000
        const timestampMatch = line.match(
            /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/,
        );

        if (timestampMatch) {
            const _start = timestampMatch[1];
            const _end = timestampMatch[2];

            // Collect text lines until next blank line or timestamp
            i++;
            const textLines: string[] = [];
            while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
                textLines.push(lines[i].trim());
                i++;
            }

            const rawText = textLines.join(' ');

            // Extract speaker from <v Speaker Name>text</v> format
            const speakerMatch = rawText.match(/<v\s+([^>]+)>(.+?)<\/v>/);
            if (speakerMatch) {
                utterances.push({
                    start_time: _start,
                    end_time: _end,
                    speaker: speakerMatch[1].trim(),
                    text: speakerMatch[2].trim(),
                });
            } else {
                // No speaker tag — use raw text
                utterances.push({
                    start_time: _start,
                    end_time: _end,
                    speaker: 'Unknown',
                    text: rawText,
                });
            }
        } else {
            i++;
        }
    }

    return utterances;
}

/**
 * Chunk utterances into ~3-5 minute windows.
 * Groups by time proximity, never splitting mid-sentence.
 *
 * @param utterances - Array of parsed utterances
 * @returns Array of utterance groups (chunks)
 */
function chunk_utterances(utterances: VttUtterance[]): VttUtterance[][] {
    const CHUNK_DURATION_MS = 4 * 60 * 1000; // 4 minutes in ms
    const chunks: VttUtterance[][] = [];
    let currentChunk: VttUtterance[] = [];
    let chunkStartMs = 0;

    for (const utterance of utterances) {
        const currentMs = time_to_ms(utterance.start_time);

        if (currentChunk.length === 0) {
            chunkStartMs = currentMs;
        }

        // If this utterance exceeds the chunk duration, start a new chunk
        if (currentChunk.length > 0 && currentMs - chunkStartMs >= CHUNK_DURATION_MS) {
            chunks.push(currentChunk);
            currentChunk = [];
            chunkStartMs = currentMs;
        }

        currentChunk.push(utterance);
    }

    // Push remaining utterances
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}

/**
 * Convert a VTT timestamp (HH:MM:SS.mmm) to milliseconds.
 * @param time - VTT timestamp string
 * @returns Time in milliseconds
 */
function time_to_ms(time: string): number {
    const parts = time.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const [seconds, ms] = parts[2].split('.').map((s) => parseInt(s, 10));
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
}
