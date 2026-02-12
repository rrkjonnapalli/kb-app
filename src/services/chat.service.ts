import { chatModel } from '@ai/chat.model';
import { searchDocuments } from '@services/vector.service';
import { logger } from '@utils/log.util';
import type { ChatResponse, SearchFilters, SourceReference, SearchResult } from '@app-types/index';

/** System prompt template for the RAG chain */
const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on meeting transcripts, distribution list information, and PDF documents from our organization.

Use ONLY the following context to answer the question. If the context doesn't contain enough information to answer, say "I don't have enough information to answer that question."

Always cite which meeting or distribution list your answer comes from.

Context:
{context}`;

/**
 * Execute a RAG query: search vector store → build prompt → call LLM → return answer with sources.
 *
 * @param query - The user's question
 * @param filters - Optional search filters (source_type, date range, etc.)
 * @returns ChatResponse with answer text and source references
 */
export async function chat(
    query: string,
    filters?: SearchFilters,
): Promise<ChatResponse> {
    logger.info({ query, filters }, 'Processing chat query');

    // 1. Retrieve relevant documents
    const searchResults = await searchDocuments(query, {
        limit: 5,
        minScore: 0.7,
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

    // 3. Build prompt and call LLM
    const systemMessage = SYSTEM_PROMPT.replace('{context}', context);

    const response = await chatModel.invoke([
        { role: 'system', content: systemMessage },
        { role: 'user', content: query },
    ]);

    const answer =
        typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

    // 4. Build source references
    const sources = buildSourceReferences(searchResults);

    logger.info(
        { sourcesCount: sources.length },
        'Chat query completed',
    );

    return { answer, sources };
}

/**
 * Build source references from search results for the chat response.
 * @param results - The vector search results
 * @returns Array of SourceReference
 */
function buildSourceReferences(results: SearchResult[]): SourceReference[] {
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
