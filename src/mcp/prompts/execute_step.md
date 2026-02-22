# Execute Step Workflow

You are helping the user execute a single step from a plan, following the guidance in the step file and updating status appropriately.

## Your Task

Follow this workflow to execute a plan step using the riotplan MCP tools and resources available to you.

**CRITICAL**: This workflow REQUIRES using RiotPlan's tracking infrastructure. You MUST use `riotplan_step_start` before work and `riotplan_step_complete` after work. Do NOT just do the work without tracking.

## Step 1: Check Plan Status

Use the `riotplan_status` tool to check the current plan state:

```
{
  "planId": "${planId}",
  "verbose": false
}
```

This will show you:
- Current step number
- Progress percentage
- Any blockers or issues
- Which step should be worked on next

Verify that prerequisites are met and identify which step to execute.

## Step 2: Read Step Details and Evidence

**CRITICAL**: Before implementing, you MUST read the step file AND any relevant evidence.

### 2a. Read the Step File

Fetch the step resource to get full content and acceptance criteria:

```
riotplan://step/${planId}?number={stepNumber}
```

Or use the `riotplan_step_list` tool to see all steps:

```
{
  "planId": "${planId}",
  "pending": true
}
```

Review the step content to understand:
- Objectives and goals
- Acceptance criteria
- Dependencies and context
- Testing requirements

### 2b. Check for Relevant Evidence

**Before implementing, check if evidence exists that informs this step:**

1. List files in the `evidence/` directory
2. Read any evidence files that are relevant to this step
3. Look for evidence referenced in the step file
4. Check if the step mentions specific research, examples, or documentation

**Action**: If evidence exists, read it. Implementation should incorporate evidence findings, not just conversation memory.

**Anti-Pattern**: Do NOT implement from memory alone — if evidence files exist, they contain important details that should be incorporated.

### 2c. Read Prior Step Reflections

**Before starting work, check for reflections from prior steps:**

Prior step reflections contain valuable lessons learned during execution. They document:
- What surprised the executing agent
- What took longer than expected
- What could have been done differently
- Important context for subsequent steps

**Action**: Check if `reflections/` directory exists in the plan. If it does, read all reflection files for steps that have been completed before this one.

