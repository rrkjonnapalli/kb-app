/**
 * Environment configuration.
 *
 * Feature flags control which subsystems are active:
 *   - AZURE_SOURCE=Y          → Enable Microsoft Graph API features (default: disabled)
 *   - CHAT_MODEL_PROVIDER     → Chat model backend (optional — chat is disabled when unset)
 *   - EMBED_MODEL_PROVIDER    → Embedding backend (optional — embeddings/RAG disabled when unset)
 *
 * AI model env vars (CHAT_*, EMBED_*) are never required at startup.
 * Validation happens lazily when the model is first accessed.
 */

import { EnvMissingError } from '@errors/config.error';

/** Typed environment variables */
export interface Env {
    // ── Feature flags ────────────────────────────────────────────────
    AZURE_SOURCE: boolean;

    // ── AI model config (generic per-capability) ─────────────────────
    CHAT_MODEL_PROVIDER: string;   // AZURE | OPENAI | DEEPSEEK | OLLAMA | CUSTOM | ''
    CHAT_API_KEY: string;
    CHAT_MODEL_NAME: string;
    CHAT_BASE_URL: string;

    EMBED_MODEL_PROVIDER: string;  // AZURE | OPENAI | DEEPSEEK | OLLAMA | CUSTOM | ''
    EMBED_API_KEY: string;
    EMBED_MODEL_NAME: string;
    EMBED_BASE_URL: string;
    EMBED_DIMENSIONS: number;

    // ── Azure OpenAI specific (only when *_PROVIDER=AZURE) ───────────
    AZURE_OPENAI_API_VERSION: string;

    // ── Microsoft Graph (required only when AZURE_SOURCE=Y) ──────────
    AZURE_TENANT_ID: string;
    AZURE_CLIENT_ID: string;
    AZURE_CLIENT_SECRET: string;

    // ── Store selection ──────────────────────────────────────────────
    STORE_TYPE: 'mongo' | 'postgres';
    MONGODB_URI: string;
    MONGODB_DB_NAME: string;
    POSTGRES_URL: string;

    // ── Server ───────────────────────────────────────────────────────
    PORT: number;
    LOG_LEVEL: string;
}

/**
 * Read a required env var or throw a descriptive error.
 */
function required(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new EnvMissingError(key);
    }
    return value;
}

/** Read an optional env var, returning fallback when unset. */
function optional(key: string, fallback = ''): string {
    return process.env[key] || fallback;
}

// ── Derived flags evaluated once ─────────────────────────────────────
const azure_source = process.env.AZURE_SOURCE === 'Y';

/** Validated and typed environment configuration */
export const env: Env = {
    // Feature flags
    AZURE_SOURCE: azure_source,

    // Chat model
    CHAT_MODEL_PROVIDER: optional('CHAT_MODEL_PROVIDER').toUpperCase(),
    CHAT_API_KEY: optional('CHAT_API_KEY'),
    CHAT_MODEL_NAME: optional('CHAT_MODEL_NAME'),
    CHAT_BASE_URL: optional('CHAT_BASE_URL'),

    // Embed model
    EMBED_MODEL_PROVIDER: optional('EMBED_MODEL_PROVIDER').toUpperCase(),
    EMBED_API_KEY: optional('EMBED_API_KEY'),
    EMBED_MODEL_NAME: optional('EMBED_MODEL_NAME'),
    EMBED_BASE_URL: optional('EMBED_BASE_URL'),
    EMBED_DIMENSIONS: parseInt(optional('EMBED_DIMENSIONS', '1024'), 10),

    // Azure OpenAI
    AZURE_OPENAI_API_VERSION: optional('AZURE_OPENAI_API_VERSION', '2024-02-01'),

    // Microsoft Graph (required only when Azure source is enabled)
    AZURE_TENANT_ID: azure_source ? required('AZURE_TENANT_ID') : optional('AZURE_TENANT_ID'),
    AZURE_CLIENT_ID: azure_source ? required('AZURE_CLIENT_ID') : optional('AZURE_CLIENT_ID'),
    AZURE_CLIENT_SECRET: azure_source ? required('AZURE_CLIENT_SECRET') : optional('AZURE_CLIENT_SECRET'),

    // Store
    STORE_TYPE: (process.env.STORE_TYPE || 'mongo') as 'mongo' | 'postgres',

    // MongoDB (conditionally required)
    MONGODB_URI: process.env.STORE_TYPE === 'postgres' ? (process.env.MONGODB_URI || '') : required('MONGODB_URI'),
    MONGODB_DB_NAME: process.env.STORE_TYPE === 'postgres' ? (process.env.MONGODB_DB_NAME || '') : required('MONGODB_DB_NAME'),

    // PostgreSQL (conditionally required)
    POSTGRES_URL: process.env.STORE_TYPE === 'postgres' ? required('POSTGRES_URL') : (process.env.POSTGRES_URL || ''),

    // Server
    PORT: parseInt(process.env.PORT || '3000', 10),
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
