import { Elysia, t } from 'elysia';
import { chat } from '@services/chat.service';
import { logger } from '@utils/log.util';

/**
 * Chat API plugin.
 * Provides RAG-based chat endpoint for querying the knowledge base.
 *
 * Routes:
 * - POST /api/chat — query the knowledge base with optional filters
 */
export const api$chat = new Elysia({ prefix: '/api/chat' }).post(
    '/',
    async ({ body }) => {
        logger.info({ query: body.query }, 'Chat API request');
        const result = await chat(body.query, body.filters);
        return result;
    },
    {
        body: t.Object({
            query: t.String({ description: 'The question to ask the knowledge base' }),
            filters: t.Optional(
                t.Object({
                    source_type: t.Optional(
                        t.Union([
                            t.Literal('transcript'),
                            t.Literal('distribution_list'),
                            t.Literal('pdf'),
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
            summary: 'Query the knowledge base',
            description:
                'Ask a question against meeting transcripts, distribution lists, and PDFs using RAG. Returns an answer with source references.',
            tags: ['Chat'],
        },
    },
);
