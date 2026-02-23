# RiotPlan Data Model

## Overview

This document defines the data model for RiotPlan's narrative evolution system, including timeline events, checkpoints, and evidence integration. The design maintains backward compatibility with existing timeline readers while adding support for free-form narrative capture and lightweight checkpointing.

## Core Principles

1. **Hybrid Timeline**: Mix structured events (notes, constraints, questions) with raw narrative chunks in a single chronological timeline
2. **Append-Only Log**: Timeline is immutable - events are never modified, only appended
3. **Human-Readable**: All data stored as JSONL (timeline) and Markdown (documents)
4. **Lightweight Checkpoints**: Simple markers for stopping points and recovery, not full Git-like versioning
5. **Evidence First-Class**: Evidence (documents, data, images) integrated as timeline events with model-assisted gathering

## Storage Structure

```
plan-directory/
├── .history/
│   ├── timeline.jsonl           # Append-only event log
│   ├── checkpoints/
│   │   ├── {name}.json          # Checkpoint metadata and snapshot
│   │   └── ...
│   └── prompts/
│       ├── {name}.md            # Prompt context for each checkpoint
│       └── ...
├── evidence/
│   ├── evidence-{id}.md         # Inline evidence (transcripts, research, etc.)
│   └── ...
├── IDEA.md                      # Current idea state (Idea stage)
├── SHAPING.md                   # Approaches and feedback (Shaping stage)
├── LIFECYCLE.md                 # Stage tracking
└── ...
```

## Timeline Event Types

### Base Event Structure

All timeline events follow this structure:

```typescript
interface TimelineEvent {
  timestamp: string;      // ISO 8601 timestamp
  type: string;           // Event type identifier
  data: Record<string, any>;  // Event-specific data
}
```

### Structured Event Types

These are the existing structured event types that capture specific kinds of information:

#### `idea_created`

```typescript
{
  timestamp: "2026-01-29T07:43:08.668Z",
  type: "idea_created",
  data: {
    code: string;         // Idea code/slug (kebab-case)
    description: string;  // Initial description
  }
}
```

#### `note_added`

```typescript
{
  timestamp: "2026-01-29T07:45:30.547Z",
  type: "note_added",
  data: {
    note: string;         // Free-form observation or thought
  }
}
```

#### `constraint_added`

```typescript
{
  timestamp: "2026-01-29T07:52:20.167Z",
  type: "constraint_added",
  data: {
    constraint: string;   // Limitation or requirement
  }
}
```

#### `question_added`

```typescript
{
  timestamp: "2026-01-29T08:02:40.106Z",
  type: "question_added",
  data: {
    question: string;     // Open question needing resolution
  }
}
```

#### `evidence_added`

```typescript
{
  timestamp: "2026-01-29T08:12:07.279Z",
  type: "evidence_added",
  data: {
    evidencePath: string;     // Filesystem path or URL
    description: string;      // What this evidence shows
    gatheringMethod?: string; // "manual" | "model-assisted"
    relevanceScore?: number;  // 0-1 score from model (if model-assisted)
    summary?: string;         // Model-generated summary (if model-assisted)
  }
}
```

#### `shaping_started`

```typescript
{
  timestamp: "2026-01-29T08:13:28.574Z",
  type: "shaping_started",
  data: {}
}
```

#### `approach_added`

```typescript
{
  timestamp: "2026-01-29T08:21:17.200Z",
  type: "approach_added",
  data: {
    name: string;           // Approach name
    description: string;    // How it would work
    tradeoffs: string[];    // Pros and cons
    assumptions?: string[]; // What we're assuming
  }
}
```

#### `feedback_added`

```typescript
{
  timestamp: "2026-01-29T08:18:35.098Z",
  type: "feedback_added",
  data: {
    feedback: string;       // The feedback content
    approach?: string;      // Related approach (if in shaping)
  }
}
```

#### `approach_selected`

```typescript
{
  timestamp: "2026-01-29T08:24:57.553Z",
  type: "approach_selected",
  data: {
    approach: string;       // Selected approach name
    reason: string;         // Why this approach was chosen
  }
}
```

#### `idea_killed`

