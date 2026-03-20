# MCP Server Integration

RiotPlan provides a Model Context Protocol (MCP) server that allows AI assistants to manage long-lived, stateful workflows directly.

## Overview

The MCP server exposes riotplan's functionality through:
- **Tools** - Callable functions for plan management
- **Resources** - Read-only access to plan data
- **Prompts** - Workflow templates for common tasks

## Installation

### Global Installation

```bash
npm install -g @kjerneverk/riotplan-mcp-http
```

(`@kjerneverk/riotplan` is installed automatically as a dependency of the HTTP package.)

### Cursor Configuration

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "riotplan": {
      "command": "npx",
      "args": ["-y", "@kjerneverk/riotplan-mcp-http", "riotplan-mcp-http", "--plans-dir", "/path/to/plans"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "riotplan": {
      "command": "riotplan-mcp-http",
      "args": ["--plans-dir", "/path/to/plans"]
    }
  }
}
```

### Cursor Remote HTTP Client Configuration

If you are running `riotplan-mcp-http` separately (for example on another machine, a container, or Cloud Run), configure Cursor as an HTTP MCP client:

```json
{
  "mcpServers": {
    "riotplan-http": {
      "url": "https://your-host.example.com/mcp",
      "headers": {
        "Authorization": "Bearer <raw_key_secret>"
      }
    }
  }
}
```

You can also send the key as `X-API-Key`:

```json
{
  "mcpServers": {
    "riotplan-http": {
      "url": "https://your-host.example.com/mcp",
      "headers": {
        "X-API-Key": "<raw_key_secret>"
      }
    }
  }
}
```

Use `Authorization` **or** `X-API-Key` (not both unless your gateway requires it). These match the auth headers accepted by `riotplan-mcp-http`.

**Zero-Config Option:** If you don't set `RIOTPLAN_PLAN_DIRECTORY`, RiotPlan will automatically:
1. Look for a `riotplan.config.yaml` (or `.json`, `.js`, `.ts`) file in your workspace
2. Walk up the directory tree to find an existing `plans/` directory
3. Fall back to `./plans` in your workspace root

This means most users don't need any configuration - RiotPlan will automatically find your plans directory!

See the [Configuration Guide](./configuration.md) for complete details.

## Optional GCS Mode (MCP Server)

RiotPlan MCP supports an opt-in cloud mode for Google Cloud Storage.

- Default behavior remains local file-based (`.plan` SQLite files under the resolved plans directory).
- Cloud mode is enabled only when you set `cloud.enabled` (or `RIOTPLAN_CLOUD_ENABLED=true`).
- You must provide two buckets:
  - one for plan files (`cloud.planBucket`)
  - one for context data (`cloud.contextBucket`)

### Example (`riotplan.config.yaml`)

```yaml
cloud:
  enabled: true
  incrementalSyncEnabled: true
  syncFreshnessTtlMs: 5000
  syncTimeoutMs: 120000
  planBucket: riotplan-plan-bucket
  planPrefix: riotplan/plans
  contextBucket: riotplan-context-bucket
  contextPrefix: riotplan/context
  projectId: my-gcp-project
  keyFilename: ~/.config/gcloud/riotplan-sa.json
  cacheDirectory: ./.riotplan-cloud-cache
```

For `riotplan-mcp-http`, cloud mode no longer requires an explicit canonical `plansDir`. If omitted, runtime directories are derived from cache configuration (`<cacheRoot>/plans` and `<cacheRoot>/context`).

### Environment variable overrides

```bash
export RIOTPLAN_CLOUD_ENABLED=true
export RIOTPLAN_CLOUD_INCREMENTAL_SYNC_ENABLED=true
export RIOTPLAN_CLOUD_SYNC_FRESHNESS_TTL_MS=5000
export RIOTPLAN_CLOUD_SYNC_TIMEOUT_MS=120000
export RIOTPLAN_PLAN_BUCKET=riotplan-plan-bucket
export RIOTPLAN_CONTEXT_BUCKET=riotplan-context-bucket
export RIOTPLAN_PLAN_PREFIX=riotplan/plans
export RIOTPLAN_CONTEXT_PREFIX=riotplan/context
export GOOGLE_CLOUD_PROJECT=my-gcp-project
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### How it works

- RiotPlan MCP mirrors plan/context files between local cache and GCS.
- Local mode is still the default and requires no cloud settings.
- In cloud mode, mutating tool calls sync updates back to the configured bucket(s).
- `incrementalSyncEnabled=true` enables manifest diff + coalescing + TTL short-circuit.
- Set `incrementalSyncEnabled=false` to immediately roll back to full-sync behavior.

### Operational guardrails

