import { extractors } from '@extractors/index';
import { parsers } from '@parsers/index';
import { documents } from '@services/document.service';
import { sync_state } from '@services/sync_state.service';
import { SourceType } from '@enums/source_type.enum';
import { logger } from '@utils/log.util';
import type { IngestResult } from '@app-types/ingest.types';

/**
 * Ingest meeting transcripts: extract → parse → embed → store.
 * Supports delta sync via `since` parameter.
 */
export async function run(options?: { since?: Date }): Promise<IngestResult> {
    const since = options?.since ?? (await sync_state.get_last_sync(SourceType.TRANSCRIPT));
    const details: string[] = [];
    let processed = 0;
    let errors = 0;

    logger.info({ since }, 'Starting transcript ingestion');

    try {
        const _raw = await extractors.transcripts.extract({ since });
        logger.info({ count: _raw.length }, 'Extracted transcripts');

        for (const _item of _raw) {
            try {
                const _docs = parsers.transcripts.parse(_item);

                if (_docs.length > 0) {
                    await documents.add(_docs);
                    processed += _docs.length;
                    details.push(
                        `Processed meeting "${_item.meeting.subject}": ${_docs.length} chunks`,
                    );
                }
            } catch (err) {
                errors++;
                const msg = err instanceof Error ? err.message : String(err);
                details.push(`Error processing transcript ${_item.transcript.id}: ${msg}`);
                logger.error(
                    { transcriptId: _item.transcript.id, error: err },
                    'Failed to process transcript',
                );
            }
        }

        await sync_state.upsert(
            { job_name: SourceType.TRANSCRIPT } as Parameters<typeof sync_state.upsert>[0],
            { last_success: new Date(), updated_at: new Date() } as Parameters<typeof sync_state.upsert>[1],
        );
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
