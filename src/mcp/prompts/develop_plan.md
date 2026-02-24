# Develop Plan

## Purpose

Transform rich ideation context (ideas, narratives, evidence, shaping decisions) into a comprehensive, actionable execution plan. This prompt bridges the gap between exploration and execution by synthesizing all the thinking, deliberation, and decisions captured during the idea and shaping phases into a structured plan.

**CRITICAL**: This is NOT about generating a generic task list. This is about synthesizing all the valuable context captured during ideation into a plan that reflects the full depth of thinking, honors all constraints, implements the selected approach, and references the evidence that informed decisions.

## The Value of Context-Driven Planning

The ideation phase captures:
- **Notes and observations**: Insights discovered during exploration
- **Questions and answers**: Uncertainties raised and resolved
- **Constraints**: Requirements that must be honored
- **Evidence**: Research, examples, data that inform decisions
- **Narratives**: Raw conversational context and reasoning
- **Shaping decisions**: Approaches considered, tradeoffs analyzed, selections made

**All of this context has value.** A plan that doesn't leverage it is just a generic task list. A plan that synthesizes it becomes a roadmap grounded in deep understanding.

## When to Use 

- After completing idea exploration and shaping phases
- Ready to convert an idea into an executable plan
- Need to synthesize all captured context into actionable steps
- Want to ensure the plan reflects all the deliberation and decisions made
- Moving from "what should we do?" to "how will we do it?"

**Before using this prompt**: Ensure the idea has been explored (IDEA.md exists, timeline has events) and ideally shaped (approach selected). If the idea is still nascent, use `explore_idea` first.

## Critical Context Sources

Before generating a plan, you MUST gather and synthesize context from these sources:

### 1. The Idea File (`IDEA.md`)

This is the foundation. It contains:
- **Core Concept**: What are we trying to achieve?
- **Why This Matters**: The motivation and value
- **Initial Thoughts**: Early thinking and observations
- **Constraints**: Limitations and requirements that must be honored
- **Questions**: Uncertainties that were raised (and possibly answered)
- **Evidence**: Supporting materials, research, examples
- **Status**: Current stage and next steps

**Action**: Read `IDEA.md` completely. This tells you WHAT needs to be built and WHY.

### 2. The Timeline (`.history/timeline.jsonl`)

This captures the full evolution of thinking:
- **Notes**: Observations and insights added during exploration
- **Questions**: Uncertainties raised and answered
- **Constraints**: Requirements discovered during exploration
- **Evidence**: Materials gathered to inform decisions
- **Narrative Chunks**: Raw conversational context and deliberation
- **Shaping Events**: Approaches considered, feedback given, decisions made
- **Checkpoints**: Snapshots of state at key moments

**Action**: Read the timeline to understand HOW the thinking evolved. Pay special attention to:
- Questions that were answered (inform approach)
- Constraints added (must be honored in plan)
- Narrative chunks (capture reasoning and context)
- Shaping decisions (selected approach and rationale)

### 3. The Prompts Directory (`.history/prompts/`)

These are numbered conversation captures that preserve full context:
- Raw user input and assistant responses
- Detailed deliberation and reasoning
- Alternative approaches considered
- Decision rationale

**Action**: Read recent prompt files (especially from shaping phase) to understand the detailed reasoning behind decisions.

### 4. Shaping Artifacts (if present)

If the idea went through shaping:
- **SHAPING.md**: Approaches considered, feedback, comparisons
- **Selected Approach**: Which strategy was chosen and why
- **Tradeoffs**: What was gained and sacrificed with this choice

**Action**: Understand which approach was selected and ensure the plan implements it correctly.

### 5. Evidence Files (`evidence/` directory)

Supporting materials that informed the idea:
- Example implementations
- Research findings
- Reference documents
- Prototypes or mockups

**Action**: Review evidence to understand context and requirements more deeply.

## Workflow

### 1. Gather All Context

Start by reading ALL the sources listed above:

```typescript
// Read the idea file
const idea = await read("IDEA.md")

// Read the timeline to understand evolution
const timeline = await read(".history/timeline.jsonl")

// Read recent prompts for detailed context
const prompts = await listFiles(".history/prompts/")
// Read the most recent 3-5 prompt files

// If shaping occurred, read shaping artifacts
const shaping = await read("SHAPING.md") // if exists

// List and review evidence
const evidence = await listFiles("evidence/")
// Read key evidence files
```