- If sync latency spikes, set `RIOTPLAN_CLOUD_INCREMENTAL_SYNC_ENABLED=false` first to isolate optimization effects.
- Keep `syncFreshnessTtlMs` low (for example 2000-5000ms) for interactive workloads.
- Use `syncTimeoutMs` to prevent hanging sync operations under degraded GCS/network conditions.
- Monitor:
  - p50/p95 `tool.call.complete` latency
  - `downloadedCount` trend
  - `coalescedWaiterCount` utilization
  - `syncFreshHit` rate

## HTTP RBAC Security (Optional)

`riotplan-mcp-http` supports optional API-key authentication with file-backed RBAC.

- Keep it disabled by default (`secured: false`) for local/dev scenarios.
- Enable it for shared/server deployments (`secured: true`).
- When enabled, the server fails fast at startup unless RBAC files are valid.

### Required config when secured

```yaml
secured: true
rbacUsersPath: /var/run/riotplan-rbac/users.yaml
rbacKeysPath: /var/run/riotplan-rbac/keys.yaml
rbacPolicyPath: /var/run/riotplan-rbac/policy.yaml # optional
rbacReloadSeconds: 0 # optional, 0 = reload on restart only
```

Equivalent env vars:

```bash
export RIOTPLAN_HTTP_SECURED=true
export RBAC_USERS_PATH=/var/run/riotplan-rbac/users.yaml
export RBAC_KEYS_PATH=/var/run/riotplan-rbac/keys.yaml
export RBAC_POLICY_PATH=/var/run/riotplan-rbac/policy.yaml
export RBAC_RELOAD_SECONDS=0
```

### Auth headers

Provide API key secret using either:

- `Authorization: Bearer <raw_key_secret>`
- `X-API-Key: <raw_key_secret>`

### Built-in route examples

- Public: `GET /health`
- Authenticated (any role): `GET /auth/whoami`
- Admin-only: `GET /admin/ping`

## Tools

### Plan Management

#### `riotplan_create`

Create a new plan with AI-generated steps.

Plan storage location is server-managed and not client-configurable.

**Parameters:**
- `code` (required) - Plan identifier (e.g., "auth-system")
- `description` (required) - What you want to accomplish
- `name` (optional) - Human-readable name
- `steps` (optional) - Number of steps to generate
- `direct` (optional) - Skip analysis phase
- `provider` (optional) - AI provider (anthropic, openai, gemini)
- `model` (optional) - Specific model
- `noAi` (optional) - Use templates only

**Example:**
```typescript
riotplan_create({
  code: "user-auth",
  description: "Implement user authentication with JWT tokens",
  steps: 6,
  provider: "anthropic"
})
```

#### `riotplan_status`

Show current plan status and progress.

**Parameters:**
- `path` (optional) - Plan directory
- `verbose` (optional) - Include step details

**Returns:**
- Plan status (pending, in_progress, completed)
- Progress percentage
- Current step
- Blockers and issues

#### `riotplan_validate`

Validate plan structure and files.

**Parameters:**
- `path` (optional) - Plan directory
- `fix` (optional) - Attempt to fix issues

**Checks:**
- Required files exist
- STATUS.md is valid
- Step numbering is correct
- No circular dependencies

#### `riotplan_generate`

Generate plan content using AI.

**Parameters:**
- `description` (required) - Plan requirements
- `steps` (optional) - Number of steps
- `provider` (optional) - AI provider
- `model` (optional) - Specific model

### Step Management

#### `riotplan_step_list`

List all steps in a plan.

**Parameters:**
- `path` (optional) - Plan directory
- `pending` (optional) - Show only pending steps
- `all` (optional) - Include completed steps

**Returns:**
Array of steps with number, title, status, and file.

#### `riotplan_step_start`

Mark a step as started.

**Parameters:**
- `path` (optional) - Plan directory
- `step` (required) - Step number

Updates STATUS.md to reflect in-progress status.

#### `riotplan_step_complete`

Mark a step as completed.

**Parameters:**
- `path` (optional) - Plan directory
- `step` (required) - Step number

Updates STATUS.md and advances to next step.

### Project Binding and Workspace-Scoped Listing

RiotPlan supports a portable one-project-per-plan binding model that works across machines.

#### Binding resolution order

When a client asks for project information (`riotplan_get_project_binding`), RiotPlan resolves in this order:

1. **Explicit** binding persisted with `riotplan_bind_project`
2. **Inferred** repo identity (from surrounding git metadata)
3. **None** (`unresolved` / unassigned)

Unresolved plans are still returned by list APIs so clients can prompt users to map them.

#### One-project-per-plan semantics

- Each plan stores at most one `project` binding object.
- Directory plans store binding under `plan.yaml`.
- SQLite plans store binding metadata inside `.plan` as `other/project-binding.json`.

#### Workspace filtering

`riotplan_list_plans` supports:

- `projectId` filter (existing behavior)
- `workspaceId` filter (optional)

Plan storage/search location is server-managed and not client-configurable.

When `workspaceId` is omitted, behavior is unchanged for older clients.

**Example:**

```typescript
riotplan_list_plans({
  filter: "active",
  workspaceId: "workspace-alpha"
})
```

#### `riotplan_step_add`

Add a new step to the plan.

**Parameters:**
- `path` (optional) - Plan directory
- `title` (required) - Step title
- `number` (optional) - Position to insert
- `after` (optional) - Insert after this step

## Resources

Resources provide read-only access to plan data.

### `riotplan://plan/{path}`

Plan metadata and structure.

**Returns:**
- Plan code and name
- Metadata (created date, author, etc.)
- Optional `metadata.projectPath` when present in `plan.yaml`
- Current state

### `riotplan://status/{path}`

Current status and progress.

**Returns:**
- Status (pending, in_progress, completed)
- Current step number
- Progress (completed/total/percentage)
- Blockers and issues

### `riotplan://steps/{path}`

List of all steps.

**Returns:**
Array of steps with number, title, status, and filename.

### `riotplan://step/{path}?number={n}`

Specific step with full content.

**Returns:**
- Step metadata
- Full step content (markdown)
- Acceptance criteria
- Testing requirements

## Prompts

Workflow templates for common tasks.

### `create_plan`

Guided workflow for creating a new plan with AI-generated steps.

**Use when:** Starting a new complex task or feature.

**Workflow:**
1. Define plan details
2. Create with AI generation
3. Review generated plan
4. Validate structure
5. Begin execution

### `execute_step`

Workflow for executing a single step with proper status tracking.

**Use when:** Working through plan steps.

**Workflow:**
1. Check plan status
2. Read step details
3. Mark step as started
4. Execute tasks
5. Verify completion
6. Mark step as complete

### `track_progress`

Workflow for monitoring plan progress and maintaining status.

**Use when:** Checking progress or reviewing plan state.

**Workflow:**
1. Check overall status
2. Review step progress
3. Identify issues
4. Update status
5. Adjust plan if needed

## AI Provider Configuration

For AI-powered plan generation, set your API key:

```bash
# Anthropic (recommended)
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI
export OPENAI_API_KEY="sk-..."

# Google Gemini
export GOOGLE_API_KEY="..."
```

Install the corresponding execution package:

```bash
npm install -g @kjerneverk/execution-anthropic
# or
npm install -g @kjerneverk/execution-openai
# or
npm install -g @kjerneverk/execution-gemini
```

## Usage Patterns

### Creating and Executing a Plan

```typescript
// 1. Create plan
riotplan_create({
  code: "feature-x",
  description: "Implement feature X with tests and docs",
  steps: 8
})

// 2. Check status
riotplan_status({ path: "./feature-x" })

// 3. Start first step
riotplan_step_start({ path: "./feature-x", step: 1 })

// 4. Read step content
fetch("riotplan://step/feature-x?number=1")

// 5. Complete step
riotplan_step_complete({ path: "./feature-x", step: 1 })

// 6. Repeat for remaining steps
```

### Monitoring Progress

```typescript
// Quick status check
riotplan_status({ path: "./my-plan" })

// Detailed status with step info
riotplan_status({ path: "./my-plan", verbose: true })

// List pending steps
riotplan_step_list({ path: "./my-plan", pending: true })
```

### Adapting Plans

```typescript
// Add a new step
riotplan_step_add({
  path: "./my-plan",
  title: "Security Audit",
  after: 5
})

// Validate after changes
riotplan_validate({ path: "./my-plan" })
```

## Benefits

### For AI Assistants

- **Structured Workflows** - Break complex tasks into manageable steps
- **State Persistence** - Resume work across multiple sessions
- **Progress Tracking** - Always know where you are
- **Context Maintenance** - Keep track of decisions and blockers
- **Adaptive Planning** - Add/modify steps as requirements emerge

### For Users

- **Transparent Progress** - See exactly what's been done
- **Reviewable Plans** - Inspect and adjust AI-generated plans
- **Collaborative Work** - Human and AI work together
- **Version Control Friendly** - All files are markdown

## Troubleshooting

### Server Not Starting

Check installation:
```bash
which riotplan-mcp-http
# or
npx @kjerneverk/riotplan riotplan-mcp-http --help
```

### Tools Not Available

Verify MCP configuration in Cursor settings and restart the IDE.

### AI Provider Errors

Ensure API keys are set and execution packages are installed:
```bash
echo $ANTHROPIC_API_KEY
npm list -g @kjerneverk/execution-anthropic
```

## See Also

- [Usage Guide](./usage.md) - CLI usage
- [Index](./index.md) - Guide overview
- [README](../README.md#mcp-integration) - Quick MCP setup
