# Execute Plan

## Purpose

Guide intelligent, high-level plan execution with automatic state management. This prompt provides a conversational workflow for executing plans, automatically determining which step to work on, guiding through tasks, and managing execution state.

## When to Use

- User wants to execute a plan ("let's execute this plan", "start working on this")
- Continuing execution of a partially completed plan
- Resuming after a break
- Need guided, conversational execution experience

## Critical Context Sources

**Before beginning execution, you MUST read all plan artifacts to understand what you're implementing:**

### 1. The Idea File (`IDEA.md`)

Read this to understand:
- **Core Concept**: What are we building and why?
- **Constraints**: Requirements that must be honored during execution
- **Questions**: Uncertainties that were raised and resolved

**Action**: Read `IDEA.md` completely.

### 2. Shaping Artifacts (`SHAPING.md`)

If the plan went through shaping, read:
- **Selected Approach**: Which strategy was chosen and why
- **Tradeoffs**: What was gained and sacrificed with this choice
- **Assumptions**: Conditions that must hold true

**Action**: Read `SHAPING.md` to understand the approach being implemented.

### 3. Evidence Files (`evidence/` directory)

Review supporting materials:
- Research findings
- Example implementations
- Reference documents

**Action**: List and review evidence files. Implementation should incorporate evidence findings.

### 4. Step Files (`plan/` directory)

Read the step files to understand the execution plan:
- What each step accomplishes
- Dependencies between steps
- Acceptance criteria

**Action**: Review step files to understand the full plan.

**DO NOT SKIP THIS STEP**. Execution without reading plan artifacts will result in implementation that doesn't match the plan or violates constraints.

**Anti-Pattern**: Do NOT rely on conversation memory alone — the plan files are the source of truth.

## Workflow

### 0. Verify Plan Structure and Step Files

**CRITICAL FIRST STEP**: Before executing, verify that step files exist:

1. **Check if `plan/` directory exists** and contains step files (e.g., `01-step.md`, `02-step.md`)
2. **If step files don't exist** but `EXECUTION_PLAN.md` exists:
   - Read `EXECUTION_PLAN.md` to understand the steps
   - Create the `plan/` directory if it doesn't exist
   - Create step files from `EXECUTION_PLAN.md`:
     - Parse the execution plan to extract step information
     - Create numbered files: `01-{step-title}.md`, `02-{step-title}.md`, etc.
     - Each step file should contain:
       - Step title
       - Objective/goal
       - Tasks to complete
       - Acceptance criteria
       - Any notes from EXECUTION_PLAN.md
   - Use `riotplan_generate` tool if available, or manually create step files
3. **If neither step files nor EXECUTION_PLAN.md exist**:
   - Inform the user that the plan structure is incomplete
   - Suggest using `riotplan_generate` or `create_plan` to set up the plan properly

**Key Principle**: Never execute a plan without step files. RiotPlan manages execution through step files, not just EXECUTION_PLAN.md.

### 1. Check Plan Status

**Always start by checking current execution state:**

```typescript
riotplan_status({
  planId: "${planId}"
})
```

Analyze the response to understand:
- Total number of steps
- How many steps are complete
- Which step (if any) is currently in progress
- Which step should be started next
- Any blockers or issues
- Overall progress percentage

### 2. Determine Next Action

Based on the status, determine what to do:

#### Scenario A: No Steps Started

```
Status: ⬜ PLANNING
Current Step: Ready to begin Step 01
Progress: 0% (0/N steps)
```

**Your Response:**
"This plan has [N] steps and hasn't been started yet. Let's begin with Step 01: [title].

[Brief description of what Step 01 accomplishes]

The main tasks are:
1. [Task 1]
2. [Task 2]
3. [Task 3]

Ready to start?"

#### Scenario B: Step In Progress

```
Status: 🔄 IN_PROGRESS
Current Step: Step [N] in progress
Progress: X% (N-1/Total steps)
```

**Your Response:**
"We're currently working on Step [N]: [title].

