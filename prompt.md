# Project Generation Prompt: Microsoft Knowledge Base RAG Service

## Overview

Build a **TypeScript + Bun** backend service that ingests Microsoft Teams meeting transcripts and email distribution lists (DLs) via Microsoft Graph API, stores them as vector embeddings in MongoDB Atlas Vector Search, and exposes a chat API for querying the knowledge base using RAG (Retrieval-Augmented Generation).

---

## Tech Stack

| Layer              | Technology                                                    |
| ------------------ | ------------------------------------------------------------- |
| Runtime            | Bun                                                           |
| Language           | TypeScript (strict mode)                                      |
| Server             | Elysia with `@elysiajs/swagger` for OpenAPI                   |
| Validation         | Elysia native TypeBox OR `@elysiajs/zod` (whichever is cleaner) |
| AI / LLM           | Azure OpenAI via `@langchain/openai` (AzureChatOpenAI, AzureOpenAIEmbeddings) |
| Vector Store       | MongoDB Atlas Vector Search via `@langchain/mongodb`          |
| Database           | MongoDB via `mongodb` native driver                           |
| Graph API          | `@microsoft/microsoft-graph-client` + `@azure/identity` (ClientSecretCredential) |
| Cron / Jobs        | `agenda` (uses MongoDB as job store)                          |
| Logging            | `pino` + `pino-pretty` (dev)                                 |
| LangChain          | `@langchain/core`, `@langchain/openai`, `@langchain/mongodb`, `@langchain/community` (as needed) |

---

## Environment Variables (`.env`)

```env
# MongoDB
MONGO_URI=mongodb+srv://...
MONGO_DB_NAME=knowledge_base

# Microsoft Graph API
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

# Azure OpenAI
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=https://yourname.openai.azure.com
AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Server
PORT=3000
LOG_LEVEL=info
```

The app must throw a clear error at startup if any required env var is missing. No env validation library needed — just direct `process.env` reads with runtime checks.

---

## Project Structure

```
knowledge-base/
├── src/
│   ├── config/
│   │   └── env.ts                          # Reads and exports typed env vars, throws if missing
│   │
│   ├── connection/
│   │   ├── mongo.connection.ts             # MongoClient singleton, connects on init, exposes db/collections
│   │   └── vector.connection.ts            # MongoDB Atlas Vector Search index setup/verification
│   │
│   ├── ai/
│   │   ├── embed.model.ts                  # AzureOpenAIEmbeddings instance (singleton)
│   │   └── chat.model.ts                   # AzureChatOpenAI instance (singleton)
│   │
│   ├── api/
│   │   ├── chat.api.ts                     # POST /api/chat — query the knowledge base
│   │   └── trigger.api.ts                  # POST /api/trigger/transcripts, POST /api/trigger/dls — manual job triggers
│   │
│   ├── services/
│   │   ├── microsoft/
│   │   │   ├── transcript.microsoft.ts     # Graph API: list meetings, fetch transcripts (VTT), supports delta sync
│   │   │   └── dl.microsoft.ts             # Graph API: list distribution lists, fetch members
│   │   ├── embed.service.ts                # Takes text/texts → returns embedding vectors (uses ai/embed.model)
│   │   ├── vector.service.ts               # addDocuments(), searchDocuments(), deleteDocuments() — uses embed.service + mongo vector
│   │   ├── chat.service.ts                 # Full RAG chain: query → vector search → build prompt → LLM → answer
│   │   └── ingest.service.ts               # Orchestrator: fetch (microsoft) → parse → vector.addDocuments. Used by cron + trigger API
│   │
│   ├── parsers/
│   │   ├── transcript.parser.ts            # VTT text → chunked documents with metadata (speaker, timestamp, meeting info)
│   │   └── dl.parser.ts                    # Graph DL response → structured documents with metadata (dl name, members, purpose)
│   │
│   ├── types/
│   │   └── index.ts                        # All shared interfaces and types
│   │
│   ├── enums/
│   │   └── index.ts                        # All enums as plain TS objects (collections, job names, source types, etc.)
│   │
│   ├── cron/
│   │   ├── transcript.cron.ts              # Agenda job definition: daily transcript ingestion via ingest.service
│   │   └── dl.cron.ts                      # Agenda job definition: daily DL sync via ingest.service
│   │
│   ├── utils/
│   │   ├── log.util.ts                     # Pino logger singleton
│   │   └── (others as needed)              # Only add utils that are actually used (date helpers, id gen, etc.)
│   │
│   └── index.ts                            # Entry point: init connections → start Elysia server → start Agenda cron
│
├── scripts/
│   ├── create-index.ts                     # Creates MongoDB Atlas Vector Search index on the knowledge_base collection
│   ├── test-embed.ts                       # Takes sample text, embeds it, stores in vector store, prints confirmation
│   ├── query-embed.ts                      # Takes a query string, searches vector store, prints matching docs + scores
│   └── test-synthesizer.ts                 # Full RAG test: takes a question, retrieves context, generates answer via LLM
│
├── .env
├── .env.example                            # All env vars with placeholder values
├── package.json
├── tsconfig.json
├── bunfig.toml                             # Bun config if needed
└── README.md
```

