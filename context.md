# Project Context & Design Philosophy

## Overview

**kb-app** is a Knowledge Base RAG (Retrieval-Augmented Generation) service built with **Bun + Elysia + TypeScript**. It ingests data from multiple sources (Microsoft Teams transcripts, distribution lists, PDFs), generates vector embeddings, stores them, and serves an LLM-powered chat interface that answers questions against the knowledge base.

### Stack

| Layer | Technology |
|---|---|
| Runtime | Bun (native TypeScript, no build step) |
| HTTP framework | Elysia |
| Databases | MongoDB Atlas (vector search) / PostgreSQL + pgvector |
| AI providers | Azure OpenAI, OpenAI, DeepSeek, Ollama, Custom (OpenAI-compatible) |
| External APIs | Microsoft Graph API (Teams transcripts, distribution lists) |
| Cron | `@elysiajs/cron` (backed by `croner`) |
| Observability | `@elysiajs/opentelemetry`, Pino logger |
| API docs | `@elysiajs/openapi` (serves Swagger UI at `/openapi`) |
| Shared libs | `@rniverse/utils`, `@rniverse/connectors` |

---

## The "Entity-First" Architecture

The core philosophy is **Entity-First Design**. Instead of organizing code by technical layers (`controllers/`, `services/`, `repositories/`), we organize by **domain entities and capabilities**, exposing a clean, verb-based API:

```typescript
documents.search(query)
store.connect()
ai.embed.embed(text)
extractors.pdf.extract(options)
parsers.transcripts.parse(raw)
ingestion.transcripts.run()
```

### Why Not Technical Layers?

Technical layers lead to:
- **Scattered logic**: A single feature ("transcripts") is spread across 5 directories.
- **God classes**: `IngestService` knowing about MongoDB _and_ PDF parsing _and_ vector search.
- **Inconsistent APIs**: `fileService.process()` vs `documentService.addDocuments()` vs `vectorStore.upsert()`.

Our approach solves this with **thin, composable wrappers** around primitives.

### The Core Pattern

Every pluggable layer follows this flow:

1. **Interface** — Defines the _what_ (`VectorStore`, `Embedder`, `Extractor<T>`, `Parser<T>`)
2. **Implementation** — Defines the _how_ per provider (`PGVectorStore`, `OllamaEmbedder`, `TranscriptExtractor`)
3. **Factory** — Env-driven singleton accessor (`get_store()`, `get_embedder()`, `get_chat_model()`)
4. **Facade** — High-level namespace export for consumers (`store`, `ai`, `extractors`, `parsers`)

Generic CRUD is written once (`create_entity_service<T>(collection)` in `base.service.ts`), then spread into entity services — never duplicate `insert`/`find_by_id`/`update` per entity.

---

## Key Architectural Decisions

### 1. Store Abstraction (DB-Agnostic)

We support both **MongoDB Atlas** and **PostgreSQL (pgvector)** without `if/else` checks:

- **Segregated interfaces** — the monolithic "Store" is split into:
  - `Store` — lifecycle: `connect`, `close`, `setup`, `get_vector_store`, `get_meta_store`
  - `VectorStore` — embedding CRUD: `insert`, `search`, `delete`
  - `MetaStore<T>` — generic document CRUD: `insert`, `find_by_id`, `find_one`, `update`, `delete`, `upsert`
- **Factory** in `src/store/index.ts` reads `STORE_TYPE` from env and instantiates `MongoStore` or `PGStore`.
- **Facade** delegates to the singleton: `export const store = { connect, close, setup, get_vector_store, get_meta_store }`.
- **Dynamic setup**: `store.setup(dimensions)` creates tables/indexes/vector indexes based on the backend.
- **Zero-knowledge vectors**: `VectorStore` doesn't know _how_ embeddings are generated — it just stores `number[]`.

### 2. Pluggable AI Models

LLM providers (embeddings & chat) are swappable commodities:

- **Two sub-layers**: `ai/chat/` and `ai/embed/`, each with interface + implementations + factory.
- **Supported providers** (via `ModelProvider` enum): `AZURE`, `OPENAI`, `DEEPSEEK`, `OLLAMA`, `CUSTOM`.
- **Lazy `require()`** inside factory switch cases — only the selected provider's SDK is loaded. Keeps startup fast and avoids importing SDKs that aren't installed.
- **Getter-based facade**: `export const ai = { get chat() { ... }, get embed() { ... } }` — lazy instantiation, throws `ChatNotConfiguredError` / `EmbedNotConfiguredError` only when the capability is accessed without a provider configured.
- **Why separate `dimensions`?** — Different models have different vector sizes (OpenAI=1536, Ollama=variable). The store queries the embedder for dimensions during schema setup.
- **SDK sharing**: OpenAI, DeepSeek, and Custom all use `OpenAICompatChatModel`/`OpenAICompatEmbedder` — same SDK, different config.

