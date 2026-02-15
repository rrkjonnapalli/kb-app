import { ai } from '@ai';
import { documents } from '@services/document.service';
import { logger } from '@utils/log.util';
import type { ChatResponse, SourceReference } from '@app-types/chat.types';
import type { SearchFilters, SearchResult } from '@app-types/search.types';

/**
 * Execute a RAG query: search vector store → build context → call LLM → return answer with sources.
 */
export async function chat(
    query: string,
    filters?: SearchFilters,
): Promise<ChatResponse> {
    logger.info({ query, filters }, 'Processing chat query');

    // 1. Retrieve relevant documents
    const searchResults = await documents.search(query, {
        limit: 5,
        min_score: 0.2,
        filter: filters,
    });

    if (searchResults.length === 0) {
        return {
            answer:
                "I don't have enough information to answer that question. No relevant documents were found in the knowledge base.",
            sources: [],
        };
    }

    // 2. Build context from retrieved documents
    const context = searchResults
        .map((result, i) => {
            const meta = result.document.metadata;
            let sourceLabel: string;
            if (meta.source_type === 'transcript') {
                sourceLabel = `[Meeting: ${meta.meeting_subject} (${meta.meeting_date})]`;
            } else if (meta.source_type === 'distribution_list') {
                sourceLabel = `[Distribution List: ${meta.dl_name}]`;
            } else {
                sourceLabel = `[PDF: ${meta.pdf_filename}]`;
            }
            return `--- Document ${i + 1} ${sourceLabel} ---\n${result.document.content}`;
        })
        .join('\n\n');

    // 3. Call LLM with context
    const answer = await ai.chat.invoke(query, context);

    // 4. Build source references
    const sources = build_source_references(searchResults);

    logger.info({ sourcesCount: sources.length }, 'Chat query completed');
    return { answer, sources };
}

function build_source_references(results: SearchResult[]): SourceReference[] {
    return results.map((result) => {
        const meta = result.document.metadata;

        if (meta.source_type === 'transcript') {
            return {
                source_type: meta.source_type,
                title: meta.meeting_subject,
                date: meta.meeting_date,
                relevance_score: result.score,
            };
        }

        if (meta.source_type === 'distribution_list') {
            return {
                source_type: meta.source_type,
                title: meta.dl_name,
                relevance_score: result.score,
            };
        }

        return {
            source_type: meta.source_type,
            title: meta.pdf_filename,
            relevance_score: result.score,
        };
    });
}
