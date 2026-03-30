# Changelog: Plan Manifest Auto-Creation

## Changes

### Added

- **`ensurePlanManifest()` utility function** in `src/mcp/tools/shared.ts`
  - Automatically creates `plan.yaml` manifest if missing
  - Idempotent - safe to call multiple times
  - Auto-generates id and title from directory name
  - Gracefully handles missing riotplan-catalyst package
  - Returns boolean indicating if manifest was created

- **`riotplan_backfill_manifests` MCP tool** in `src/mcp/tools/backfill-manifests.ts`
  - Recursively scans directory tree for plan directories
  - Creates manifests for all plans that lack them
  - Supports dry-run mode
  - Configurable verbosity
  - Safe to run multiple times

### Modified

- **`riotplan_create`** - Now always creates manifest (not just when catalysts provided)
- **`riotplan_idea_create`** - Now creates manifest when creating new idea
- **`riotplan_build`** - Now creates manifest when building from idea/shaping
- **`riotplan_step_start`** - Ensures manifest exists before starting step
- **`riotplan_step_complete`** - Ensures manifest exists before completing step
- **`riotplan_shaping_start`** - Ensures manifest exists when starting shaping
- **`riotplan_status`** - Ensures manifest exists when checking status

## Behavior Changes

### Before

```
riotplan_create({ code: 'my-plan', description: '...' })
→ Creates plan WITHOUT plan.yaml

riotplan_create({ code: 'my-plan', description: '...', catalysts: ['@foo/bar'] })
→ Creates plan WITH plan.yaml
```

### After

```
riotplan_create({ code: 'my-plan', description: '...' })
→ Creates plan WITH plan.yaml (minimal: id, title, created)

riotplan_create({ code: 'my-plan', description: '...', catalysts: ['@foo/bar'] })
→ Creates plan WITH plan.yaml (includes catalysts array)
```

## Migration

### For Existing Plans

Run the backfill tool to add manifests to all existing plans:

```typescript
// Via MCP
riotplan_backfill_manifests({ 
    path: '/path/to/plans',
    verbose: true
})
```

Or just use any plan - the manifest will be auto-created on first access:

```typescript
// These will auto-create manifest if missing:
riotplan_status({ path: '/path/to/plan' })
riotplan_step_start({ path: '/path/to/plan', step: 1 })
```

### For New Plans

No changes needed - manifests are created automatically.

## Backward Compatibility

✅ **Fully backward compatible:**

- Plans without manifests continue to work
- `readPlanManifest()` returns `null` for missing manifests
- `ensurePlanManifest()` is a no-op if manifest exists
- If riotplan-catalyst is not installed, silently skips

## Implementation Notes

### Why MCP Tools Only?

The manifest creation is implemented in the MCP tool layer, not in the core `createPlan()` function. This is intentional:

1. **Separation of concerns:** Core library handles plan structure, MCP tools handle metadata
2. **Optional dependency:** Manifest requires `@planvokter/riotplan-catalyst` which is optional
3. **MCP-specific feature:** Manifests are primarily used by MCP tools for catalyst tracking

### Manifest Auto-Creation Strategy

The "touch to create" approach ensures:

1. **Lazy creation:** Manifests created only when needed
2. **No breaking changes:** Old plans work until first access
3. **Consistent state:** Once created, manifest is always present
4. **User control:** Backfill tool for bulk operations

## Testing

### Build Status

✅ Build successful:
```
npm run build
✓ built in 1.70s
MCP build complete!
```

### Linter Status

✅ No linter errors in modified files

### Manual Testing

To test the changes:

1. **Create new plan:**
   ```typescript
   riotplan_idea_create({ code: 'test-plan', description: 'Test' })
   // Check for plan.yaml in created directory
   ```

2. **Backfill existing plans:**
   ```typescript
   riotplan_backfill_manifests({ 
       path: '/path/to/plans',
       verbose: true,
       dryRun: true  // First run as dry-run
   })
   ```

3. **Touch existing plan:**
   ```typescript
   riotplan_status({ path: '/path/to/old-plan' })
   // Check for plan.yaml - should be auto-created
   ```

## Files Changed

- `src/mcp/tools/shared.ts` - Added `ensurePlanManifest()`
- `src/mcp/tools/create.ts` - Always create manifest
- `src/mcp/tools/build.ts` - Create manifest after build
- `src/mcp/tools/idea.ts` - Create manifest on idea creation
- `src/mcp/tools/step.ts` - Ensure manifest on step operations
- `src/mcp/tools/shaping.ts` - Ensure manifest on shaping start
- `src/mcp/tools/status.ts` - Ensure manifest on status check
- `src/mcp/tools/backfill-manifests.ts` - **NEW** backfill tool
- `src/mcp/tools/index.ts` - Register backfill tool

## Related

- Original implementation: `plans/done/global-riotplan-rules/plan/05-define-plan-manifest-planyaml-schema-and-readwrite.md`
- Manifest schema: `@planvokter/riotplan-catalyst/src/schema/schemas.ts`
- Manifest I/O: `@planvokter/riotplan-catalyst/src/loader/plan-manifest.ts`