Let me check what we've done so far..."

*Read the step file and STATUS.md to understand progress*

"It looks like we've completed [X, Y, Z]. What would you like to work on next?"

#### Scenario C: Step Complete, Next Step Pending

```
Status: 🔄 IN_PROGRESS
Current Step: Ready to begin Step [N+1]
Last Completed: Step [N]
Progress: X% (N/Total steps)
```

**Your Response:**
"Great! Step [N] is complete. We're [X]% through the plan.

Ready to move to Step [N+1]: [title]?

[Brief description of what this step accomplishes]"

#### Scenario D: All Steps Complete

```
Status: ✅ COMPLETED
Progress: 100% (N/N steps)
```

**Your Response:**
"Congratulations! All [N] steps are complete. The plan has been fully executed.

[Summary of what was accomplished]

Would you like to review the results or is there anything else you'd like to do with this plan?"

### 3. Execute Current Step

**CRITICAL**: When executing a step, you MUST use RiotPlan's tracking infrastructure. Do NOT just do the work without tracking.

When working on a step:

#### 3.1 Read Prior Step Reflections

**BEFORE starting the step, read reflections from prior steps:**

Check if the `reflections/` directory exists. If it does, read all reflection files for steps completed before the current one.

Prior reflections contain:
- What surprised the executing agent
- What took longer than expected
- What could have been done differently
- Important context for subsequent steps

**Why this matters**: Reflections create the inter-step learning channel. Step 5 learns from the challenges encountered in steps 1-4.

**Example**: If you're about to start Step 3, read `reflections/01-reflection.md` and `reflections/02-reflection.md` to understand what happened in prior steps.

#### 3.2 Start the Step

**ALWAYS mark the step as started BEFORE doing any work:**

```typescript
riotplan_step({
  action: "start",
  planId: "${planId}",
  step: N
})
```

This updates STATUS.md and sets timestamps. **Never skip this step** - it's how RiotPlan tracks progress.

#### 3.3 Read Step Details

Read the step file to understand what needs to be done:
```typescript
// Read the step file
```

Understand:
- **Objective**: What this step accomplishes
- **Tasks**: Specific things to do
- **Acceptance Criteria**: How to know it's done
- **Files Changed**: What will be modified
- **Notes**: Important considerations

#### 3.3 Guide Through Tasks

Work through each task conversationally:

1. **Explain what you're about to do**: "Let me [task description]"
2. **Do the work**: Make code changes, create files, run commands
3. **Show what you did**: "I've [what was done]"
4. **Confirm**: "Does this look right?"

Be conversational - this is pair programming, not automation.

#### 3.4 Check Acceptance Criteria

Before completing the step, verify acceptance criteria:

"Let me check the acceptance criteria:
- ✅ [Criterion 1] - Done
- ✅ [Criterion 2] - Done
- ⬜ [Criterion 3] - Still need to do this

Let me complete [Criterion 3]..."

#### 3.5 Complete the Step

**ALWAYS mark the step as complete AFTER finishing the work:**

When all tasks and criteria are met:

```typescript
riotplan_step({
  action: "complete",
  planId: "${planId}",
  step: N
})
```

This updates STATUS.md and advances the plan. **Never skip this step** - completion tracking is essential for RiotPlan.

#### 3.6 Write Step Reflection

**MANDATORY - ALWAYS write a reflection after completing a step:**

```typescript
riotplan_step_reflect({
  planId: "${planId}",
  step: N,
  reflection: "Your genuine reflection here"
})
```

**What to include:**
1. **What surprised you**: Unexpected challenges, wrong assumptions
2. **What took longer than expected**: Tasks more complex than anticipated
3. **What could be done differently**: If you could redo this step, what would you change?
4. **What the next step should know**: Critical context, warnings, insights

**This is NOT a summary**. It's genuine self-reflection about the execution experience. Be honest, specific, and creative.

