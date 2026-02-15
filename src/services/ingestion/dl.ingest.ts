import { extractors } from '@extractors/index';
import { parsers } from '@parsers/index';
import { documents } from '@services/document.service';
import { sync_state } from '@services/sync_state.service';
import { SourceType } from '@enums/source_type.enum';
import { logger } from '@utils/log.util';
import type { IngestResult } from '@app-types/ingest.types';

/**
 * Ingest distribution lists: extract → parse → delete old → embed → store.
 * Always does a full refresh to avoid stale data.
 */
export async function run(): Promise<IngestResult> {
    const details: string[] = [];
    let processed = 0;
    let errors = 0;

    logger.info('Starting distribution list ingestion');

    try {
        const _raw = await extractors.dls.extract();
        logger.info({ count: _raw.length }, 'Extracted distribution lists');

        // Delete existing DL documents to avoid stale data
        const deleted = await documents.delete({
            source_type: SourceType.DISTRIBUTION_LIST,
        });
        details.push(`Deleted ${deleted} existing DL documents`);

        for (const _item of _raw) {
            try {
                const _docs = parsers.dls.parse(_item);
                await documents.add(_docs);
                processed += _docs.length;
                details.push(
                    `Processed DL "${_item.displayName}" (${_item.members.length} members)`,
                );
            } catch (err) {
                errors++;
                const msg = err instanceof Error ? err.message : String(err);
                details.push(`Error processing DL ${_item.displayName}: ${msg}`);
                logger.error(
                    { dlId: _item.id, error: err },
                    'Failed to process distribution list',
                );
            }
        }

        await sync_state.upsert(
            { job_name: SourceType.DISTRIBUTION_LIST } as Parameters<typeof sync_state.upsert>[0],
            { last_success: new Date(), updated_at: new Date() } as Parameters<typeof sync_state.upsert>[1],
        );
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