```typescript
{
  timestamp: "2026-01-29T10:15:42.123Z",
  type: "idea_killed",
  data: {
    reason: string;         // Why the idea was abandoned
  }
}
```

### New Event Types

#### `narrative_chunk`

Captures raw conversational input that doesn't fit structured categories. This preserves the full-fidelity context that structured summaries lose.

```typescript
{
  timestamp: "2026-01-29T15:30:45.123Z",
  type: "narrative_chunk",
  data: {
    content: string;        // Raw user input (paragraph, thoughts, etc.)
    source?: string;        // "typing" | "voice" | "paste" | "import"
    context?: string;       // Optional context about what prompted this
    speaker?: string;       // "user" | "assistant" | participant name
  }
}
```

**Usage**: Narrative chunks are interspersed with structured events in the timeline. They capture the "why" and "how" of thinking that structured events miss.

**Example**:
```json
{
  "timestamp": "2026-01-29T15:30:45.123Z",
  "type": "narrative_chunk",
  "data": {
    "content": "I'm not sure if we should go with Redis or in-memory caching. Redis would be more robust but adds operational complexity. Let me think about this...",
    "source": "typing",
    "speaker": "user"
  }
}
```

#### `checkpoint_created`

Marks a point in time where the user wants to save state. Checkpoints are lightweight markers, not full Git commits.

```typescript
{
  timestamp: "2026-01-29T15:20:12.256Z",
  type: "checkpoint_created",
  data: {
    name: string;           // Checkpoint name (kebab-case)
    message: string;        // Description of what's being checkpointed
    snapshotPath?: string;  // Path to checkpoint snapshot (relative)
    promptPath?: string;    // Path to prompt context (relative)
  }
}
```

**Usage**: Checkpoints provide stopping points and enable recovery from dead ends. Each checkpoint captures:
- Current state of all plan files (IDEA.md, SHAPING.md, etc.)
- Timeline position
- Prompt context for resuming work

**Example**:
```json
{
  "timestamp": "2026-01-29T15:20:12.256Z",
  "type": "checkpoint_created",
  "data": {
    "name": "before-redis-decision",
    "message": "Captured state before deciding on caching strategy",
    "snapshotPath": ".history/checkpoints/before-redis-decision.json",
    "promptPath": ".history/prompts/before-redis-decision.md"
  }
}
```

#### `checkpoint_restored`

Records when a checkpoint was restored, creating an audit trail.

```typescript
{
  timestamp: "2026-01-29T16:45:30.789Z",
  type: "checkpoint_restored",
  data: {
    checkpoint: string;     // Name of restored checkpoint
    restoredFrom: string;   // Timestamp of original checkpoint
  }
}
```

## Checkpoint Storage Format

### Checkpoint Metadata (`{name}.json`)

Each checkpoint is stored as a JSON file in `.history/checkpoints/`:

```typescript
interface CheckpointMetadata {
  name: string;                 // Checkpoint name
  timestamp: string;            // When created (ISO 8601)
  message: string;              // User-provided description
  stage: string;                // Current stage (Idea, Shaping, Built, etc.)
  snapshot: {
    timestamp: string;
    idea?: {
      exists: boolean;
      content?: string;         // Full IDEA.md content
    };
    shaping?: {
      exists: boolean;
      content?: string;         // Full SHAPING.md content
    };
    lifecycle?: {
      exists: boolean;
      content?: string;         // Full LIFECYCLE.md content
    };
  };
  context: {
    filesChanged: string[];     // List of .md files at checkpoint
    eventsSinceLastCheckpoint: number;  // Timeline events since last checkpoint
  };
}
```

### Prompt Context (`{name}.md`)

Each checkpoint includes a Markdown file with full context for resuming work:

```markdown
# Checkpoint: {name}

**Timestamp**: {timestamp}
**Stage**: {stage}
**Message**: {message}

## Current State

{formatted snapshot of IDEA.md, SHAPING.md, etc.}

## Files at This Point

- IDEA.md
- SHAPING.md
- ...

## Recent Timeline

{last 10 timeline events}

---

This checkpoint captures the state of the plan at this moment in time.
You can restore to this checkpoint using: `riotplan_checkpoint({ action: "restore", checkpoint: "{name}" })`
```

## Checkpoint Restoration Strategy