**DO NOT SKIP THIS STEP**. The plan quality depends entirely on how well you understand the full context.

### 2. Synthesize Context into Plan Requirements

After gathering all context, synthesize it into clear plan requirements:

**From IDEA.md:**
- Core concept → Plan objective and scope
- Why this matters → Value proposition in SUMMARY.md
- Constraints → Must be honored in every step
- Questions (answered) → Inform approach decisions
- Questions (unanswered) → May need research steps in plan

**From Timeline:**
- Notes and observations → Context for approach decisions
- Narrative chunks → Understanding of tradeoffs and reasoning
- Evidence → Supporting materials to reference
- Shaping decisions → Selected approach to implement

**From Shaping:**
- Selected approach → Overall strategy for EXECUTION_PLAN.md
- Tradeoffs → Known limitations to document
- Assumptions → Conditions that must hold true

**Synthesis Questions:**
1. What is the core problem we're solving? (from IDEA.md)
2. What approach did we select and why? (from SHAPING.md or timeline)
3. What constraints must every step honor? (from IDEA.md constraints)
4. What evidence informs our implementation? (from evidence/)
5. What was the key reasoning behind decisions? (from narratives)

### 3. Structure the Plan

Now that you understand the full context, structure the plan:

**A. Define Phases**

Break the work into logical phases based on:
- The selected approach (from shaping)
- Natural dependencies (what must come first)
- Risk mitigation (validate assumptions early)
- Incremental value delivery (working software at each phase)

Example phases:
- Phase 1: Foundation (infrastructure, core abstractions)
- Phase 2: Core Features (main functionality)
- Phase 3: Integration (connect components)
- Phase 4: Polish (refinement, documentation)

**B. Define Steps Within Each Phase**

For each phase, break down into concrete steps:
- Each step should be completable in a reasonable timeframe
- Each step should have clear acceptance criteria
- Each step should reference relevant evidence or context
- Each step should honor all constraints

**C. Capture Rationale**

For each step, document:
- **Why this step?** (connects to idea and approach)
- **Why now?** (explains ordering and dependencies)
- **What constraints apply?** (from IDEA.md)
- **What evidence informed this?** (from evidence/)

### 4. Write the Plan Files

Generate the complete plan structure:

**SUMMARY.md:**
```markdown
# [Plan Name]

## Objective
[From IDEA.md core concept]

## Value
[From IDEA.md "why this matters"]

## Scope
[What's included and excluded, informed by constraints]

## Success Criteria
[How we'll know we're done]

## Context
[Key insights from timeline and narratives]
```

**EXECUTION_PLAN.md:**
```markdown
# Execution Plan

## Selected Approach
[From SHAPING.md - which approach and why]

## Strategy
[How we'll implement this approach]

## Phases
[List phases with rationale]

## Key Decisions
[Important decisions from shaping/timeline]

## Assumptions
[From shaping - what must be true]

## Constraints
[From IDEA.md - what we must honor]

## Risks and Mitigations
[Known risks from deliberation]
```

**STATUS.md:**
```markdown
# Status

## Overview
- **Current Phase**: Not started
- **Progress**: 0/[N] steps complete
- **Status**: Ready to begin

## Steps
| Step | Title | Status | Phase |
|------|-------|--------|-------|
| 1 | [Title] | pending | [Phase] |
...
```

**plan/001-[step-name].md** (for each step):
```markdown
# Step 1: [Title]

## Objective
[What this step achieves]

## Context
[Why this step, why now - reference timeline/evidence]

## Tasks
- [ ] [Specific task]
- [ ] [Specific task]

## Acceptance Criteria
- [ ] [Measurable criterion]
- [ ] [Measurable criterion]

## Constraints
[Relevant constraints from IDEA.md]

## Dependencies
- Requires: [Previous steps]
- Blocks: [Future steps]

## Evidence
[Reference relevant evidence files]

## Estimated Effort
[Time estimate]
```

### 5. Validate Against Context

Before presenting the plan, validate it:

**Completeness Check:**
- [ ] Does the plan implement the selected approach?
- [ ] Are all constraints from IDEA.md honored?
- [ ] Does the plan address all key questions?
- [ ] Is evidence appropriately referenced?
- [ ] Does the rationale reflect the deliberation?

