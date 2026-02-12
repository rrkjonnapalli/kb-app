/**
 * Environment configuration.
 * Reads all required env vars from process.env and throws immediately
 * if any are missing. Exports a fully-typed `env` object.
 */

/** Typed environment variables */
export interface Env {
    // Microsoft Graph
    AZURE_TENANT_ID: string;
    AZURE_CLIENT_ID: string;
    AZURE_CLIENT_SECRET: string;

    // Azure OpenAI
    AZURE_OPENAI_API_KEY: string;
    AZURE_OPENAI_ENDPOINT: string;
    AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT: string;
    AZURE_OPENAI_CHAT_DEPLOYMENT: string;
    AZURE_OPENAI_API_VERSION: string;

    // Store selection
    STORE_TYPE: 'mongo' | 'postgres';

    // MongoDB (required when STORE_TYPE=mongo)
    MONGODB_URI: string;
    MONGODB_DB_NAME: string;

    // PostgreSQL (required when STORE_TYPE=postgres)
    POSTGRES_URL: string;

    // Server
    PORT: number;
    LOG_LEVEL: string;
}

/**
 * Read a required env var or throw a descriptive error.
 * @param key - The environment variable name
 * @returns The value of the environment variable
 * @throws Error if the variable is not set
 */
function required(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

/** Validated and typed environment configuration */
export const env: Env = {
    // Microsoft Graph
    AZURE_TENANT_ID: required('AZURE_TENANT_ID'),
    AZURE_CLIENT_ID: required('AZURE_CLIENT_ID'),
    AZURE_CLIENT_SECRET: required('AZURE_CLIENT_SECRET'),

    // Azure OpenAI
    AZURE_OPENAI_API_KEY: required('AZURE_OPENAI_API_KEY'),
    AZURE_OPENAI_ENDPOINT: required('AZURE_OPENAI_ENDPOINT'),
    AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT: required('AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT'),
    AZURE_OPENAI_CHAT_DEPLOYMENT: required('AZURE_OPENAI_CHAT_DEPLOYMENT'),
    AZURE_OPENAI_API_VERSION: required('AZURE_OPENAI_API_VERSION'),

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
