# @planvokter/riotplan-format

SQLite-based storage format for RiotPlan with dual format support.

This package provides a storage abstraction layer that supports both directory-based and SQLite `.plan` formats for RiotPlan plans.

## Installation

```bash
npm install @planvokter/riotplan-format
```

## Features

- **Dual Format Support**: Store plans as directories (traditional) or SQLite files (portable)
- **Storage Abstraction**: Unified `StorageProvider` interface for both formats
- **Format Detection**: Automatic detection of plan format from path
- **Migration Utilities**: Convert plans between formats with validation
- **Markdown Rendering**: Export plans to markdown format
- **Type-Safe**: Full TypeScript support with comprehensive types

## Usage

### Creating a SQLite Plan

```typescript
import { SqliteStorageProvider } from '@planvokter/riotplan-format';

const provider = new SqliteStorageProvider('./my-plan.plan');

await provider.initialize({
    id: 'my-plan',
    name: 'My Plan',
    description: 'A sample plan',
    stage: 'idea',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 1,
});

// Add a step
await provider.addStep({
    number: 1,
    code: 'step-1',
    title: 'First Step',
    status: 'pending',
    content: '# First Step\n\nDescription here.',
});

// Close when done
await provider.close();
```

### Using the Storage Factory

```typescript
import { createStorageFactory, createProvider } from '@planvokter/riotplan-format';

// Create a factory with custom config
const factory = createStorageFactory({
    defaultFormat: 'sqlite',
    sqlite: {
        extension: '.plan',
        walMode: true,
    },
});

// Create a provider based on path
const provider = factory.createProvider('./my-plan.plan');

// Or use the convenience function
const provider2 = createProvider('./another.plan', { format: 'sqlite' });
```

### Format Detection

```typescript
import { detectPlanFormat, inferFormatFromPath } from '@planvokter/riotplan-format';

// Detect format of existing plan
const format = detectPlanFormat('./my-plan'); // 'directory' | 'sqlite' | 'unknown'

// Infer format from path
const inferred = inferFormatFromPath('./my-plan.plan'); // 'sqlite'
```

### Migration Between Formats

```typescript
import { PlanMigrator, MigrationValidator } from '@planvokter/riotplan-format';

const migrator = new PlanMigrator();

// Migrate from source to target
const result = await migrator.migrate(
    sourcePath,
    targetPath,
    sourceProvider,
    targetProvider,
    {
        keepSource: true,
        validate: true,
        onProgress: (progress) => {
            console.log(`${progress.phase}: ${progress.percentage}%`);
        },
    }
);

if (result.success) {
    console.log(`Migrated ${result.stats.stepsConverted} steps`);
}

// Validate migration
const validator = new MigrationValidator();
const validation = await validator.validate(sourceProvider, targetProvider);
```

### Rendering to Markdown

```typescript
import { renderPlanToMarkdown } from '@planvokter/riotplan-format';

const rendered = await renderPlanToMarkdown(provider, {
    includeEvidence: true,
    includeFeedback: true,
    includeSourceInfo: true,
});

// rendered.files: Map<string, string> - SUMMARY.md, STATUS.md, etc.
// rendered.steps: Map<string, string> - 01-step.md, 02-step.md, etc.
// rendered.evidence: Map<string, string> - evidence files
// rendered.feedback: Map<string, string> - feedback files
```

## API Reference

### Types

- `PlanMetadata` - Plan metadata (id, name, stage, timestamps)
- `PlanStep` - Step definition (number, title, status, content)
- `PlanFile` - File content (type, filename, content)
- `TimelineEvent` - Timeline event (type, timestamp, data)
- `EvidenceRecord` - Evidence record (description, source, content)
- `FeedbackRecord` - Feedback record (title, content, participants)
- `Checkpoint` - Checkpoint for state snapshots
- `StorageFormat` - `'directory' | 'sqlite'`

### Storage Providers

- `StorageProvider` - Interface for storage operations
- `SqliteStorageProvider` - SQLite implementation
- `DirectoryStorageProvider` - Directory implementation (skeleton)

### Configuration

- `FormatConfig` - Format selection configuration
- `SqliteConfig` - SQLite-specific options
- `DirectoryConfig` - Directory-specific options
- `mergeFormatConfig()` - Merge user config with defaults

### Utilities

- `detectPlanFormat()` - Detect format of existing plan
- `inferFormatFromPath()` - Infer format from path
- `validatePlanPath()` - Validate path for format
- `ensureFormatExtension()` - Add correct extension

### Migration

- `PlanMigrator` - Migrate plans between formats
- `MigrationValidator` - Validate migration fidelity
- `generateTargetPath()` - Generate target path for migration
- `inferTargetFormat()` - Infer opposite format

### Rendering

- `renderPlanToMarkdown()` - Render plan to markdown files

## Directory Format Structure

```
my-plan/
├── SUMMARY.md          # Plan overview
├── STATUS.md           # Current status and progress
├── IDEA.md             # Original idea (optional)
├── SHAPING.md          # Shaping notes (optional)
├── EXECUTION_PLAN.md   # Execution strategy (optional)
├── plan/
│   ├── 01-step-one.md
│   ├── 02-step-two.md
│   └── ...
├── evidence/
│   └── *.md
├── feedback/
│   └── *.md
├── reflections/
│   └── *.md
└── .history/
    ├── timeline.json
    └── checkpoints/
        └── *.json
```

## SQLite Schema

The SQLite format uses a normalized schema with tables for:

- `plans` - Plan metadata
- `plan_steps` - Step definitions
- `plan_files` - File contents
- `timeline_events` - Timeline events
- `evidence_records` - Evidence records
- `feedback_records` - Feedback records
- `checkpoints` - State snapshots
- `step_reflections` - Step reflections

Schema version tracking enables future migrations.

## License

MIT