**How to interpret reflections:**
- Treat them as communication from the agent that executed prior steps
- Pay attention to warnings about complexity, dependencies, or edge cases
- Look for patterns or approaches that worked well (or didn't)
- Consider how prior learnings apply to your current step

**Example**: If you're on Step 5 and reflection files exist for steps 1-4, read them to understand what challenges were encountered and what insights were gained.

**Anti-Pattern**: Do NOT skip reading reflections. They contain hard-won knowledge from actual execution, not just planning assumptions.

## Step 3: Mark Step as Started

**CRITICAL**: You MUST use the `riotplan_step_start` MCP tool to mark the step as in progress BEFORE doing any work:

```
{
  "planId": "${planId}",
  "step": N
}
```

This updates STATUS.md and sets timestamps to track progress. **Never skip this step** - it's how RiotPlan tracks execution. If you do work without calling this tool first, you're bypassing RiotPlan's execution management.

## Step 4: Execute Step Tasks

Now follow the guidance in the step file:
- Implement required changes
- Write tests as specified
- Document as needed
- Follow acceptance criteria

Work through the step systematically, ensuring all requirements are met.

## Step 5: Verify Completion

Before marking the step complete, verify:
- All acceptance criteria are met
- Tests pass successfully
- Changes are complete and reviewed
- Documentation is updated if needed

## Step 6: Mark Step as Complete

**CRITICAL**: You MUST use the `riotplan_step_complete` MCP tool to mark the step as done AFTER completing all work:

```
{
  "planId": "${planId}",
  "step": N
}
```

This updates STATUS.md and advances the plan to the next step. **Never skip this step** - completion tracking is essential. If you complete work without calling this tool, RiotPlan won't know the step is done.

## Step 7: Write Step Reflection

**MANDATORY**: After completing a step, you MUST reflect on the execution experience using `riotplan_step_reflect`:

```
{
  "planId": "${planId}",
  "step": N,
  "reflection": "Your reflection content here"
}
```

**What to include in your reflection:**

1. **What surprised you**: What was unexpected? What assumptions were wrong?
2. **What took longer than expected**: Which tasks were more complex than anticipated?
3. **What could be done differently**: If you could redo this step, what would you change?
4. **What the next step should know**: Critical context, warnings, or insights for subsequent steps

**Quality matters**: This is NOT a summary of what you did. This is genuine self-reflection about the execution experience. Be honest, specific, and creative. Generic reflections like "everything went as planned" are not useful.

**Use your reasoning capabilities**: This is where capable models shine. Reflect deeply on what happened and why. What patterns did you notice? What would you do differently next time?

**Example of a good reflection:**

```
This step took about 45 minutes instead of the estimated 30 minutes. The main surprise was that the existing authentication middleware was more tightly coupled to the session store than I expected from reading the code. I had to refactor the middleware interface first, which wasn't in the original plan.

What could be done differently: Better upfront analysis of the dependency graph would have revealed the coupling. The step file should have included "analyze existing middleware" as a subtask before implementation.

What the next step should know: The new authentication interface is in src/auth/interface.ts. All middleware now uses this interface, so adding new auth providers should be straightforward. Watch out for the session timeout logic - it's still in the old location and needs migration (added as a follow-up task).
```

**Example of a poor reflection:**

```
Completed the authentication middleware as planned. Everything worked fine. Tests pass.
```

**Anti-Pattern**: Do NOT skip reflection or write generic summaries. Reflection creates the inter-step learning channel that makes RiotPlan execution intelligent.

## Step 8: Check Overall Progress

Use `riotplan_status` again to see updated progress and identify the next step to work on.

## Important Guidelines

- **Always use MCP tools** - Never shell out to CLI commands
- **Update status properly** - Mark steps as started and completed using RiotPlan tools
- **One step at a time** - Focus on completing one step fully before moving to the next
- **Test thoroughly** - Each step should include verification of acceptance criteria
- **Document issues** - If you encounter blockers, document them in STATUS.md
- **Use RiotPlan tracking** - Never execute steps without using `riotplan_step_start` and `riotplan_step_complete`
- **Don't bypass tracking** - Even if it seems like extra overhead, tracking is essential for RiotPlan

## Handling Issues

If you encounter problems during step execution:

### Step is Blocked
If you encounter blockers:
1. Inform the user about the blocker
2. Ask if the step needs to be split using `riotplan_step_add`
3. Consider if prerequisite steps are needed
4. Document the blocker for tracking

### Acceptance Criteria Unclear
If criteria are vague:
1. Ask the user for clarification
2. Suggest more specific tasks
3. Consider if the step needs more detail

### Step Too Large
If a step is too complex:
1. Suggest using `riotplan_step_add` to break it into smaller steps
2. Ask the user how they want to proceed
3. Consider completing the current step partially and adding follow-up steps

## Example Workflow

Here's how you should execute this workflow:

1. Call `riotplan_status` with `planId`: "${planId}"
2. Review the output and identify the current step
3. Fetch the step resource or list steps
4. **Read prior step reflections** from `reflections/` directory
5. Call `riotplan_step_start` with the step number
6. Execute the step tasks (implement, test, document)
7. Call `riotplan_step_complete` when done
8. **Call `riotplan_step_reflect`** with genuine analysis of the execution
9. Call `riotplan_status` again to see progress

Remember: Always use MCP tools, never shell commands. And always use RiotPlan's tracking tools (`riotplan_step_start`, `riotplan_step_complete`, and `riotplan_step_reflect`) - don't just do the work without tracking.

## For AI Assistants

**When executing a step, you MUST:**

1. **Read prior reflections** from `reflections/` directory (if they exist)
2. Call `riotplan_step_start` BEFORE doing any work
3. Do the actual work (implement, test, document)
4. Call `riotplan_step_complete` AFTER completing the work
5. **Call `riotplan_step_reflect`** with genuine, thoughtful analysis

**Do NOT:**
- Just do the work without calling the tracking tools
- Skip STATUS.md updates
- Treat this like a regular task list
- Skip reflection or write generic summaries
- Ignore prior step reflections

**Key principle**: If you're working on a RiotPlan step, RiotPlan should manage the execution tracking AND the learning loop, not just the planning. Use the tools!

**Reflection is mandatory**: This is how RiotPlan creates inter-step communication. Later steps learn from earlier ones through reflections. Don't skip it.
