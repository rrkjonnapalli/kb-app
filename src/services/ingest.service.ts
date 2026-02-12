import {
    fetchRecentTranscripts,
    fetchTranscriptContent,
    fetchMeetingDetails,
} from '@services/microsoft/transcript.microsoft';
import { fetchDistributionLists } from '@services/microsoft/dl.microsoft';
import { parseTranscript } from '@parsers/transcript.parser';
import { parseDistributionList } from '@parsers/dl.parser';
import { addDocuments, deleteDocuments } from '@services/vector.service';
import { getStore } from '@store/index';
import { SourceType } from '@enums/index';
import { logger } from '@utils/log.util';
import type { IngestResult } from '@app-types/index';

/**
 * Ingest meeting transcripts from Microsoft Graph into the vector store.
 *
 * Flow: fetch transcripts → fetch VTT content → parse → chunk → embed → store.
 * Supports delta sync via `since` parameter.
 *
 * @param options - Optional config: `since` date for incremental sync
 * @returns IngestResult with processed count, errors, and details
 */
export async function ingestTranscripts(
    options?: { since?: Date },
): Promise<IngestResult> {
    const store = getStore();
    const since = options?.since || (await store.getLastSyncTime(SourceType.TRANSCRIPT));
    const details: string[] = [];
    let processed = 0;
    let errors = 0;

    logger.info({ since }, 'Starting transcript ingestion');

    try {
        const transcripts = await fetchRecentTranscripts(since);
        logger.info({ count: transcripts.length }, 'Found transcripts to process');

        for (const transcript of transcripts) {
            try {
                // Fetch VTT content
                const vttContent = await fetchTranscriptContent(
                    transcript.meetingOrganizerId,
                    transcript.meetingId,
                    transcript.id,
                );

                // Fetch meeting metadata
                const meeting = await fetchMeetingDetails(
                    transcript.meetingOrganizerId,
                    transcript.meetingId,
                );

                // Parse VTT into documents
                const docs = parseTranscript(vttContent, {
                    meeting_subject: meeting.subject,
                    meeting_date: meeting.startDateTime,
                    meeting_id: meeting.id,
                    attendees: meeting.attendees.map((a) => a.emailAddress.name),
                });

                if (docs.length > 0) {
                    await addDocuments(docs);
                    processed += docs.length;
                    details.push(
                        `Processed meeting "${meeting.subject}": ${docs.length} chunks`,
                    );
                }
            } catch (err) {
                errors++;
                const msg = err instanceof Error ? err.message : String(err);
                details.push(`Error processing transcript ${transcript.id}: ${msg}`);
                logger.error(
                    { transcriptId: transcript.id, error: err },
                    'Failed to process transcript',
                );
            }
        }

        // Update sync state
        await store.updateSyncTime(SourceType.TRANSCRIPT);
    } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        details.push(`Fatal error during transcript ingestion: ${msg}`);
        logger.error({ error: err }, 'Transcript ingestion failed');
    }

    const result: IngestResult = { processed, errors, details };
    logger.info(result, 'Transcript ingestion complete');
    return result;
}

/**
 * Ingest distribution lists from Microsoft Graph into the vector store.
 *
 * Flow: fetch DLs → parse → delete old DL docs → embed → store.
 * Always does a full refresh to avoid stale data.
 *
 * @returns IngestResult with processed count, errors, and details
 */
export async function ingestDistributionLists(): Promise<IngestResult> {
    const store = getStore();
    const details: string[] = [];
    let processed = 0;
    let errors = 0;

    logger.info('Starting distribution list ingestion');

    try {
        const dls = await fetchDistributionLists();
        logger.info({ count: dls.length }, 'Found distribution lists to process');

        // Delete existing DL documents to avoid stale data
        const deleted = await deleteDocuments({
            source_type: SourceType.DISTRIBUTION_LIST,
        });
        details.push(`Deleted ${deleted} existing DL documents`);

        for (const dl of dls) {
            try {
                const doc = parseDistributionList(dl);
                await addDocuments([doc]);
                processed++;
                details.push(`Processed DL "${dl.displayName}" (${dl.members.length} members)`);
            } catch (err) {
                errors++;
                const msg = err instanceof Error ? err.message : String(err);
                details.push(`Error processing DL ${dl.displayName}: ${msg}`);
                logger.error(
                    { dlId: dl.id, error: err },
                    'Failed to process distribution list',
                );
            }
        }

        // Update sync state
        await store.updateSyncTime(SourceType.DISTRIBUTION_LIST);
    } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        details.push(`Fatal error during DL ingestion: ${msg}`);
        logger.error({ error: err }, 'DL ingestion failed');
    }

    const result: IngestResult = { processed, errors, details };
    logger.info(result, 'DL ingestion complete');
    return result;
}
