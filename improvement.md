# Architectural Improvement Plan

Entity-first, pluggable redesign of the KB RAG service. Every component follows the same patterns:
- **interface → implementations → factory** for pluggable backends
- **namespace.entity.verb()** for all consumer-facing APIs

---

## 0. Coding Conventions

### Variable naming

Prefer short, generic names. Avoid verbose camelCase compound names.

| Prefer | Avoid |
|--------|-------|
| `_doc`, `_record`, `__doc`, `__record` | `transcriptDoc`, `fileRecord` |
| `response`, `result` | `chatResponse`, `searchResult` |
| `input`, `output` | `userInput`, `processedOutput` |
| `params`, `options` | `searchParams`, `queryOptions` |
| `mapper$file.format()`, `format.input()` | `map_file()`, `formatOutput()`, `formatTranscript()` |

### Disambiguation with `$` prefix

When you **must** distinguish between entities of the same shape, use `$`-prefixed entity names:

```typescript
// ✅ Good
const doc$file = ...;
const doc$task = ...;
const extractor$dl = ...;

// ❌ Bad
const fileDoc = ...;
const taskDoc = ...;
const dlExtractor = ...;
```

### snake_case everywhere (except external packages)

**Our interfaces, methods, and fields** — always `snake_case`:

```typescript
// ✅ Our interface
interface SearchOptions {
  limit?: number;
  min_score?: number;      // not minScore
  filter?: SearchFilters;
}
```

**External package APIs** — accept their conventions as-is:

```typescript
// ✅ OK — Microsoft Graph returns camelCase, we can't change it
interface RawTranscript {
  meetingId: string;          // from Graph API
  createdDateTime: string;    // from Graph API
}
```

### DB keys

All database keys must be `snake_case`. No camelCase in Mongo documents or Postgres columns.

```
✅ source_type, meeting_subject, created_at, chunks_count
❌ sourceType, meetingSubject, createdAt, chunksCount
```

### Current violations to fix

| File | Field | Fix |
|------|-------|-----|
| `types/index.ts → SearchOptions` | `minScore` | → `min_score` |
| `types/index.ts → SourceReference` | `relevance_score` | ✅ already correct |

> All other DB-facing fields (`source_type`, `meeting_subject`, `created_at`, etc.) are already snake_case.

---

## 1. Store Layer

Replaces the current monolithic `Store` class with segregated entity stores.

### Interfaces

```typescript
// Top-level — lifecycle only
interface Store {
  connect(): Promise<void>;
  close(): Promise<void>;
  setup(): Promise<void>;   // schema, indexes, extensions
  get_vector_store(name: string): VectorStore;
  get_meta_store<T>(name: string): MetaStore<T>;
}

// Vector storage — raw embeddings in, results out. No embedding logic.
interface VectorStore {
  insert(docs: { content: string; embedding: number[]; metadata: Record<string, unknown> }[]): Promise<string[]>;
  search(embedding: number[], options?: SearchOptions): Promise<SearchResult[]>;
  delete(filter: SearchFilters): Promise<number>;
}

// Generic CRUD — typed per entity
interface MetaStore<T> {
  insert(record: Partial<T>): Promise<string>;
  find_by_id(id: string): Promise<T | null>;
  find_one(filter: Partial<T>): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  upsert(filter: Partial<T>, data: Partial<T>): Promise<void>;
}
```

### Implementations

| Backend | Env | VectorStore | MetaStore |
|---------|-----|-------------|-----------|
| MongoDB Atlas | `STORE_TYPE=mongo` | `$vectorSearch` pipeline | Collection CRUD |
| PostgreSQL + pgvector | `STORE_TYPE=postgres` | `<=>` cosine + HNSW | Table CRUD via `pg` |

### Dimension handling

`setup()` reads `models.embed.dimensions` to create the vector column/index with the correct size — no hardcoded `1536`.

---

## 2. Models

Organized by capability (embed, chat). Each capability has a pluggable interface, implementations per provider, and a factory.

### Structure

```
src/models/
├── embed/
│   ├── embedder.interface.ts          # Embedder interface
│   ├── openai.embedder.ts             # Azure OpenAI / OpenAI implementation
│   ├── ollama.embedder.ts             # Ollama implementation (future)
│   └── index.ts                       # getEmbedder() factory
├── chat/
│   ├── chat-model.interface.ts        # ChatModel interface
│   ├── openai.chat-model.ts           # Azure OpenAI / OpenAI implementation
│   ├── ollama.chat-model.ts           # Ollama implementation (future)
│   └── index.ts                       # getChatModel() factory
└── index.ts                           # models.embed / models.chat
```

### Interfaces

