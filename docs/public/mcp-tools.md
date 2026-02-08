# MCP Tools

Complete reference for all MCP tools available in RiotPlan.

## Plan Management Tools

### riotplan_create

Create a new plan with AI-generated steps.

**Parameters:**
- `code` (required) - Plan identifier (e.g., "auth-system")
- `description` (required) - What you want to accomplish
- `name` (optional) - Human-readable name
- `directory` (optional) - Parent directory
- `steps` (optional) - Number of steps to generate
- `direct` (optional) - Skip analysis phase
- `provider` (optional) - AI provider (anthropic, openai, gemini)
- `model` (optional) - Specific model
- `noAi` (optional) - Use templates only

**Example:**

```typescript
riotplan_create({
  code: "user-auth",
  description: "Implement user authentication with JWT tokens",
  steps: 6,
  provider: "anthropic"
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

### riotplan_step_list

List all steps in a plan with their status.

**Parameters:**
- `path` (optional) - Plan directory (default: current)
- `pending` (optional) - Show only pending steps
- `all` (optional) - Include completed steps

**Returns:**
Array of steps with number, title, status, and file.

**Example:**

```typescript
riotplan_step_list({ path: "./my-plan", pending: true })
```

### riotplan_step_start

Mark a step as started. Updates STATUS.md to reflect in-progress status.

**Parameters:**
- `path` (optional) - Plan directory (default: current)
- `step` (required) - Step number

**Example:**

```typescript
riotplan_step_start({ path: "./my-plan", step: 3 })
```

### riotplan_step_complete

Mark a step as completed. Updates STATUS.md and advances to next step.

**Parameters:**
- `path` (optional) - Plan directory (default: current)
- `step` (required) - Step number

**Example:**

```typescript
riotplan_step_complete({ path: "./my-plan", step: 3 })
```

### riotplan_step_add

Add a new step to the plan.

**Parameters:**
- `path` (optional) - Plan directory (default: current)
- `title` (required) - Step title
- `number` (optional) - Position to insert
- `after` (optional) - Insert after this step

**Example:**

```typescript
riotplan_step_add({
  path: "./my-plan",
  title: "Security Audit",
  after: 5
})
```

## Idea Stage Tools

### riotplan_idea_create

Create a new idea without commitment. Start exploring a concept in the Idea stage.

**Parameters:**
- `code` (required) - Idea identifier
- `description` (required) - What you want to explore
- `directory` (optional) - Parent directory

**Example:**

```typescript
riotplan_idea_create({
  code: "new-feature",
  description: "Explore adding real-time collaboration features"
})
```

### riotplan_idea_add_note

Add a note to an idea. Capture thoughts and observations during exploration.

**Parameters:**
- `note` (required) - Note content
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea_add_note({
  note: "Users have been requesting this feature for months"
})
```

### riotplan_idea_add_constraint

Add a constraint to an idea. Document limitations and requirements.

**Parameters:**
- `constraint` (required) - Constraint description
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea_add_constraint({
  constraint: "Must work with existing authentication system"
})
```

### riotplan_idea_add_question

Add a question to an idea. Raise uncertainties that need resolution.

**Parameters:**
- `question` (required) - Question text
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea_add_question({
  question: "How will this affect database performance?"
})
```

### riotplan_idea_add_evidence

Add evidence to an idea. Attach supporting materials like diagrams, documents, or examples.

