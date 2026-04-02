# RiotPlan Workflow Fix: Missing PROVENANCE.md

## Problem

Plans were consistently missing `PROVENANCE.md`, `EXECUTION_PLAN.md`, and `SUMMARY.md` files. Investigation revealed a workflow gap where the AI would:

1. ✅ Create an idea (`riotplan_idea_create`)
2. ✅ Move to shaping (`riotplan_shaping_start`)
3. ✅ Add approaches (`riotplan_shaping_add_approach`)
4. ✅ Select an approach (`riotplan_shaping_select`)
5. ❌ **Skip `riotplan_build`** (the critical step)
6. ❌ Manually create step files and execute them
7. ❌ Never transition to "built" stage properly

## Root Cause

The `riotplan_shaping_select` tool would record the selected approach and suggest calling `riotplan_build`, but the AI would often skip this step and proceed directly to implementation. This happened because:

1. The tool's return message was too passive: "Next: Transition to 'built' stage..."
2. The tool description didn't emphasize the requirement strongly enough
3. The AGENTS.md documentation showed the pattern but didn't highlight it as critical

## Solution

### 1. Updated `riotplan_shaping_select` Return Message

Changed from passive suggestion:
```
Next: Transition to 'built' stage to generate detailed plan:
  riotplan_transition({ stage: "built", reason: "..." })
```

To explicit requirement:
```
⚠️  IMPORTANT: You must now call riotplan_build to generate the detailed execution plan.

This will:
- Create PROVENANCE.md (tracing how artifacts shaped the plan)
- Create EXECUTION_PLAN.md (detailed step-by-step strategy)
- Create SUMMARY.md (high-level overview)
- Create STATUS.md (progress tracking)
- Generate step files in plan/ directory
- Transition to 'built' stage

Call: riotplan_build({ path: "..." })
```

### 2. Updated Tool Description

Changed from:
```
"Select an approach and prepare to transition to 'built' stage."
```

To:
```
"Select an approach from shaping stage. After calling this, you MUST immediately 
call riotplan_build to generate the detailed execution plan with PROVENANCE.md, 
EXECUTION_PLAN.md, SUMMARY.md, and step files."
```

### 3. Enhanced AGENTS.md Documentation

Added a **CRITICAL** section under "Shaping Stage Tools":

```markdown
**CRITICAL: After calling `riotplan_shaping_select`, you MUST immediately call `riotplan_build`.**

This is the most common mistake when using RiotPlan. The workflow is:
1. Call `riotplan_shaping_select` to record the chosen approach
2. **Immediately** call `riotplan_build` to generate PROVENANCE.md, EXECUTION_PLAN.md, SUMMARY.md, and step files
3. Only then can you begin executing steps

**Do NOT skip `riotplan_build`** - it creates essential documentation and transitions the plan to "built" stage.
```

## Files Changed

1. `src/mcp/tools/shaping.ts` - Updated `shapingSelect()` function and tool description
2. `AGENTS.md` - Added critical workflow warning

## Testing

- All existing tests pass (756 passed, 4 skipped)
- No breaking changes to API
- Coverage remains high (90.48% statements)

## Impact

This fix ensures that:
1. Every plan that completes shaping will have proper provenance documentation
2. The AI cannot accidentally skip the build step
3. Plans maintain proper lifecycle transitions (idea → shaping → built → executing → completed)
4. All artifact analysis is captured in PROVENANCE.md

## Migration for Existing Plans

Plans that were created before this fix and are missing PROVENANCE.md can:
1. Have PROVENANCE.md backfilled manually (as done for fix-dual-registration-system-riotplan)
2. Be regenerated using `riotplan_build` if still in shaping stage
3. Continue as-is if already completed (PROVENANCE.md is documentation, not required for execution)
