# MCP Tools

Complete reference for all MCP tools available in RiotPlan.

## Storage Modes

RiotPlan MCP supports two server-side storage modes:

- **Default local mode:** file-based SQLite (`.plan`) under server-managed plan directories.
- **Optional GCS mode:** enabled via server configuration (`cloud.enabled`) with separate buckets:
  - `cloud.planBucket` for plan files
  - `cloud.contextBucket` for context data

Clients do not choose storage locations through tool arguments.

## Plan Management Tools

### riotplan_plan

Manage plans with a single action-based tool.

Plan storage location is server-managed and not client-configurable.

**Parameters:**
- `action` (required) - One of `create | switch | move | rename`
- `planId` (required for `switch | move | rename`) - Plan identifier (id/uuid/filename/path)
- `target` (required for `move`) - One of `active | done | hold`
- `name` (required for `rename`, optional for `create`) - Human-readable plan name
- `code` (required for `create`) - Plan identifier (e.g., "auth-system")
- `description` (required for `create`) - What you want to accomplish
- `steps` (optional for `create`) - Number of steps to generate
- `direct` (optional for `create`) - Skip analysis phase
- `provider` (optional for `create`) - AI provider (anthropic, openai, gemini)
- `model` (optional for `create`) - Specific model
- `noAi` (optional for `create`) - Use templates only

**Example:**

```typescript
riotplan_plan({
  action: "create",
  code: "user-auth",
  description: "Implement user authentication with JWT tokens",
  steps: 6,
  provider: "anthropic"
})
```

```typescript
riotplan_plan({
  action: "rename",
  planId: "user-auth",
  name: "User Authentication Refresh"
})
```

### riotplan_status

Show current plan status including progress, current step, blockers, and issues.

**Parameters:**
- `path` (optional) - Plan directory (default: current)
- `verbose` (optional) - Include step details

**Returns:**
- Plan status (pending, in_progress, completed)
- Progress percentage
- Current step
- Blockers and issues

**Example:**

```typescript
riotplan_status({ path: "./my-plan", verbose: true })
```

### riotplan_validate

Validate plan structure and files.

**Parameters:**
- `path` (optional) - Plan directory (default: current)
- `fix` (optional) - Attempt to fix issues

**Checks:**
- Required files exist
- STATUS.md is valid
- Step numbering is correct
- No circular dependencies

**Example:**

```typescript
riotplan_validate({ path: "./my-plan", fix: true })
```

### riotplan_generate

Generate plan content from an existing prompt file.

**Parameters:**
- `path` (optional) - Plan directory (default: current)
- `steps` (optional) - Number of steps
- `provider` (optional) - AI provider
- `model` (optional) - Specific model

**Example:**

```typescript
riotplan_generate({
  path: "./my-plan",
  steps: 8,
  provider: "anthropic"
})
```

## Step Management Tools

### riotplan_step

Unified step mutation tool. Use `action` to select behavior.

**Actions:**
- `start` - mark a step as started
- `complete` - mark a step as completed
- `add` - add a new step
- `remove` - remove a step
- `move` - reorder a step

**Common Parameters:**
- `action` (required) - One of `start|complete|add|remove|move`
- `planId` (optional) - Plan identifier (defaults to current context)

**Action-Specific Parameters:**
- `step` (required for `start|complete|remove`)
- `force`, `skipVerification` (optional for `complete`)
- `title`, `number`, `after` (for `add`)
- `from`, `to` (for `move`)

**Examples:**

```typescript
riotplan_step({ action: "start", planId: "./my-plan", step: 3 })
riotplan_step({ action: "complete", planId: "./my-plan", step: 3 })
riotplan_step({ action: "add", planId: "./my-plan", title: "Security Audit", after: 5 })
riotplan_step({ action: "remove", planId: "./my-plan", step: 7 })
riotplan_step({ action: "move", planId: "./my-plan", from: 5, to: 3 })
```

## Idea Stage Tools

### riotplan_idea

Create a new SQLite-backed idea plan without commitment. Starts in the `idea` stage and returns sqlite storage metadata (`planId`, `planPath`, `storage`).

Plan storage location is server-managed and not client-configurable.

**Parameters:**
- `code` (required) - Idea identifier
- `description` (required) - What you want to explore

**Example:**

```typescript
riotplan_idea({
  code: "new-feature",
  description: "Explore adding real-time collaboration features"
})
```

### riotplan_idea

Add a note to an idea. Capture thoughts and observations during exploration.

**Parameters:**
- `note` (required) - Note content
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea({
  note: "Users have been requesting this feature for months"
})
```

### riotplan_idea

Add a constraint to an idea. Document limitations and requirements.

**Parameters:**
- `constraint` (required) - Constraint description
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea({
  constraint: "Must work with existing authentication system"
})
```

### riotplan_idea

Add a question to an idea. Raise uncertainties that need resolution.

