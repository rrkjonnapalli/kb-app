# Project Context & Design Philosophy

## The "Entity-First" Architecture

The core philosophy of this project is **Entity-First Design**. Instead of organizing code by technical layers (e.g., `controllers`, `services`, `repositories`), we organize by domain entities and capabilities, exposing a clean, verb-based API to consumers.

### Why "Entity-First"?

Technical layers often lead to:
-   **Scattered Logic**: A single feature (like "transcripts") is spread across 5 directories.
-   **Tight Coupling**: Service layers become monolithic "God classes" (e.g., `IngestService` knowing about MongoDB _and_ PDF parsing _and_ Vector search).
-   **Inconsistent APIs**: `fileService.process()` vs `documentService.addDocuments()` vs `vectorStore.upsert()`.

Our approach solves this by standardizing creating **thin, composable wrappers** around primitives.

### The "Core Pattern"

Every major capability follows this pattern:

1.  **Interface**: Defines the *what* (e.g., `VectorStore`, `Embedder`, `Extractor`).
2.  **Implementation**: Defines the *how* for a specific provider (e.g., `MongoVectorStore`, `AzureOpenAIEmbedder`, `GraphTranscriptExtractor`).
3.  **Factory**: A singleton accessor that returns the configured implementation (e.g., `getStore()`, `getEmbedder()`).
4.  **Service Wrapper**: A high-level, domain-specific API that composes these primitives (e.g., `documents.add()`, `extractors.transcripts.extract()`).

---

## Key Architectural Decisions

### 1. Store Abstraction (DB Agnostic)

We support both **MongoDB Atlas** and **PostgreSQL (pgvector)**. To achieve this without `if/else` checks everywhere:

-   **Segregated Interfaces**: We split the monolithic "Store" into:
    -   `VectorStore`: Strictly for vector operations (embedding search). It doesn't know about file metadata or sync state.
    -   `MetaStore<T>`: A generic CRUD interface for any entity type (`FileRecord`, `SyncState`, `KnowledgeDocument`).
-   **Dynamic Setup**: `store.setup()` handles schema creation (SQL `CREATE TABLE` or Mongo Indexes) based on the environment.
-   **Zero-Knowledge Vectors**: The `VectorStore` doesn't know *how* `embedding` fields are generated. It just stores `number[]`.

### 2. Pluggable Models

We treat LLM providers (Embeddings & Chat) as swappable commodities.

-   **Embedder Interface**: Exposes `embed(text)` and `dimensions`.
-   **Why separate dimensions?**: Different models have different vector sizes (OpenAI=1536, Llama3=variable). The `Store` layer queries the `Embedder` for dimensions during setup to create the correct schema.

### 3. Extraction vs. Parsing

We strictly separate **getting data** from **understanding data**:

-   **Extractors (`src/extractors`)**:
    -   **Responsibility**: Fetch raw data from the outside world (API, filesystem, URL).
    -   **Output**: The rawest possible format (JSON response, Buffer, VTT string).
    -   **Why?**: Allows us to cache/save raw data for debugging or re-parsing later without re-fetching.

-   **Parsers (`src/parsers`)**:
    -   **Responsibility**: Transform raw data into our standard `KnowledgeDocument[]`.
    -   **Logic**: Chunking, metadata extraction, cleaning.
    -   **Output**: Always `KnowledgeDocument[]`.
    -   **Why?**: Parsing logic changes frequently (chunk size, overlap). Extraction logic (auth, API calls) rarely changes.

---

## Coding Conventions

### 4. Mappers (`src/mappers`)

We strictly separate **data transformation** from logic.

-   **Responsibility**: Convert external data structures (often `camelCase` from APIs) into our internal domain objects (`snake_case`).
-   **Why?**:
    -   Keeps parsers focused on *understanding* data (chunking, cleaning), not *renaming* fields.
    -   Ensures type safety at the boundary.
    -   Reusability across different parsers if the input format is the same.

### Usage

```typescript
import { mappers } from '@mappers';

// Inside a parser or service
const metadata = mappers.microsoft.transcript.format.input(rawGraphData);
```
---

## Coding Conventions

### 1. Variable Naming

We prefer **short, generic names** over verbose Hungarian notation.