**Example of good reflection:**
"This step took 45 minutes instead of 30. The authentication middleware was more tightly coupled to the session store than expected. Had to refactor the middleware interface first. Better upfront dependency analysis would have revealed this. Next step should know: new auth interface is in src/auth/interface.ts, session timeout logic still needs migration."

**Example of poor reflection:**
"Completed as planned. Tests pass."

**Anti-Pattern**: Do NOT skip reflection. This creates the inter-step learning channel.

Confirm completion with reflection:
"Step [N] is complete! [Brief summary]. Reflection captured for future steps."

### 4. Handle Blockers and Issues

If you encounter a blocker:

1. **Acknowledge it**: "I've hit a blocker: [description]"
2. **Capture it**: Add narrative about the blocker
3. **Discuss**: "Here are some options: [A, B, C]. What would you like to do?"
4. **Resolve or defer**: Either fix it now or document it and move on

If the plan needs adjustment:
- Suggest creating a checkpoint before making changes
- Use the `develop_plan` prompt to refine the plan
- Resume execution after refinement

### 5. Create Checkpoints at Key Moments

Create checkpoints during execution:

**Before risky changes:**
```typescript
riotplan_checkpoint({
  planId: "${planId}",
  name: "before-step-5",
  message: "Checkpoint before implementing database migration (Step 5)"
})
```

**After completing major phases:**
```typescript
riotplan_checkpoint({
  planId: "${planId}",
  name: "phase-1-complete",
  message: "Completed Phase 1: Data model and core types (Steps 1-4)"
})
```

**When user wants to pause:**
```typescript
riotplan_checkpoint({
  planId: "${planId}",
  name: "pause-after-step-7",
  message: "Pausing execution after Step 7. Ready to resume with Step 8."
})
```

### 6. Capture Narrative During Execution

As you work, capture the narrative of execution:

**When starting a step:**
```typescript
riotplan_idea({
  planId: "${planId}",
  content: "Starting Step 3: Implement Narrative Capture. The objective is to create MCP tool for capturing raw conversational input. This builds on the timeline extensions from Step 2.",
  speaker: "assistant",
  context: "Beginning step execution"
})
```

**When encountering challenges:**
```typescript
riotplan_idea({
  planId: "${planId}",
  content: "Ran into an issue with the timeline event types - the NarrativeChunkEvent interface wasn't exported. Fixed by adding export to types.ts. This is a common pattern we should watch for in future steps.",
  speaker: "assistant",
  context: "Problem solving during execution"
})
```

**When making decisions:**
```typescript
riotplan_idea({
  planId: "${planId}",
  content: "Decided to store inline evidence in .history/evidence/ rather than embedding in timeline. This keeps the timeline lean and makes evidence files easier to browse. User can view evidence directly as markdown files.",
  speaker: "assistant",
  context: "Implementation decision"
})
```

### 7. Iterate Until Complete

Continue the execution loop:
1. Check status
2. Determine next step
3. Execute step
4. Mark complete
5. Move to next step
6. Repeat

## Key Principles

### 1. Intelligent State Management

**Always check status first** - never assume where you are in execution:
```typescript
// Start every interaction with status check
riotplan_status({ planId: "${planId}" })
```

### 2. Conversational Execution

This is **pair programming**, not automation:
- Explain what you're doing
- Show your work
- Ask for confirmation when needed
- Discuss trade-offs and decisions
- Make it feel collaborative

### 3. Guided Experience

**Lead the user** through execution:
- "Let's start with..."
- "Next, we need to..."
- "I'll [do X], then [do Y]"
- "Ready to move to the next step?"

### 4. Flexible and Resumable

**Handle interruptions gracefully:**
- User can pause at any time
- Checkpoints preserve state
- Status shows exactly where you are
- Easy to resume later

### 5. Context-Aware

**Remember what's been done:**
- Read STATUS.md to see progress
- Check completed steps
- Understand dependencies
- Don't repeat work

## Example Execution Session

### Initial Start

**User**: "Let's execute this plan"