When restoring a checkpoint:

1. **Read checkpoint metadata** from `.history/checkpoints/{name}.json`
2. **Restore files** from snapshot:
   - Overwrite IDEA.md with `snapshot.idea.content` (if exists)
   - Overwrite SHAPING.md with `snapshot.shaping.content` (if exists)
   - Overwrite LIFECYCLE.md with `snapshot.lifecycle.content` (if exists)
3. **Log restoration event** to timeline with `checkpoint_restored` type
4. **Timeline is preserved** - restoration doesn't modify history, just adds a new event

**Important**: Checkpoints don't truncate the timeline. The timeline continues to grow, showing both the original path and the restoration. This provides a complete audit trail.

## Evidence Gathering

Evidence can be gathered in two ways:

### Manual Evidence

User explicitly adds evidence with path and description:

```typescript
{
  timestamp: "2026-01-29T08:12:07.279Z",
  type: "evidence_added",
  data: {
    evidencePath: "/path/to/document.md",
    description: "Example of existing implementation",
    gatheringMethod: "manual"
  }
}
```

### Model-Assisted Evidence

Model searches directories and assesses relevance:

```typescript
{
  timestamp: "2026-01-29T16:30:22.456Z",
  type: "evidence_added",
  data: {
    evidencePath: "/path/to/relevant-code.ts",
    description: "Authentication implementation using JWT",
    gatheringMethod: "model-assisted",
    relevanceScore: 0.87,
    summary: "This file implements JWT-based authentication with refresh tokens..."
  }
}
```

Model-assisted gathering:
1. Model receives request to gather evidence for a topic
2. Model searches specified directories
3. Model reads candidate files and assesses relevance
4. Model adds high-relevance files as evidence with summaries
5. Each addition logged as `evidence_added` event

## Querying the Timeline

The timeline is designed for sequential reading but can be filtered:

### By Event Type

```typescript
const events = await readTimeline(planPath);
const notes = events.filter(e => e.type === 'note_added');
const narratives = events.filter(e => e.type === 'narrative_chunk');
```

### By Time Range

```typescript
const since = new Date('2026-01-29T15:00:00Z');
const recent = events.filter(e => new Date(e.timestamp) >= since);
```

### Since Last Checkpoint

```typescript
const lastCheckpointIndex = events.findLastIndex(e => e.type === 'checkpoint_created');
const sinceCheckpoint = events.slice(lastCheckpointIndex + 1);
```

## Backward Compatibility

The design maintains backward compatibility:

1. **Existing event types unchanged** - All current event types remain the same
2. **Optional new types** - `narrative_chunk` is optional; existing workflows don't require it
3. **Additive changes** - New fields in existing events are optional
4. **Timeline format unchanged** - Still JSONL with same structure
5. **Checkpoint system separate** - Stored in `.history/checkpoints/`, doesn't affect main files

## Design Rationale

### Why Hybrid Timeline?

- **Complete chronology**: See exactly when each piece of thinking happened
- **No artificial separation**: Structured and conversational data coexist naturally
- **Preserves context**: Why a constraint was added is visible in surrounding narrative
- **Easy to understand**: Read top to bottom to see the journey

### Why Lightweight Checkpoints?

- **Low friction**: Quick to create, no complex Git operations
- **Recovery focused**: Designed for "oops, wrong path" scenarios
- **Prompt-friendly**: Checkpoint context designed for AI consumption
- **Audit trail**: Restorations logged, never lose history

### Why Evidence Integration?

- **Grounded decisions**: Ideas backed by real data and documents
- **Model-assisted discovery**: Reduce manual work finding relevant materials
- **First-class support**: Evidence not an afterthought, part of core model

## Future Considerations

### Potential Extensions

1. **Timeline compression**: For very long timelines, provide summarization tools
2. **Branch/merge**: If ideas split, support branching timelines
3. **Cross-plan references**: Link evidence across multiple plans
4. **Timeline visualization**: Generate visual timeline of idea evolution

### Not in Scope

1. **Git integration**: Checkpoints are not Git commits
2. **Collaboration**: Currently single-user focused
3. **Real-time sync**: No live collaboration features
4. **Binary evidence**: Evidence is paths/URLs, not embedded binaries