**Parameters:**
- `question` (required) - Question text
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea({
  question: "How will this affect database performance?"
})
```

### riotplan_idea

Add evidence to an idea. Attach supporting materials like diagrams, documents, or examples.

**Parameters:**
- `evidencePath` (required) - Path to evidence file
- `description` (required) - Evidence description
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea({
  evidencePath: "./mockups/collaboration-ui.png",
  description: "UI mockup for collaboration features"
})
```

### riotplan_evidence

Unified structured evidence tool. Use `action` to select behavior.

**Actions:**
- `add` - create evidence record
- `edit` - update an existing record
- `delete` - remove a record (requires confirm=true)

**Common Parameters:**
- `action` (required) - One of `add|edit|delete`
- `planId` (required)

**Action-Specific Parameters:**
- `add`: `title`, `summary`, `content`, optional `sources`, `referenceSources`, `tags`, `createdBy`, `idempotencyKey`
- `edit`: `evidenceRef` + `patch`
- `delete`: `evidenceRef` + `confirm: true`

**Example:**

```typescript
riotplan_evidence({
  action: "add",
  planId: "auth-refresh-flow",
  title: "Cross-project implementation reference",
  summary: "Linked implementation and review discussion",
  content: "Captured references for follow-up validation."
})

riotplan_evidence({
  action: "edit",
  planId: "auth-refresh-flow",
  evidenceRef: { evidenceId: "ev_0123abcd4567ef89" },
  patch: { summary: "Updated findings after re-validation" }
})

riotplan_evidence({
  action: "delete",
  planId: "auth-refresh-flow",
  evidenceRef: { file: "evidence/2026-02-23-token-rotation-0123abcd.json" },
  confirm: true
})
```

### riotplan_idea

Add raw narrative content to the timeline. Capture conversational context and thinking-out-loud.

**Parameters:**
- `content` (required) - Narrative content
- `path` (optional) - Idea directory (default: current)
- `source` (optional) - Source type (typing, voice, paste, import)
- `context` (optional) - Additional context
- `speaker` (optional) - Speaker identifier

**Example:**

```typescript
riotplan_idea({
  content: "Had a conversation with the team about real-time sync. They're concerned about latency but excited about the possibilities.",
  source: "typing"
})
```

### riotplan_idea

Kill an idea. Abandon the idea with a reason, preserving the learning.

**Parameters:**
- `reason` (required) - Why the idea is being killed
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea({
  reason: "Too complex for current sprint, revisit in Q3"
})
```

## Lifecycle Tools

### riotplan_transition

Move between lifecycle stages (forward or backward). Updates LIFECYCLE.md and logs transition to timeline.

**Parameters:**
- `stage` (required) - Target stage (idea, shaping, built, executing, completed, cancelled)
- `reason` (required) - Reason for transitioning
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_transition({
  stage: "executing",
  reason: "Plan approved, starting implementation"
})
```

**Notes:**
- Allows any transitions without validation
- In caller-side build workflows, call this after `riotplan_build_write_*` operations complete

### riotplan_build

Prepare caller-side generation instructions from idea/shaping artifacts.

**Parameters:**
- `path` (optional) - Idea/shaping directory (default: current)
- `description` (optional) - Plan description (defaults to IDEA.md content)
- `steps` (optional) - Number of steps to generate
- `includeCodebaseContext` (optional) - Include project-root prompting hints (default: true)

**Returns:**
- `generationInstructions.systemPrompt` - Canonical planner system prompt
- `generationInstructions.userPrompt` - Artifact-grounded user prompt
- `generationInstructions.responseSchema` - Required JSON schema for generated plan
- `generationContext` - Structured inputs used to construct the prompt
- `contextCoverage` - Coverage report of all loaded plan artifacts
- `missingContext` - Required/recommended gaps detected before generation
- `inclusionProof` - SHA-256 hashes for prompt and included artifacts
- `writeProtocol` - Required write tools + sequence for persisting artifacts
- `validationProtocol` - Required plan shape and file-path normalization rules

**Important:**
- `riotplan_build` does **not** run AI generation
- `riotplan_build` does **not** write files
- `riotplan_build` does **not** transition lifecycle stage
- `riotplan_build_write_*` calls require `validationStamp` from `riotplan_build_validate_plan`

**Example:**

```typescript
const prep = riotplan_build({ path: "./my-idea", steps: 6 })
// caller LLM generates JSON with prep.generationInstructions
```

**Notes:**
- Only works from idea or shaping stages
- Use `riotplan_build_write_artifact` and `riotplan_build_write_step` to persist caller-generated output
- Call `riotplan_transition({ stage: "built", ... })` only after writes complete

### riotplan_build_write_artifact

Persist a caller-generated build artifact.

**Parameters:**
- `planId` (optional) - Plan identifier/path (defaults to current context)
- `type` (required) - `summary` | `execution_plan` | `status` | `provenance`
- `content` (required) - Full markdown content
- `validationStamp` (required) - Stamp returned by `riotplan_build_validate_plan`

**Example:**

```typescript
riotplan_build_write_artifact({
  planId: "./my-idea",
  type: "summary",
  content: "# Summary\n\n..."
})
```

### riotplan_build_write_step

Persist a caller-generated step file.