```typescript
interface Embedder {
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embed_batch(texts: string[]): Promise<number[][]>;
}

interface ChatModel {
  invoke(input: string, context?: string): Promise<string>;
}
```

### Usage

```typescript
import { models } from '@models';

const embedding = await models.embed.embed('some text');
const embeddings = await models.embed.embed_batch(chunks);
const dimensions = models.embed.dimensions;

const answer = await models.chat.invoke(question, context);
```

### Env config

```bash
EMBED_PROVIDER=azure_openai             # azure_openai | openai | ollama
CHAT_PROVIDER=azure_openai              # azure_openai | openai | ollama
```

---

## 3. Extractors

Extractors **fetch raw data** from external sources. Each source type has its own extractor.

### Interface

```typescript
interface Extractor<TRaw> {
  extract(options?: ExtractOptions): Promise<TRaw[]>;
}
```

### Structure

```
src/extractors/
├── extractor.interface.ts
├── microsoft/
│   ├── graph.client.ts                # Shared MS Graph auth client
│   ├── transcript.extractor.ts        # Graph API → raw VTT + meeting metadata
│   └── dl.extractor.ts               # Graph API → raw DL data + members
├── pdf/
│   └── pdf.extractor.ts              # URL download or buffer → raw PDF
└── index.ts                           # extractors.transcripts / .dls / .pdf
```

### Usage

```typescript
import { extractors } from '@extractors';

const rawTranscripts = await extractors.transcripts.extract({ since });
const rawDLs = await extractors.dls.extract();
const rawPdf = await extractors.pdf.extract({ url });
// or
const rawPdf = await extractors.pdf.extract({ buffer });
```

---

## 4. Parsers

Parsers **transform raw data into `KnowledgeDocument[]`**. Paired with extractors, reusable when formats overlap.

### Interface

```typescript
interface Parser<TRaw> {
  parse(raw: TRaw): KnowledgeDocument[];
}
```

### Structure

```
src/parsers/
├── parser.interface.ts
├── transcript.parser.ts               # VTT → time-chunked docs with speaker metadata
├── dl.parser.ts                       # DL data → single doc with member metadata
├── pdf.parser.ts                      # PDF buffer → text → overlapping chunks
├── text-chunker.ts                    # Shared: chunk text with overlap + sentence boundaries
└── index.ts                           # parsers.transcripts / .dls / .pdf
```

### Usage

```typescript
import { parsers } from '@parsers';

const docs = parsers.transcripts.parse(rawVttData);
const docs = parsers.dls.parse(rawDlData);
const docs = parsers.pdf.parse(rawPdf);
```

### Extractor ↔ Parser mapping

```
extractors.transcripts → parsers.transcripts
extractors.dls         → parsers.dls
extractors.pdf         → parsers.pdf (uses text-chunker)
```

Future sources (Confluence, Slack, DOCX, etc.) just need a new extractor + parser pair.

---

## 4.5. Mappers

Mappers **transform external data structures** (often camelCase) into our **internal domain objects** (strictly snake_case). They isolate data transformation logic from parsers and services.

### Structure

```
src/mappers/
├── mapper.interface.ts                # Optional generic interface
├── microsoft/
│   ├── transcript.mapper.ts           # RawTranscript → TranscriptMetadata
│   └── dl.mapper.ts                   # RawDLData → DLMetadata
├── pdf/
│   └── pdf.mapper.ts                  # PDF metadata transform
└── index.ts                           # mappers.microsoft.transcript / .dl
```

### Usage

```typescript
import { mappers } from '@mappers';

// Inside a parser or service
const metadata = mappers.microsoft.transcript.format.input(rawGraphData);
```

---

## 5. Entity Services

Thin entity-first wrappers composing store + model primitives. The **only public API** consumers use.

### `services/documents.ts`

```typescript
export const documents = {
  async add(docs: KnowledgeDocument[]): Promise<string[]>,
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>,
  async delete(filter: SearchFilters): Promise<number>,
};
```

### `services/files.ts`

```typescript
export const files = {
  async insert(record: Partial<FileRecord>): Promise<string>,
  async find_by_id(id: string): Promise<FileRecord | null>,
  async update(id: string, data: Partial<FileRecord>): Promise<void>,
};
```

### `services/sync-state.ts`

```typescript
export const sync_state = {
  async find_one(filter: Partial<SyncState>): Promise<SyncState | null>,
  async upsert(filter: Partial<SyncState>, data: Partial<SyncState>): Promise<void>,
  async get_last_sync(source_type: string): Promise<Date>,
};
```

---

## 6. Cron

Entity-first cron management. Each job is its own entity with `register()` and `run()`.

### Interface

