# MCP Resources

Complete reference for all MCP resources available in RiotPlan. Resources provide read-only access to plan data.

For caller-side build workflows, use resources to read context and use MCP tools (`riotplan_build`, `riotplan_build_write_*`, `riotplan_transition`) to generate and persist plan artifacts.

## Plan Execution Resources

### riotplan://plan/{path}

Plan metadata and structure.

**Returns:**
- Plan code and name
- Metadata (created date, author, etc.)
- Optional `metadata.projectPath` when set in `plan.yaml`
- Current state
- List of steps

**Example:**

```typescript
const plan = await fetch("riotplan://plan/my-feature");
console.log(plan.code);        // "my-feature"
console.log(plan.name);        // "My Feature Implementation"
console.log(plan.state.status); // "in_progress"
```

### riotplan://status/{path}

Current status and progress.

**Returns:**
- Status (pending, in_progress, completed, blocked, failed)
- Current step number
- Progress (completed/total/percentage)
- Blockers and issues
- Timestamps

**Example:**

```typescript
const status = await fetch("riotplan://status/my-feature");
console.log(status.status);           // "in_progress"
console.log(status.progress);         // { completed: 3, total: 8, percentage: 37.5 }
console.log(status.currentStep);      // 4
console.log(status.blockers);         // []
console.log(status.issues);           // [...]
```

### riotplan://steps/{path}

List of all steps.

**Returns:**
Array of steps with:
- Step number
- Title
- Status
- Filename
- Started/completed timestamps

**Example:**

```typescript
const steps = await fetch("riotplan://steps/my-feature");
steps.forEach(step => {
  console.log(`${step.number}. ${step.title} - ${step.status}`);
});
```

### riotplan://step/{path}?number={number}

Specific step with full content.

**Returns:**
- Step metadata (number, title, status)
- Full step content (markdown)
- Acceptance criteria
- Testing requirements
- Tasks

**Example:**

```typescript
const step = await fetch("riotplan://step/my-feature?number=3");
console.log(step.title);              // "Implementation"
console.log(step.content);            // Full markdown content
console.log(step.acceptanceCriteria); // [...]
console.log(step.tasks);              // [...]
```

## Ideation Context Resources

### riotplan://idea/{path}

Read IDEA.md file with core concept, constraints, questions, and evidence.

**Returns:**
- Core concept description
- Notes
- Constraints
- Questions
- Evidence list
- Lifecycle stage

**Example:**

```typescript
const idea = await fetch("riotplan://idea/new-feature");
console.log(idea.description);   // Core concept
console.log(idea.notes);          // Array of notes
console.log(idea.constraints);    // Array of constraints
console.log(idea.questions);      // Array of questions
console.log(idea.evidence);       // Array of evidence items
```

### riotplan://timeline/{path}

Read .history/timeline.jsonl with full evolution of thinking.

**Returns:**
Array of timeline events:
- Timestamp
- Event type (note, constraint, question, evidence, narrative, etc.)
- Content
- Metadata

**Example:**

```typescript
const timeline = await fetch("riotplan://timeline/new-feature");
timeline.forEach(event => {
  console.log(`${event.timestamp}: ${event.type}`);
  console.log(event.content);
});
```

### riotplan://prompts/{path}

List all prompt files in .history/prompts/ directory.

**Returns:**
Array of prompt files with:
- Filename
- Timestamp
- Size

**Example:**

```typescript
const prompts = await fetch("riotplan://prompts/new-feature");
prompts.forEach(prompt => {
  console.log(prompt.filename);
});
```

### riotplan://prompt/{path}/{file}

Read a specific prompt file with conversational context.

**Returns:**
- Filename
- Content
- Timestamp
- Metadata

**Example:**

```typescript
const prompt = await fetch("riotplan://prompt/new-feature/001-initial.md");
console.log(prompt.content);
```

### riotplan://evidence/{path}

List all evidence files in evidence/ directory.

**Returns:**
Array of evidence files with:
- Filename
- Description
- Type
- Size

**Example:**

```typescript
const evidence = await fetch("riotplan://evidence/new-feature");
evidence.forEach(item => {
  console.log(`${item.filename}: ${item.description}`);
});
```

### riotplan://evidence-file/{path}/{file}

Read a specific evidence file.

**Returns:**
- Filename
- Content
- Type
- Metadata
- `record.referenceSources` (normalized structured source references when available)
- `record.sources` (compatibility string list mirrored from references)

**Example:**