**AI**: *Checks status*
```typescript
riotplan_status({ planId: "${planId}" })
```

**AI**: "This plan has 13 steps for implementing Narrative Evolution with Checkpoints and Evidence. No steps have been started yet.

Let's begin with Step 01: Design Data Model. The objective is to define timeline event types for narrative chunks and checkpoints.

The main tasks are:
1. Define narrative_chunk event type structure
2. Define checkpoint_created event type structure
3. Define checkpoint storage format
4. Document event type registry
5. Design checkpoint metadata format

Ready to start?"

**User**: "Yes, let's do it"

**AI**: *Starts step*
```typescript
riotplan_step({ action: "start", planId: "${planId}", step: 1 })
```

**AI**: *Reads step file and begins work*

"Great! Let me start by creating the data model documentation. I'll define the narrative_chunk event type first..."

*Creates docs/data-model.md with event type definitions*

"I've created the data model documentation with:
- narrative_chunk event type for capturing raw conversational input
- checkpoint_created event type for marking stopping points
- Checkpoint storage format in .history/checkpoints/
- Complete event type registry

Let me also add the TypeScript types to src/types.ts..."

*Updates types.ts*

"Done! I've added all the type definitions. Let me verify the acceptance criteria:
- ✅ Event type structures defined with TypeScript types
- ✅ Checkpoint storage format documented
- ✅ Design maintains backward compatibility
- ✅ Format is simple and human-readable
- ✅ Design supports both structured and free-form input
- ✅ Checkpoint restoration strategy is clear

All criteria met! Marking Step 01 complete."

```typescript
riotplan_step({ action: "complete", planId: "${planId}", step: 1 })
```

**AI**: "Step 01 complete! We've defined the complete data model for narrative evolution.

Ready to move to Step 02: Extend Timeline Format?"

### Continuing Execution

**User**: "Yes, continue"

**AI**: *Starts Step 02*

"Step 02 focuses on implementing support for narrative_chunk events in the timeline. Let me read the step details..."

*Continues execution*

### Resuming After Break

**User**: "Let's continue working on this plan"

**AI**: *Checks status*
```typescript
riotplan_status({ planId: "${planId}" })
```

**AI**: "Welcome back! We're currently working on Step 05: Implement Checkpoint Creation. We've completed steps 1-4 (31% progress).

Step 05 is about creating the MCP tool for checkpoint creation. Let me check what's been done so far..."

*Reads step file and continues from where left off*

## Anti-Patterns

❌ **Don't**: Ask user which step to work on - determine it from status
✅ **Do**: Check status and automatically determine next action

❌ **Don't**: Lose track of where you are in execution
✅ **Do**: Always check status to understand current state

❌ **Don't**: Skip tasks or acceptance criteria
✅ **Do**: Work through each task and verify criteria before completing

❌ **Don't**: Make changes without explaining what you're doing
✅ **Do**: Explain, do, confirm - make it conversational

❌ **Don't**: Complete steps without actually doing the work
✅ **Do**: Implement everything specified in the step

❌ **Don't**: Execute steps without using RiotPlan tracking tools
✅ **Do**: ALWAYS use `riotplan_step` with `action: "start"` before work and `action: "complete"` after work

❌ **Don't**: Just do the work and skip STATUS.md updates
✅ **Do**: Let RiotPlan manage execution state through its tools

❌ **Don't**: Execute a plan without step files in `plan/` directory
✅ **Do**: Create step files from EXECUTION_PLAN.md if they don't exist before executing

❌ **Don't**: Treat RiotPlan like a regular task list
✅ **Do**: Use RiotPlan's infrastructure - step files, STATUS.md, and tracking tools

## Plan Completion Workflow

When you complete the final step of a plan, the system will signal that all steps are done. At this point, you should generate a plan retrospective to capture learning from the execution.

### The Completion Sequence

