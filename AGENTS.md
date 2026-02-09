# RiotPlan AI Assistant Guide

This guide helps AI assistants understand and work effectively with RiotPlan.

## What is RiotPlan?

RiotPlan is a framework for managing long-lived, multi-step AI-assisted workflows. Unlike simple task lists, RiotPlan treats plans as **constructs** with full lifecycles from idea exploration through execution.

## Core Concepts

### Plans Have Lifecycles

Plans progress through stages:

1. **Idea**: Exploring a concept, gathering evidence, documenting constraints
2. **Shaping**: Comparing approaches, evaluating tradeoffs, selecting direction
3. **Built**: AI-generated detailed execution plan with steps
4. **Executing**: Working through steps with progress tracking
5. **Done**: Plan completed successfully

### Plans Are Stateful

- **STATUS.md**: Current state, progress, blockers
- **Step files**: Numbered markdown files (01-step.md, 02-step.md)
- **History**: Timeline of events and decisions
- **Checkpoints**: Snapshots for rollback

### Plans Support Deep Thinking

RiotPlan encourages analysis before action:

- **Evidence gathering**: Research, examples, documentation
- **Approach comparison**: Evaluate multiple solutions
- **Constraint documentation**: Capture requirements and limitations
- **Question raising**: Identify unknowns

## Working with Plans via MCP

### Lifecycle Tools

- `riotplan_idea_create`: Start exploring an idea
- `riotplan_shaping_start`: Begin comparing approaches
- `riotplan_build`: Generate detailed plan with AI
- `riotplan_transition`: Move between stages manually

### Step Execution (CRITICAL)

**When executing a RiotPlan step, you MUST use tracking tools:**

```typescript
// 1. Check status
riotplan_status({ path: './my-plan' })

// 2. Mark step as started BEFORE doing work
riotplan_step_start({ path: './my-plan', step: 1 })

// 3. Do the actual work (implement, test, document)

// 4. Mark step as complete AFTER finishing
riotplan_step_complete({ path: './my-plan', step: 1 })
```

**Common Mistake**: Executing steps without calling `riotplan_step_start` and `riotplan_step_complete`. This bypasses RiotPlan's execution management.

**Key Principle**: If you're working on a RiotPlan, RiotPlan should manage the execution, not just the planning.

### Idea Stage Tools

- `riotplan_idea_add_note`: Capture thoughts during exploration
- `riotplan_idea_add_constraint`: Document requirements
- `riotplan_idea_add_question`: Raise uncertainties
- `riotplan_idea_add_evidence`: Attach supporting materials
- `riotplan_idea_kill`: Abandon idea with reason

### Shaping Stage Tools (CRITICAL)

- `riotplan_shaping_add_approach`: Propose solution approaches
- `riotplan_shaping_add_feedback`: Comment on approaches
- `riotplan_shaping_compare`: Generate comparison of all approaches
- `riotplan_shaping_select`: Choose best approach

**CRITICAL: After calling `riotplan_shaping_select`, you MUST immediately call `riotplan_build`.**

This is the most common mistake when using RiotPlan. The workflow is:
1. Call `riotplan_shaping_select` to record the chosen approach
2. **Immediately** call `riotplan_build` to generate PROVENANCE.md, EXECUTION_PLAN.md, SUMMARY.md, and step files
3. Only then can you begin executing steps

**Do NOT skip `riotplan_build`** - it creates essential documentation and transitions the plan to "built" stage.

### History & Checkpoints

- `riotplan_checkpoint_create`: Save state snapshot
- `riotplan_checkpoint_restore`: Restore previous state
- `riotplan_history_show`: View timeline of events

## Catalysts: Planning Intelligence

**Catalysts** are composable bundles of planning guidance that influence plan creation. They contain:

- **Questions**: Guiding questions for exploration
- **Constraints**: Rules plans must satisfy
- **Domain Knowledge**: Context about technology/organization
- **Process Guidance**: How to approach planning
- **Output Templates**: Expected deliverables
- **Validation Rules**: Post-creation checks

### Using Catalysts

**List available catalysts:**

```typescript
riotplan_catalyst_list()
```

**Show catalyst details:**

```typescript
riotplan_catalyst_show({ catalyst: '@kjerneverk/catalyst-project' })
```

**Associate catalysts with a plan:**

```typescript
riotplan_catalyst_associate({
  path: './my-plan',
  action: 'add',
  catalysts: ['@kjerneverk/catalyst-nodejs']
})
```

### When to Use Catalysts

Use catalysts when:

- Creating plans for specific technologies (Node.js, React, Python)
- Working within organizational standards
- Planning for specific project types (API, CLI, library)
- Ensuring compliance with requirements

### Catalyst Influence

When catalysts are applied:

1. **Questions** guide what to ask during idea exploration
2. **Constraints** become requirements in the plan
3. **Domain Knowledge** informs AI generation
4. **Process Guidance** shapes the approach
5. **Output Templates** define expected deliverables
6. **Validation Rules** verify plan completeness

### Catalyst Traceability

Plans record which catalysts influenced their creation:

- **plan.yaml**: Lists catalyst IDs
- **SUMMARY.md**: Shows applied catalysts
- **AI prompts**: Include catalyst content

## AI Generation

RiotPlan uses AI to generate detailed, actionable plans:

### Build Command

```typescript
riotplan_build({
  path: './my-plan',
  steps: 6,
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  catalysts: ['@kjerneverk/catalyst-nodejs']
})
```

### What Gets Generated

