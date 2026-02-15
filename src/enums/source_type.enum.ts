/** Source types for documents in the knowledge base */
export const SourceType = {
    TRANSCRIPT: 'transcript',
    DISTRIBUTION_LIST: 'distribution_list',
    PDF: 'pdf',
} as const;

export type SourceTypeValue = (typeof SourceType)[keyof typeof SourceType];
