# MCP Prompts

Complete reference for all MCP workflow prompts available in RiotPlan. Prompts are pre-built workflow templates that guide you through common tasks.

## What are MCP Prompts?

MCP Prompts are workflow templates that provide step-by-step guidance for common RiotPlan tasks. They combine multiple tools and resources into cohesive workflows.

## Available Prompts

### explore_idea

Explore a new idea collaboratively without premature commitment. Capture thoughts, constraints, questions, and evidence.

**Use when:**
- Starting to explore a new concept
- Not ready to commit to a plan
- Want to gather context and constraints
- Need to document questions and uncertainties

**Arguments:**
- `code` (optional) - Idea identifier (kebab-case, e.g., "real-time-notifications")
- `description` (optional) - Initial concept description

**Workflow:**
1. Create idea directory structure
2. Capture initial concept
3. Add notes and observations
4. Document constraints
5. Raise questions
6. Attach evidence
7. Add narrative context
8. Decide: continue exploring, move to shaping, or kill

**Example:**

```typescript
// Start exploring an idea
explore_idea({
  code: "real-time-collab",
  description: "Add real-time collaboration features"
})
```

**What it does:**
- Creates IDEA.md with your concept
- Sets up .history/timeline.jsonl for tracking
- Guides you through exploration
- Helps capture all relevant context

### shape_approach

Compare different approaches and make decisions before building detailed plans. Surface tradeoffs and gather evidence.

**Use when:**
- Multiple ways to solve a problem
- Need to evaluate tradeoffs
- Want to gather team feedback
- Ready to move from idea to approach

**Arguments:**
- `path` (optional) - Path to idea or shaping directory

**Workflow:**
1. Review idea context
2. Propose approaches
3. Document tradeoffs for each
4. Gather feedback
5. Attach evidence
6. Compare approaches
7. Select best approach
8. Move to plan creation

**Example:**

```typescript
// Start shaping approaches
shape_approach({
  path: "./real-time-collab"
})
```

**What it does:**
- Creates SHAPING.md
- Guides approach documentation
- Facilitates comparison
- Helps make informed decisions

### create_plan

Create a new plan with AI-generated steps for a complex task (use after shaping).

**Use when:**
- Ready to commit to an approach
- Need detailed execution steps
- Want AI to generate actionable plan
- Have clear requirements

**Arguments:**
- `code` (optional) - Plan code/identifier (e.g., "auth-system", "dark-mode")
- `description` (optional) - Detailed description of what you want to accomplish
- `directory` (optional) - Parent directory where the plan should be created (e.g., "./plans")
- `steps` (optional) - Number of steps to generate (AI determines if not specified)

**Workflow:**
1. Gather requirements
2. Choose generation mode (analysis-first or direct)
3. Generate plan with AI
4. Review generated content
5. Validate structure
6. Begin execution

**Example:**

```typescript
// Create a plan
create_plan({
  code: "websocket-sync",
  description: "Implement WebSocket-based real-time sync",
  directory: "./plans",
  steps: 8
})
```

**What it does:**
- Creates plan directory structure
- Generates SUMMARY.md with approach
- Creates EXECUTION_PLAN.md with strategy
- Generates detailed step files
- Sets up STATUS.md for tracking

### develop_plan

Refine a generated plan through conversational feedback. Captures full narrative of plan evolution with checkpoints.

**Use when:**
- Plan needs refinement
- Want to adjust steps
- Need to clarify details
- Iterating on approach

**Arguments:**
- `path` (optional) - Path to the plan directory to develop

**Workflow:**
1. Review current plan
2. Provide feedback
3. Create checkpoints
4. Adjust steps
5. Refine content
6. Validate changes
7. Ready for execution

**Example:**

```typescript
// Refine a plan
develop_plan({
  path: "./plans/websocket-sync"
})
```

**What it does:**
- Guides conversational refinement
- Creates checkpoints automatically
- Tracks all changes
- Preserves full context

### execute_plan

Execute a plan with intelligent state management. Automatically determines next step, guides through tasks, and manages execution state.

**Use when:**
- Ready to start execution
- Want guided step-by-step workflow
- Need automatic status tracking
- Executing complex multi-step plan

**Arguments:**
- `path` (optional) - Path to the plan directory to execute

**Workflow:**
1. **Verify plan structure** - Check if step files exist in `plan/` directory, create them from `EXECUTION_PLAN.md` if missing
2. Check current status
3. Identify next step
4. Read step details
5. **Mark step as started** using `riotplan_step` with `action: "start"` BEFORE doing work
6. Execute tasks
7. Verify completion
8. **Mark step as complete** using `riotplan_step` with `action: "complete"` AFTER completing work
9. Move to next step
10. Repeat until complete

**Example:**

```typescript
// Execute a plan
execute_plan({
  path: "./plans/websocket-sync"
})
```

**What it does:**
- Verifies plan structure and creates step files if needed
- Reads STATUS.md to find current state
- Guides through each step
- **Uses RiotPlan tracking tools** (`riotplan_step` with `action: "start"|"complete"`)
- Updates status automatically
- Handles blockers and issues
- Tracks progress

**For AI Assistants:** This prompt REQUIRES using RiotPlan's tracking infrastructure. Always use `riotplan_step` with `action: "start"` before work and `action: "complete"` after work. Don't just do the work without tracking.

