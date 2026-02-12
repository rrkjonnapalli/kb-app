import type { SourceTypeValue, FileStatusValue } from '@enums/index';

// ─── Document Metadata ───────────────────────────────────────────────

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

/** A stored document with embedding and MongoDB _id */
export interface StoredDocument {
    _id?: string;
    content: string;
    embedding: number[];
    metadata: DocumentMetadata;
}

// ─── Search ──────────────────────────────────────────────────────────

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
    minScore?: number;
    filter?: SearchFilters;
}

/** A search result with score */
export interface SearchResult {
    document: KnowledgeDocument;
    score: number;
}

// ─── Chat ────────────────────────────────────────────────────────────

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

// ─── Ingestion ───────────────────────────────────────────────────────

/** Result summary from an ingestion run */
export interface IngestResult {
    processed: number;
    errors: number;
    details?: string[];
}

/** Sync state record stored in MongoDB */
export interface SyncState {
    job_name: string;
    last_success: Date;
    updated_at: Date;
}

// ─── PDF / File Records ──────────────────────────────────────────────

/** Record tracking a file upload/URL import and its processing status */
export interface FileRecord {
    _id?: string;
    filename: string;
    original_url?: string;
    source: 'upload' | 'url';
    status: FileStatusValue;
    error?: string;
    chunks_count?: number;
    created_at: Date;
    updated_at: Date;
}

// ─── Microsoft Graph Raw Types ───────────────────────────────────────

/** Raw transcript record from Graph API */
export interface RawTranscript {
    id: string;
    meetingId: string;
    meetingOrganizerId: string;
    createdDateTime: string;
}

/** Raw meeting details from Graph API */
export interface RawMeetingDetails {
    id: string;
    subject: string;
    startDateTime: string;
    endDateTime: string;
    attendees: Array<{
        emailAddress: { name: string; address: string };
    }>;
}

/** Raw distribution list from Graph API */
export interface RawDLData {
    id: string;
    displayName: string;
    mail: string;
    description: string | null;
    members: RawDLMember[];
}

/** A member of a distribution list */
export interface RawDLMember {
    id: string;
    displayName: string;
    mail: string;
    jobTitle?: string;
}
