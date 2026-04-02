# feedback

Commands for creating and managing feedback records.

## create

Create a new feedback record.

```bash
riotplan feedback create [path] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `path` | Plan directory (default: current) |

### Options

| Option | Description |
|--------|-------------|
| `--step <number>` | Related step number |
| `--type <type>` | Feedback type (issue, blocker, note) |
| `--message, -m <text>` | Feedback message |

### Examples

```bash
# Interactive feedback
riotplan feedback create

# Quick feedback
riotplan feedback create -m "Step 03 needs more error handling"

# Step-specific feedback
riotplan feedback create --step 03 -m "Add validation"

# Report blocker
riotplan feedback create --type blocker -m "Waiting for API key"
```

### What It Creates

Creates a timestamped feedback file in `feedback/`:

```
feedback/2026-01-15-step-03-feedback.md
```

Content:

```markdown
# Feedback: Step 03

**Date:** 2026-01-15
**Type:** issue
**Step:** 03

## Description

Step 03 needs more error handling for edge cases.

## Context

During testing, discovered several edge cases that aren't handled:
- Empty input
- Invalid format
- Network timeouts

## Action Items

- [ ] Add input validation
- [ ] Add error messages
- [ ] Add timeout handling
```

## list

List all feedback records.

```bash
riotplan feedback list [path] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `path` | Plan directory (default: current) |

### Options

| Option | Description |
|--------|-------------|
| `--step <number>` | Filter by step |
| `--type <type>` | Filter by type |
| `--json` | Output as JSON |

### Examples

```bash
# List all feedback
riotplan feedback list

# Filter by step
riotplan feedback list --step 03

# Filter by type
riotplan feedback list --type blocker

# JSON output
riotplan feedback list --json
```

### Output

```
Feedback Records:

2026-01-15 [issue] Step 03: Needs more error handling
2026-01-16 [blocker] Step 06: Waiting for API key
2026-01-18 [note] General: Consider refactoring auth module
```

## show

Display a feedback record.

```bash
riotplan feedback show <id> [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `id` | Feedback ID or filename |
| `path` | Plan directory (default: current) |

### Examples

```bash
# Show by ID
riotplan feedback show 1

# Show by filename
riotplan feedback show 2026-01-15-step-03-feedback
```

## resolve

Mark a feedback record as resolved.

```bash
riotplan feedback resolve <id> [path] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `id` | Feedback ID or filename |
| `path` | Plan directory (default: current) |

### Options

| Option | Description |
|--------|-------------|
| `--notes <text>` | Resolution notes |

### Examples

```bash
# Resolve feedback
riotplan feedback resolve 1

# With notes
riotplan feedback resolve 1 --notes "Added error handling in commit abc123"
```

## Feedback Types

| Type | Description |
|------|-------------|
| `issue` | Problem or concern |
| `blocker` | Blocking progress |
| `note` | General observation |
| `question` | Needs clarification |
| `suggestion` | Improvement idea |

## Best Practices

### When to Create Feedback

- Discovered an issue during execution
- Found something that needs improvement
- Encountered a blocker
- Have a question about approach
- Want to record a decision

### Writing Good Feedback

**Good:**
```
Step 03 needs input validation. Currently accepts empty strings which
causes downstream errors in step 04. Should validate before processing.
```

**Not as good:**
```
Fix step 03
```

### Linking to Steps

Always link feedback to specific steps when relevant:

```bash
riotplan feedback create --step 03 -m "Needs validation"
```

This makes it easier to:
- Track issues per step
- Review feedback when working on that step
- Generate reports

## Next Steps

- [Managing Steps](managing-steps) - Working with steps
- [CLI Usage](cli-usage) - Command overview
- [Creating Plans](creating-plans) - Plan creation guide