**Quality Check:**
- [ ] Are steps concrete and actionable?
- [ ] Are acceptance criteria measurable?
- [ ] Are dependencies clear?
- [ ] Is the ordering logical?
- [ ] Will this actually solve the problem?

### 6. Present Plan to User

Present the plan with context:

1. **Summarize the synthesis**: "I've reviewed the full idea context including [X notes], [Y narrative chunks], [Z evidence files], and the selected approach from shaping. Here's the plan I've developed..."

2. **Highlight key connections**: 
   - "Step 3 implements the [approach] we selected because [reasoning from timeline]"
   - "Step 5 honors the constraint about [X] from the idea phase"
   - "Phase 2 is informed by [evidence file] you provided"

3. **Invite feedback**: "Does this plan capture everything we discussed? Are there aspects that need adjustment?"

### 7. Iterate Based on Feedback

The user may want to refine the plan. Use the same narrative capture approach:

```typescript
// Capture user feedback
riotplan_idea({
  planId: "${planId}",
  content: "[User's feedback about the plan]",
  speaker: "user",
  context: "Feedback on generated plan"
})

// Make adjustments
// Update plan files as needed

// Capture what changed
riotplan_idea({
  planId: "${planId}",
  content: "Updated [X] based on feedback because [reasoning]",
  speaker: "assistant",
  context: "Plan refinement"
})
```

### 8. Create Checkpoint When Plan is Approved

Once the user approves the plan, create a checkpoint:

```typescript
riotplan_checkpoint({
  planId: "${planId}",
  name: "plan-approved",
  message: "Plan approved and ready for execution. Synthesized from [N] timeline events, [M] evidence files, and selected approach from shaping phase."
})
```

## Key Principles

### 1. Context is Everything

The plan quality depends on how well you understand and synthesize the full ideation context:
- **Read everything**: IDEA.md, timeline, prompts, evidence, shaping
- **Understand the why**: Don't just implement features, understand the problem
- **Honor constraints**: Every constraint in IDEA.md must be respected
- **Reference evidence**: Show how evidence informed decisions
- **Preserve reasoning**: Capture the deliberation that led to choices

**The plan is not just a task list - it's a synthesis of all the thinking that came before.**

### 2. Connect Plan to Context

Every part of the plan should trace back to the ideation context:
- Steps should reference evidence that informed them
- Rationale should reflect timeline deliberation
- Approach should match shaping decisions
- Constraints should be explicitly honored
- Questions should be addressed or acknowledged

**Make the connections explicit.** Don't assume the user remembers all the context.

### 3. Be Comprehensive but Actionable

Balance thoroughness with practicality:
- **Comprehensive**: Cover all aspects discussed in ideation
- **Actionable**: Each step has clear tasks and acceptance criteria
- **Realistic**: Effort estimates are grounded in evidence
- **Ordered**: Dependencies and sequencing make sense

### 4. Capture Rationale

For every decision in the plan, document why:
- **Why this step?** (connects to objective)
- **Why this approach?** (from shaping)
- **Why this order?** (dependencies and risk)
- **Why these tasks?** (from evidence and constraints)

Future you (or future maintainers) will thank you for the context.

### 5. Validate Before Presenting

Don't just generate and dump. Validate:
- Does this plan actually solve the problem from IDEA.md?
- Are all constraints honored?
- Is the selected approach implemented correctly?
- Are steps concrete enough to execute?
- Is the rationale clear?

**Quality over speed.** A well-synthesized plan saves time during execution.

## Example: Developing a Plan from Idea Context

**Scenario**: User has explored an idea for "Add caching to API" and selected an approach during shaping. Now they want to develop the execution plan.

**Step 1: Gather Context**

```typescript
// AI reads all context sources
const idea = read("IDEA.md")
// Core concept: Add Redis-based caching to reduce database load
// Constraints: Must not break existing API contracts, must be opt-in per endpoint
// Questions answered: Redis vs in-memory (chose Redis for persistence)

const timeline = read(".history/timeline.jsonl")
// 23 events: notes about performance issues, evidence from load tests,
// shaping discussion about Redis vs Memcached, decision to use Redis

const shaping = read("SHAPING.md")
// Selected approach: "Incremental Redis Integration"
// Tradeoffs: More setup complexity, but better production readiness
// Assumptions: Redis cluster available, team familiar with Redis

const evidence = listFiles("evidence/")
// load-test-results.md: Shows 80% of requests hit same 5 endpoints
// redis-examples.md: Example implementations from similar projects
```