### 3. Extraction vs. Parsing vs. Mapping

We strictly separate **getting data**, **transforming data**, and **understanding data**:

| Layer | Directory | Responsibility | Output |
|---|---|---|---|
| **Extractors** | `src/extractors/` | Fetch raw data from external sources (API, filesystem, URL) | Rawest possible format (JSON, Buffer, VTT string) |
| **Mappers** | `src/mappers/` | Convert external data structures (`camelCase` APIs) into internal types (`snake_case`) | Typed internal objects |
| **Parsers** | `src/parsers/` | Chunk, enrich with metadata, produce domain documents | `KnowledgeDocument[]` |

**Why separate?**
- Extraction logic (auth, API calls) rarely changes. Rerunnable for debugging.
- Mapping keeps the `camelCase → snake_case` boundary in one place.
- Parsing logic changes frequently (chunk size, overlap) — independent of fetching.

### 4. Feature Gating

Optional features are controlled by env flags:

- **`AZURE_SOURCE=Y`** — enables Microsoft Graph integration (transcripts + distribution lists). When disabled, `DisabledExtractor<T>` stubs are injected that throw `AzureSourceDisabledError` on any call — no null checks scattered through the codebase.
- **`CHAT_MODEL_PROVIDER`** / **`EMBED_MODEL_PROVIDER`** — optional. When unset, the corresponding `ai.chat` / `ai.embed` getter throws only when accessed.
- Cron jobs conditionally mount based on feature flags (lazy `require()` in `cron/index.ts`).
- Health checks report `not_configured` for missing capabilities.

### 5. Data Pipeline

Ingestion follows a standard pipeline pattern:

```
Extract → Map → Parse → Embed → Store → Track
```

Each source has its own **ingestion orchestrator**: `services/ingestion/<source>.ingest.ts` with a `run()` function. Per-item error handling: catch + log + continue — one bad document doesn't abort the batch.

---

## Coding Conventions

### File Naming

Files use **dot-separated segments**, each segment is `snake_case`. **No hyphens ever.**

```
✅ transcript.parser.ts    chat_model.interface.ts    pg.vector_store.ts    chat.api.ts
❌ transcript-parser.ts    chat-model.interface.ts    pg.vector-store.ts    chat-api.ts
```

### Class / Type / Interface Naming

Acronyms and system names stay **uppercase** — PDF, PG are not words:

```
✅ PDFParser, PDFExtractor, PGStore, PGVectorStore
❌ PdfParser, PdfExtractor, PgStore, PgVectorStore
✅ MongoStore — "Mongo" is a proper name
```

No `I` prefix for interfaces: `Store`, not `IStore`.

### Identifiers

| Element | Convention | Examples |
|---|---|---|
| Functions | `snake_case` | `get_store()`, `health_check()`, `chunk_text()` |
| Variables | `snake_case` | `vector_store`, `min_score`, `file_id` |
| Classes | `PascalCase` | `PGStore`, `OllamaChatModel`, `TranscriptParser` |
| Interfaces | `PascalCase` (no `I`) | `Store`, `Embedder`, `ChatModel`, `Parser<T>` |
| Const objects | `PascalCase` + `UPPER_SNAKE` keys | `Collections.KNOWLEDGE_BASE`, `FileStatus.COMPLETED` |
| Env vars | `UPPER_SNAKE` | `STORE_TYPE`, `EMBED_MODEL_PROVIDER` |

### The `$` Qualifier

`$` namespaces qualified exports — things that are _instances of a pattern_:

| Usage | Examples |
|---|---|
| API route plugins | `api$chat`, `api$search`, `api$pdf`, `api$trigger` |
| Cron job plugins | `cron$transcript`, `cron$dl` |
| Composite plugins | `cron$jobs` |
| Mappers | `mapper$transcript`, `mapper$dl` |

Do **not** use `$` in services, utilities, or internal functions.

### Variable Naming

Prefer **short, generic names** over verbose Hungarian notation:

| Concept | Preferred | Avoid |
|---|---|---|
| Generics | `_doc`, `_record` | `transcriptDoc`, `fileRecord` |
| Results | `result`, `response` | `searchResult`, `apiResponse` |
| Inputs | `input`, `query` | `userInput`, `searchQueryString` |

**Disambiguation**: When two variables share the same shape in the same scope, use `$` to denote context:

```typescript
const store$vector = store.get_vector_store('kb');
const store$meta = store.get_meta_store<FileRecord>('files');
```

**Shadow/temporary**: Use `_prefix` or a domain noun — never compound camelCase:

```typescript
const _docs = parsers.transcripts.parse(raw);   // ✅
const storedDocs = ...;                           // ❌
```

### Casing Standards

- **Internal interfaces & methods**: Always `snake_case` — `find_by_id`, `min_score`, `created_at`.
- **Database keys**: Always `snake_case` — `meeting_subject`, `source_type`.
- **External APIs**: Keep original casing — Microsoft Graph `meetingId` stays camelCase in raw types.

### Import Paths

Path aliases via `tsconfig.json` — one `@<layer>` per `src/` sub-directory:

```typescript
// Namespace imports for entity bundles
import { store } from '@store';
import { ai } from '@ai';
import { extractors } from '@extractors';
import { parsers } from '@parsers';

// Direct imports for types and utilities
import type { FileRecord } from '@app-types/file.types';
import { logger } from '@utils/log.util';
import { env } from '@config/env';
```

Available aliases: `@config`, `@connection`, `@ai`, `@store`, `@services`, `@extractors`, `@parsers`, `@mappers`, `@app-types` (avoids `@types` npm collision), `@enums`, `@cron`, `@utils`, `@errors`.

### Enums

**Never** use TypeScript `enum`. Use `const` objects with `as const` + extracted type unions:

```typescript
export const ModelProvider = {
    AZURE: 'AZURE', OPENAI: 'OPENAI', DEEPSEEK: 'DEEPSEEK', OLLAMA: 'OLLAMA', CUSTOM: 'CUSTOM',
} as const;
export type ModelProviderValue = typeof ModelProvider[keyof typeof ModelProvider];
```

### Error Handling

Base `AppError` class with per-domain subclasses:

```typescript
export class AppError extends Error {
    readonly code: string;    // 'CHAT_NOT_CONFIGURED', 'ENV_MISSING', etc.
    readonly status: number;  // HTTP status for the global handler
    constructor(code: string, message: string, status: number = 500) { ... }
}
```

Domain errors extend it: `ChatNotConfiguredError`, `EmbedNotConfiguredError`, `ProviderUnsupportedError`, `AzureSourceDisabledError`, `StoreNotConnectedError`, `EnvMissingError`, `PDFOptionsRequiredError`, etc.

Global error handler: `instanceof AppError` → use `error.status`; everything else → 500.

---

## Config Layer

**`src/config/env.ts`** — eagerly evaluated singleton:

- Full typed `Env` interface covering every config key.
- `required(key)` throws `EnvMissingError` immediately — fail fast.
- `optional(key, default)` for non-critical values.
- **Generic per-capability naming**: `CHAT_MODEL_PROVIDER`, `CHAT_API_KEY`, `CHAT_MODEL_NAME`, `CHAT_BASE_URL` — not `OPENAI_API_KEY`, `OLLAMA_BASE_URL`.
- **Conditional requirements**: Azure creds required only when `AZURE_SOURCE=Y`, Mongo URI only when `STORE_TYPE=mongo`, Postgres URL only when `STORE_TYPE=postgres`.
- AI model vars are never required at startup — validated lazily when the model is first accessed.

---

## Cron Architecture

Cron jobs use **`@elysiajs/cron`** — each job is an Elysia plugin, not a custom scheduler.

```typescript
// Individual job — src/cron/transcript.cron.ts
export const cron$transcript = cron({
    name: JobName.INGEST_TRANSCRIPTS,
    pattern: '0 2 * * *',
    async run() { /* try/catch + log */ },
});

// Composite plugin — src/cron/index.ts
export const cron$jobs = new Elysia({ name: 'cron' });
if (env.AZURE_SOURCE) {
    const { cron$transcript } = require('@cron/transcript.cron');
    const { cron$dl } = require('@cron/dl.cron');
    cron$jobs.use(cron$transcript).use(cron$dl);
}

// Bootstrap — src/index.ts
app.use(cron$jobs).listen(env.PORT);
```

No separate "start" step — mounting the plugin is all that's needed.

---

## Bootstrap Sequence