### execute_step

Execute a single step from a plan with proper status tracking.

**Use when:**
- Working on specific step
- Not executing full plan
- Need focused guidance
- Want granular control

**Arguments:**
- `path` (optional) - Plan directory path

**Workflow:**
1. Check plan status
2. Read step details
3. **Mark step as started** using `riotplan_step` with `action: "start"` BEFORE doing work
4. Execute tasks
5. Verify acceptance criteria
6. **Mark step as complete** using `riotplan_step` with `action: "complete"` AFTER completing work
7. STATUS.md is updated automatically by the tools

**Example:**

```typescript
// Execute a specific step
execute_step({
  path: "./plans/websocket-sync"
})
```

**What it does:**
- Focuses on single step
- Provides task checklist
- **Uses RiotPlan tracking tools** (`riotplan_step` with `action: "start"|"complete"`)
- Verifies completion
- Updates status properly through RiotPlan tools

**For AI Assistants:** This prompt REQUIRES using RiotPlan's tracking infrastructure. You MUST call `riotplan_step` with `action: "start"` before work and `action: "complete"` after work. Never skip these calls - they're how RiotPlan tracks execution.

### track_progress

Monitor plan progress and maintain status tracking.

**Use when:**
- Checking plan status
- Reviewing progress
- Identifying issues
- Updating blockers

**Arguments:**
- `path` (optional) - Plan directory path

**Workflow:**
1. Read current status
2. Show progress summary
3. List completed steps
4. Show pending steps
5. Identify blockers
6. Review issues
7. Suggest next actions

**Example:**

```typescript
// Track progress
track_progress({
  path: "./plans/websocket-sync"
})
```

**What it does:**
- Displays comprehensive status
- Shows progress percentage
- Lists blockers and issues
- Suggests next steps

## Workflow Combinations

### Full Idea-to-Execution Flow

```typescript
// 1. Explore idea
explore_idea({
  code: "feature-x",
  description: "New feature concept"
})

// 2. Shape approach
shape_approach({
  path: "./feature-x"
})

// 3. Create plan
create_plan({
  code: "feature-x-impl",
  description: "Implement feature X using approach A"
})

// 4. Refine plan
develop_plan({
  path: "./plans/feature-x-impl"
})

// 5. Execute plan
execute_plan({
  path: "./plans/feature-x-impl"
})

// 6. Track progress
track_progress({
  path: "./plans/feature-x-impl"
})
```

### Quick Plan Execution

```typescript
// 1. Create plan directly
create_plan({
  code: "quick-fix",
  description: "Fix bug in authentication"
})

// 2. Execute plan
execute_plan({
  path: "./plans/quick-fix"
})
```

### Iterative Development

```typescript
// 1. Create initial plan
create_plan({
  code: "feature-y",
  description: "Implement feature Y"
})

// 2. Refine based on feedback
develop_plan({
  path: "./plans/feature-y"
})

// 3. Execute step by step
execute_step({
  path: "./plans/feature-y"
})

// 4. Track progress regularly
track_progress({
  path: "./plans/feature-y"
})
```

## Benefits

### Guided Workflows

- Step-by-step instructions
- Clear next actions
- Automatic state management
- Best practices built-in

### Context Preservation

- Full history tracking
- Checkpoint support
- Narrative capture
- Decision documentation

### Flexibility

- Use prompts individually
- Combine into workflows
- Adapt to your process
- Skip steps when needed

## Tips

### When to Use Prompts

- **Starting out** - Use prompts to learn the workflow
- **Complex tasks** - Let prompts guide you through steps
- **Collaboration** - Prompts provide shared process
- **Consistency** - Prompts ensure nothing is missed

### When to Use Tools Directly

- **Experienced users** - Skip prompts for speed
- **Simple tasks** - Tools may be more direct
- **Custom workflows** - Build your own process
- **Automation** - Scripts use tools, not prompts

### Execution Tracking Requirements

**When executing plans, you MUST:**

1. **Use tracking tools** - Always call `riotplan_step` with `action: "start"` before work and `action: "complete"` after work
2. **Check for step files** - Verify `plan/` directory exists with step files before executing
3. **Create step files if missing** - If `EXECUTION_PLAN.md` exists but step files don't, create them first
4. **Let RiotPlan manage state** - Don't manually edit STATUS.md, use the tools

**Common Mistakes:**

- ❌ Executing steps without using tracking tools
- ❌ Just doing the work and skipping STATUS.md updates
- ❌ Executing a plan without step files in `plan/` directory
- ❌ Treating RiotPlan like a regular task list

**Remember:** RiotPlan managed the thinking (idea → shaping → planning), so it should also manage the execution. Use the tools!

### Combining Prompts and Tools

You can mix prompts and direct tool calls:

```typescript
// Start with prompt
explore_idea({ code: "idea-x" })

// Use tools directly for specific actions
riotplan_idea({ note: "Important insight" })
riotplan_idea({ 
  evidencePath: "./mockup.png",
  description: "UI mockup"
})

// Return to prompt for next phase
shape_approach({ path: "./idea-x" })
```

## Next Steps

- Learn about [MCP Tools](mcp-tools) - Individual tool reference
- Explore [MCP Resources](mcp-resources) - Data access
- Read [MCP Overview](mcp-overview) - Getting started