```typescript
interface CronJob {
  register(): void;                      // Schedule the job
  run(): Promise<IngestResult>;          // Manual trigger
}
```

### Structure

```
src/cron/
├── cron.interface.ts
├── transcript.cron.ts                  # CronJob for transcript ingestion
├── dl.cron.ts                          # CronJob for DL ingestion
├── scheduler.ts                        # start() — kicks off all registered crons
└── index.ts                            # cron.transcripts / .dls / .start
```

### Usage

```typescript
import { cron } from '@cron';

// During app init
cron.transcripts.register();
cron.dls.register();
cron.start();

// Manual triggers (from API)
const result = await cron.transcripts.run();
const result = await cron.dls.run();
```

---

## 7. Types & Enums (Split by Domain)

Instead of one monolithic `types/index.ts` and `enums/index.ts`, split by domain so related things live together.

### Types

```
src/types/
├── document.types.ts                  # KnowledgeDocument, StoredDocument, DocumentMetadata
│                                      # TranscriptMetadata, DLMetadata, PdfMetadata
├── search.types.ts                    # SearchFilters, SearchOptions, SearchResult
├── chat.types.ts                      # ChatResponse, SourceReference
├── file.types.ts                      # FileRecord
├── sync.types.ts                      # SyncState
├── ingest.types.ts                    # IngestResult
├── microsoft.types.ts                 # RawTranscript, RawMeetingDetails, RawDLData, RawDLMember
└── index.ts                           # Re-exports everything
```

### Enums

```
src/enums/
├── collections.enum.ts                # Collections (knowledge_base, sync_state, files)
├── source-type.enum.ts                # SourceType (transcript, distribution_list, pdf)
├── file-status.enum.ts                # FileStatus (pending, processing, completed, failed)
├── jobs.enum.ts                       # JobName (ingest-transcripts, ingest-dls)
└── index.ts                           # Re-exports everything
```

> **Note:** `VectorIndex` and `EmbeddingConfig` (currently in enums) move out — dimensions come from `models.embed.dimensions`, index name is internal to each store implementation.

---

## 8. TSConfig Path Aliases

Both `@module/*` (subpath imports) and `@module` (index imports) for every module:

```json
{
  "compilerOptions": {
    "paths": {
      "@config/*":     ["src/config/*"],
      "@config":       ["src/config"],
      "@models/*":     ["src/models/*"],
      "@models":       ["src/models"],
      "@store/*":      ["src/store/*"],
      "@store":        ["src/store"],
      "@extractors/*": ["src/extractors/*"],
      "@extractors":   ["src/extractors"],
      "@parsers/*":    ["src/parsers/*"],
      "@parsers":      ["src/parsers"],
      "@mappers/*":    ["src/mappers/*"],
      "@mappers":      ["src/mappers"],
      "@cron/*":       ["src/cron/*"],
      "@cron":         ["src/cron"],
      "@services/*":   ["src/services/*"],
      "@services":     ["src/services"],
      "@api/*":        ["src/api/*"],
      "@api":          ["src/api"],
      "@app-types/*":  ["src/types/*"],
      "@app-types":    ["src/types"],
      "@enums/*":      ["src/enums/*"],
      "@enums":        ["src/enums"],
      "@utils/*":      ["src/utils/*"],
      "@utils":        ["src/utils"]
    }
  }
}
```

### Import style

```typescript
// Namespace imports (preferred for entity-first access)
import { models } from '@models';
import { extractors } from '@extractors';
import { parsers } from '@parsers';
import { mappers } from '@mappers';
import { cron } from '@cron';

// Direct subpath imports (for internals / specific files)
import { env } from '@config/env';
import { logger } from '@utils/log.util';
import type { FileRecord } from '@app-types/file.types';
```

---

## 9. Full Consumer Example

```typescript
// ingest.service.ts — transcript ingestion
import { extractors } from '@extractors';
import { parsers } from '@parsers';
import { documents } from '@services/documents';
import { sync_state } from '@services/sync-state';

const since = await sync_state.get_last_sync('transcript');
const _raw = await extractors.transcripts.extract({ since });
for (const _item of _raw) {
  const _docs = parsers.transcripts.parse(_item);
  await documents.add(_docs);
}
await sync_state.upsert({ job_name: 'transcript' }, { last_success: new Date() });
```

```typescript
// pdf.ingest.service.ts — PDF pipeline
import { extractors } from '@extractors';
import { parsers } from '@parsers';
import { documents } from '@services/documents';
import { files } from '@services/files';

await files.update(id, { status: 'processing' });
const _raw = await extractors.pdf.extract({ buffer });
const _docs = parsers.pdf.parse(_raw);
await documents.add(_docs);
await files.update(id, { status: 'completed', chunks_count: _docs.length });
```

