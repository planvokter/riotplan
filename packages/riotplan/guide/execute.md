# Executing a Plan

**Purpose**: Instructions for executing a RiotPlan, either via CLI or direct LLM execution.

## Overview

A RiotPlan is executed by working through the steps defined in `EXECUTION_PLAN.md`, updating `STATUS.md` after each step to track progress. This enables interrupted work to be resumed and provides visibility into plan progress.

---

## Method 1: Execute Using RiotPlan CLI

The CLI provides structured commands for managing plan execution.

### Prerequisites

```bash
# Install riotplan
npm install -g riotplan

# Navigate to plan directory
cd ./prompts/my-feature
```

### Check Current Status

```bash
# View plan status
riotplan status

# Verbose output
riotplan status -v
```

### List Steps

```bash
# List all steps with their current state
riotplan step list

# Show only pending steps
riotplan step list --pending
```

### Execute Steps

```bash
# Start the next pending step
riotplan step start

# Start a specific step
riotplan step start 03

# Mark a step as complete
riotplan step complete 03
```

### Resume Interrupted Work

```bash
# Resume from where you left off
riotplan resume

# Skip failed steps and continue
riotplan resume --skip-failed
```

---

## Method 2: Direct LLM Execution (Without CLI)

When executing a plan directly as an LLM, follow these instructions:

### Step 1: Read the Execution Plan

Read `EXECUTION_PLAN.md` first. This file contains:
- The ordered sequence of steps to execute
- Dependencies between steps
- Quality gates and verification points
- Commit strategies (if applicable)

```
Execute: "Read EXECUTION_PLAN.md"
```

### Step 2: Check Current Status

Read `STATUS.md` to understand:
- Current plan status (`pending`, `in_progress`, `completed`, `blocked`)
- Which step is currently active
- Which steps are already completed
- Any blockers or issues

```
Execute: "Read STATUS.md to find current state"
```

### Step 3: Identify the Next Step

From the execution plan and status:
1. Find the first step that is not `completed` or `skipped`
2. Verify any dependencies are satisfied
3. Read the step file from the `plan/` directory

```
Execute: "Read plan/XX-step-name.md"
```

### Step 4: Execute the Step

Follow the instructions in the step file. Each step file typically contains:
- **Goal**: What this step accomplishes
- **Prerequisites**: What must be done first
- **Tasks**: Specific work items
- **Acceptance Criteria**: How to verify completion
- **Verification**: Commands or checks to run

### Step 5: Update STATUS.md

After completing each step, update `STATUS.md`:

1. Change the step status from `🔄 In Progress` to `✅ Completed`
2. Add completion timestamp
3. Update the `Current Step` to the next pending step
4. Record any issues or blockers encountered
5. Add notes if relevant

**Example STATUS.md update:**

```markdown
| 03 | Implementation | ✅ Completed | 2026-01-25 | 2026-01-25 | Implemented with tests |
| 04 | Testing | 🔄 In Progress | 2026-01-25 | - | - |
```

### Step 6: Run Quality Gates

If the execution plan specifies quality gates, run them:

```bash
# Common quality gates
npm run test
npm run lint
npm run precommit
```

### Step 7: Continue or Complete

- If more steps remain: Return to Step 3
- If all steps complete: Update STATUS.md final status to `completed`

---

## Status Indicators

| Symbol | Status | Meaning |
|--------|--------|---------|
| ⬜ | `pending` | Not started |
| 🔄 | `in_progress` | Currently active |
| ✅ | `completed` | Done |
| ❌ | `failed` | Failed with error |
| ⏸️ | `blocked` | Waiting on dependency |
| ⏭️ | `skipped` | Intentionally skipped |

---

## LLM Execution Quick Reference

```
1. Read EXECUTION_PLAN.md
2. Read STATUS.md 
3. Find next pending step
4. Read plan/XX-step-name.md
5. Execute the step
6. Update STATUS.md
7. Run quality gates
8. Repeat until complete
```

### Sample Prompt for LLM Execution

> Execute the plan at `./prompts/my-feature/EXECUTION_PLAN.md`. Start by reading STATUS.md to find the current state, then execute the next pending step and update STATUS.md when complete.

---

## Handling Failures

When a step fails:

1. **Update STATUS.md** with `❌ Failed` status
2. **Document the failure** in the Issues section
3. **Decide action**:
   - Fix and retry the step
   - Skip the step (`⏭️ Skipped`) with justification
   - Block execution (`⏸️ Blocked`) until resolved

**Example failure documentation:**

```markdown
## Issues

- Step 03 failed: Database migration error
  - Cause: Missing foreign key constraint
  - Resolution: Need to run step 02 migration first
```

---

## Verification

After execution completes, verify the plan:

```bash
# Verify analysis coverage (plan addresses requirements)
riotplan verify --analysis

# Verify execution completion (all steps done)
riotplan verify --execution

# Full verification
riotplan verify
```

For LLMs: Review that all acceptance criteria in each step file have been met, and that STATUS.md accurately reflects completion.