| Concept | Preferred | Avoid |
| :--- | :--- | :--- |
| **Generics** | `_doc`, `_record`, `__doc` | `transcriptDoc`, `fileRecord` |
| **Results** | `result`, `response` | `searchResult`, `apiResponse` |
| **Inputs** | `input`, `query` | `userInput`, `searchQueryString` |
| **Params** | `params`, `options` | `searchParams`, `filterOptions` |
| **Mappers** | `mapper$file.format()`, `format.input()` | `map_file()`, `formatOutput()`, `formatTranscript()` |

### 2. Disambiguation (`$`)

When you strictly need to distinguish between two variables of the same "shape" in the same scope, use a `$` suffix/prefix to denote the *context* or *source*:

```typescript
// Good
const doc$file = ...; // Document related to a file
const doc$task = ...; // Document related to a task
const extractor$dl = ...; // Extractor for DLs

// Bad
const fileDoc = ...;
const taskDoc = ...;
const distributionListExtractor = ...;
```

### 3. Casing Standards

-   **Internal Interfaces & Methods**: Always `snake_case`.
    -   `find_by_id`, `min_score`, `created_at`.
-   **Database Keys**: Always `snake_case`.
    -   `meeting_subject`, `source_type`.
-   **External APIs**: Keep original casing.
    -   Microsoft Graph returns `meetingId` (camelCase) -> we keep it in `RawTranscript`.

### 4. Import Paths

We use explicit mapping in `tsconfig.json` to avoid relative `../../` hell.

-   **Namespace Imports**: Preferred for accessing entity bundles.
    -   `import { models } from '@models';`
    -   `import { extractors } from '@extractors';`
    -   `import { mappers } from '@mappers';`
-   **Direct Imports**: For types or utilities.
    -   `import type { FileRecord } from '@app-types/file.types';`

---

## Cron Architecture

Cron jobs are treated as **Entities** with a standard lifecycle, not just scripts.

### Pattern

```typescript
interface CronJob {
  register(): void;             // Schedule it (e.g., '0 0 * * *')
  run(): Promise<IngestResult>; // Manual trigger logic
}
```

### Usage

```typescript
// Registering
cron.transcripts.register();

// Identifying
await sync_state.upsert({ job_name: 'transcripts' }, ...);
```

---

## Target File Structure

This is the blueprint for where code should live.

```
src/
├── config/
├── models/                    # Embedder, ChatModel
├── store/                     # VectorStore, MetaStore (Mongo/Pg)
├── extractors/                # Fetch raw data
├── parsers/                   # Transform to KnowledgeDocument
├── mappers/                   # Transform external -> internal types
├── services/                  # High-level entity APIs (documents, files)
├── cron/                      # Entity-first cron jobs
├── api/                       # REST endpoints
├── types/                     # Domain types
├── enums/                     # Domain enums
└── utils/
```

---

## Extension Guide

### How to add a new Data Source (e.g., Slack)

1.  **Define Types**: Create `src/types/slack.types.ts` (Raw types).
2.  **Create Extractor**: `src/extractors/slack/slack.extractor.ts` (Fetch raw JSON).
3.  **Create Mapper**: `src/mappers/slack.mapper.ts` (Raw JSON -> Metadata).
4.  **Create Parser**: `src/parsers/slack.parser.ts` (Use mapper + chunking -> `KnowledgeDocument`).
5.  **Register Types**: Add `slack` to `SourceType` enum.
6.  **Create Cron**: `src/cron/slack.cron.ts`.
7.  **Export**: Add to `extractors/index.ts`, `parsers/index.ts`, `mappers/index.ts`, `cron/index.ts`.
8.  **Usage**:
    ```typescript
    const raw = await extractors.slack.extract();
    const docs = parsers.slack.parse(raw);
    await documents.add(docs);
    ```

### How to add a new Store (e.g., Pinecone)

1.  **Create Interface Impl**: `src/store/pinecone/pinecone.vector-store.ts` implements `VectorStore`.
2.  **Update Factory**: in `src/store/index.ts`, add case for `STORE_TYPE=pinecone`.

---

## Current State (Phase 6)

We are currently refactoring towards this "Entity-First" vision.

-   **Done**: Basic foundation, Mongo/PostgreSQL support, key extractors (PDF, Graph).
-   **In Progress**: Splitting monolithic files into domain-specific modules (`types/`, `enums/`), implementing the `namespace.entity.verb()` pattern completely.
