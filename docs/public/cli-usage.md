# CLI Overview

RiotPlan provides a comprehensive command-line interface for managing long-lived, stateful AI workflows.

## Installation

```bash
npm install -g @planvokter/riotplan
```

Verify installation:

```bash
riotplan --version
```

## Command Structure

```bash
riotplan <command> [options]
```

## Core Commands

### Plan Management

| Command | Description |
|---------|-------------|
| `create` | Create a new plan with AI generation |
| `status` | Show plan status and progress |
| `validate` | Validate plan structure |
| `generate` | Generate plan content from prompt |

### Step Management

| Command | Description |
|---------|-------------|
| `step list` | List all steps |
| `step start` | Mark step as started |
| `step complete` | Mark step as completed |
| `step add` | Add a new step |

### Feedback Management

| Command | Description |
|---------|-------------|
| `feedback create` | Create feedback record |
| `feedback list` | List feedback records |

## Global Options

| Option | Description |
|--------|-------------|
| `--help, -h` | Show help |
| `--version, -v` | Show version |
| `--json` | Output as JSON |
| `--verbose` | Verbose output |

## Common Workflows

### Creating and Executing a Plan

```bash
# 1. Create plan
riotplan create my-feature

# 2. Check status
riotplan status

# 3. List steps
riotplan step list

# 4. Start first step
riotplan step start 1

# 5. Complete step
riotplan step complete 1

# 6. Repeat for remaining steps
```

### Working with Analysis

```bash
# Create with analysis
riotplan create complex-feature --analyze

# Provide feedback
riotplan elaborate ./complex-feature

# Mark ready
riotplan analysis ready ./complex-feature

# Generate plan
riotplan generate ./complex-feature
```

### Monitoring Progress

```bash
# Quick status
riotplan status

# Detailed status
riotplan status -v

# JSON output for scripting
riotplan status --json
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key for AI generation |
| `OPENAI_API_KEY` | OpenAI API key for AI generation |
| `GOOGLE_API_KEY` | Google API key for AI generation |
| `RIOTPLAN_DEFAULT_PROVIDER` | Default AI provider |

## Configuration

Create `.riotplanrc.json` in your plan directory or home directory:

```json
{
  "defaultProvider": "anthropic",
  "autoUpdateStatus": true,
  "stepTemplate": "detailed",
  "analysis": {
    "enabled": true,
    "directory": "analysis"
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Plan not found |
| 4 | Validation error |
| 5 | AI provider error |

## Next Steps

- [create](cli-create) - Create new plans
- [status](cli-status) - Check plan status
- [step](cli-step) - Manage steps
- [feedback](cli-feedback) - Manage feedback