**Parameters:**
- `evidencePath` (required) - Path to evidence file
- `description` (required) - Evidence description
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea_add_evidence({
  evidencePath: "./mockups/collaboration-ui.png",
  description: "UI mockup for collaboration features"
})
```

### riotplan_idea_add_narrative

Add raw narrative content to the timeline. Capture conversational context and thinking-out-loud.

**Parameters:**
- `content` (required) - Narrative content
- `path` (optional) - Idea directory (default: current)
- `source` (optional) - Source type (typing, voice, paste, import)
- `context` (optional) - Additional context
- `speaker` (optional) - Speaker identifier

**Example:**

```typescript
riotplan_idea_add_narrative({
  content: "Had a conversation with the team about real-time sync. They're concerned about latency but excited about the possibilities.",
  source: "typing"
})
```

### riotplan_idea_kill

Kill an idea. Abandon the idea with a reason, preserving the learning.

**Parameters:**
- `reason` (required) - Why the idea is being killed
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_idea_kill({
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
- Use `riotplan_build` instead to transition from idea/shaping to built with plan generation

### riotplan_build

Build plan files in existing idea/shaping directory, transitioning to built stage. Uses AI generation to create detailed plan from idea and shaping content.

**Parameters:**
- `path` (optional) - Idea/shaping directory (default: current)
- `description` (optional) - Plan description (defaults to IDEA.md content)
- `steps` (optional) - Number of steps to generate
- `provider` (optional) - AI provider (anthropic, openai, gemini)
- `model` (optional) - Specific model

**Creates:**
- SUMMARY.md - Plan overview
- EXECUTION_PLAN.md - Detailed execution strategy
- STATUS.md - Progress tracking
- plan/ directory - Step files

**Preserves:**
- IDEA.md - Original idea content
- SHAPING.md - Approach exploration
- .history/ - Timeline and prompts
- .evidence/ - Supporting materials

**Example:**

```typescript
riotplan_build({
  path: "./my-idea",
  steps: 6,
  provider: "anthropic"
})
```

**Notes:**
- Only works from idea or shaping stages
- Automatically transitions to "built" stage
- Requires AI provider to be installed and configured
- This is the recommended way to create plans from ideas/shaping

## Shaping Stage Tools

### riotplan_shaping_start

Start shaping an idea. Move from Idea to Shaping stage to explore approaches.

**Parameters:**
- `path` (optional) - Idea directory (default: current)

**Example:**

```typescript
riotplan_shaping_start({ path: "./new-feature" })
```

### riotplan_shaping_add_approach

Add an approach to consider. Propose a way to solve the problem with explicit tradeoffs.

**Parameters:**
- `name` (required) - Approach name
- `description` (required) - Approach description
- `tradeoffs` (required) - Array of tradeoffs
- `assumptions` (optional) - Array of assumptions
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping_add_approach({
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

### riotplan_shaping_add_feedback

Add feedback on an approach. Provide observations, concerns, or suggestions.

**Parameters:**
- `approach` (required) - Approach name
- `feedback` (required) - Feedback content
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping_add_feedback({
  approach: "WebSocket-based sync",
  feedback: "Need to consider fallback for users behind restrictive firewalls"
})
```

### riotplan_shaping_add_evidence

Add evidence for an approach. Attach supporting materials that inform the decision.

**Parameters:**
- `approach` (required) - Approach name
- `evidencePath` (required) - Path to evidence file
- `description` (required) - Evidence description
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping_add_evidence({
  approach: "WebSocket-based sync",
  evidencePath: "./benchmarks/websocket-performance.md",
  description: "Performance benchmarks showing 50ms average latency"
})
```

### riotplan_shaping_compare

Compare all approaches. Generate a side-by-side comparison of tradeoffs.

**Parameters:**
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping_compare({ path: "./new-feature" })
```

### riotplan_shaping_select

Select an approach. Choose the best approach and move to Built stage.

**Parameters:**
- `approach` (required) - Approach name to select
- `reason` (required) - Why this approach was chosen
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_shaping_select({
  approach: "WebSocket-based sync",
  reason: "Best balance of performance and complexity. Team has experience with WebSockets."
})
```

## Checkpoint Tools

### riotplan_checkpoint_create

Create a checkpoint. Save a snapshot of the current state with prompt context.

**Parameters:**
- `name` (required) - Checkpoint name
- `message` (required) - Checkpoint message
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_checkpoint_create({
  name: "before-refactor",
  message: "Saving state before major refactoring"
})
```

### riotplan_checkpoint_list

List all checkpoints. Show all saved checkpoints with timestamps.

**Parameters:**
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_checkpoint_list({ path: "./my-plan" })
```

### riotplan_checkpoint_show

Show checkpoint details. Display the full checkpoint snapshot and prompt context.

**Parameters:**
- `checkpoint` (required) - Checkpoint name
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_checkpoint_show({
  checkpoint: "before-refactor",
  path: "./my-plan"
})
```

### riotplan_checkpoint_restore

Restore a checkpoint. Revert to a previous state.

**Parameters:**
- `checkpoint` (required) - Checkpoint name
- `path` (optional) - Plan directory (default: current)

**Example:**

```typescript
riotplan_checkpoint_restore({
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