---

## Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@config/*": ["src/config/*"],
      "@connection/*": ["src/connection/*"],
      "@ai/*": ["src/ai/*"],
      "@api/*": ["src/api/*"],
      "@services/*": ["src/services/*"],
      "@parsers/*": ["src/parsers/*"],
      "@types/*": ["src/types/*"],
      "@enums/*": ["src/enums/*"],
      "@cron/*": ["src/cron/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

All imports throughout the project must use these aliases. No relative imports like `../../`.

---

## package.json Scripts

```json
{
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun --watch run src/index.ts",
    "create-index": "bun run scripts/create-index.ts",
    "test-embed": "bun run scripts/test-embed.ts",
    "query-embed": "bun run scripts/query-embed.ts",
    "test-synthesizer": "bun run scripts/test-synthesizer.ts"
  }
}
```

---

## Enums (`src/enums/index.ts`)

Define as plain TypeScript `as const` objects (not TS enums). Include at minimum:

```ts
/** MongoDB collection names */
export const Collections = {
  KNOWLEDGE_BASE: 'knowledge_base',
  JOBS: 'agendaJobs',           // Agenda's default collection
} as const;

/** Source types for documents in the knowledge base */
export const SourceType = {
  TRANSCRIPT: 'transcript',
  DISTRIBUTION_LIST: 'distribution_list',
} as const;

/** Agenda job names */
export const JobName = {
  INGEST_TRANSCRIPTS: 'ingest-transcripts',
  INGEST_DLS: 'ingest-dls',
} as const;

/** Vector search index name */
export const VectorIndex = {
  KNOWLEDGE_BASE: 'knowledge_base_vector_index',
} as const;
```

Add more enums as needed during implementation. Reference env vars inside enums if applicable (e.g., collection names from env).

---

## Detailed File Specifications

### `src/config/env.ts`
- Read all env vars from `process.env`
- Export a typed `env` object
- Throw descriptive errors immediately if any required var is missing
- No validation library — just manual checks

### `src/connection/mongo.connection.ts`
- MongoClient singleton using `env.MONGO_URI`
- Export `getDb()` → returns the database instance
- Export `getCollection(name)` → returns a typed collection
- Connect on first call, reuse after
- Log connection status with pino

### `src/connection/vector.connection.ts`
- Uses the mongo connection to verify/create the Atlas Vector Search index
- Index config: vector field name, dimensions (1536 for text-embedding-3-small), similarity metric (cosine)
- Also indexes metadata fields for filtering: `source_type`, `meeting_date`, `meeting_subject`, `dl_name`
- Exports a function `ensureVectorIndex()` called at startup

### `src/ai/embed.model.ts`
- Exports a singleton `AzureOpenAIEmbeddings` instance from `@langchain/openai`
- Configured with env vars for Azure OpenAI

### `src/ai/chat.model.ts`
- Exports a singleton `AzureChatOpenAI` instance from `@langchain/openai`
- Configured with env vars for Azure OpenAI
- Set reasonable defaults: temperature 0.3, max tokens as needed

### `src/services/microsoft/transcript.microsoft.ts`
- Authenticate using `ClientSecretCredential` from `@azure/identity` + `TokenCredentialAuthenticationProvider`
- `fetchRecentTranscripts(since?: Date)` — uses `getAllTranscripts` endpoint with delta/filter to get transcripts since last run
- `fetchTranscriptContent(userId: string, meetingId: string, transcriptId: string)` — fetches VTT content for a specific transcript
- `fetchMeetingDetails(userId: string, meetingId: string)` — fetches meeting metadata (subject, attendees, start time)
- Handle pagination for large result sets
- All methods return typed results (see types)

### `src/services/microsoft/dl.microsoft.ts`
- Reuse the same Graph client auth from transcript service (extract shared Graph client setup to avoid redundancy — if needed, create a shared `microsoft.client.ts` or put the auth init in a shared spot)
- `fetchDistributionLists()` — lists all groups where `mailEnabled=true` and `securityEnabled=false`
- `fetchDLMembers(groupId: string)` — fetches transitive members of a DL
- `fetchDLDetails(groupId: string)` — fetches DL metadata (name, email, description)
- Handle pagination

**IMPORTANT**: If both microsoft services share a Graph client setup, extract that into a shared file like `src/services/microsoft/graph.client.ts`. No duplicated auth code.

### `src/services/embed.service.ts`
- `embedText(text: string): Promise<number[]>` — embed a single text
- `embedTexts(texts: string[]): Promise<number[][]>` — embed multiple texts (batch)
- Uses `ai/embed.model.ts` under the hood
- Thin wrapper — exists so the rest of the app doesn't import LangChain directly

### `src/services/vector.service.ts`
- `addDocuments(docs: KnowledgeDocument[])` — embed + store documents with metadata into MongoDB Atlas vector collection
- `searchDocuments(query: string, options?: SearchOptions)` — embed query → similarity search with optional metadata filters (source_type, date range, meeting_subject, dl_name)
- `deleteDocuments(filter: DocumentFilter)` — remove documents by metadata filter (e.g., re-ingest a meeting)
- Uses `embed.service.ts` for all embedding operations
- Uses `@langchain/mongodb` MongoDBAtlasVectorSearch or the native mongo driver directly — whichever is cleaner
- SearchOptions should support: `limit`, `minScore`, `filter` (metadata filters)

### `src/services/chat.service.ts`
- `chat(query: string, filters?: SearchFilters): Promise<ChatResponse>`
- Flow: query → `vector.service.searchDocuments()` → build prompt with retrieved context → `ai/chat.model` → return answer + sources
- The prompt template should:
  - Include the retrieved document chunks as context
  - Instruct the LLM to answer based only on provided context
  - Include source attribution (which meeting/DL the info came from)
  - Handle "I don't know" when context is insufficient
- Return both the answer text and the source documents used

### `src/services/ingest.service.ts`
- `ingestTranscripts(options?: { since?: Date })` — orchestrates: fetch transcripts via microsoft service → parse via transcript.parser → store via vector.service
- `ingestDistributionLists()` — orchestrates: fetch DLs via microsoft service → parse via dl.parser → store via vector.service (deletes old DL docs first to avoid stale data)
- Both methods log progress and return summary stats (docs processed, errors, etc.)
- Used by both cron jobs and trigger API — single source of truth for ingestion logic

### `src/parsers/transcript.parser.ts`
- `parseTranscript(vttContent: string, metadata: TranscriptMetadata): KnowledgeDocument[]`
- Parse VTT format: extract speaker name, timestamp, text per utterance
- Chunking strategy: group by speaker turns or ~3-5 minute windows. Keep speaker attribution. Don't split mid-sentence.
- Each chunk becomes a `KnowledgeDocument` with:
  - `content`: the text content
  - `metadata`: `{ source_type: 'transcript', meeting_subject, meeting_date, meeting_id, speakers: string[], timestamp_start, timestamp_end, attendees: string[] }`

### `src/parsers/dl.parser.ts`
- `parseDistributionList(dl: RawDLData): KnowledgeDocument`
- Each DL becomes ONE document (they're small)
- Content format: `"Distribution List: {name} ({email}). Description: {description}. Members: {member1} ({role}), {member2} ({role}), ..."`
- Metadata: `{ source_type: 'distribution_list', dl_name, dl_email, member_count, dl_id }`

### `src/types/index.ts`
Define at minimum:
- `KnowledgeDocument` — { content: string, metadata: DocumentMetadata }
- `DocumentMetadata` — union/intersection of transcript and DL metadata fields
- `TranscriptMetadata` — meeting-specific fields
- `DLMetadata` — DL-specific fields
- `SearchOptions` — { limit?, minScore?, filter?: SearchFilters }
- `SearchFilters` — { source_type?, meeting_subject?, dl_name?, date_from?, date_to? }
- `ChatResponse` — { answer: string, sources: SourceReference[] }
- `SourceReference` — { source_type, title, date?, relevance_score }
- `IngestResult` — { processed: number, errors: number, details?: string[] }
- Raw types for Graph API responses as needed

### `src/api/chat.api.ts`
- Elysia group/plugin mounted at `/api/chat`
- `POST /api/chat` — body: `{ query: string, filters?: SearchFilters }` → response: `ChatResponse`
- Schema validation on request body
- OpenAPI docs with descriptions

### `src/api/trigger.api.ts`
- Elysia group/plugin mounted at `/api/trigger`
- `POST /api/trigger/transcripts` — optional body: `{ since?: string (ISO date) }` → triggers transcript ingestion → response: `IngestResult`
- `POST /api/trigger/dls` — no body needed → triggers DL ingestion → response: `IngestResult`
- Schema validation on request bodies
- OpenAPI docs with descriptions

### `src/cron/transcript.cron.ts`
- Defines and registers Agenda job `ingest-transcripts`
- Runs daily (configurable)
- Calls `ingest.service.ingestTranscripts()` with since = 24 hours ago (or last successful run)
- Logs results

### `src/cron/dl.cron.ts`
- Defines and registers Agenda job `ingest-dls`
- Runs daily (configurable)
- Calls `ingest.service.ingestDistributionLists()`
- Logs results

### `src/utils/log.util.ts`
- Exports a configured pino logger instance
- Log level from `env.LOG_LEVEL`
- Use `pino-pretty` in development
- All files import logger from here — no `console.log` anywhere

### `src/index.ts`
- Initialize mongo connection
- Ensure vector search index exists
- Create Elysia app with:
  - Swagger plugin at `/swagger`
  - Chat API routes
  - Trigger API routes
  - Global error handler (simple, logs + returns 500)
- Initialize Agenda, define cron jobs, start Agenda
- Start Elysia server on configured port
- Graceful shutdown on SIGTERM/SIGINT (close mongo, stop agenda)

---

## Scripts (`scripts/` folder)

### `scripts/create-index.ts`
- Connects to MongoDB
- Calls `ensureVectorIndex()` from `vector.connection.ts`
- Logs success/failure
- Exits

### `scripts/test-embed.ts`
- Connects to MongoDB
- Creates 2-3 sample `KnowledgeDocument` objects (one transcript chunk, one DL doc) with realistic metadata
- Calls `vector.service.addDocuments()` to embed and store them
- Logs the stored document IDs and confirmation
- Exits

### `scripts/test-embed.ts` can accept optional CLI arg for custom text:
```bash
bun run test-embed                           # uses sample data
bun run test-embed "Custom text to embed"    # uses provided text
```

### `scripts/query-embed.ts`
- Connects to MongoDB
- Takes a query string from CLI args: `bun run query-embed "What was discussed about the migration?"`
- Calls `vector.service.searchDocuments()` with the query
- Prints: matching documents with content preview, metadata, and relevance scores
- Exits

### `scripts/test-synthesizer.ts`
- Connects to MongoDB
- Takes a question from CLI args: `bun run test-synthesizer "What topics were discussed in the Jan standup?"`
- Calls `chat.service.chat()` with the question
- Prints: the generated answer + source references
- Exits

---

## Critical Rules

1. **ZERO redundancy.** If two files need the same logic, extract it. Especially:
   - Graph API client/auth → shared in one place
   - MongoDB collection access → through `mongo.connection.ts` getCollection()
   - AI model instances → singletons in `ai/` folder
   - Ingestion orchestration → only in `ingest.service.ts`, called by both cron and API

2. **Every exported function and class must have JSDoc comments.** Describe what it does, its parameters, and what it returns.

3. **All imports use path aliases** (`@config/env`, `@services/vector.service`, `@utils/log.util`, etc.). No relative imports.

4. **Logger only.** Use the pino logger from `@utils/log.util` everywhere. No `console.log` or `console.error`.

5. **Error handling:** Functions should throw typed errors with descriptive messages. The Elysia global error handler catches unhandled errors, logs them, and returns a clean 500 response. Services should catch and re-throw with context where useful.

6. **Env vars:** Expect them to exist. Throw immediately at startup if missing. No defaults for required vars.

7. **Singletons:** MongoClient, Pino logger, AI model instances, and Graph client are all singletons. Initialize once, reuse everywhere.

8. **Agenda uses the same MongoDB connection** — don't create a separate connection for Agenda.

---

## Notes for Implementation

- The VTT format from Microsoft looks like:
  ```
  WEBVTT

  00:00:00.000 --> 00:00:05.000
  <v Speaker Name>Hello everyone, let's get started with the standup.</v>

  00:00:05.000 --> 00:00:12.000
  <v Another Speaker>Sure, I'll go first. Yesterday I worked on the API.</v>
  ```
  Parse accordingly.

- For distribution lists via Graph API, filter groups where `mailEnabled eq true` and `securityEnabled eq false`. Use `/groups/{id}/transitiveMembers` for nested member resolution.

- MongoDB Atlas Vector Search index definition should look approximately like:
  ```json
  {
    "type": "vectorSearch",
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      },
      {
        "type": "filter",
        "path": "metadata.source_type"
      },
      {
        "type": "filter",
        "path": "metadata.meeting_date"
      },
      {
        "type": "filter",
        "path": "metadata.meeting_subject"
      },
      {
        "type": "filter",
        "path": "metadata.dl_name"
      }
    ]
  }
  ```

- For the chat prompt template, use something like:
  ```
  You are a helpful assistant that answers questions based on meeting transcripts and distribution list information from our organization.

  Use ONLY the following context to answer the question. If the context doesn't contain enough information to answer, say "I don't have enough information to answer that question."

  Always cite which meeting or distribution list your answer comes from.

  Context:
  {context}

  Question: {question}
  ```

- Delta sync for transcripts: store the last sync timestamp somewhere (a simple MongoDB document in a `sync_state` collection) so the daily cron only fetches new transcripts since the last successful run.