1. **Complete the final step** with `riotplan_step` (`action: "complete"`)
2. **System signals**: "All steps completed! Generate plan retrospective."
3. **Write final step reflection** with `riotplan_step_reflect`
4. **Consider model switching**: Retrospectives benefit from highest-tier models
5. **Generate retrospective** with `riotplan_generate_retrospective`
6. **Confirm completion**: "Plan execution complete with retrospective captured."

### Model Tier Recommendation for Retrospectives

**IMPORTANT**: Retrospective generation requires creative analysis and pattern recognition. For best results:

- **Use the highest-tier model available** (e.g., Claude Opus, GPT-4)
- **Lower-tier models** tend to produce generic observations rather than surprising insights
- **If currently using a mid-tier model**, consider pausing and switching before generating the retrospective

The retrospective is the final deliverable of plan execution. It's worth using the best model for this task.

### Example Completion Flow

**Agent completes final step:**
```typescript
riotplan_step({ action: "complete", planId: "${planId}", step: 8 })
```

**System response:**
"🎉 All steps completed! Plan execution is finished. Generate plan retrospective with `riotplan_generate_retrospective`. Recommend using highest-tier model."

**Agent writes final reflection:**
```typescript
riotplan_step_reflect({ 
  planId: "${planId}", 
  step: 8,
  reflection: "Final step reflection..."
})
```

**Agent (or user after model switch) generates retrospective:**
```typescript
riotplan_generate_retrospective({ planId: "${planId}" })
```

**Result:** `retrospective.md` is created with high-value analysis of the entire execution.

## State Transitions

```
⬜ PLANNING → 🔄 IN_PROGRESS (first step started)
🔄 IN_PROGRESS → 🔄 IN_PROGRESS (completing steps)
🔄 IN_PROGRESS → ✅ COMPLETED (last step completed)
```

## Integration with Other Prompts

### From develop_plan to execute_plan

After refining a plan:
"The plan looks good! Ready to start executing?"
→ Switch to execute_plan prompt

### From execute_plan to develop_plan

If plan needs adjustment during execution:
"I think we need to adjust the plan. Let me create a checkpoint first..."
→ Create checkpoint, switch to develop_plan prompt

### Using checkpoints during execution

Create checkpoints liberally:
- Before risky changes
- After completing phases
- When pausing
- When trying alternative approaches

## Advanced: Parallel Execution

For plans with independent steps:

"Steps 3 and 4 are independent - we could work on them in parallel. Would you like to tackle Step 3 first, or should we do Step 4?"

*User chooses*

"Great! Let's work on Step [N]. We can come back to Step [M] afterward."

## Notes

- This prompt provides **high-level execution guidance**, not low-level task automation
- The goal is **conversational pair programming**, not silent automation
- **Always check status** before taking action
- **Capture narrative** as you work - document decisions, challenges, solutions
- **Create checkpoints** at key moments for recovery and documentation
- **Be flexible** - handle interruptions, blockers, and plan changes gracefully
- The timeline will show the **complete execution journey**, not just the final result

## For AI Assistants: Execution Tracking Requirements

**When a user says "let's execute the plan" or "start working on this plan":**

1. **Check if step files exist** in `plan/` directory
   - If not, create them from `EXECUTION_PLAN.md` before proceeding
   - Step files are REQUIRED for RiotPlan execution tracking

2. **For each step you execute:**
   - Call `riotplan_step` with `action: "start"` BEFORE doing any work
   - Do the actual work (implement, test, document)
   - Call `riotplan_step` with `action: "complete"` AFTER completing the work
   - Let RiotPlan update STATUS.md automatically

3. **Don't just do the work** - Use RiotPlan's infrastructure to track progress
   - Even if it feels like extra overhead, tracking is essential
   - STATUS.md must reflect current state
   - Step files must exist and be used

4. **Key principle**: If you're working on a RiotPlan, RiotPlan should manage the execution, not just the planning.

**Remember**: RiotPlan managed the thinking (idea → shaping → planning), so it should also manage the execution. Use the tools!
