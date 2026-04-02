# plan

Commands for initializing and managing plan directories.

## create

Create a new plan with AI-generated steps.

```bash
riotplan create <code> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `code` | Plan identifier (e.g., "user-auth") |

### Options

| Option | Description |
|--------|-------------|
| `--description, -d <text>` | Plan description |
| `--name, -n <text>` | Human-readable name |
| `--directory <path>` | Parent directory (default: current) |
| `--steps <number>` | Number of steps to generate |
| `--direct` | Skip analysis phase |
| `--analyze` | Force analysis phase |
| `--provider <name>` | AI provider (anthropic, openai, gemini) |
| `--model <name>` | Specific model |
| `--no-ai` | Use templates only |

### Examples

```bash
# Interactive creation
riotplan create my-feature

# With description
riotplan create my-feature -d "Implement user authentication"

# Direct generation
riotplan create my-feature --direct --steps 5

# Specific provider
riotplan create my-feature --provider anthropic --model claude-sonnet-4-5

# Template-based
riotplan create my-feature --no-ai
```

## init

Quick scaffolding for programmatic use.

```bash
riotplan init <code> [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `code` | Plan identifier |

### Options

| Option | Description |
|--------|-------------|
| `--description <text>` | Plan description |
| `--steps <number>` | Number of step files to create |
| `--path <directory>` | Target directory |

### Examples

```bash
# Basic scaffolding
riotplan init my-feature

# With steps
riotplan init my-feature --steps 5

# Specific location
riotplan init my-feature --path ./prompts/
```

## validate

Validate plan structure and files.

```bash
riotplan validate [path] [options]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `path` | Plan directory (default: current) |

### Options

| Option | Description |
|--------|-------------|
| `--fix` | Attempt to fix issues |

### Checks

- Required files exist (STATUS.md, EXECUTION_PLAN.md, etc.)
- STATUS.md is parseable
- Step files have valid numbering (01-*, 02-*, etc.)
- Step dependencies are valid
- No circular dependencies

### Examples

```bash
# Validate current directory
riotplan validate

# Validate specific plan
riotplan validate ./my-feature

# Fix issues
riotplan validate --fix
```

## archive

Archive a completed plan.

```bash
riotplan archive [path]
```

### Arguments

| Argument | Description |
|----------|-------------|
| `path` | Plan directory (default: current) |

### What It Does

1. Validates plan is complete
2. Creates archive directory if needed
3. Moves plan to archive
4. Updates index

### Examples

```bash
# Archive current plan
riotplan archive

# Archive specific plan
riotplan archive ./my-feature
```

## Next Steps

- [status](cli-status) - Check plan status
- [step](cli-step) - Manage steps
- [Creating Plans](creating-plans) - Detailed guide
