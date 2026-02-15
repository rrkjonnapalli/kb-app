/** Metadata specific to transcript documents */
export interface TranscriptMetadata {
    source_type: 'transcript';
    meeting_subject: string;
    meeting_date: string;
    meeting_id: string;
    speakers: string[];
    timestamp_start: string;
    timestamp_end: string;
    attendees: string[];
}

/** Metadata specific to distribution list documents */
export interface DLMetadata {
    source_type: 'distribution_list';
    dl_name: string;
    dl_email: string;
    dl_id: string;
    member_count: number;
}

/** Metadata specific to PDF documents */
export interface PdfMetadata {
    source_type: 'pdf';
    pdf_filename: string;
    pdf_file_id: string;
    page_start: number;
    page_end: number;
    total_pages: number;
    chunk_index: number;
}

/** Union of all document metadata types */
export type DocumentMetadata = TranscriptMetadata | DLMetadata | PdfMetadata;

/** A document stored in the knowledge base vector collection */
export interface KnowledgeDocument {
    content: string;
    metadata: DocumentMetadata;
}

/** A stored document with embedding and DB id */
export interface StoredDocument {
    _id?: string;
    content: string;
    embedding: number[];
    metadata: DocumentMetadata;
}
