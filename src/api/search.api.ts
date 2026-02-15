import { Elysia, t } from 'elysia';
import { documents } from '@services/document.service';
import { logger } from '@utils/log.util';

/**
 * Search API plugin.
 * Provides raw vector search without LLM chat — returns matching documents and scores directly.
 *
 * Routes:
 * - POST /api/search — vector similarity search with optional filters
 */
export const api$search = new Elysia({ prefix: '/api/search' }).post(
    '/',
    async ({ body }) => {
        logger.info({ query: body.query }, 'Search API request');

        const results = await documents.search(body.query, {
            limit: body.limit ?? 5,
            min_score: body.min_score ?? 0.2,
            filter: body.filters,
        });

        return {
            count: results.length,
            results: results.map((r) => ({
                content: r.document.content,
                metadata: r.document.metadata,
                score: r.score,
            })),
        };
    },
    {
        body: t.Object({
            query: t.String({ description: 'The search query to embed and match against' }),
            limit: t.Optional(t.Number({ description: 'Max results to return (default 5)', minimum: 1, maximum: 50 })),
            min_score: t.Optional(t.Number({ description: 'Minimum similarity score threshold (default 0.2)', minimum: 0.01, maximum: 1 })),
            filters: t.Optional(
                t.Object({
                    source_type: t.Optional(
                        t.Union([
                            t.Literal('pdf'),
                            t.Literal('transcript'),
                            t.Literal('distribution_list'),
                        ], {
                            description: 'Filter by source type',
                        }),
                    ),
                    meeting_subject: t.Optional(
                        t.String({ description: 'Filter by meeting subject' }),
                    ),
                    dl_name: t.Optional(
                        t.String({ description: 'Filter by distribution list name' }),
                    ),
                    pdf_filename: t.Optional(
                        t.String({ description: 'Filter by PDF filename' }),
                    ),
                    date_from: t.Optional(
                        t.String({ description: 'Filter by date range start (ISO)' }),
                    ),
                    date_to: t.Optional(
                        t.String({ description: 'Filter by date range end (ISO)' }),
                    ),
                }),
            ),
        }),
        detail: {
            summary: 'Search the knowledge base',
            description:
                'Perform a raw vector similarity search without LLM processing. Returns matching documents with relevance scores.',
            tags: ['Search'],
        },
    },
);
