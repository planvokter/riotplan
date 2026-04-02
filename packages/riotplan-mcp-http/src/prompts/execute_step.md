# Execute Step Workflow

You are helping the user execute one plan step using RiotPlan MCP tools and resources.

## Your Task

Follow this sequence exactly. Tracking is mandatory:
1. `riotplan_status`
2. `riotplan_step` with `action: "start"`
3. Execute work
4. `riotplan_step` with `action: "complete"`
5. `riotplan_step_reflect`

Do not execute step work without start/complete/reflect tracking.

## Step 1: Check Plan Status

Use `riotplan_status` first:

```
{
  "planId": "${planId}",
  "verbose": false
}
```

Identify the target step number and confirm there are no blockers.

## Step 2: Read Execution Context from Resources

Before coding, gather step context from resources (not filesystem assumptions).

### 2a. Read Step Details

Use:

```
riotplan://step/${planId}?number={stepNumber}
```

If you need overview context, list steps via:

```
riotplan://steps/${planId}
```

Review objectives, acceptance criteria, dependencies, and test expectations.

### 2b. Read Evidence and Prior Learnings

Read evidence that informs this step through RiotPlan evidence resources/artifacts.

Read prior reflections and execution learnings through available reflection/history resources or timeline events.

Do not execute from memory when relevant evidence or prior reflections exist.

### 2c. Check Selected Approach Alignment (Required)

Read shaping and plan context to identify the selected approach, if present.

Before starting execution, verify the current step remains consistent with that selected approach.

If the step appears inconsistent with the selected approach, pause and ask the user how to proceed before doing work.

## Step 3: Mark Step as Started

Call `riotplan_step` with `action: "start"` before any implementation:

```
{
  "action": "start",
  "planId": "${planId}",
  "step": N
}
```

## Step 4: Execute the Step

Implement and validate the step according to its acceptance criteria:
- Make required changes
- Add or update tests
- Update documentation when needed

## Step 5: Verify Completion

Before completing:
- Acceptance criteria are satisfied
- Tests relevant to the step pass
- Required artifacts/changes are present

## Step 6: Mark Step as Complete

Call `riotplan_step` with `action: "complete"` after work is done:

```
{
  "action": "complete",
  "planId": "${planId}",
  "step": N
}
```

## Step 7: Write Step Reflection (Mandatory)

Call `riotplan_step_reflect` immediately after completion:

```
{
  "planId": "${planId}",
  "step": N,
  "reflection": "What surprised you, what took longer, what you'd change, and what the next step should know."
}
```

Keep reflections specific and useful for later steps.

## Step 8: Check Updated Progress

Call `riotplan_status` again to confirm progress and identify the next step.

## Handling Issues

### Blocked Step
1. Tell the user what is blocked
2. Ask whether to split or reorder steps
3. Capture blocker context in RiotPlan tracking

### Unclear Acceptance Criteria
1. Ask for clarification
2. Propose a concrete interpretation
3. Continue only after criteria are clear

### Approach Mismatch
1. Describe the mismatch with selected approach
2. Pause execution
3. Ask user whether to adjust the step or change approach

## Example Workflow

1. Call `riotplan_status` for `${planId}`
2. Read `riotplan://steps/${planId}` and `riotplan://step/${planId}?number={stepNumber}`
3. Read evidence resources/artifacts and relevant reflection/history/timeline context
4. Confirm selected approach alignment
5. Call `riotplan_step` with `action: "start"`
6. Execute and verify the step
7. Call `riotplan_step` with `action: "complete"`
8. Call `riotplan_step_reflect`
9. Call `riotplan_status` again

Use MCP tools/resources only; do not bypass tracking.
