-- ============================================================
-- PostgreSQL + pgvector setup for Knowledge Base RAG Service
--
-- NOTE: The application creates these tables automatically via
--       store.setup(dimensions) at startup. This file is a
--       reference / manual bootstrap script only.
--
-- The vector dimension defaults to 1024 below. Adjust to match
-- your embedding model output (set via EMBED_DIMENSIONS env var):
--   - OpenAI text-embedding-3-small  → 1536
--   - OpenAI text-embedding-3-large  → 3072
--   - Ollama nomic-embed-text        → 768
--   - DeepSeek embeddings            → 1024
--
-- Run this BEFORE starting the application with STORE_TYPE=postgres
-- if you prefer manual schema management.
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Knowledge base table (mirrors Mongo knowledge_base collection)
--    Replace 1024 with your model's dimension if different.
CREATE TABLE IF NOT EXISTS knowledge_base (
    id          BIGSERIAL PRIMARY KEY,
    content     TEXT        NOT NULL,
    embedding   VECTOR(1024) NOT NULL,  -- adjust to EMBED_DIMENSIONS
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on source_type for filtered queries and deletes
CREATE INDEX IF NOT EXISTS idx_kb_source_type
    ON knowledge_base ((metadata->>'source_type'));

-- Index on meeting_date for date range filters
CREATE INDEX IF NOT EXISTS idx_kb_meeting_date
    ON knowledge_base ((metadata->>'meeting_date'));

-- HNSW index for fast cosine vector search
CREATE INDEX IF NOT EXISTS idx_kb_embedding_hnsw
    ON knowledge_base
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 3. Files table (mirrors Mongo files collection)
CREATE TABLE IF NOT EXISTS files (
    id            BIGSERIAL PRIMARY KEY,
    filename      TEXT        NOT NULL,
    original_url  TEXT,
    source        TEXT        NOT NULL CHECK (source IN ('upload', 'url')),
    status        TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error         TEXT,
    chunks_count  INTEGER,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Sync state table (mirrors Mongo sync_state collection)
CREATE TABLE IF NOT EXISTS sync_state (
    job_name      TEXT        PRIMARY KEY,
    last_success  TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
