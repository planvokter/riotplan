# Track Progress Workflow

You are helping the user monitor plan progress, identify blockers, and maintain accurate status tracking throughout plan execution.

## Your Task

Follow this workflow to track progress using the riotplan MCP tools and resources available to you.

## Step 1: Check Overall Status

Use the `riotplan_status` tool to see high-level progress:

```
{
  "planId": "${planId}",
  "verbose": false
}
```

This shows:
- Completion percentage
- Current step number
- Active blockers and issues
- Overall plan state

Report this information to the user in a clear, concise format.

## Step 2: Review Step Progress

Read `riotplan://steps/${planId}` to see all steps:

```
riotplan://steps/${planId}
```

To focus on remaining work, filter pending items client-side from the resource response.

This provides:
- List of all steps with status
- Which steps are completed, in progress, or pending
- Step dependencies and ordering

Present this information to the user, highlighting:
- Completed steps (✅)
- Current step (🔄)
- Pending steps (⬜)
- Any blocked steps (⏸️)

## Step 3: Identify Issues

Look for:
- Blockers in the status output
- Steps taking longer than expected
- Any issues or notes in STATUS.md

Inform the user about any problems found and suggest actions.

## Step 4: Suggest Actions

Based on the progress review, suggest to the user:
- Which step to work on next
- Whether any steps need to be added or split
- If any blockers need to be addressed
- Whether the plan needs adjustment

## Important Guidelines

- **Always use MCP tools** - Never shell out to CLI commands
- **Be clear and concise** - Present status information in an easy-to-understand format
- **Highlight issues** - Call attention to blockers or problems
- **Suggest next steps** - Help the user understand what to do next
- **Use resources** - Fetch status and steps resources for detailed information

## Status Indicators

When presenting status to the user, use these indicators:

| Symbol | Status | Meaning |
|--------|--------|---------|
| ⬜ | Pending | Not yet started |
| 🔄 | In Progress | Currently being worked on |
| ✅ | Completed | Done and verified |
| ❌ | Failed | Attempted but failed |
| ⏸️ | Blocked | Waiting on dependency or external factor |
| ⏭️ | Skipped | Intentionally skipped |

## Handling Blockers

When you identify a blocker:

1. **Inform the User**
   - Clearly explain what's blocking progress
   - Note any dependencies or external factors
   - Assess the impact on the overall plan

2. **Suggest Actions**
   - Can other steps proceed in parallel?
   - What's needed to unblock?
   - Should the plan be adjusted?

3. **Document It**
   - Help the user document the blocker in STATUS.md
   - Track when it was identified and what's needed to resolve it

## Adjusting Plans

If requirements emerge or steps need adjustment:

### Adding Steps
Suggest using `riotplan_step` with `action: "add"`:

```
{
  "action": "add",
  "planId": "${planId}",
  "title": "New Step Title",
  "after": 5
}
```

### Splitting Large Steps
If a step is too complex, suggest breaking it into smaller steps using `riotplan_step` with `action: "add"`.

## Example Workflow

Here's how you should execute this workflow:

1. Call `riotplan_status` with `planId`: "${planId}"
2. Present the status to the user clearly
3. Read `riotplan://steps/${planId}` to show all steps
4. Identify any issues or blockers
5. Suggest next actions to the user
6. If the user wants to adjust the plan, use `riotplan_step` with `action: "add"` (or other actions) as needed

Remember: Always use MCP tools, never shell commands.