**Step 2: Synthesize Requirements**

**AI**: "I've reviewed the full context:
- 23 timeline events including performance analysis and shaping discussion
- Selected approach: Incremental Redis Integration
- Key constraint: Must not break existing API contracts
- Evidence: Load tests show 80% of traffic hits 5 endpoints

I'll structure the plan around this context..."

**Step 3: Generate Plan**

**AI generates**:
- **SUMMARY.md**: Objective from idea, value from performance evidence
- **EXECUTION_PLAN.md**: Implements "Incremental Redis Integration" approach
- **STATUS.md**: 8 steps organized in 3 phases
- **plan/001-setup-redis.md**: References redis-examples.md evidence
- **plan/002-cache-abstraction.md**: Honors "opt-in per endpoint" constraint
- **plan/003-implement-hot-endpoints.md**: Uses load-test-results.md to prioritize
- ... (remaining steps)

**Step 4: Present with Context**

**AI**: "Here's the execution plan I've developed:

**Phase 1: Foundation (Steps 1-2)**
- Step 1 sets up Redis infrastructure (informed by redis-examples.md)
- Step 2 creates cache abstraction (honors opt-in constraint from IDEA.md)

**Phase 2: Incremental Rollout (Steps 3-6)**
- Step 3 implements caching for the 5 hot endpoints identified in load tests
- Steps 4-6 add monitoring, testing, and gradual rollout
- This implements the 'Incremental Redis Integration' approach from shaping

**Phase 3: Expansion (Steps 7-8)**
- Step 7 adds caching to remaining endpoints
- Step 8 handles documentation and team training

Each step includes:
- Clear acceptance criteria
- References to evidence that informed it
- Explicit constraints from the idea phase
- Rationale from our shaping discussion

Does this plan capture everything we discussed? Any adjustments needed?"

**Step 5: User Feedback**

**User**: "Looks good, but I think we should add a step for cache invalidation strategy before we implement the hot endpoints."

**AI**: *Captures feedback*
```typescript
riotplan_idea({
  content: "User wants to add cache invalidation strategy step before implementing hot endpoints. Makes sense - we need the invalidation approach defined before we start caching.",
  speaker: "assistant",
  context: "Plan refinement feedback"
})
```

**AI**: "Good catch. I'll add a new step 3 for cache invalidation strategy and renumber the remaining steps."

*Updates plan files*

**AI**: "I've added Step 3: Define Cache Invalidation Strategy. It includes:
- TTL-based expiration
- Event-based invalidation patterns
- Manual invalidation endpoints
- Testing invalidation logic

The hot endpoint implementation is now Step 4 and depends on Step 3. Does this work?"

**User**: "Perfect. Let's proceed."

**AI**: *Creates checkpoint*
```typescript
riotplan_checkpoint({
  name: "plan-approved",
  message: "Plan approved. Synthesized from 23 timeline events, 2 evidence files, and selected Redis approach. Added cache invalidation step based on user feedback."
})
```

## Common Pitfalls to Avoid

### ❌ Starting Without Context

**Don't**: Jump straight to generating steps without reading IDEA.md, timeline, evidence
**Do**: Spend time understanding the full context first - it will show in plan quality

### ❌ Ignoring Constraints

**Don't**: Generate a plan that violates constraints from IDEA.md
**Do**: Explicitly check each step against constraints and document how they're honored

### ❌ Disconnected from Evidence

**Don't**: Create steps without referencing the evidence that informed them
**Do**: Show the connection - "Step 3 is informed by load-test-results.md which shows..."

### ❌ Missing the "Why"

**Don't**: Just list tasks without explaining rationale
**Do**: Document why each step exists, why it's ordered this way, why this approach

### ❌ Forgetting Shaping Decisions

**Don't**: Generate a plan that doesn't implement the selected approach
**Do**: Ensure the plan structure and steps reflect the approach chosen during shaping

### ❌ Generic Acceptance Criteria

**Don't**: Use vague criteria like "Step is complete" or "Code works"
**Do**: Use specific, measurable criteria informed by constraints and evidence

### ❌ Assuming User Remembers Everything

**Don't**: Reference "the thing we discussed" without context
**Do**: Explicitly connect plan elements to specific timeline events, evidence files, or decisions

## Resources to Expose

When using this prompt, ensure these resources are available:

### MCP Resources

The following should be exposed as MCP resources for easy access:

1. **`idea://[plan-code]/idea`** - The IDEA.md file
2. **`idea://[plan-code]/timeline`** - The .history/timeline.jsonl file
3. **`idea://[plan-code]/prompts`** - List of prompt files in .history/prompts/
4. **`idea://[plan-code]/prompt/[number]`** - Specific prompt file
5. **`idea://[plan-code]/evidence`** - List of evidence files
6. **`idea://[plan-code]/shaping`** - The SHAPING.md file (if exists)
7. **`idea://[plan-code]/checkpoints`** - List of checkpoints

These resources make it easy to gather context without manually constructing file paths.

### MCP Tools

The following tools should be available:

1. **`riotplan_status`** - Get current plan status
2. **`riotplan_idea`** - Capture feedback and deliberation
3. **`riotplan_checkpoint`** - Create snapshots at key moments
4. **`riotplan_step`** with `action: "add"` - Add new steps during refinement
5. **`riotplan_step`** with `action: "start"` - Mark step as started
6. **`riotplan_step`** with `action: "complete"` - Mark step as complete

### File Operations

You'll need standard file operations:
- Read files (IDEA.md, timeline, prompts, evidence)
- Write files (SUMMARY.md, EXECUTION_PLAN.md, STATUS.md, step files)
- List directories (evidence/, .history/prompts/, plan/)
- Create directories (plan/ if it doesn't exist)

## Transition Criteria

**Plan Refinement Needed**: User provides feedback on generated plan
- Capture feedback as narrative
- Make requested changes
- Validate changes honor all constraints
- Confirm with user

**Ready to Execute**: User approves the plan
- Create "plan-approved" checkpoint
- Consider using the `execute_plan` prompt for guided execution
- Ensure all context is preserved for future reference

**Back to Shaping**: Feedback reveals the approach needs fundamental reconsideration
- Create checkpoint to preserve current plan
- Use `shape_approach` prompt to explore alternative approaches
- May need to regenerate plan based on new approach

**Need More Context**: Plan generation reveals missing information
- Gather additional evidence
- Ask clarifying questions
- Update IDEA.md with new insights
- Continue plan development

**Pause for Later**: User wants to stop and come back
- Create checkpoint with current state
- Timeline preserves all context for resuming
- Plan can be picked up exactly where it left off

## Quality Checklist

Before presenting a plan, verify:

### Context Integration
- [ ] Read and understood IDEA.md completely
- [ ] Reviewed full timeline (all events)
- [ ] Read recent prompt files for detailed context
- [ ] Reviewed shaping decisions (if applicable)
- [ ] Examined all evidence files
- [ ] Understood selected approach and rationale

### Plan Completeness
- [ ] SUMMARY.md captures objective and value
- [ ] EXECUTION_PLAN.md implements selected approach
- [ ] STATUS.md has complete step table
- [ ] All step files have clear tasks and acceptance criteria
- [ ] Dependencies are correctly specified
- [ ] Phases are logically organized

### Constraint Compliance
- [ ] Every constraint from IDEA.md is honored
- [ ] Constraints are explicitly referenced in relevant steps
- [ ] No step violates any constraint
- [ ] Tradeoffs from shaping are acknowledged

### Evidence Integration
- [ ] Evidence files are referenced in relevant steps
- [ ] Rationale shows how evidence informed decisions
- [ ] Performance data, examples, or research are cited
- [ ] Evidence supports approach selection

### Rationale Quality
- [ ] Each step explains "why this step"
- [ ] Ordering is justified
- [ ] Approach selection is explained
- [ ] Tradeoffs are documented
- [ ] Assumptions are stated

### Actionability
- [ ] Tasks are concrete and specific
- [ ] Acceptance criteria are measurable
- [ ] Effort estimates are realistic
- [ ] Steps are appropriately sized
- [ ] Dependencies are clear

## Notes

- **This prompt is about synthesis, not just generation**: The value is in connecting all the ideation context into a coherent plan
- **Context quality determines plan quality**: Spend time understanding the full story before generating steps
- **Make connections explicit**: Don't assume the user remembers all the deliberation - reference it
- **Honor all constraints**: They were captured for a reason - every one must be respected
- **Preserve rationale**: Future you will need to understand why decisions were made
- **The plan is a living document**: It will evolve during execution, but it should start from a solid foundation of context