```typescript
// chat.service.ts — RAG chain
import { models } from '@models';
import { documents } from '@services/documents';

const _results = await documents.search(question, { limit: 5 });
const context = _results.map(r => r.document.content).join('\n');
const answer = await models.chat.invoke(question, context);
```

---

## 10. File Structure (Target)

```
src/
├── config/
│   └── env.ts
├── models/
│   ├── embed/
│   │   ├── embedder.interface.ts
│   │   ├── openai.embedder.ts
│   │   └── index.ts
│   ├── chat/
│   │   ├── chat-model.interface.ts
│   │   ├── openai.chat-model.ts
│   │   └── index.ts
│   └── index.ts
├── store/
│   ├── store.interface.ts
│   ├── mongo/
│   │   ├── mongo.store.ts
│   │   ├── mongo.vector-store.ts
│   │   └── mongo.meta-store.ts
│   ├── pg/
│   │   ├── pg.store.ts
│   │   ├── pg.vector-store.ts
│   │   └── pg.meta-store.ts
│   └── index.ts
├── extractors/
│   ├── extractor.interface.ts
│   ├── microsoft/
│   │   ├── graph.client.ts
│   │   ├── transcript.extractor.ts
│   │   └── dl.extractor.ts
│   ├── pdf/
│   │   └── pdf.extractor.ts
│   └── index.ts
├── parsers/
│   ├── parser.interface.ts
│   ├── transcript.parser.ts
│   ├── dl.parser.ts
│   ├── pdf.parser.ts
│   ├── text-chunker.ts
│   └── index.ts
├── mappers/
│   ├── mapper.interface.ts
│   ├── microsoft/
│   │   ├── transcript.mapper.ts
│   │   └── dl.mapper.ts
│   └── index.ts
├── services/
│   ├── documents.ts
│   ├── files.ts
│   ├── sync-state.ts
│   ├── chat.service.ts
│   ├── ingest.service.ts
│   └── pdf.ingest.service.ts
├── cron/
│   ├── cron.interface.ts
│   ├── transcript.cron.ts
│   ├── dl.cron.ts
│   ├── scheduler.ts
│   └── index.ts
├── api/
│   ├── chat.api.ts
│   ├── trigger.api.ts
│   └── pdf.api.ts
├── types/
│   ├── document.types.ts
│   ├── search.types.ts
│   ├── chat.types.ts
│   ├── file.types.ts
│   ├── sync.types.ts
│   ├── ingest.types.ts
│   ├── microsoft.types.ts
│   └── index.ts
├── enums/
│   ├── collections.enum.ts
│   ├── source-type.enum.ts
│   ├── file-status.enum.ts
│   ├── jobs.enum.ts
│   └── index.ts
├── utils/
│   └── log.util.ts
└── index.ts
```

---

## 11. Env Config

```bash
# Store backend
STORE_TYPE=mongo                          # mongo | postgres

# Model providers
EMBED_PROVIDER=azure_openai               # azure_openai | openai | ollama
CHAT_PROVIDER=azure_openai                # azure_openai | openai | ollama

# Azure OpenAI (when provider=azure_openai)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://...
AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Ollama (when provider=ollama)
OLLAMA_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=llama3

# Microsoft Graph
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...

# MongoDB (when STORE_TYPE=mongo)
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=knowledge_base

# PostgreSQL (when STORE_TYPE=postgres)
POSTGRES_URL=postgresql://user:pass@localhost:5432/knowledge_base

# Server
PORT=3000
LOG_LEVEL=info
```

---

## 12. Implementation Order

1. **TSConfig** — update path aliases
2. **Types & Enums** — split into domain files, re-export from index
3. **Mappers** — create mapper functions/interfaces
4. **Models** — `Embedder` + `ChatModel` interfaces, OpenAI impls, factories, namespace export
5. **Store interfaces** — `Store`, `VectorStore`, `MetaStore`
6. **MongoStore** — split into `MongoVectorStore` + `MongoMetaStore`
7. **PgStore** — split into `PgVectorStore` + `PgMetaStore`
8. **Entity services** — `documents.ts`, `files.ts`, `sync-state.ts`
9. **Extractors** — refactor from current `microsoft/*.ts` + `pdf.ingest.service.ts`
10. **Parsers** — refactor existing parsers + extract `text-chunker` (use mappers)
11. **Cron** — refactor into entity-first pattern with `register()` + `run()`
12. **Consumer refactor** — update `ingest.service`, `pdf.ingest.service`, `chat.service`, APIs, scripts
13. **Verify** — `bunx tsc --noEmit`, manual testing
