# Merge Summary: commands-plan → riotplan

## Overview
Successfully merged all code from `commands-plan` package into the main `riotplan` package. The plan commands are now part of the core riotplan library instead of being a separate dependency.

## Changes Made

### 1. Source Files Copied
Copied all command source files from `commands-plan/src/` to `riotplan/src/commands/plan/`:
- [init.ts](src/commands/plan/init.ts) - Create new plans
- [archive.ts](src/commands/plan/archive.ts) - Archive completed plans
- [validate.ts](src/commands/plan/validate.ts) - Validate plan structure
- [template.ts](src/commands/plan/template.ts) - Template management commands
- [index.ts](src/commands/plan/index.ts) - Command registration

### 2. Tests Copied
Copied comprehensive test suite:
- `commands-plan/tests/index.test.ts` → `riotplan/tests/commands-plan.test.ts`
- All 30 tests passing (465 total tests in suite)
- Test coverage: 93.7% statements, 96.49% branches for plan commands

### 3. Import Updates
Updated all imports to use local paths instead of package references:
- `@riotprompt/riotplan` → relative imports to `../../plan/`, `../../status/`, etc.
- `@riotprompt/riotplan-templates` → kept as-is (separate package)
- Test mocks updated to mock local modules instead of package imports

### 4. Package Dependencies
Updated [package.json](package.json):
- Removed: `@riotprompt/riotplan-commands-plan` dependency
- Added: `@riotprompt/riotplan-templates` dependency (needed by template.ts)

### 5. Exports Updated
Updated [src/index.ts](src/index.ts) to export plan commands:
```typescript
export {
    registerPlanCommands,
    initCommand,
    validateCommand,
    archiveCommand,
    templateCommand,
    templateListCommand,
    templateShowCommand,
    templateUseCommand,
} from "./commands/plan/index.js";
```

### 6. CLI Integration
Updated [src/cli/cli.ts](src/cli/cli.ts):
- Changed import from `@riotprompt/riotplan-commands-plan` to `../commands/plan/index.js`
- No functional changes to CLI behavior

## Verification

### Tests
```bash
npm test
# ✓ 465 tests passed (including 30 plan command tests)
# ✓ Coverage: 93.7% for plan commands
```

### Build
```bash
npm run build
# ✓ Build successful
# ✓ All TypeScript compiled correctly
```

### CLI Verification
```bash
node -e "import('./dist/cli.js').then(m => {
  const program = m.createProgram();
  program.parse(['node', 'test', 'plan', '--help']);
})"
# ✓ Shows all plan subcommands: init, validate, archive, template
```

## Command Functionality

All plan commands are now available as part of the core `riotplan` CLI:

### `riotplan plan init <name>`
Create a new plan with specified name
- Options: --description, --template, --path, --steps

### `riotplan plan validate [path]`
Validate plan structure and files
- Options: --strict, --fix, --json

### `riotplan plan archive [path]`
Archive a completed plan
- Options: --target, --force, --mark-complete

### `riotplan plan template`
Manage plan templates
- Subcommands: list, show, use

## Benefits of Merge

1. **Simplified Dependencies**: One less package to manage and version
2. **Improved Type Safety**: Direct imports enable better TypeScript checking
3. **Easier Maintenance**: All plan-related code in one place
4. **Reduced Complexity**: No need to publish/manage separate commands package
5. **Better Tree-Shaking**: Bundlers can optimize better with direct imports

## Next Steps

Consider merging other command packages (`commands-status`, `commands-step`, `commands-feedback`) following the same pattern if desired.
