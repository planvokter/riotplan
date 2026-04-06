# Managing Steps

Learn how to work with plan steps — listing, starting, completing, and adding steps — all via MCP tools.

## Overview

Steps are the fundamental units of work in a plan. Each step:
- Has a unique number (01, 02, 03, etc.)
- Contains specific tasks and acceptance criteria
- Tracks its own status independently
- Can depend on other steps

All step management is done through the `riotplan_step` MCP tool. Ask your AI assistant to perform step operations for you.

## Listing Steps

### Show All Steps

> "List all steps in the user-auth plan."

This calls `riotplan_step` and returns the full step list with statuses.

### Show Only Pending Steps

> "Show only pending steps in the user-auth plan."

### JSON Output

The MCP tool returns structured data:

```json
{
  "steps": [
    {
      "number": 1,
      "title": "analysis",
      "status": "completed",
      "file": "plan/01-analysis.md",
      "started": "2026-01-08",
      "completed": "2026-01-08"
    },
    {
      "number": 5,
      "title": "implementation-api",
      "status": "in_progress",
      "file": "plan/05-implementation-api.md",
      "started": "2026-01-10",
      "completed": null
    }
  ]
}
```

## Starting Steps

### Start Next Pending Step

> "Start the next pending step in the user-auth plan."

This finds the first pending step and marks it as in-progress.

### Start Specific Step

> "Start step 5 in the user-auth plan."

### What Happens

When you start a step:
1. STATUS.md is updated
2. Step status changes to 🔄 In Progress
3. Start timestamp is recorded
4. Current step pointer is updated

**STATUS.md update:**

```markdown
| 05 | Implementation API | 🔄 In Progress | 2026-01-10 | - | - |
```

## Completing Steps

### Complete Current Step

> "Mark the current step as complete in the user-auth plan."

### Complete Specific Step

> "Mark step 5 as complete in the user-auth plan."

### What Happens

When you complete a step:
1. STATUS.md is updated
2. Step status changes to ✅ Completed
3. Completion timestamp is recorded
4. Progress percentage is updated
5. Current step advances to next pending

**STATUS.md update:**

```markdown
| 05 | Implementation API | ✅ Completed | 2026-01-10 | 2026-01-10 | All endpoints working |
```

## Adding Steps

### Add Step at End

> "Add a step called 'Integration Testing' to the user-auth plan."

Creates `plan/09-integration-testing.md` (assuming 8 steps exist).

### Add Step at Specific Position

> "Add a step called 'Security Audit' at position 7 in the user-auth plan."

Creates `plan/07-security-audit.md` and renumbers subsequent steps:
- Old `07-documentation.md` → `08-documentation.md`
- Old `08-release.md` → `09-release.md`

### Add Step After Another

> "Add a step called 'Code Review' after step 5 in the user-auth plan."

Creates `plan/06-code-review.md` and renumbers subsequent steps.

### What Happens

When you add a step:
1. New step file is created
2. Subsequent steps are renumbered
3. STATUS.md is updated with new step
4. EXECUTION_PLAN.md may need manual update

## Step Status Indicators

| Symbol | Status | Meaning |
|--------|--------|---------|
| ⬜ | `pending` | Not started |
| 🔄 | `in_progress` | Currently active |
| ✅ | `completed` | Done |
| ❌ | `failed` | Failed with error |
| ⏸️ | `blocked` | Waiting on dependency |
| ⏭️ | `skipped` | Intentionally skipped |

## Marking Steps as Failed

> "Mark step 5 as failed with reason 'Database migration error' in the user-auth plan."

Updates STATUS.md:

```markdown
| 05 | Implementation API | ❌ Failed | 2026-01-10 | - | Database migration error |
```

## Marking Steps as Blocked

> "Mark step 6 as blocked with reason 'Waiting for API key from DevOps' in the user-auth plan."

Updates STATUS.md:

```markdown
| 06 | Testing | ⏸️ Blocked | - | - | Waiting for API key |
```

And adds to Blockers section:

```markdown
## Blockers

- Step 06 (Testing): Waiting for API key from DevOps team
```

