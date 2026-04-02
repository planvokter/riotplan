# @planvokter/riotplan-core

Core domain services for RiotPlan plan lifecycle management.

This package owns the domain logic that operates on plans independent of any
transport layer (HTTP, CLI, etc.). It defines the contracts other packages
program against and provides the default implementations backed by
`@planvokter/riotplan-format` (SQLite).

## What lives here

### Contracts (`src/contracts/`)

TypeScript interfaces that define how the rest of the system interacts with
plan data. Nothing in this layer depends on SQLite, HTTP, or any framework.

- **`PlanStore`** -- read/write interface for plan metadata, files, steps,
  and timeline events.
- **`PlanLifecycleService`** -- stage transitions (idea -> shaping -> built ->
  executing -> done).
- **`PlanStepService`** -- start, complete, add, move, remove steps.
- **`PlanStatusService`** -- read and regenerate plan status summaries.
- **`PlanShapingService`** -- manage approaches and approach selection.

### Services (`src/services/`)

Stateless functions that implement domain operations. Each service works
against the contracts above or directly against `@planvokter/riotplan` for
directory-based plan operations that haven't been abstracted yet.

- **lifecycle** -- SQLite stage transitions with timeline logging.
- **steps** -- directory-based step start/complete/add/remove/move with
  STATUS.md regeneration.
- **status** -- read a status snapshot from a SQLite plan.
- **idea** -- append bullets to IDEA.md sections inside a SQLite plan.
- **build** -- resolve project root for plan generation context.

### Adapters (`src/adapters/`)

- **`SqlitePlanStore`** -- implements `PlanStore` using
  `@planvokter/riotplan-format`'s SQLite provider.

### Composition (`src/composition.ts`)

`resolveCoreServices()` returns a bag of all service instances, acting as the
dependency-injection root for consumers.

## Dependencies

| Package | Role |
|---|---|
| `@planvokter/riotplan` | Types (`PlanStep`, `TaskStatus`, etc.) and directory-based plan operations (`loadPlan`, `generateStatus`, step mutations) |
| `@planvokter/riotplan-format` | SQLite provider (`createSqliteProvider`) |

## Status

Extraction in progress. The code here is real and tested through the
`riotplan` test suite (which still contains the identical source under
`src/core/`). Standalone build, tests, and npm publishing are not yet
configured.
