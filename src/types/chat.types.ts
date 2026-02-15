import type { SourceTypeValue } from '@enums/source_type.enum';

/** Reference to a source used in a chat response */
export interface SourceReference {
    source_type: SourceTypeValue;
    title: string;
    date?: string;
    relevance_score: number;
}

/** Response from the chat API */
export interface ChatResponse {
    answer: string;
    sources: SourceReference[];
}