- **SUMMARY.md**: Overview and approach
- **EXECUTION_PLAN.md**: Step-by-step strategy
- **STATUS.md**: Initial state tracking
- **plan/*.md**: Individual step files with tasks and acceptance criteria

### Artifact-Driven Generation

RiotPlan uses **artifacts** to inform AI generation:

- **IDEA.md**: Original concept and constraints
- **SHAPING.md**: Approaches and selected direction
- **Evidence files**: Research and examples
- **History**: Timeline of decisions
- **Catalyst content**: Questions, constraints, guidance

The AI receives all these artifacts in a structured prompt, ensuring generated plans are grounded in the actual context.

## Best Practices for AI Assistants

### 1. Respect the Lifecycle

Don't skip stages. If a user wants to create a plan:

- **Good**: Suggest starting with `riotplan_idea_create` to explore first
- **Bad**: Jump straight to `riotplan_create` without understanding requirements

### 2. Use Tracking Tools

Always use `riotplan_step_start` and `riotplan_step_complete`:

- **Good**: Call tracking tools before and after work
- **Bad**: Do the work without tracking, then manually update STATUS.md

### 3. Leverage Catalysts

When creating plans, check for relevant catalysts:

- **Good**: List catalysts, suggest relevant ones, apply them
- **Bad**: Ignore catalysts and miss important guidance

### 4. Read Evidence

Before implementing, check for evidence files:

- **Good**: Read evidence files, incorporate findings
- **Bad**: Implement from conversation memory alone

### 5. Document Decisions

Use history and checkpoints:

- **Good**: Create checkpoints before major changes
- **Bad**: Make changes without saving state

### 6. Ask Questions

Use the idea stage to clarify:

- **Good**: Add questions to IDEA.md, gather evidence
- **Bad**: Make assumptions and proceed

### 7. Compare Approaches

Use the shaping stage for complex decisions:

- **Good**: Add multiple approaches, compare tradeoffs, select best
- **Bad**: Pick first approach without evaluation

## MCP Resources

Read-only access to plan data:

- `riotplan://plan/{path}`: Plan metadata and structure
- `riotplan://status/{path}`: Current status and progress
- `riotplan://steps/{path}`: List of all steps
- `riotplan://step/{path}?number={n}`: Specific step content

**Use resources to check state before taking actions.**

## MCP Prompts

Workflow templates for common tasks:

- `create_plan`: Guided plan creation workflow
- `execute_step`: Step execution workflow with tracking
- `track_progress`: Progress monitoring and status updates

**Invoke prompts for complex workflows instead of calling tools directly.**

## Common Patterns

### Creating a New Plan

```typescript
// 1. Start with an idea
riotplan_idea_create({
  code: 'my-feature',
  description: 'Implement user authentication'
})

// 2. Add constraints
riotplan_idea_add_constraint({
  constraint: 'Must use JWT tokens'
})

// 3. Add evidence
riotplan_idea_add_evidence({
  description: 'JWT best practices article',
  source: 'https://...'
})

// 4. Move to shaping
riotplan_shaping_start()

// 5. Add approaches
riotplan_shaping_add_approach({
  name: 'Passport.js',
  description: 'Use Passport.js middleware',
  tradeoffs: ['Pros: Well-tested, Cons: Heavy dependency']
})

// 6. Select approach
riotplan_shaping_select({
  approach: 'Passport.js',
  reason: 'Most mature and well-documented'
})

// 7. Build detailed plan
riotplan_build({
  steps: 6,
  catalysts: ['@kjerneverk/catalyst-nodejs']
})
```

### Executing a Plan

```typescript
// 1. Check status
const status = riotplan_status({ path: './my-plan' })

// 2. Read step file
const step = fetch('riotplan://step/./my-plan?number=1')

// 3. Mark started
riotplan_step_start({ path: './my-plan', step: 1 })

// 4. Do the work
// ... implement, test, document ...

// 5. Mark complete
riotplan_step_complete({ path: './my-plan', step: 1 })

// 6. Check progress
riotplan_status({ path: './my-plan' })
```

### Using Catalysts

```typescript
// 1. List available catalysts
const catalysts = riotplan_catalyst_list()

// 2. Show details
const details = riotplan_catalyst_show({
  catalyst: '@kjerneverk/catalyst-nodejs'
})

// 3. Associate with plan
riotplan_catalyst_associate({
  path: './my-plan',
  action: 'add',
  catalysts: ['@kjerneverk/catalyst-nodejs']
})

// 4. Build plan with catalysts
riotplan_build({
  path: './my-plan',
  catalysts: ['@kjerneverk/catalyst-nodejs']
})
```

## Error Handling

RiotPlan tools return structured errors:

```typescript
{
  success: false,
  error: 'Plan not found: ./my-plan'
}
```

**Always check for errors and handle them gracefully.**

## Configuration

RiotPlan uses a four-tier configuration system:

1. Environment variables (highest priority)
2. Config files (riotplan.config.*)
3. Auto-detection (finds plans/ directory)
4. Fallback (./plans)

**Most users don't need explicit configuration** - RiotPlan finds plans automatically.

## Further Reading

- **README.md**: User-facing documentation
- **docs/CATALYST_AUTHORING.md**: How to create catalysts
- **guide/ai-generation.md**: AI generation details
- **guide/mcp.md**: MCP integration details

## Summary

As an AI assistant working with RiotPlan:

1. **Respect the lifecycle**: Idea → Shaping → Built → Executing → Done
2. **Use tracking tools**: Always call step_start and step_complete
3. **Leverage catalysts**: Check for and apply relevant guidance
4. **Read evidence**: Don't implement from memory alone
5. **Document decisions**: Use history and checkpoints
6. **Ask questions**: Use the idea stage to clarify
7. **Compare approaches**: Use the shaping stage for complex decisions

RiotPlan is designed for **thoughtful, long-lived workflows**. Take time to explore, shape, and plan before executing.
