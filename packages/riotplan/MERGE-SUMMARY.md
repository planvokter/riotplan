# Merge Summary: riotplan-cli → riotplan

**Date**: 2026-01-22
**Status**: ✅ Complete

## Overview

Successfully merged `@riotprompt/riotplan-cli` into `@riotprompt/riotplan`. The CLI functionality is now available directly from the main package.

## What Was Done

### 1. Verified Code Identity
- Confirmed that `riotplan-cli/src/` and `riotplan/src/cli/` contained identical code
- CLI was already present in riotplan package
- The separate riotplan-cli package was essentially a wrapper

### 2. Updated riotplan Package
- ✅ CLI already configured in package.json with `bin` entry
- ✅ vite.config.ts already building both library and CLI
- ✅ Tests already present and passing (390 tests)
- ✅ README updated with complete CLI documentation from riotplan-cli
- ✅ Fixed minor TypeScript issues in mock executor

### 3. Deprecated riotplan-cli Package
- ✅ Added [DEPRECATED.md](../riotplan-cli/DEPRECATED.md) with migration guide
- ✅ Updated README with deprecation notice
- ✅ Added `deprecated` field to package.json
- ✅ Package marked for archival (no future updates)

## Migration Path

### Before
```bash
npm install -g @riotprompt/riotplan-cli
```

### After
```bash
npm install -g @riotprompt/riotplan
```

All commands work identically - no breaking changes.

## Benefits

1. **Simpler Architecture**: One package instead of two
2. **Easier Maintenance**: Single codebase to maintain
3. **Better DX**: Clear install path for users
4. **Reduced Complexity**: Fewer dependencies and build configs
5. **Same Functionality**: Zero breaking changes

## Test Results

```
Test Files  15 passed (15)
Tests       390 passed (390)
Coverage    ~93% overall
```

## Files Modified

### riotplan
- [README.md](./README.md) - Added CLI documentation
- [src/execution/index.ts](./src/execution/index.ts) - Fixed TypeScript types
- [tests/execution.test.ts](./tests/execution.test.ts) - Updated test assertions

### riotplan-cli
- [README.md](../riotplan-cli/README.md) - Added deprecation notice
- [package.json](../riotplan-cli/package.json) - Added deprecated field
- [DEPRECATED.md](../riotplan-cli/DEPRECATED.md) - Created migration guide

## Next Steps

1. ✅ Tests pass - ready to commit
2. Publish `@riotprompt/riotplan@1.0.0` with merged CLI
3. Publish `@riotprompt/riotplan-cli@1.0.0` as deprecated (final version)
4. Update any documentation referencing riotplan-cli
5. Archive riotplan-cli repository after users migrate

## Questions?

Open an issue at: https://github.com/planvokter/riotplan/issues
