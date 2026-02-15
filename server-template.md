# Server Template — Entity-First Architecture

A conventions-driven architectural template for TypeScript backend services.
Framework-agnostic patterns with a Bun + Elysia reference section at the end.

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Foundation Libraries](#2-foundation-libraries)
3. [Directory Structure](#3-directory-structure)
4. [Naming Conventions](#4-naming-conventions)
5. [Config Layer](#5-config-layer)
6. [Error Layer](#6-error-layer)
7. [Enums](#7-enums)
8. [Types](#8-types)
9. [Interfaces](#9-interfaces)
10. [Connection Layer](#10-connection-layer)
11. [Store Layer](#11-store-layer)
12. [AI Layer](#12-ai-layer)
13. [Extractors](#13-extractors)
14. [Mappers](#14-mappers)
15. [Parsers](#15-parsers)
16. [Services](#16-services)
17. [API Layer](#17-api-layer)
18. [Cron / Scheduled Jobs](#18-cron--scheduled-jobs)
19. [Utils](#19-utils)
20. [Barrel Exports](#20-barrel-exports)
21. [Pluggability & Feature Gating](#21-pluggability--feature-gating)
22. [Data Pipeline](#22-data-pipeline)
23. [Application Bootstrap](#23-application-bootstrap)
24. [Bun + Elysia Reference](#24-bun--elysia-reference)

---

## 1. Philosophy

### Entity-First

Everything is an **entity** (noun) that performs **verbs** (methods/functions).
Structure the codebase around _what things are_, not _what framework needs_.

```
entity.verb()
documents.search(query)
store.connect()
ai.embed.embed(text)
extractors.pdf.extract(options)
parsers.transcripts.parse(raw)
```

### Core Principles

- **Interface → Implementation → Factory → Facade** — every pluggable layer follows this flow.
- **Segregation** — each concern lives in its own directory: config, errors, enums, types, connections, store, ai, extractors, mappers, parsers, services, api, cron, utils.
- **No god files** — files should do one thing. If a file grows beyond ~150 lines, it likely needs splitting.
- **Flat where possible, nested where meaningful** — avoid deep nesting. Sub-directories only when there's a logical group (provider, backend, source type).
- **Explicit over implicit** — no magic. Dependencies are imported, singletons are initialized via factory functions with clear guards.
- **Composition over inheritance** — prefer object spread, facade delegation, and factory functions over deep class hierarchies.

---

## 2. Foundation Libraries

Two shared packages provide common utilities and connectors across all services. Use these instead of re-implementing per project.

### `@rniverse/utils`

General-purpose utilities. Install from GitHub: `bun add github:rniverse/utils`.

| Export | Purpose |
|---|---|
| `_` | Lodash extended (full lodash re-export) |
| `date` | Day.js with ~30 plugins pre-loaded |
| `uuid`, `ulid` | ID generation |
| `jwt$` | JWT sign/verify/decode (via jose) |
| `log` | Pino logger singleton |
| `cxt$req` | `AsyncLocalStorage`-based request context |
| `password` | Hash + verify (bcrypt-compatible) |
| `random` | Cryptographic random string generators |
| `sync$seq`, `async$seq` | Sequential code / counter generators (see [Utils](#19-utils)) |
| `bullmq` | BullMQ re-export for job queues |
| `commander` | CLI argument parser re-export |
| `v` (valibot) | Schema validation re-export |
| `zlib` | Compression utilities |
| `undici` | HTTP client re-export |
| `String.prototype.fmt` | Template-literal-style string formatting patch |

**Import pattern:**

```ts
import { _, date, log, sync$seq, v } from '@rniverse/utils';
```

### `@rniverse/connectors`

Database and messaging connectors. Install from GitHub: `bun add github:rniverse/connectors`.

Peer-depends on `@rniverse/utils`, `mongodb`, `kafkajs`, `drizzle-orm`, `typescript`.

| Connector | Backend | Key Methods |
|---|---|---|
| `MongoDBConnector` | MongoDB (full CRUD, aggregation, indexing) | `connect`, `ping`, `health`, `find`, `insertOne`, `updateOne`, `aggregate`, `close` |
| `RedisConnector` | Redis (Bun native `RedisClient`) | `connect`, `ping`, `health`, `getInstance`, `close` |
| `RedpandaConnector` | Kafka / Redpanda (kafkajs) | `connect`, `ping`, `publish`, `subscribe`, `unsubscribe`, `createTopic`, `close` |
| `SQLConnector` | SQL via Drizzle ORM + Bun SQL | `connect`, `ping`, `health`, `getInstance`, `close` |

Each connector also exports a low-level `init*()` tool function (`initMongoDB`, `initRedis`, `initRedpanda`, `initORM`) — but prefer using the Connector class for lifecycle management.

**Usage pattern — Connector class (recommended):**

```ts
import { MongoDBConnector } from '@rniverse/connectors';

const mongo = new MongoDBConnector({ url: env.MONGO_URL, database: 'mydb' });
await mongo.connect();           // verifies reachability
const db = mongo.getInstance();  // returns Db
await mongo.close();             // clean shutdown
```

```ts
import { SQLConnector } from '@rniverse/connectors';

const sql = new SQLConnector({ url: env.POSTGRES_URL });
await sql.connect();             // verifies with SELECT 1
const orm = sql.getInstance();   // returns Drizzle ORM instance
```

**Lifecycle guarantees (all connectors):**

- `connect()` uses an `init_promise` pattern — safe for concurrent calls, returns the same promise.
- On failure, `init_promise` resets to `null` — subsequent `connect()` calls retry.
- `require_client()` guard throws if `connect()` hasn't completed — no silent null access.
- Result shape: `{ ok: true, data }` | `{ ok: false, error }` on all query methods.
- `close()` cleans up all resources and resets internal state.

**Redpanda-specific guards:**

- `subscribe()` throws if consumer is already running — call `unsubscribe()` first.
- `getConsumer(groupId)` throws if called with a different groupId than the active consumer.

**Drizzle Kit (ships with connectors):**

The package includes `drizzle-kit` as a dev dependency with convenience scripts:

```bash
bun run db:generate    # Generate migrations from schema
bun run db:migrate     # Apply pending migrations
bun run db:push        # Push schema directly (dev)
bun run db:introspect  # Pull schema from existing DB
bun run db:studio      # Open Drizzle Studio GUI
```

Sample config and schema files are in `lib/migrations/`.

### When to Use vs. When to Build Locally

| Situation | Approach |
|---|---|
| Logger, dates, IDs, validation, sequential codes | Use `@rniverse/utils` |
| MongoDB, Redis, Kafka, SQL connections | Use `@rniverse/connectors` |
| Vector store (pgvector, Atlas Search) | Build in `src/store/` — domain-specific |
| AI providers (embeddings, chat) | Build in `src/ai/` — domain-specific |
| External API clients (Microsoft Graph, etc.) | Build in `src/connection/` — domain-specific |
| Project-specific helpers | Build in `src/utils/` |

### Path Aliases for Shared Libs

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@rniverse/utils": ["./node_modules/@rniverse/utils"],
      "@rniverse/connectors": ["./node_modules/@rniverse/connectors"]
    }
  }
}
```

---

## 3. Directory Structure

```
src/
├── index.ts                          # Application bootstrap
├── config/
│   └── env.ts                        # Typed env config singleton
├── errors/
│   ├── index.ts                      # Barrel
│   ├── app.error.ts                  # Base error class
│   ├── <domain>.error.ts             # Domain-specific errors
│   └── ...
├── enums/
│   ├── index.ts                      # Barrel
│   └── <name>.enum.ts                # Const object + type union
├── types/
│   ├── index.ts                      # Barrel (type-only re-exports)
│   └── <domain>.types.ts             # Pure interface/type definitions
├── connection/
│   ├── <backend>/
│   │   └── <backend>.connection.ts   # Client/pool singleton + factory
│   └── <provider>/
│       └── <provider>.client.ts      # External API client singleton
├── store/
│   ├── index.ts                      # Factory + facade
│   ├── store.interface.ts            # Store, VectorStore, MetaStore<T>
│   ├── <backend>/
│   │   ├── <backend>.store.ts        # Store implementation
│   │   ├── <backend>.vector_store.ts # VectorStore implementation
│   │   └── <backend>.meta_store.ts   # MetaStore<T> implementation
│   └── ...
├── ai/
│   ├── index.ts                      # Facade: { chat, embed }
│   ├── chat/
│   │   ├── index.ts                  # Factory + singleton
│   │   ├── chat_model.interface.ts   # ChatModel interface
│   │   ├── system_prompt.ts          # Shared prompt template
│   │   ├── <provider>.chat_model.ts  # Per-provider implementation
│   │   └── ...
│   └── embed/
│       ├── index.ts                  # Factory + singleton
│       ├── embedder.interface.ts     # Embedder interface
│       ├── <provider>.embedder.ts    # Per-provider implementation
│       └── ...
├── extractors/
│   ├── index.ts                      # Facade + conditional loading
│   ├── extractor.interface.ts        # Extractor<TRaw> interface
│   ├── <source>/
│   │   └── <source>.extractor.ts     # Source extractor class
│   └── <provider>/
│       ├── <name>.extractor.ts
│       └── ...
├── mappers/
│   ├── index.ts                      # Barrel
│   └── <provider>/
│       └── <name>.mapper.ts          # Raw → internal type transforms
├── parsers/
│   ├── index.ts                      # Facade
│   ├── parser.interface.ts           # Parser<TRaw> interface
│   ├── text_chunker.ts              # Shared chunking utility
│   ├── <source>.parser.ts            # Source parser
│   └── <provider>/
│       └── <name>.parser.ts
├── services/
│   ├── base.service.ts               # Generic CRUD factory
│   ├── <entity>.service.ts           # Entity services (files, sync_state)
│   ├── <domain>.service.ts           # Domain services (chat, health)
│   └── ingestion/
│       ├── index.ts                  # Facade
│       └── <source>.ingest.ts        # Source ingestion pipeline
├── api/
│   ├── <domain>.api.ts               # Route plugin per domain
│   └── ...
├── cron/
│   ├── index.ts                      # Composite Elysia plugin (conditional mount)
│   └── <name>.cron.ts                # cron$<name> Elysia cron plugins
├── utils/
│   └── <purpose>.util.ts             # Logger, helpers
└── assets/                           # Static files
```

### Grouping Rules

- **By backend** when multiple backends exist for the same interface: `store/pg/`, `store/mongo/`, `connection/pg/`, `connection/mongo/`
- **By provider** when multiple external providers exist: `ai/chat/ollama.chat_model.ts`, `ai/chat/azure.chat_model.ts`
- **By source** when multiple data sources exist: `extractors/pdf/`, `extractors/microsoft/`, `parsers/microsoft/`
- **Generic at root, specific in sub-dir**: `parsers/text_chunker.ts` (shared), `parsers/microsoft/transcript.parser.ts` (specific)

---

## 4. Naming Conventions

### Files

All files use **snake_case** with a **dot separator** for the category suffix.

| Pattern | Examples |
|---|---|
| `<name>.<category>.ts` | `pg.vector_store.ts`, `ollama.chat_model.ts`, `chat.api.ts` |
| `<name>.<layer>.ts` | `app.error.ts`, `parse.error.ts`, `log.util.ts` |
| `<name>.types.ts` | `document.types.ts`, `search.types.ts` |
| `<name>.enum.ts` | `collections.enum.ts`, `file_status.enum.ts` |
| `<name>.interface.ts` | `store.interface.ts`, `embedder.interface.ts` |

### Code Identifiers

| Element | Convention | Examples |
|---|---|---|
| Functions | `snake_case` | `get_store()`, `health_check()`, `chunk_text()` |
| Variables | `snake_case` | `vector_store`, `min_score`, `file_id` |
| Classes | `PascalCase` | `PGStore`, `OllamaChatModel`, `TranscriptParser` |
| Interfaces | `PascalCase` (no `I` prefix) | `Store`, `Embedder`, `ChatModel`, `Parser<T>` |
| Type aliases | `PascalCase` | `DocumentMetadata`, `FileStatusValue` |
| Const objects (enum-like) | `PascalCase` object, `UPPER_SNAKE` keys | `Collections.KNOWLEDGE_BASE`, `FileStatus.COMPLETED` |
| Env vars | `UPPER_SNAKE` | `STORE_TYPE`, `EMBED_MODEL_PROVIDER` |

### The `$` Qualifier

Use `$` to namespace qualified exports — things that are _instances of a pattern_ rather than standalone identifiers.

| Usage | Examples |
|---|---|
| API route plugins | `api$chat`, `api$search`, `api$pdf` |
| Mappers | `mapper$transcript`, `mapper$dl` |

Do **not** use `$` in services, utilities, or internal functions.

### The `_` Prefix

Use `_` for intentionally unused variables (e.g., loop items you log but don't return).

```
const _docs = await documents.add(parsed);
```

---

## 5. Config Layer

### Location: `src/config/env.ts`

### Rules

- Define a full **typed interface** (`Env`) covering every config key.
- Export a **singleton** `env` object, eagerly evaluated at import time.
- Use `required(key)` / `optional(key, default)` helper functions for extraction.
- `required()` throws a custom `EnvMissingError` immediately — fail fast.
- Group conditional requirements: Azure creds required only when `AZURE_SOURCE=Y`, Mongo URI only when `STORE_TYPE=mongo`.
- Use **generic per-capability** naming, not per-provider: `CHAT_MODEL_PROVIDER`, `CHAT_API_KEY`, `CHAT_MODEL_NAME`, `CHAT_BASE_URL` — not `OPENAI_API_KEY`, `OLLAMA_BASE_URL`.
- Feature flags use simple env vars: `AZURE_SOURCE=Y` → enabled.

### Pattern

```
Env interface → required()/optional() helpers → export const env: Env
```

---

## 6. Error Layer

### Location: `src/errors/` + `src/enums/errors.enum.ts`

The error system has two parts: a **declarative error registry** (enum) and a **single error class** that consumes it.

### Part 1: Declarative Error Registry

All errors are defined in one place as tuple pairs `[KEY, message]`:

**File: `src/enums/errors.enum.ts`**

```ts
import { sync$seq } from '@rniverse/utils';

// Single source of truth — all application errors as [KEY, message] tuples
export const enum$errors_list = [
    ['ORG_NOT_FOUND', 'Organization not found'],
    ['ORG_ALREADY_EXISTS', 'Organization already exists'],
    ['USER_EMAIL_REQUIRED', 'User email is required'],
    ['USER_NOT_FOUND', 'User not found'],
    ['VALIDATION_INVALID_EMAIL', 'Invalid email address'],
] as const;

// Type-safe key union
export type ErrorKey = typeof enum$errors_list[number][0];

// KEY → message lookup
export const enum$errors = Object.fromEntries(enum$errors_list) as Record<ErrorKey, string>;

// Auto-generated sequential error codes (base-36 padded)
const get_next_code = sync$seq.get({ type: 'code', length: 10 });
export const enum$error_codes = Object.fromEntries(
    enum$errors_list.map(([key]) => [key, get_next_code()])
) as Record<ErrorKey, string>;

// KEY → KEY identity map (for safe key references without string literals)
export const enum$error_key: Record<ErrorKey, ErrorKey> = Object.keys(enum$errors).reduce(
    (acc, key) => { acc[key as ErrorKey] = key as ErrorKey; return acc; },
    {} as Record<ErrorKey, ErrorKey>
);
```

### Part 2: Single Error Class

A single `GuardError` class consumes the registry — no subclass-per-error needed.

**File: `src/errors/error.util.ts`**

```ts
import { enum$error_codes, enum$errors, type ErrorKey } from '@enums/errors.enum';

export class GuardError extends Error {
    code: string = '000000';
    statusCode: number = 400;
    details?: Record<string, any>;

    constructor(key: ErrorKey, details?: Record<string, any>) {
        super(enum$errors[key]);
        this.code = enum$error_codes[key];
        this.statusCode = details?.statusCode ?? 400;
        this.details = details;
    }
}
```

### Rules

- **All errors declared in one file** — `enum$errors_list` is the single source of truth.
- Keys are `UPPER_SNAKE` strings: `USER_NOT_FOUND`, `VALIDATION_INVALID_EMAIL`.
- Messages are human-readable: `'User not found'`.
- **Error codes are auto-generated** at startup using a sequential code generator (`sync$seq`) — no manual code assignment.
- **One error class** (`GuardError`) handles all cases — pass the `ErrorKey` and optional `details` (including `statusCode` override).
- The global error handler checks `instanceof GuardError` for `statusCode`; everything else maps to `500` with a generic message (no internal leak).
- Use `enum$error_key.USER_NOT_FOUND` instead of raw strings for type-safe key references across the codebase.
- Adding a new error = **one line** in `enum$errors_list`. No new class, no new file.

### Usage

```ts
import { GuardError } from '@errors/error.util';

// Basic — defaults to 400
throw new GuardError('USER_NOT_FOUND');

// With status override
throw new GuardError('ORG_NOT_FOUND', { statusCode: 404 });

// With extra context
throw new GuardError('VALIDATION_INVALID_EMAIL', { statusCode: 422, email: input.email });
```

### Pattern

```
Declarative list (enum$errors_list) → Auto-codes (sync$seq) → Single class (GuardError)
Global handler: instanceof GuardError ? error.statusCode : 500
```

---

## 7. Enums

### Location: `src/enums/`

### Rules

- **Never** use TypeScript `enum`. Use `const` objects with `as const` + extracted type unions.
- Object name is `PascalCase`. Keys are `UPPER_SNAKE`.
- Export both the **value object** and the **type union** (`XValue = typeof X[keyof typeof X]`).
- Barrel re-exports all enums + types from `src/enums/index.ts`.

### Pattern

```
export const FileStatus = { PENDING: 'pending', COMPLETED: 'completed' } as const;
export type FileStatusValue = typeof FileStatus[keyof typeof FileStatus];
```

---

## 8. Types

### Location: `src/types/`

### Rules

- Files contain **only** `interface` and `type` definitions — no runtime code.
- File naming: `<domain>.types.ts`.
- Use **discriminated unions** when a type has variants (e.g., metadata discriminated on `source_type`).
- Barrel re-exports using `export type { ... }` to ensure tree-shaking.
- Types alias import as `@app-types` (avoids collision with `@types` npm namespace).

---

## 9. Interfaces

### Location: Colocated with implementations (e.g., `store/store.interface.ts`, `ai/chat/chat_model.interface.ts`)

### Rules

- One `*.interface.ts` file per pluggable layer.
- No `I` prefix — `Store`, not `IStore`.
- Interfaces define **the minimum contract** — implementations can add internal methods.
- Generic interfaces use type parameters: `Parser<TRaw>`, `MetaStore<T>`, `Extractor<TRaw>`.
- Interfaces are colocated with their implementations, not in a separate `interfaces/` directory.

### Core Interfaces (typical project)

| Interface | Purpose |
|---|---|
| `Store` | Database lifecycle: connect, close, setup, get sub-stores |
| `VectorStore` | Embedding CRUD: insert, search, delete |
| `MetaStore<T>` | Generic document CRUD: insert, find, update, delete, upsert |
| `Embedder` | Text → vector: embed, embed_batch, dimensions |
| `ChatModel` | LLM invocation: invoke(input, context?) |
| `Extractor<TRaw>` | Data extraction: extract(options?) |
| `Parser<TRaw>` | Raw → domain type: parse(raw) |
| `CronJobDef` | Scheduled job: name, pattern, run() |

---

## 10. Connection Layer

### Location: `src/connection/<backend>/`

### Rules

- **Standard backends** (MongoDB, Redis, Kafka/Redpanda, SQL) — use `@rniverse/connectors` directly. Instantiate the Connector class, call `await connector.connect()`, then use.
- **Domain-specific backends** (e.g., pgvector, Microsoft Graph) — build custom connection modules in `src/connection/<backend>/`.
- One sub-directory per backend/provider: `pg/`, `mongo/`, `microsoft/`.
- Each custom connection module is a **module-level singleton** with factory functions: `get_client()`, `get_pool()`, `close_*()`.
- Connections require **explicit `connect()` call** — all connectors verify reachability before exposing the client.
- Guard functions throw if accessed before `connect()` completes.
- SQL reference files (`.sql`) live alongside the connection they belong to.

### Pattern (custom connections)

```
Module-level: let pool: Pool | null = null
Factory:      export function get_pool(): Pool { if (!pool) throw ...; return pool; }
Lifecycle:    export async function connect() { pool = new Pool(url); }
Teardown:     export async function close() { await pool?.end(); pool = null; }
```

### Pattern (standard backends via @rniverse/connectors)

```ts
import { MongoDBConnector } from '@rniverse/connectors';

const mongo = new MongoDBConnector({ url: env.MONGO_URL, database: env.MONGO_DB });
await mongo.connect();  // verifies with admin.ping()
const db = mongo.getInstance();
// db.collection('users').find(...)
```

---

## 11. Store Layer

### Location: `src/store/`

### Rules

- The **`Store` interface** is the top-level abstraction: connect, close, setup, get_vector_store, get_meta_store.
- Sub-stores (`VectorStore`, `MetaStore<T>`) are obtained from the parent `Store` via factory methods.
- Each backend has its own sub-directory: `pg/`, `mongo/`.
- File naming: `<backend>.<role>.ts` — e.g., `pg.store.ts`, `pg.vector_store.ts`, `mongo.meta_store.ts`.
- The **factory** in `src/store/index.ts` reads `STORE_TYPE` from env and instantiates the right backend.
- The **facade** delegates to the singleton: `export const store = { connect: () => get_store().connect(), ... }`.
- `setup(dimensions)` handles schema creation/migration — tables, indexes, vector indexes.
- **One set of interfaces, multiple backends** — never duplicate business logic per backend.

### Pattern

```
Interface (Store) → Implementation (PGStore, MongoStore) → Factory (get_store()) → Facade (export const store)
```

---

## 12. AI Layer

### Location: `src/ai/`

### Rules

- Two sub-layers: `chat/` and `embed/`, each with interface + implementations + factory.
- **Provider enum** (`ModelProvider`) defines supported providers: AZURE, OPENAI, DEEPSEEK, OLLAMA, CUSTOM.
- Factory uses `switch/case` on `CHAT_MODEL_PROVIDER` / `EMBED_MODEL_PROVIDER`.
- **Lazy `require()`** inside switch cases — only the selected provider's SDK is loaded.
- Singleton: module-level `let instance = null` + `get_chat_model()` / `get_embedder()`.
- Top-level facade: `export const ai = { get chat() { ... }, get embed() { ... } }` — **getter properties** for lazy instantiation.
- When a provider isn't configured, the getter throws `ChatNotConfiguredError` / `EmbedNotConfiguredError` — not at import time, only when accessed.
- Shared concerns (system prompt template) live at the sub-layer root: `ai/chat/system_prompt.ts`.
- Providers that share an SDK share an implementation class: OpenAI, DeepSeek, and Custom all use `OpenAICompatChatModel`.

### Pattern

```
Interface (ChatModel) → Implementations (OllamaChatModel, AzureChatModel, ...) → Factory (get_chat_model()) → Facade (ai.chat)
```

### Sub-grouping (when implementations grow)

If a single provider has multiple related files (model, tokenizer, prompt formatter), nest:

```
ai/
├── chat/
│   ├── ollama/
│   │   ├── ollama.chat_model.ts
│   │   └── ollama.prompt_formatter.ts
│   └── ...
```

Only create sub-directories when there are 2+ files per provider. A single file stays flat.

---

## 13. Extractors

### Location: `src/extractors/`

### Rules

- Interface: `Extractor<TRaw>` with `extract(options?): Promise<TRaw[]>`.
- Group by provider/source: `pdf/`, `microsoft/`, `s3/`, etc.
- Each extractor also exports its **raw result type** alongside: `TranscriptExtractResult`, `PdfExtractResult`.
- **Conditional loading**: when a source is disabled via env flag, use a **`DisabledExtractor<T>` stub** that throws a descriptive error. This avoids null checks throughout the codebase.
- Facade: `export const extractors = { pdf, microsoft: { transcripts, dls } }` — delegates to real or disabled instances.

### Pattern

```
Interface (Extractor<T>) → Implementation (PDFExtractor, TranscriptExtractor) → Conditional Factory → Facade
Disabled sources → DisabledExtractor stub (throws on any method call)
```

---

## 14. Mappers

### Location: `src/mappers/`

### Rules

- Mappers transform **external/raw data** into **internal types**. They are the boundary between external APIs and the domain.
- Export as namespace objects: `mapper$transcript`, `mapper$dl`.
- Pure functions — no side effects, no async, no state.
- Group by provider: `microsoft/transcript.mapper.ts`, `microsoft/dl.mapper.ts`.
- Mappers handle the `camelCase → snake_case` boundary — external APIs speak camelCase, internal code speaks snake_case.

---

## 15. Parsers

### Location: `src/parsers/`

### Rules

- Interface: `Parser<TRaw>` with `parse(raw): DomainDocument[]`.
- Parsers convert **extracted raw data** into **domain documents** (chunked, metadata-enriched).
- Shared utilities at root: `text_chunker.ts` (overlapping chunk splitter).
- Group by source/provider: `microsoft/transcript.parser.ts`, `pdf.parser.ts`.
- When parsing is async (e.g., PDF binary parsing), export a standalone function alongside the class: `parse_pdf()`.
- Facade: `export const parsers = { transcripts: new TranscriptParser(), dls: new DLParser() }`.

---

## 16. Services

### Location: `src/services/`

### Rules

- Services are **never classes** — they are plain exported objects or functions.
- **Base CRUD factory**: `create_entity_service<T>(collection)` returns a generic CRUD object (`insert`, `find_by_id`, `find_one`, `update`, `delete`, `upsert`) backed by `MetaStore<T>`.
- **Entity services** spread the base + add domain methods: `const files = { ...create_entity_service<FileRecord>(collection), create(), update_status() }`.
- **Domain services** are standalone functions: `chat(query, filters)`, `health_check()`.
- **Composition services** compose multiple primitives: `documents.add()` uses Embedder + VectorStore; `chat()` uses documents + ChatModel.
- **Ingestion sub-module**: `services/ingestion/<source>.ingest.ts` — each exports a `run()` function implementing the extract → parse → embed → store pipeline.

### Pattern

Entity services: `create_entity_service<T>() + object spread + domain methods`
Domain services: `export async function domain_verb(): Promise<Result>`
Composition services: `export const entity = { verb1, verb2, ... }`
```

---

## 17. API Layer

### Location: `src/api/`

### Rules

- One file per domain: `chat.api.ts`, `search.api.ts`, `trigger.api.ts`, `pdf.api.ts`.
- Each file exports a **single route plugin** named `api$<domain>`.
- Request/response validation is **inline** with the route definition (framework-provided schemas).
- Every route has **OpenAPI metadata**: `summary`, `description`, `tags`.
- Routes are thin — they validate input, call a service function, return the result.
- Async background processing (e.g., PDF ingestion) uses fire-and-forget from the route handler.
- Never put business logic in a route handler.

### Pattern

```
export const api$chat = framework.plugin('/api/chat')
    .post('/', handler, { validation, openapi_metadata })
```

---

## 18. Cron / Scheduled Jobs

### Location: `src/cron/`

Uses `@elysiajs/cron` — each job is an Elysia plugin, mounted with `.use()`.

### Rules

- Each job file exports a **named cron plugin**: `export const cron$<name> = cron({ name, pattern, run })`.
- File naming: `<name>.cron.ts`.
- The `run` function contains the job logic; wrap in `try/catch` and log errors (cron failures must not crash the app).
- **Conditional registration**: the cron index (`src/cron/index.ts`) exports a composite Elysia plugin that conditionally mounts job plugins based on feature flags.
- The composite plugin is mounted on the main app: `app.use(cron$jobs)`.
- No custom scheduler needed — `@elysiajs/cron` handles scheduling (backed by `croner`).
- Job names come from the `JobName` enum.

### Pattern

**Individual job** (`src/cron/transcript.cron.ts`):

```ts
import { cron } from '@elysiajs/cron';

export const cron$transcript = cron({
    name: JobName.INGEST_TRANSCRIPTS,
    pattern: '0 2 * * *',
    async run() {
        logger.info('Cron: starting transcript ingestion');
        try {
            const result = await ingestion.transcripts.run();
            logger.info({ processed: result.processed }, 'Cron: transcript ingestion complete');
        } catch (error) {
            logger.error({ error }, 'Cron: transcript ingestion failed');
        }
    },
});
```

**Composite plugin** (`src/cron/index.ts`):

```ts
import { Elysia } from 'elysia';

export const cron$jobs = new Elysia({ name: 'cron' });

if (env.AZURE_SOURCE) {
    const { cron$transcript } = require('@cron/transcript.cron');
    const { cron$dl } = require('@cron/dl.cron');
    cron$jobs.use(cron$transcript).use(cron$dl);
}
```

**Bootstrap** (`src/index.ts`):

```ts
app.use(cron$jobs).listen(env.PORT);
```

---

## 19. Utils

### Location: `src/utils/` + `@rniverse/utils`

### Rules

- **Common utilities** (logger, dates, IDs, validation, seq generators) come from `@rniverse/utils` — import directly, no local wrapper needed.
- **Project-specific helpers** go in `src/utils/<purpose>.util.ts`.
- File naming: `<purpose>.util.ts`.
- Stateless, pure utility functions.
- Keep utils minimal — if a utility grows complex, it may belong in its own layer.

### From `@rniverse/utils` (no local code needed)

```ts
import { log } from '@rniverse/utils';          // Pino logger
import { date } from '@rniverse/utils';          // Day.js with plugins
import { sync$seq } from '@rniverse/utils';      // Sequential code generator
import { v } from '@rniverse/utils';             // Valibot schemas
import { _, uuid, ulid } from '@rniverse/utils'; // Lodash, IDs
```

### Sequence Generator (from `@rniverse/utils`)

A reusable utility for generating sequential codes, IDs, and counters. Used by the error system for auto-generated error codes.

**Sync variant** — for startup-time generation (error codes, enum codes):

```ts
import { sync$seq } from '@rniverse/utils';

// Generate base-36 padded codes: '0000000001', '0000000002', ...
const next_code = sync$seq.get({ type: 'code', length: 10 });
next_code(); // '0000000001'
next_code(); // '0000000002'

// With prefix: 'ERR-0000000001'
const next_err = sync$seq.get({ prefix: 'ERR', type: 'code', length: 10 });

// Raw bigint sequence
const next_seq = sync$seq.next.seq();
next_seq(); // 1n
next_seq(); // 2n
```

**Async variant** — for runtime ID generation with concurrency safety:

```ts
import { async$seq } from '@rniverse/utils';

const next_id = async$seq.get({ prefix: 'TXN', type: 'code' });
await next_id(); // 'TXN-0000000001'
```

**Export shape:**

```ts
export const sync$seq = {
    next: { seq, code },  // raw generators
    get: (options?) => () => string,  // configured generator factory
};

export const async$seq = {
    next: { seq, code },
    get: (options?) => async () => string,
};
```

Conventions:
- `sync$seq` / `async$seq` — use `$` qualifier to distinguish sync vs async variants.
- Codes use base-36 encoding for compact, alphanumeric output.
- Length is configurable (default 10 chars).
- Prefix is optional — use for namespacing (`ERR-`, `TXN-`, `DOC-`).

---

## 20. Barrel Exports

### Rules

- Every directory with multiple exports has an `index.ts` barrel.
- Barrels re-export **values** and **types** from their siblings.
- Type-only re-exports use `export type { ... }` for correct tree-shaking.
- Barrels can also be facades (store/index.ts, ai/index.ts, cron/index.ts) — combining re-exports with factory logic.
- External consumers import from the barrel (via path alias), never from internal files:

```
import { store } from '@store';           // ✓ barrel
import { PGStore } from '@store/pg/...';  // ✗ internal
```

---

## 21. Pluggability & Feature Gating

### Provider Pluggability

Every pluggable layer follows: **Interface → Implementation → Env-driven Factory → Facade**.

- The factory reads an env var (e.g., `STORE_TYPE`, `CHAT_MODEL_PROVIDER`) and instantiates the matching implementation.
- Factory uses `switch/case` — explicit, readable, no DI container.
- Unsupported values throw `ProviderUnsupportedError` with a helpful message.
- Module-level singleton (`let instance = null`) ensures single instantiation.

### Lazy `require()`

Use `require()` inside factory switch cases to avoid loading unused SDKs at startup:

```
case 'OLLAMA':
    const { OllamaChatModel } = require('./ollama.chat_model');
    instance = new OllamaChatModel();
```

This keeps startup fast and avoids importing SDKs that aren't installed.

### Feature Gating

For optional features (e.g., Azure Graph API integration):

- Use a **boolean env flag**: `AZURE_SOURCE=Y`.
- When disabled, substitute a **`Disabled*` stub class** that throws a descriptive error on any method call.
- Conditional loading in the factory — real implementation via `require()` when enabled, stub when disabled.
- Cron jobs, API routes, and services check the flag before registering or executing.

### Optional Capabilities

Some capabilities (chat, embeddings) can be entirely absent:

- Factory returns `null` or the facade getter throws a `*NotConfiguredError` on access.
- Bootstrap logs warnings for unconfigured capabilities.
- Health checks report `not_configured` status for missing capabilities.

---

## 22. Data Pipeline

When the service involves ingesting external data (documents, events, API responses), follow the pipeline pattern:

```
Extract → Map → Parse → Embed → Store → Track
```

| Stage | Layer | Responsibility |
|---|---|---|
| Extract | `extractors/` | Fetch raw data from external source |
| Map | `mappers/` | Transform external format → internal types |
| Parse | `parsers/` | Chunk, enrich with metadata, produce domain documents |
| Embed | `services/document.service` | Generate vector embeddings |
| Store | `store/` | Persist documents + embeddings |
| Track | `services/sync_state.service` | Record last successful sync timestamp |

Each source type has its own **ingestion orchestrator**: `services/ingestion/<source>.ingest.ts` with a `run()` function that wires the pipeline together.

- Per-item error handling: catch + log + continue — one bad document doesn't abort the batch.
- Idempotent where possible: use upsert or check-before-insert.

---

## 23. Application Bootstrap

The entry point (`src/index.ts`) follows a strict sequence:

1. **Connect** to store
2. **Setup** schema/indexes (conditional on embed provider being configured)
3. **Create** HTTP server with:
   - OpenTelemetry plugin (optional — distributed tracing via `@elysiajs/opentelemetry`)
   - OpenAPI plugin (`@elysiajs/openapi` — serves Swagger UI at `/openapi`)
   - Global error handler (AppError → status, else → 500)
   - Root route (`/`) — basic liveness
   - Health route (`/health`) — deep component checks
   - Mount API route plugins (`.use(api$chat).use(api$search)...`)
   - Mount cron plugin (`.use(cron$jobs)` — conditional on feature flags)
4. **Start** server with `.listen(port)`
5. **Register** graceful shutdown handlers (SIGTERM/SIGINT → close store → exit)

### Graceful Shutdown

- Listen for `SIGTERM` and `SIGINT`.
- Close store connections.
- Exit cleanly.

---

## 24. Bun + Elysia Reference

When using this template with **Bun** + **Elysia** specifically:

### tsconfig.json

- Target: `ES2021`, Module: `ES2022`, ModuleResolution: `bundler`
- Types: `["bun-types"]`
- Path aliases: one `@<layer>` per `src/` sub-directory
- Use `@app-types` for `src/types` (avoids `@types` npm collision)

### Elysia Patterns

- Each API file exports a plugin: `new Elysia({ prefix: '/api/<domain>' })`
- Request validation via `t.Object({ ... })` inline schemas
- OpenAPI via `@elysiajs/openapi` plugin with `detail: { tags, summary, description }` per route
- Global error handler via `.onError()` — single place for all HTTP error mapping
- Route plugins mounted with `.use()` chaining
- `.listen(port)` at the end of the chain

### Bun-Specific

- Native TypeScript execution — no build step
- `bun --watch` for development
- `@elysiajs/cron` for scheduled tasks (backed by `croner`)
- `@elysiajs/opentelemetry` for distributed tracing (optional)
- Bun-native file I/O where applicable

### Package Manager

- Use `bun` as the package manager
- `bun add` / `bun add -d` for dependencies
- `bun run <script>` for npm scripts

---

## Quick Reference Card

| Layer | Location | File Naming | Export Pattern |
|---|---|---|---|
| Foundation | `@rniverse/utils` | — | `import { log, date, sync$seq, v } from '@rniverse/utils'` |
| Connectors | `@rniverse/connectors` | — | `import { MongoDBConnector, SQLConnector } from '@rniverse/connectors'` |
| Config | `config/` | `env.ts` | `export const env: Env` |
| Errors | `errors/` + `enums/errors.enum.ts` | `error.util.ts` + `errors.enum.ts` | `enum$errors_list` → `GuardError` class |
| Enums | `enums/` | `<name>.enum.ts` | `export const X = {} as const` + `export type XValue` |
| Types | `types/` | `<domain>.types.ts` | `export interface X` / `export type X` |
| Connections | `connection/<backend>/` or `@rniverse/connectors` | `<backend>.connection.ts` | Connector class (`connect()` → `getInstance()`) or custom `get_*()`, `close_*()` |
| Store | `store/<backend>/` | `<backend>.<role>.ts` | Interface → Class → Factory → Facade |
| AI | `ai/<capability>/` | `<provider>.<capability>.ts` | Interface → Class → Factory → Facade |
| Extractors | `extractors/<source>/` | `<source>.extractor.ts` | Interface → Class → Conditional Factory |
| Mappers | `mappers/<provider>/` | `<name>.mapper.ts` | `export const mapper$<name>` |
| Parsers | `parsers/` | `<source>.parser.ts` | Interface → Class → Facade |
| Services | `services/` | `<entity>.service.ts` | `export const entity = { ... }` or `export function verb()` |
| Ingestion | `services/ingestion/` | `<source>.ingest.ts` | `export async function run()` |
| API | `api/` | `<domain>.api.ts` | `export const api$<domain>` |
| Cron | `cron/` | `<name>.cron.ts` | `export const cron$<name> = cron({ ... })` → composite plugin |
| Utils | `utils/` + `@rniverse/utils` | `<purpose>.util.ts` | Shared from lib; project-specific in `src/utils/` |

---

## Anti-Patterns (Don't Do)

| Anti-Pattern | Instead |
|---|---|
| TypeScript `enum` | `const` object `as const` + type union |
| `camelCase` file names | `snake_case` with dot category separator |
| `IStore` interface prefix | Just `Store` |
| Business logic in route handlers | Thin handlers → service functions |
| Per-provider env vars (`OPENAI_API_KEY`) | Generic capability vars (`CHAT_API_KEY`) |
| Deep class inheritance | Object spread composition, facades |
| Global `try/catch` swallowing errors | Custom error hierarchy + global handler |
| One class per error condition | Declarative error list + single `GuardError` class |
| Manual error code assignment | Auto-generated sequential codes via `sync$seq` |
| Raw string error keys scattered in code | `enum$error_key.X` for type-safe references |
| Magic string comparisons | Enum-like const objects |
| Importing from internal files across layers | Import from barrel `index.ts` via `@alias` |
| DI container / decorators | Manual factory + singleton pattern |
| Loading all provider SDKs at startup | Lazy `require()` in factory switch/case |
| Null checks for disabled features | Disabled stub classes that throw descriptive errors |
| Re-implementing logger, dates, IDs, validation | Use `@rniverse/utils` |
| Writing MongoDB/Redis/Kafka connection boilerplate | Use `@rniverse/connectors` |
| Copying seq generator per project | Import `sync$seq` / `async$seq` from `@rniverse/utils` |
