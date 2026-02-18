# Plan Verification System

## Overview

The verification system prevents incomplete steps from being marked as done through automated checks and configurable enforcement. It addresses the problem where steps can be marked complete without actually finishing the work.

## Problem Statement

Without verification, RiotPlan trusts executing agents to accurately report completion. This led to plans being marked as "completed" when critical work was missing. The verification system adds automated checks to catch these issues.

## Configuration

Add verification settings to your `riotplan.config.yaml`:

```yaml
verification:
  enforcement: interactive  # advisory | interactive | strict
  checkAcceptanceCriteria: true
  checkArtifacts: false
  autoRetrospective: true
  requireEvidence: false
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enforcement` | string | `interactive` | Enforcement level (advisory/interactive/strict) |
| `checkAcceptanceCriteria` | boolean | `true` | Parse and verify markdown checkboxes in step files |
| `checkArtifacts` | boolean | `false` | Verify files mentioned in "Files Changed" exist |
| `autoRetrospective` | boolean | `true` | Auto-generate retrospective when plan completes |
| `requireEvidence` | boolean | `false` | Require evidence links in reflections |

### Environment Variables

Override configuration via environment variables:

```bash
RIOTPLAN_VERIFICATION_ENFORCEMENT=strict
RIOTPLAN_VERIFICATION_CHECK_CRITERIA=true
RIOTPLAN_VERIFICATION_CHECK_ARTIFACTS=true
RIOTPLAN_VERIFICATION_AUTO_RETROSPECTIVE=true
RIOTPLAN_VERIFICATION_REQUIRE_EVIDENCE=false
```

## Enforcement Levels

### Advisory (Warnings Only)

Shows warnings but never blocks completion.

```yaml
verification:
  enforcement: advisory
```

**Use when:**
- You want visibility without enforcement
- Team is learning the system
- You trust the process but want reminders

**Behavior:**
- Warnings shown in output
- Step completes regardless
- No user interaction required

### Interactive (Default)

Prompts user for confirmation when issues are found.

```yaml
verification:
  enforcement: interactive  # This is the default
```

**Use when:**
- You want safety with flexibility
- Humans are executing steps
- You want to catch mistakes but allow overrides

**Behavior:**
- Shows verification results
- Prompts: "Mark step as complete despite these issues?"
- User can proceed or cancel
- Can bypass with `--force` flag

### Strict (Blocking)

Blocks completion unless `--force` flag is used.

```yaml
verification:
  enforcement: strict
```

**Use when:**
- Running in CI/automated environments
- You want strong enforcement
- Team has agreed to strict policies

**Behavior:**
- Throws error if verification fails
- Must use `--force` to bypass
- No interactive prompts

## Usage

### CLI Commands

```bash
# Complete step with verification (default)
riotplan step complete 3

# Force completion bypassing verification
riotplan step complete 3 --force

# Skip verification entirely
riotplan step complete 3 --skip-verification

# Complete with notes
riotplan step complete 3 --notes "Finished early"
```

### MCP Tools

```typescript
// Complete step with verification
await riotplan_step_complete({
    path: './my-plan',
    step: 3
});

// Force completion
await riotplan_step_complete({
    path: './my-plan',
    step: 3,
    force: true
});

// Skip verification
await riotplan_step_complete({
    path: './my-plan',
    step: 3,
    skipVerification: true
});
```

## Acceptance Criteria Format

Verification parses markdown checkboxes from step files:

```markdown
## Acceptance Criteria

- [x] Feature implemented
- [x] Tests written
- [ ] Documentation updated  ← This will be flagged
- [x] Code reviewed
```

**Format requirements:**
- Must be in `## Acceptance Criteria` section
- Use markdown checkbox syntax: `- [ ]` or `- [x]`
- Both lowercase `x` and uppercase `X` are supported
- Checkboxes outside this section are ignored

## Artifact Verification

When `checkArtifacts: true`, verification checks that files mentioned in "Files Changed" actually exist:

```markdown
## Files Changed

- src/config/schema.ts  ← Will be verified
- src/verification/engine.ts  ← Will be verified
- tests/config/schema.test.ts  ← Will be verified
```

**Format requirements:**
- Must be in `## Files Changed` section
- List items with file paths
- Paths resolved relative to plan root
- Supports backtick quotes: `` `src/file.ts` ``

## Automatic Retrospectives

When `autoRetrospective: true`, RiotPlan automatically generates a retrospective when all steps complete:

```bash
# When you complete the last step:
riotplan step complete 5

# RiotPlan automatically:
# 1. Detects all steps are complete
# 2. Calls riotplan_generate_retrospective
# 3. Writes retrospective.md
# 4. Continues with completion
```

If retrospective generation fails, a warning is shown but completion continues.

## Error Messages

### Unchecked Acceptance Criteria

```
⚠️  Verification Issues Found:
   2 acceptance criteria not checked:
   - [ ] Documentation updated
   - [ ] Code reviewed

Mark step as complete despite these issues? (y/N)
```

### Missing Artifacts

```
⚠️  Verification Issues Found:
   2 artifacts not found:
   - src/nonexistent/file.ts
   - tests/missing.test.ts

Mark step as complete despite these issues? (y/N)
```

### Strict Mode Blocked

```
❌ Verification Failed:
   2 acceptance criteria not checked:
   - [ ] Documentation updated
   - [ ] Code reviewed

Use --force to bypass verification checks.
```

## Best Practices

### Writing Good Acceptance Criteria

**Good:**
```markdown
## Acceptance Criteria

- [ ] Configuration schema includes verification options
- [ ] Tests pass with 100% coverage
- [ ] CLI command supports --force flag
- [ ] Documentation updated with examples
```

**Bad:**
```markdown
## Acceptance Criteria

- [ ] Everything works
- [ ] Code is good
```

Make criteria specific, measurable, and actionable.

### Using Enforcement Levels

1. **Start with advisory** - See what verification catches without disruption
2. **Move to interactive** - Get prompts but maintain flexibility
3. **Use strict in CI** - Enforce quality gates in automated environments

### When to Use --force

Use `--force` when:
- Acceptance criteria can't be checked programmatically
- You've verified completion manually
- Edge cases where verification is wrong
- Emergency situations requiring override

Don't use `--force` to:
- Avoid doing the work
- Skip important checks
- Bypass legitimate issues

## Troubleshooting

### Verification always passes

Check your configuration:
```bash
riotplan check-config
```

Ensure `checkAcceptanceCriteria: true` is set.

### False positives on artifacts

Artifact checking assumes files are relative to plan root. If your paths are different, either:
- Adjust paths in step files
- Disable artifact checking: `checkArtifacts: false`
- Use `--skip-verification` for specific steps

### Interactive prompts in CI

In CI environments, use strict mode with --force:

```yaml
verification:
  enforcement: strict
```

```bash
# In CI script
riotplan step complete $STEP_NUMBER --force
```

## Implementation Details

### Verification Flow

1. User calls `riotplan step complete 3`
2. Load configuration
3. If interactive mode: Run verification and prompt user
4. Call `completeStep()` which runs verification again
5. If strict mode and verification fails: Throw error
6. If advisory mode: Show warnings and continue
7. Mark step complete
8. If all steps complete: Auto-generate retrospective

### Performance

Verification adds minimal overhead:
- Acceptance criteria parsing: ~5ms per step
- Artifact checking: ~10ms per file
- Total: typically <50ms per step completion

## See Also

- [Verification Migration Guide](./verification-migration.md)
- [Configuration Guide](./configuration.md)
- [AGENTS.md](../AGENTS.md) - AI assistant guidance
