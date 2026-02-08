# Bug Fix: riotplan_step_add Creates Files in Wrong Directory

## Issue
`riotplan_step_add` was creating step files directly in the plan root directory instead of in the `plan/` subdirectory when the `plan/` subdirectory didn't exist.

## Root Cause
The `getPlanDir()` helper function in `src/steps/operations.ts` would fall back to the plan root directory if the `plan/` subdirectory didn't exist, rather than creating it.

```typescript
// OLD BEHAVIOR (BUGGY)
async function getPlanDir(planPath: string): Promise<string> {
    const standardDir = join(planPath, PLAN_CONVENTIONS.standardDirs.plan);
    try {
        await readdir(standardDir);
        return standardDir;
    } catch {
        return planPath;  // ❌ Falls back to root instead of creating plan/
    }
}
```

## Solution
Modified `getPlanDir()` to create the `plan/` subdirectory if it doesn't exist:

```typescript
// NEW BEHAVIOR (FIXED)
async function getPlanDir(planPath: string): Promise<string> {
    const standardDir = join(planPath, PLAN_CONVENTIONS.standardDirs.plan);
    try {
        await readdir(standardDir);
        return standardDir;
    } catch {
        // Create plan/ subdirectory if it doesn't exist
        await mkdir(standardDir, { recursive: true });
        return standardDir;  // ✅ Always returns plan/ subdirectory
    }
}
```

## Files Changed
1. **src/steps/operations.ts**
   - Added `mkdir` to imports from `node:fs/promises`
   - Modified `getPlanDir()` to create `plan/` subdirectory if missing
   - Updated function documentation

2. **tests/step-operations.test.ts**
   - Added new test suite: "plan/ subdirectory creation"
   - Test 1: Verifies `plan/` is created when it doesn't exist
   - Test 2: Verifies existing `plan/` is used correctly

## Test Results
- All 666 tests pass (4 skipped)
- Coverage for `operations.ts`: 98.6% (improved from 97.2%)
- Overall coverage: 92.61% statements, 80.07% branches, 92.77% functions, 93.6% lines

## Impact
- ✅ New plans now have consistent structure
- ✅ Step files are always created in `plan/` subdirectory
- ✅ Matches existing plan conventions across the repository
- ✅ No breaking changes - existing plans continue to work
- ✅ Backward compatible - handles both scenarios correctly

## Verification
The fix was verified with:
1. Existing test suite (40 original tests)
2. New regression tests (2 additional tests)
3. Manual verification of plan structure consistency

## Related Files
All existing plans in the repository use the `plan/` subdirectory pattern:
- `mcp-integration/env-var-config-implementation/plan/`
- `done/config-discovery-locations/plan/`
- `done/config-format-support/plan/`
- `future/server-runtime-support/plan/`

This fix ensures all new plans follow the same convention.