## Skipping Steps

> "Skip step 7 with reason 'Documentation will be done separately' in the user-auth plan."

Updates STATUS.md:

```markdown
| 07 | Documentation | ⏭️ Skipped | - | - | Will be done separately |
```

## Viewing Step Details

### Read Step Content

> "Show me the content of step 5 in the user-auth plan."

This uses the `riotplan://step/{path}?number={n}` MCP resource to retrieve the full step file.

### Show Step Status

> "What's the status of step 5 in the user-auth plan?"

Returns:

```
Step 05: Implementation API
Status: 🔄 In Progress
File: plan/05-implementation-api.md
Started: 2026-01-10
Progress: 50%

Tasks:
- [x] Create Express routes
- [x] Add validation middleware
- [ ] Implement error handling
- [ ] Add rate limiting
```

## Step Dependencies

### Viewing Dependencies

> "Show dependencies for step 5 in the user-auth plan."

Returns:

```
Step 05: Implementation API

Prerequisites:
- Step 01 (Analysis) ✅ Completed
- Step 02 (Design) ✅ Completed
- Step 04 (Core Implementation) ✅ Completed

Blocks:
- Step 06 (Testing)
- Step 07 (Documentation)
```

### Dependency Validation

RiotPlan validates dependencies automatically. If you try to start a step whose prerequisites aren't complete, the tool will return an error explaining which steps need to be finished first.

## Programmatic Usage

### List Steps

```typescript
import { loadPlan } from '@planvokter/riotplan';

const plan = await loadPlan('./my-feature');

// Get all steps
const allSteps = plan.steps;

// Get pending steps
const pendingSteps = plan.steps.filter(s => s.status === 'pending');

// Get current step
const currentStep = plan.steps.find(s => s.number === plan.state.currentStep);
```

### Start Step

```typescript
import { loadPlan, startStep } from '@planvokter/riotplan';

const plan = await loadPlan('./my-feature');
const updatedPlan = await startStep(plan, 5);
```

### Complete Step

```typescript
import { loadPlan, completeStep } from '@planvokter/riotplan';

const plan = await loadPlan('./my-feature');
const updatedPlan = await completeStep(plan, 5, {
  notes: 'All endpoints working correctly'
});
```

### Add Step

```typescript
import { loadPlan, addStep } from '@planvokter/riotplan';

const plan = await loadPlan('./my-feature');
const updatedPlan = await addStep(plan, {
  title: 'Integration Testing',
  description: 'Test all components together',
  after: 5  // Insert after step 5
});
```

## Best Practices

### Step Granularity

**Good:**
- Each step completable in one session (1-4 hours)
- Clear deliverables
- Testable outcomes

**Too Large:**
- "Implement entire feature" (break into smaller steps)
- Multiple days of work
- Unclear when "done"

**Too Small:**
- "Add import statement"
- Trivial changes
- No meaningful checkpoint

### Naming Steps

**Good:**
- `01-database-schema.md`
- `02-user-model.md`
- `03-authentication-endpoints.md`

**Not as good:**
- `01-db.md` (too abbreviated)
- `02-stuff.md` (not descriptive)
- `03-do-the-thing.md` (vague)

### Recording Progress

Add notes when completing steps:

> "Mark step 5 as complete with notes: 'Implemented all CRUD endpoints. Added validation. Rate limiting pending.'"

This helps when resuming work later.

### Handling Failures

When a step fails:

1. **Mark as failed** with reason
2. **Document the issue** in the plan
3. **Decide action**:
   - Fix and retry
   - Skip with justification
   - Block until resolved

### Dependencies

Document dependencies in step files:

```markdown
## Prerequisites
- Step 01 (Analysis) must be completed
- Step 02 (Design) must be completed
- Database must be configured
```

RiotPlan validates these automatically.

## Next Steps

- Explore [MCP Tools](mcp-tools) — All available MCP tools
- Read [STATUS.md Format](status-format) — Understanding status tracking
- Understand [Programmatic Usage](programmatic-usage) — Using the API
- Learn about [Plan Structure](plan-structure) — Plan anatomy