```typescript
const file = await fetch("riotplan://evidence-file/new-feature/mockup.png");
console.log(file.content); // Base64 encoded for binary files
```

### riotplan://shaping/{path}

Read SHAPING.md with approaches, tradeoffs, and selected approach.

**Returns:**
- Approaches array
  - Name
  - Description
  - Tradeoffs
  - Assumptions
  - Feedback
  - Evidence
- Selected approach
- Selection reason

**Example:**

```typescript
const shaping = await fetch("riotplan://shaping/new-feature");
shaping.approaches.forEach(approach => {
  console.log(`${approach.name}:`);
  console.log(`  ${approach.description}`);
  approach.tradeoffs.forEach(t => console.log(`  - ${t}`));
});
console.log(`Selected: ${shaping.selected}`);
```

## Checkpoint Resources

### riotplan://checkpoints/{path}

List all checkpoints in .history/checkpoints/ directory.

**Returns:**
Array of checkpoints with:
- Name
- Message
- Timestamp
- Files included

**Example:**

```typescript
const checkpoints = await fetch("riotplan://checkpoints/my-feature");
checkpoints.forEach(cp => {
  console.log(`${cp.name} (${cp.timestamp}): ${cp.message}`);
});
```

### riotplan://checkpoint/{path}/{name}

Read a specific checkpoint with snapshot and prompt context.

**Returns:**
- Checkpoint name
- Message
- Timestamp
- Snapshot data
  - IDEA.md content
  - SHAPING.md content (if exists)
  - Timeline state
- Prompt context

**Example:**

```typescript
const checkpoint = await fetch("riotplan://checkpoint/my-feature/before-refactor");
console.log(checkpoint.message);
console.log(checkpoint.snapshot.idea);
console.log(checkpoint.promptContext);
```

## Usage Patterns

### Reading Plan Status

```typescript
// Get current status
const status = await fetch("riotplan://status/my-plan");

if (status.status === "in_progress") {
  // Get current step details
  const step = await fetch(`riotplan://step/my-plan?number=${status.currentStep}`);
  console.log(`Working on: ${step.title}`);
  console.log(`Tasks remaining: ${step.tasks.filter(t => !t.completed).length}`);
}
```

### Exploring Idea History

```typescript
// Get idea details
const idea = await fetch("riotplan://idea/new-feature");

// Get full timeline
const timeline = await fetch("riotplan://timeline/new-feature");

// Get all evidence
const evidence = await fetch("riotplan://evidence/new-feature");

console.log(`Idea: ${idea.description}`);
console.log(`Timeline events: ${timeline.length}`);
console.log(`Evidence items: ${evidence.length}`);
```

### Reviewing Shaping Decisions

```typescript
// Get shaping data
const shaping = await fetch("riotplan://shaping/new-feature");

console.log(`Approaches considered: ${shaping.approaches.length}`);

shaping.approaches.forEach(approach => {
  console.log(`\n${approach.name}:`);
  console.log(`Tradeoffs: ${approach.tradeoffs.length}`);
  console.log(`Feedback items: ${approach.feedback.length}`);
});

console.log(`\nSelected: ${shaping.selected}`);
console.log(`Reason: ${shaping.selectionReason}`);
```

### Checkpoint Recovery

```typescript
// List all checkpoints
const checkpoints = await fetch("riotplan://checkpoints/my-plan");

// Find the most recent checkpoint
const latest = checkpoints.sort((a, b) => 
  new Date(b.timestamp) - new Date(a.timestamp)
)[0];

// Get checkpoint details
const checkpoint = await fetch(`riotplan://checkpoint/my-plan/${latest.name}`);

console.log(`Latest checkpoint: ${checkpoint.name}`);
console.log(`Created: ${checkpoint.timestamp}`);
console.log(`Message: ${checkpoint.message}`);
```

## Resource URIs

All resource URIs follow the pattern:

```
riotplan://{type}/{path}[/{identifier}]
```

Where:
- `{type}` - Resource type (plan, status, steps, step, idea, etc.)
- `{path}` - Plan or idea directory path
- Query/path identifiers - Optional resource-specific selectors (for example `?number=3` for `step`)

## Notes

- All resources are read-only
- Resources return JSON data
- Binary files (images, etc.) are base64 encoded
- Timestamps are in ISO 8601 format
- Paths can be relative or absolute

## Next Steps

- Learn about [MCP Tools](mcp-tools) - Callable functions
- Explore [MCP Prompts](mcp-prompts) - Workflow templates
- Read [MCP Overview](mcp-overview) - Getting started
