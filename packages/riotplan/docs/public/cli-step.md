# step

Commands for managing plan steps.

## list

List all steps in a plan.

```bash
riotplan step list [path] [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--pending` | Show only pending steps |
| `--all` | Include completed steps |
| `--json` | Output as JSON |

### Examples

```bash
# List all steps
riotplan step list

# Only pending
riotplan step list --pending

# JSON output
riotplan step list --json
```

### Output

```
✅ 01 analysis
✅ 02 design
✅ 03 architecture
✅ 04 implementation-core
🔄 05 implementation-api
⬜ 06 testing
⬜ 07 documentation
⬜ 08 release
```

## start

Mark a step as started.

```bash
riotplan step start [step] [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `step` | Step number (default: next pending) |
| `path` | Plan directory (default: current) |

### Examples

```bash
# Start next pending step
riotplan step start

# Start specific step
riotplan step start 05

# Specific plan
riotplan step start 05 ./my-feature
```

### What Happens

1. STATUS.md is updated
2. Step status changes to 🔄 In Progress
3. Start timestamp is recorded
4. Current step pointer is updated

## complete

Mark a step as completed.

```bash
riotplan step complete [step] [path] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `step` | Step number (default: current) |
| `path` | Plan directory (default: current) |

### Options

| Option | Description |
|--------|-------------|
| `--notes <text>` | Completion notes |

### Examples

```bash
# Complete current step
riotplan step complete

# Complete specific step
riotplan step complete 05

# With notes
riotplan step complete 05 --notes "All endpoints working"
```

### What Happens

1. STATUS.md is updated
2. Step status changes to ✅ Completed
3. Completion timestamp is recorded
4. Progress percentage is updated
5. Current step advances to next pending

## add

Add a new step to the plan.

```bash
riotplan step add <title> [path] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `title` | Step title |
| `path` | Plan directory (default: current) |

### Options

| Option | Description |
|--------|-------------|
| `--number <n>` | Position to insert |
| `--after <n>` | Insert after this step |

### Examples

```bash
# Add at end
riotplan step add "Integration Testing"

# Add at position
riotplan step add "Security Audit" --number 07

# Add after step
riotplan step add "Code Review" --after 05
```

### What Happens

1. New step file is created
2. Subsequent steps are renumbered
3. STATUS.md is updated with new step
4. EXECUTION_PLAN.md may need manual update

## show

Display step content.

```bash
riotplan step show <step> [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `step` | Step number |
| `path` | Plan directory (default: current) |

### Examples

```bash
# Show step 5
riotplan step show 05

# Specific plan
riotplan step show 05 ./my-feature
```

## fail

Mark a step as failed.

```bash
riotplan step fail <step> <reason> [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `step` | Step number |
| `reason` | Failure reason |
| `path` | Plan directory (default: current) |

### Examples

```bash
riotplan step fail 05 "Database migration error"
```

## block

Mark a step as blocked.

```bash
riotplan step block <step> <reason> [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `step` | Step number |
| `reason` | Blocker description |
| `path` | Plan directory (default: current) |

### Examples

```bash
riotplan step block 06 "Waiting for API key from DevOps"
```

## skip

Mark a step as skipped.

```bash
riotplan step skip <step> <reason> [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `step` | Step number |
| `reason` | Skip reason |
| `path` | Plan directory (default: current) |

### Examples

```bash
riotplan step skip 07 "Documentation will be done separately"
```

## deps

Show step dependencies.

```bash
riotplan step deps <step> [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `step` | Step number |
| `path` | Plan directory (default: current) |

### Examples

```bash
riotplan step deps 05
```

### Output

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

## Next Steps

- [Managing Steps](managing-steps) - Detailed guide
- [STATUS.md Format](status-format) - Understanding status tracking
- [CLI Usage](cli-usage) - Command overview