`src/index.ts` follows a strict order:

1. **Connect** to store
2. **Setup** schema/indexes (conditional on `EMBED_MODEL_PROVIDER` being set)
3. **Create** Elysia app with:
   - OpenTelemetry plugin (`@elysiajs/opentelemetry`)
   - OpenAPI plugin (`@elysiajs/openapi`)
   - Global `.onError()` handler
   - Root route (`/`) — liveness
   - Health route (`/health`) — deep component checks (store, embed, chat)
   - API route plugins: `.use(api$search).use(api$chat).use(api$trigger).use(api$pdf)`
   - Cron plugin: `.use(cron$jobs)`
4. **Start** server with `.listen(port)`
5. **Register** graceful shutdown handlers (SIGTERM/SIGINT → close store → exit)

---

## Directory Structure

```
src/
├── index.ts                          # Bootstrap
├── config/
│   └── env.ts                        # Typed env singleton
├── errors/
│   ├── index.ts                      # Barrel
│   ├── app.error.ts                  # Base AppError class
│   ├── ai.error.ts                   # ChatNotConfigured, EmbedNotConfigured, ProviderUnsupported, AzureSourceDisabled
│   ├── config.error.ts               # EnvMissingError
│   ├── store.error.ts                # StoreNotConnectedError
│   ├── parse.error.ts                # ParserNotSupportedError
│   └── pdf.error.ts                  # PDFOptionsRequired, PDFSourceMissing, PDFDownload
├── enums/
│   ├── index.ts                      # Barrel
│   ├── model_provider.enum.ts        # AZURE | OPENAI | DEEPSEEK | OLLAMA | CUSTOM
│   ├── collections.enum.ts           # Collection/table names
│   ├── file_status.enum.ts           # PENDING | COMPLETED | ...
│   ├── jobs.enum.ts                  # Cron job names
│   └── source_type.enum.ts           # Source types
├── types/
│   ├── index.ts                      # Barrel (type-only re-exports)
│   └── <domain>.types.ts             # Pure interface/type defs
├── connection/
│   ├── mongo/
│   │   ├── mongo.connection.ts       # get_mongo(), get_db(), get_collection()
│   │   └── vector.connection.ts      # Atlas vector search specifics
│   └── pg/
│       ├── pg.connection.ts          # get_pg(), connect_pg(), close_pg()
│       └── postgres_queries.sql      # Reference SQL
├── store/
│   ├── index.ts                      # Factory (get_store) + Facade (export const store)
│   ├── store.interface.ts            # Store, VectorStore, MetaStore<T>
│   ├── mongo/                        # MongoStore, MongoVectorStore, MongoMetaStore
│   └── pg/                           # PGStore, PGVectorStore, PGMetaStore
├── ai/
│   ├── index.ts                      # Facade: { get chat(), get embed() }
│   ├── chat/
│   │   ├── index.ts                  # Factory (get_chat_model) with lazy require()
│   │   ├── chat_model.interface.ts   # ChatModel interface
│   │   ├── system_prompt.ts          # Shared prompt template
│   │   ├── azure.chat_model.ts
│   │   ├── openai_compat.chat_model.ts  # OpenAI + DeepSeek + Custom
│   │   └── ollama.chat_model.ts
│   └── embed/
│       ├── index.ts                  # Factory (get_embedder) with lazy require()
│       ├── embedder.interface.ts     # Embedder interface
│       ├── azure.embedder.ts
│       ├── openai_compat.embedder.ts
│       └── ollama.embedder.ts
├── extractors/
│   ├── index.ts                      # Facade + DisabledExtractor stub
│   ├── extractor.interface.ts        # Extractor<TRaw> interface
│   ├── pdf/
│   │   └── pdf.extractor.ts
│   └── microsoft/
│       ├── transcript.extractor.ts
│       └── dl.extractor.ts
├── mappers/
│   ├── index.ts                      # Barrel: mapper$transcript, mapper$dl
│   └── microsoft/
│       ├── transcript.mapper.ts
│       └── dl.mapper.ts
├── parsers/
│   ├── index.ts                      # Facade: parsers.transcripts, parsers.dls
│   ├── parser.interface.ts           # Parser<TRaw> interface
│   ├── text_chunker.ts              # Shared overlapping chunk splitter
│   ├── transcript.parser.ts
│   ├── dl.parser.ts
│   └── pdf.parser.ts
├── services/
│   ├── base.service.ts               # create_entity_service<T>(collection) — generic CRUD
│   ├── document.service.ts           # Composes Embedder + VectorStore
│   ├── chat.service.ts               # RAG: search → context → LLM → answer
│   ├── health.service.ts             # Deep health checks (store, embed, chat)
│   └── ingestion/
│       ├── index.ts                  # Facade: ingestion.transcripts, .dls, .pdf
│       ├── transcript.ingest.ts      # extract → parse → embed → store
│       ├── dl.ingest.ts
│       └── pdf.ingest.ts
├── api/
│   ├── chat.api.ts                   # api$chat — POST /api/chat
│   ├── search.api.ts                 # api$search — POST /api/search
│   ├── trigger.api.ts                # api$trigger — POST /api/trigger/*
│   └── pdf.api.ts                    # api$pdf — POST /api/pdf
├── cron/
│   ├── index.ts                      # Composite Elysia plugin (conditional mount)
│   ├── transcript.cron.ts            # cron$transcript
│   └── dl.cron.ts                    # cron$dl
├── utils/
│   └── log.util.ts                   # Pino logger singleton
└── assets/
    └── favicon.ico
```

