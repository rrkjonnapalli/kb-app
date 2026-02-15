import type { SourceTypeValue } from '@enums/source_type.enum';
import type { KnowledgeDocument } from '@app-types/document.types';

/** Filters for vector search queries */
export interface SearchFilters {
    source_type?: SourceTypeValue;
    meeting_subject?: string;
    dl_name?: string;
    pdf_filename?: string;
    date_from?: string;
    date_to?: string;
}

/** Options for vector search */
export interface SearchOptions {
    limit?: number;
    min_score?: number;
    filter?: SearchFilters;
}

/** A search result with score */
export interface SearchResult {
    document: KnowledgeDocument;
    score: number;
}
