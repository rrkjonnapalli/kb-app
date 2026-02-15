import * as transcripts from '@services/ingestion/transcript.ingest';
import * as dls from '@services/ingestion/dl.ingest';
import * as pdf from '@services/ingestion/pdf.ingest';

/**
 * Ingestion namespace — orchestrate extract → parse → embed → store pipelines.
 *
 * Usage:
 *   import { ingestion } from '@services/ingestion';
 *   await ingestion.transcripts.run();
 *   await ingestion.dls.run();
 *   await ingestion.pdf.run(buffer, fileId, filename);
 */
export const ingestion = {
    transcripts,
    dls,
    pdf,
};

export { transcripts, dls, pdf };
