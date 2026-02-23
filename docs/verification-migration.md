# Migrating to Verification System

## For Existing Users

The verification system is **backward compatible** and **opt-in by default**:

- **No configuration required** - Works with sensible defaults
- **Interactive mode by default** - You'll be prompted if issues are found
- **Existing workflows unchanged** - Steps without acceptance criteria work as before
- **Easy to disable** - Use `--skip-verification` or `--force` flags

## What Changed

### Step Completion is Now Async

The `completeStep()` function is now async to support verification:

```typescript
// Before
const step = completeStep(plan, 1, "notes");

// After
const step = await completeStep(plan, 1, { notes: "notes" });
```

If you're calling `completeStep()` directly in code, add `await` and update the signature.

### New CLI Flags

```bash
# New flags available
riotplan step complete 3 --force              # Bypass verification
riotplan step complete 3 --skip-verification  # Skip entirely
```

### New MCP Tool Parameters

```typescript
riotplan_step({
    action: 'complete',
    planId: './plan',
    step: 3,
    force: true,              // New: bypass verification
    skipVerification: true    // New: skip verification
});
```

## Gradual Adoption Strategy

### Phase 1: Observe (Advisory Mode)

Start with advisory mode to see what verification catches without disruption:

```yaml
# riotplan.config.yaml
verification:
  enforcement: advisory
  checkAcceptanceCriteria: true
  checkArtifacts: false
```

**What happens:**
- Warnings shown but no blocking
- See what issues would be caught
- No workflow changes required

**Duration:** 1-2 weeks to understand patterns

### Phase 2: Interact (Interactive Mode)

Move to interactive mode for safety with flexibility:

```yaml
verification:
  enforcement: interactive  # This is the default
  checkAcceptanceCriteria: true
  checkArtifacts: false
```

**What happens:**
- Prompted when issues found
- Can proceed or cancel
- Builds good habits

**Duration:** Ongoing - this is the recommended mode

### Phase 3: Enforce (Strict Mode)

Use strict mode in CI or for strict teams:

```yaml
verification:
  enforcement: strict
  checkAcceptanceCriteria: true
  checkArtifacts: true
```

**What happens:**
- Completion blocked if verification fails
- Must use `--force` to bypass
- Strong quality gates

**Use in:** CI pipelines, automated environments

## Configuration Migration

### Minimal Configuration

No configuration needed - defaults work well:

```yaml
# This is equivalent to not having verification config at all
verification:
  enforcement: interactive
  checkAcceptanceCriteria: true
  checkArtifacts: false
  autoRetrospective: true
  requireEvidence: false
```

### Team Configuration

For teams wanting strong enforcement:

```yaml
verification:
  enforcement: strict
  checkAcceptanceCriteria: true
  checkArtifacts: true
  autoRetrospective: true
  requireEvidence: false  # Still opt-in
```

### CI Configuration

For CI environments:

```yaml
verification:
  enforcement: strict
  checkAcceptanceCriteria: true
  checkArtifacts: true
  autoRetrospective: false  # Skip in CI
  requireEvidence: false
```

Then use `--force` in CI scripts when needed:

```bash
riotplan step complete $STEP --force
```

## Updating Step Files

### Add Acceptance Criteria

If your step files don't have acceptance criteria, add them:

```markdown
## Acceptance Criteria

- [ ] Feature implemented
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Code reviewed
```

### Add Files Changed

For artifact verification (opt-in), add Files Changed section:

```markdown
## Files Changed

- src/config/schema.ts
- tests/config/schema.test.ts
- docs/configuration.md
```

### Check Boxes Before Completing

Before marking a step complete, check the boxes:

```markdown
## Acceptance Criteria

- [x] Feature implemented  ← Check these
- [x] Tests written and passing
- [x] Documentation updated
- [x] Code reviewed
```

## Troubleshooting

### "Verification Issues Found" when completing steps

This means acceptance criteria are unchecked. Either:

1. **Fix the issues** - Complete the work and check the boxes
2. **Use --force** - Bypass if you've verified manually
3. **Disable verification** - Set `enforcement: advisory`

### Verification is too strict

Adjust the enforcement level:

```yaml
verification:
  enforcement: advisory  # or interactive
```

### Want to disable verification

Either:
- Use `--skip-verification` flag per command
- Set `enforcement: advisory` for warnings only
- Remove verification config entirely (uses defaults)

### Artifact checking has false positives

Artifact checking is opt-in for this reason:

```yaml
verification:
  checkArtifacts: false  # This is the default
```

Only enable if your "Files Changed" sections use consistent paths.

## FAQ

**Q: Will this break my existing plans?**
A: No. Verification is backward compatible. Steps without acceptance criteria will show a warning but won't block.

**Q: Can I disable verification entirely?**
A: Yes. Use `--skip-verification` flag or set `enforcement: advisory` and ignore warnings.

**Q: What if acceptance criteria can't be automatically verified?**
A: Use `--force` to bypass. Verification is a tool, not a prison.

**Q: Does this slow down step completion?**
A: Minimal impact - typically <50ms per step. Interactive prompts add human time, not system time.

**Q: Will retrospectives be generated automatically?**
A: Yes, by default (`autoRetrospective: true`). This happens when the last step completes. If generation fails, a warning is shown but completion continues.

**Q: What about the MCP tools?**
A: MCP tools respect the same configuration. Use `force: true` or `skipVerification: true` parameters.

## Best Practices

### For Individual Users

- Use **interactive mode** (default)
- Write clear acceptance criteria
- Check boxes as you complete work
- Use `--force` when appropriate

### For Teams

- Start with **advisory mode** to learn
- Move to **interactive mode** for daily work
- Use **strict mode** in CI
- Document team policies in README

### For CI/Automation

- Use **strict mode** with `--force` escape hatch
- Disable `autoRetrospective` (generate manually)
- Set clear failure messages
- Document override procedures

## Examples

### Example 1: Advisory Mode

```yaml
verification:
  enforcement: advisory
```

```bash
$ riotplan step complete 3

⚠️  Verification Warnings:
   2 acceptance criteria not checked:
   - [ ] Documentation updated
   - [ ] Code reviewed

✓ Completed step 3: Add verification system
```

Step completes with warnings.

### Example 2: Interactive Mode

```yaml
verification:
  enforcement: interactive
```

```bash
$ riotplan step complete 3

⚠️  Verification Issues Found:
   2 acceptance criteria not checked:
   - [ ] Documentation updated
   - [ ] Code reviewed

Mark step as complete despite these issues? (y/N) n

Step completion cancelled.
Tip: Use --force to bypass verification, or fix the issues and try again.
```

User cancels, fixes issues, tries again.

### Example 3: Strict Mode

```yaml
verification:
  enforcement: strict
```

```bash
$ riotplan step complete 3

❌ Verification Failed:
   2 acceptance criteria not checked:
   - [ ] Documentation updated
   - [ ] Code reviewed

Use --force to bypass verification checks.

$ riotplan step complete 3 --force

✓ Completed step 3: Add verification system
```

Blocked unless --force is used.

## See Also

- [Verification Migration Guide](./verification-migration.md)
- [Configuration Guide](./configuration.md)
- [Step File Format](./step-format.md)
