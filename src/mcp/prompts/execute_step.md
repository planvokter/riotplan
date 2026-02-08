# Execute Step Workflow

You are helping the user execute a single step from a plan, following the guidance in the step file and updating status appropriately.

## Your Task

Follow this workflow to execute a plan step using the riotplan MCP tools and resources available to you.

**CRITICAL**: This workflow REQUIRES using RiotPlan's tracking infrastructure. You MUST use `riotplan_step_start` before work and `riotplan_step_complete` after work. Do NOT just do the work without tracking.

## Step 1: Check Plan Status

Use the `riotplan_status` tool to check the current plan state:

```
{
  "path": "${path}",
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
riotplan://step/${path}?number={stepNumber}
```

Or use the `riotplan_step_list` tool to see all steps:

```
{
  "path": "${path}",
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

## Step 3: Mark Step as Started

**CRITICAL**: You MUST use the `riotplan_step_start` MCP tool to mark the step as in progress BEFORE doing any work:

```
{
  "path": "${path}",
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
  "path": "${path}",
  "step": N
}
```

This updates STATUS.md and advances the plan to the next step. **Never skip this step** - completion tracking is essential. If you complete work without calling this tool, RiotPlan won't know the step is done.

## Step 7: Check Overall Progress

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

1. Call `riotplan_status` with path: "${path}"
2. Review the output and identify the current step
3. Fetch the step resource or list steps
4. Call `riotplan_step_start` with the step number
5. Execute the step tasks (implement, test, document)
6. Call `riotplan_step_complete` when done
7. Call `riotplan_status` again to see progress

Remember: Always use MCP tools, never shell commands. And always use RiotPlan's tracking tools (`riotplan_step_start` and `riotplan_step_complete`) - don't just do the work without tracking.

## For AI Assistants

**When executing a step, you MUST:**

1. Call `riotplan_step_start` BEFORE doing any work
2. Do the actual work (implement, test, document)
3. Call `riotplan_step_complete` AFTER completing the work

**Do NOT:**
- Just do the work without calling the tracking tools
- Skip STATUS.md updates
- Treat this like a regular task list

**Key principle**: If you're working on a RiotPlan step, RiotPlan should manage the execution tracking, not just the planning. Use the tools!
