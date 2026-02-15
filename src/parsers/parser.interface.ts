import type { KnowledgeDocument } from '@app-types/document.types';

/**
 * Parser interface — transforms raw extracted data into KnowledgeDocuments.
 * Each source type has its own parser implementation.
 */
export interface Parser<TRaw> {
    /** Parse raw data into knowledge base documents */
    parse(raw: TRaw): KnowledgeDocument[];
}
