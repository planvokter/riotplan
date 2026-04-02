# status

Show current plan status and progress.

## Usage

```bash
riotplan status [path] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `path` | Plan directory (default: current) |

## Options

| Option | Description |
|--------|-------------|
| `-v, --verbose` | Include step details |
| `--json` | Output as JSON |

## Output

### Standard Output

```
Plan: my-feature
Status: 🔄 in_progress
Progress: 45% (5/11 steps)
Current Step: 06-testing
Last Updated: 2026-01-10

Blockers: None
Issues: 1 (low priority)
```

### Verbose Output

```bash
riotplan status -v
```

```
Plan: my-feature
Status: 🔄 in_progress
Progress: 45% (5/11 steps)
Current Step: 06-testing
Started: 2026-01-08
Last Updated: 2026-01-10

Step Progress:
  ✅ 01 analysis (completed 2026-01-08)
  ✅ 02 design (completed 2026-01-09)
  ✅ 03 architecture (completed 2026-01-09)
  ✅ 04 implementation-core (completed 2026-01-10)
  🔄 05 implementation-api (started 2026-01-10)
  ⬜ 06 testing
  ⬜ 07 documentation
  ⬜ 08 release

Blockers: None

Issues:
  - Low: Need to decide on session storage strategy
```

### JSON Output

```bash
riotplan status --json
```

```json
{
  "code": "my-feature",
  "name": "My Feature Implementation",
  "status": "in_progress",
  "progress": {
    "completed": 5,
    "total": 11,
    "percentage": 45
  },
  "currentStep": {
    "number": 6,
    "title": "testing",
    "status": "pending"
  },
  "started": "2026-01-08",
  "lastUpdated": "2026-01-10",
  "blockers": [],
  "issues": [
    {
      "severity": "low",
      "description": "Need to decide on session storage strategy"
    }
  ]
}
```

## Status Values

| Status | Description |
|--------|-------------|
| `pending` | Created but not started |
| `in_progress` | Currently being worked on |
| `completed` | All steps finished |
| `blocked` | Waiting on external dependency |
| `failed` | Encountered unrecoverable error |

## Examples

```bash
# Current directory
riotplan status

# Specific plan
riotplan status ./prompts/my-feature

# Verbose
riotplan status -v

# JSON for scripting
riotplan status --json | jq '.progress.percentage'
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Plan not found |
| 2 | Invalid STATUS.md |

## Next Steps

- [step](cli-step) - Manage steps
- [STATUS.md Format](status-format) - Understanding status tracking
- [Managing Steps](managing-steps) - Working with steps