---

## Shared Libraries

### `@rniverse/utils`

General-purpose utilities shared across all services. Install: `bun add github:rniverse/utils`.

Key exports: `log` (Pino), `date` (Day.js), `_` (Lodash), `uuid`/`ulid`, `jwt$`, `v` (Valibot), `sync$seq`/`async$seq` (sequential code generators), `cxt$req` (AsyncLocalStorage), `password`, `random`, `bullmq`, `commander`, `zlib`, `undici`.

```typescript
import { _, date, log, sync$seq, v } from '@rniverse/utils';
```

> **Note**: kb-app predates `@rniverse/utils` and uses a local Pino logger (`src/utils/log.util.ts`). New projects should use `log` from utils directly.

### `@rniverse/connectors`

Database and messaging connectors. Install: `bun add github:rniverse/connectors`.

| Connector | Backend | Key Methods |
|---|---|---|
| `MongoDBConnector` | MongoDB | `connect`, `ping`, `health`, `find`, `insertOne`, `aggregate`, `close` |
| `RedisConnector` | Redis (Bun native) | `connect`, `ping`, `health`, `getInstance`, `close` |
| `RedpandaConnector` | Kafka/Redpanda (kafkajs) | `connect`, `ping`, `publish`, `subscribe`, `createTopic`, `close` |
| `SQLConnector` | SQL via Drizzle ORM + Bun SQL | `connect`, `ping`, `health`, `getInstance`, `close` |

All connectors use `init_promise` pattern (safe for concurrent calls), `require_client()` guard, and consistent `{ ok, data }` / `{ ok: false, error }` result shape.

> **Note**: kb-app uses raw `MongoClient` and `pg.Pool` directly in `src/connection/` (domain-specific pgvector/Atlas vector search needs). Standard backends in future projects should use `@rniverse/connectors`.

---

## Extension Guide

### Adding a New Data Source (e.g., Slack)

1. **Types**: `src/types/slack.types.ts` (raw types)
2. **Extractor**: `src/extractors/slack/slack.extractor.ts` implementing `Extractor<T>`
3. **Mapper**: `src/mappers/slack/slack.mapper.ts` (raw → internal types)
4. **Parser**: `src/parsers/slack.parser.ts` implementing `Parser<T>` (chunk + metadata)
5. **Enum**: Add `SLACK` to `SourceType`
6. **Ingestion**: `src/services/ingestion/slack.ingest.ts` with `run()` wiring the pipeline
7. **Cron**: `src/cron/slack.cron.ts` exporting `cron$slack`
8. **Barrels**: Add to `extractors/index.ts`, `parsers/index.ts`, `mappers/index.ts`, `ingestion/index.ts`, `cron/index.ts`
9. **Usage**:
    ```typescript
    const raw = await extractors.slack.extract();
    const docs = parsers.slack.parse(raw);
    await documents.add(docs);
    ```

### Adding a New Store Backend (e.g., Pinecone)

1. Implement `Store`, `VectorStore`, `MetaStore<T>` in `src/store/pinecone/`
2. Add `case 'pinecone'` in `src/store/index.ts` factory

### Adding a New AI Provider

1. Implement `ChatModel` and/or `Embedder` in `src/ai/chat/` or `src/ai/embed/`
2. Add to `ModelProvider` enum
3. Add `case` in the factory switch — use lazy `require()` for SDK isolation
