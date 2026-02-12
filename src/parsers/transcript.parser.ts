import type { KnowledgeDocument, TranscriptMetadata } from '@app-types/index';

/** Parsed VTT utterance */
interface VttUtterance {
    startTime: string;
    endTime: string;
    speaker: string;
    text: string;
}

/**
 * Parse a VTT transcript into chunked KnowledgeDocuments.
 *
 * Chunking strategy:
 * - Groups utterances into ~3-5 minute windows
 * - Keeps speaker attribution intact
 * - Never splits mid-sentence
 *
 * VTT format expected:
 * ```
 * WEBVTT
 *
 * 00:00:00.000 --> 00:00:05.000
 * <v Speaker Name>Hello everyone, let's get started.</v>
 * ```
 *
 * @param vttContent - The raw VTT string content
 * @param metadata - Meeting metadata (subject, date, id, attendees)
 * @returns Array of KnowledgeDocument chunks with transcript metadata
 */
export function parseTranscript(
    vttContent: string,
    metadata: Omit<TranscriptMetadata, 'source_type' | 'speakers' | 'timestamp_start' | 'timestamp_end'>,
): KnowledgeDocument[] {
    const utterances = parseVtt(vttContent);

    if (utterances.length === 0) {
        return [];
    }

    const chunks = chunkUtterances(utterances);

    return chunks.map((chunk) => {
        const speakers = [...new Set(chunk.map((u) => u.speaker))];
        const content = chunk
            .map((u) => `[${u.speaker}] (${u.startTime}): ${u.text}`)
            .join('\n');

        return {
            content,
            metadata: {
                source_type: 'transcript' as const,
                meeting_subject: metadata.meeting_subject,
                meeting_date: metadata.meeting_date,
                meeting_id: metadata.meeting_id,
                speakers,
                timestamp_start: chunk[0].startTime,
                timestamp_end: chunk[chunk.length - 1].endTime,
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
function parseVtt(vttContent: string): VttUtterance[] {
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
            const startTime = timestampMatch[1];
            const endTime = timestampMatch[2];

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
                    startTime,
                    endTime,
                    speaker: speakerMatch[1].trim(),
                    text: speakerMatch[2].trim(),
                });
            } else {
                // No speaker tag — use raw text
                utterances.push({
                    startTime,
                    endTime,
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
function chunkUtterances(utterances: VttUtterance[]): VttUtterance[][] {
    const CHUNK_DURATION_MS = 4 * 60 * 1000; // 4 minutes in ms
    const chunks: VttUtterance[][] = [];
    let currentChunk: VttUtterance[] = [];
    let chunkStartMs = 0;

    for (const utterance of utterances) {
        const currentMs = timeToMs(utterance.startTime);

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
function timeToMs(time: string): number {
    const parts = time.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const [seconds, ms] = parts[2].split('.').map((s) => parseInt(s, 10));
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
}