**Parameters:**
- `planId` (optional) - Plan identifier/path (defaults to current context)
- `step` (required) - Step number
- `title` (required) - Step title (used for file slug/code)
- `content` (required) - Full step markdown content
- `validationStamp` (required) - Stamp returned by `riotplan_build_validate_plan`
- `clearExisting` (optional) - Clear existing step storage before writing this step (recommended only on first step)

**Example:**

```typescript
riotplan_build_write_step({
  planId: "./my-idea",
  step: 1,
  title: "Initialize schema",
  content: "# Step 01: Initialize schema\n\n...",
  clearExisting: true
})
```

### riotplan_build_validate_plan

Validate caller-generated plan JSON against full plan context (constraints, selected approach, evidence) and issue a write gate stamp.

**Parameters:**
- `planId` (optional) - Plan identifier/path (defaults to current context)
- `generatedPlan` (required) - JSON produced from `riotplan_build` generation instructions

**Returns:**
- `validationStamp` - Required by `riotplan_build_write_artifact` and `riotplan_build_write_step`
- `checked` - Coverage checks performed

**Example:**

```typescript
const validation = riotplan_build_validate_plan({
  planId: "./my-idea",
  generatedPlan
})
const stamp = validation.validationStamp
```

## Shaping Stage Tools

### riotplan_shaping

Start shaping an idea. Move from Idea to Shaping stage to explore approaches.

**Parameters:**
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_shaping({ path: "./new-feature" })
```

### riotplan_shaping

Add an approach to consider. Propose a way to solve the problem with explicit tradeoffs.

**Parameters:**
- `name` (required) - Approach name
- `description` (required) - Approach description
- `tradeoffs` (required) - Array of tradeoffs
- `assumptions` (optional) - Array of assumptions
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping({
  name: "WebSocket-based sync",
  description: "Use WebSockets for real-time bidirectional communication",
  tradeoffs: [
    "Pro: Low latency, true real-time updates",
    "Con: More complex server infrastructure",
    "Con: Requires persistent connections"
  ],
  assumptions: [
    "Users have stable internet connections",
    "Server can handle many concurrent connections"
  ]
})
```

### riotplan_shaping

Add feedback on an approach. Provide observations, concerns, or suggestions.

**Parameters:**
- `approach` (required) - Approach name
- `feedback` (required) - Feedback content
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping({
  approach: "WebSocket-based sync",
  feedback: "Need to consider fallback for users behind restrictive firewalls"
})
```

### riotplan_shaping

Add evidence for an approach. Attach supporting materials that inform the decision.

**Parameters:**
- `approach` (required) - Approach name
- `evidencePath` (required) - Path to evidence file
- `description` (required) - Evidence description
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping({
  approach: "WebSocket-based sync",
  evidencePath: "./benchmarks/websocket-performance.md",
  description: "Performance benchmarks showing 50ms average latency"
})
```

### riotplan_shaping

Compare all approaches. Generate a side-by-side comparison of tradeoffs.

**Parameters:**
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping({ path: "./new-feature" })
```

### riotplan_shaping

Select an approach. Choose the best approach and move to Built stage.

**Parameters:**
- `approach` (required) - Approach name to select
- `reason` (required) - Why this approach was chosen
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping({
  approach: "WebSocket-based sync",
  reason: "Best balance of performance and complexity. Team has experience with WebSockets."
})
```

## Checkpoint Tools

### riotplan_checkpoint

Create a checkpoint. Save a snapshot of the current state with prompt context.

**Parameters:**
- `name` (required) - Checkpoint name
- `message` (required) - Checkpoint message
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_checkpoint({
  name: "before-refactor",
  message: "Saving state before major refactoring"
})
```

### riotplan_checkpoint

List all checkpoints. Show all saved checkpoints with timestamps.

**Parameters:**
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_checkpoint({ path: "./my-plan" })
```

### riotplan_checkpoint

Show checkpoint details. Display the full checkpoint snapshot and prompt context.

**Parameters:**
- `checkpoint` (required) - Checkpoint name
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_checkpoint({
  checkpoint: "before-refactor",
  path: "./my-plan"
})
```

### riotplan_checkpoint

Restore a checkpoint. Revert to a previous state.

**Parameters:**
- `checkpoint` (required) - Checkpoint name
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_checkpoint({
  checkpoint: "before-refactor",
  path: "./my-plan"
})
```

## History Tools

### riotplan_history_show

Show ideation history. Display the complete timeline of events.

**Parameters:**
- `path` (optional) - Plan directory (default: current)
- `limit` (optional) - Maximum number of events to show
- `sinceCheckpoint` (optional) - Show events since this checkpoint

**Example:**

```typescript
riotplan_history_show({
  path: "./my-plan",
  limit: 50,
  sinceCheckpoint: "before-refactor"
})
```

## Next Steps

- Learn about [MCP Resources](mcp-resources) - Read-only data access
- Explore [MCP Prompts](mcp-prompts) - Workflow templates
- Read [MCP Overview](mcp-overview) - Getting started
