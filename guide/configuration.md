# Configuration Guide

RiotPlan uses a flexible **four-tier configuration system** to determine where plans are stored. This system provides maximum flexibility while maintaining a zero-configuration experience for most users.

## Four-Tier Resolution Strategy

RiotPlan resolves the plan directory using the following priority order:

### Tier 1: Environment Variable (Highest Priority)

Set the `RIOTPLAN_PLAN_DIRECTORY` environment variable to explicitly specify the plan directory.

**When to use:**
- Personal overrides for specific projects
- CI/CD pipelines
- Container deployments
- Temporary testing scenarios

**Examples:**

```bash
# In your shell
export RIOTPLAN_PLAN_DIRECTORY=/path/to/my-plans
riotplan create my-feature

# In .cursor/mcp.json (for MCP server)
{
  "mcpServers": {
    "riotplan": {
      "command": "npx",
      "args": ["-y", "@riotprompt/riotplan"],
      "env": {
        "RIOTPLAN_PLAN_DIRECTORY": "/Users/me/projects/myapp/plans"
      }
    }
  }
}
```

### Tier 2: Configuration File (Project-Level)

Create a configuration file in your project to specify the plan directory and other settings.

**When to use:**
- Team projects where everyone should use the same plan location
- Projects with non-standard directory structures
- When you want to version-control configuration

**Supported file formats:**
- YAML: `riotplan.config.yaml`, `riotplan.config.yml`
- JSON: `riotplan.config.json`
- JavaScript: `riotplan.config.js`, `riotplan.config.mjs`, `riotplan.config.cjs`
- TypeScript: `riotplan.config.ts`, `riotplan.config.mts`, `riotplan.config.cts`

**Supported file locations:**
- `riotplan.config.*` (in project root)
- `riotplan.conf.*` (alternative naming)
- `.riotplan/config.*` (directory-based)
- `.riotplanrc.*` (dotfile style)
- `.riotplanrc` (no extension)

**Example: `riotplan.config.yaml`**

```yaml
# RiotPlan Configuration
# See https://github.com/kjerneverk/riotplan for documentation

# Directory where plans are stored (relative or absolute)
# Relative paths are resolved from this config file's location
planDirectory: ./plans

# Optional: Default AI provider for plan generation
# Options: anthropic, openai, gemini
defaultProvider: anthropic

# Optional: Default model to use for plan generation
# Examples: claude-3-5-sonnet-20241022, gpt-4, gemini-pro
defaultModel: claude-3-5-sonnet-20241022

# Optional: Custom template directory
templateDirectory: ./.riotplan/templates
```

**Example: `riotplan.config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/kjerneverk/riotplan/main/schemas/riotplan-config.schema.json",
  "planDirectory": "./plans",
  "defaultProvider": "anthropic",
  "defaultModel": "claude-3-5-sonnet-20241022"
}
```

**Note:** The `$schema` property enables IDE autocomplete and validation in VSCode, Cursor, and other editors that support JSON Schema.

**Example: `riotplan.config.js`**

```javascript
module.exports = {
  planDirectory: process.env.PLANS_DIR || './plans',
  defaultProvider: 'anthropic',
  defaultModel: 'claude-3-5-sonnet-20241022',
};
```

**Example: `riotplan.config.ts`**

```typescript
export default {
  planDirectory: './plans',
  defaultProvider: 'anthropic' as const,
  defaultModel: 'claude-3-5-sonnet-20241022',
} as const;
```

**Hierarchical Discovery:**
RiotPlan automatically searches up the directory tree for configuration files, similar to how `eslint.config.js` or `tsconfig.json` work. This means you can place the config file at your project root and it will be found from any subdirectory.

### Tier 3: Auto-Detection (Convenience)

If no explicit configuration is found, RiotPlan automatically walks up the directory tree looking for an existing `plans/` subdirectory.

**When to use:**
- Most common case - no configuration needed!
- Projects with a standard `plans/` directory structure
- Quick start without any setup

**How it works:**
1. Starts from the current working directory (`process.cwd()`)
2. Walks up the directory tree
3. At each level, checks if a `plans/` subdirectory exists
4. Returns the first match found
5. Stops at filesystem root if nothing found

**Example:**
```
/Users/me/project/
├── plans/              ← Found here!
│   └── my-plan/
├── src/
│   └── utils/
│       └── helper.ts   ← Running from here
```

Running `riotplan` from `/Users/me/project/src/utils/` will automatically find `/Users/me/project/plans/`.

### Tier 4: Fallback (Default)

If no configuration or existing `plans/` directory is found, RiotPlan falls back to `./plans` relative to the current working directory.

**When to use:**
- First-time use in a new project
- Quick experiments
- When you want plans in the current directory

**Behavior:**
- Creates `./plans` directory on first use if it doesn't exist
- Ensures RiotPlan always works, even with zero configuration

## Configuration Options

### `planDirectory`

**Type:** `string`  
**Default:** `"./plans"`  
**Required:** No

Path to the directory where plans are stored. Can be:
- **Relative**: Resolved from the config file's location (e.g., `./plans`, `../shared-plans`)
- **Absolute**: Full system path (e.g., `/Users/me/projects/plans`)

### `defaultProvider`

**Type:** `"anthropic" | "openai" | "gemini"`  
**Default:** `undefined` (uses system defaults)  
**Required:** No

Default AI provider to use for plan generation when not specified via CLI flags.

### `defaultModel`

**Type:** `string`  
**Default:** `undefined` (uses provider defaults)  
**Required:** No

Default model to use for plan generation. Examples:
- `claude-3-5-sonnet-20241022`
- `gpt-4`
- `gemini-pro`

### `templateDirectory`

**Type:** `string`  
**Default:** `undefined` (uses built-in templates)  
**Required:** No

Path to custom plan templates directory. Can be relative (to config file) or absolute.

### `cloud` (MCP/HTTP cloud mode)

**Type:** `object`  
**Default:** `undefined` (local mode)  
**Required:** No

Key options:

- `cloud.enabled` (`boolean`): enables GCS mirror mode.
- `cloud.incrementalSyncEnabled` (`boolean`, default `true`): enables incremental diff/coalescing/TTL optimizations.
- `cloud.syncFreshnessTtlMs` (`number`, default `5000`): freshness window for read sync short-circuit.
- `cloud.syncTimeoutMs` (`number`, default `120000`): timeout for coalesced sync operations.
- `cloud.planBucket` / `cloud.contextBucket` (`string`): GCS buckets for plans/context.
- `cloud.planPrefix` / `cloud.contextPrefix` (`string`): optional object prefixes.
- `cloud.projectId`, `cloud.keyFilename`, `cloud.credentialsJson`: auth settings.
- `cloud.cacheDirectory` (`string`): local mirror cache root.

Rollback switch:

- Set `cloud.incrementalSyncEnabled: false` (or `RIOTPLAN_CLOUD_INCREMENTAL_SYNC_ENABLED=false`) to disable optimization quickly and return to full-sync mode.

Post-deploy verification checklist:

- Confirm repeated read calls show low/zero `downloadedCount` when unchanged.
- Confirm `syncFreshHit` appears for reads within TTL.
- Confirm mutating tools still force refresh before write paths.
- Confirm coalesced burst traffic shows non-zero `coalescedWaiterCount`.

## CLI Configuration Commands

### Initialize Configuration

Create a new configuration file with sensible defaults:

```bash
riotplan --init-config
```

This creates `riotplan.config.yaml` in the current directory with:
- Default `planDirectory: ./plans`
- Commented-out optional settings
- Helpful documentation comments

### Check Configuration

View current configuration resolution:

```bash
riotplan check-config
```

Shows:
- Which tier is being used (env var, config file, walk-up, or fallback)
- Config file location (if found)
- Resolved plan directory path
- Current configuration settings

**Example output:**

```
RiotPlan Configuration Check
============================

✓ Configuration resolved successfully

Source: Walk-up detection (tier 3)
Found plans/ directory at: /Users/me/project
Plan Directory: /Users/me/project/plans (exists: yes)

Resolved Plan Directory: /Users/me/project/plans
```

## MCP Server Configuration

When using RiotPlan as an MCP server in Cursor or other IDEs, you can configure the plan directory via environment variable:

**`.cursor/mcp.json`:**

```json
{
  "mcpServers": {
    "riotplan": {
      "command": "npx",
      "args": ["-y", "@riotprompt/riotplan"],
      "env": {
        "RIOTPLAN_PLAN_DIRECTORY": "/Users/me/projects/myapp/plans"
      }
    }
  }
}
```

Alternatively, create a `riotplan.config.yaml` file in your workspace root, and RiotPlan will automatically discover it.

### HTTP MCP server (`riotplan-mcp-http`)

The HTTP server supports separate roots for plan storage and context discovery:

```bash
riotplan-mcp-http --plans-dir /Users/me/projects/myapp/plans --context-dir /Users/me/projects/context
```

- `plansDir` is required.
- `contextDir` is optional.
- If `contextDir` is not provided, RiotPlan uses deterministic fallback: `contextDir = plansDir`.

Cloud mode behavior:

- In local mode (default), `plansDir` must exist.
- In cloud mode (`cloud.enabled: true` or `RIOTPLAN_CLOUD_ENABLED=true`), `plansDir` can be omitted.
- When omitted in cloud mode, RiotPlan derives runtime mirror roots from cache config:
  - `plansDir = <cacheRoot>/plans`
  - `contextDir = <cacheRoot>/context`
  - `cacheRoot` comes from `cloud.cacheDirectory`, `RIOTPLAN_CLOUD_CACHE_DIR`, or defaults to `./.riotplan-http-cache`.

This is useful when `.plan` files live in one directory but `riotplan_context` entities (projects) are shared in another root.

You can also set these in `riotplan-http.config.yaml`:

```yaml
plansDir: /Users/me/projects/myapp/plans
contextDir: /Users/me/projects/context
port: 3002
cors: true
secured: false
rbacUsersPath: /path/to/users.yaml
rbacKeysPath: /path/to/keys.yaml
rbacPolicyPath: /path/to/policy.yaml
rbacReloadSeconds: 0
```

RBAC/auth options for HTTP mode:

- `secured` (`boolean`, default `false`): enable API key auth + RBAC authorization.
- `rbacUsersPath` (`string`): required when `secured=true`; path to users file (`yaml` or `json`).
- `rbacKeysPath` (`string`): required when `secured=true`; path to keys file (`yaml` or `json`).
- `rbacPolicyPath` (`string`, optional): optional policy rules file (`yaml` or `json`).
- `rbacReloadSeconds` (`number`, default `0`): periodic reload interval. `0` disables reload.

HTTP RBAC environment variables:

```bash
export RIOTPLAN_HTTP_SECURED=true
export RBAC_USERS_PATH=/var/run/riotplan-rbac/users.yaml
export RBAC_KEYS_PATH=/var/run/riotplan-rbac/keys.yaml
export RBAC_POLICY_PATH=/var/run/riotplan-rbac/policy.yaml
export RBAC_RELOAD_SECONDS=0
```

## Troubleshooting

### Config File Not Found

**Problem:** RiotPlan isn't finding your configuration file.

**Solutions:**
1. Run `riotplan check-config` to see which tier is being used
2. Verify the config file is named correctly (`riotplan.config.yaml`, etc.)
3. Check that the config file is in the project root or a parent directory
4. Ensure the file is readable (check permissions)

### Wrong Directory Being Used

**Problem:** RiotPlan is using a different directory than expected.

**Solutions:**
1. Run `riotplan check-config` to see the resolution chain
2. Check if `RIOTPLAN_PLAN_DIRECTORY` environment variable is set
3. Verify config file `planDirectory` setting
4. Check if there's a `plans/` directory higher up in the tree (walk-up detection)

### Plans Created in Wrong Location

**Problem:** New plans are being created in an unexpected location.

**Solutions:**
1. Use `riotplan check-config` to verify current resolution
2. Set `RIOTPLAN_PLAN_DIRECTORY` environment variable for explicit control
3. Create a `riotplan.config.yaml` with explicit `planDirectory` setting
4. Ensure you're running commands from the expected directory

### Debugging Tips

1. **Check current resolution:**
   ```bash
   riotplan check-config
   ```

2. **Verify environment variables:**
   ```bash
   echo $RIOTPLAN_PLAN_DIRECTORY
   ```

3. **Test with explicit path:**
   ```bash
   riotplan create my-plan --path /explicit/path/to/plans
   ```

4. **Clear caches** (if using programmatic API):
   ```typescript
   import { clearResolverCache } from '@riotprompt/riotplan';
   clearResolverCache();
   ```

## Migration Guide

### From Explicit Path Parameters

If you're currently passing explicit `--path` parameters to every command:

**Before:**
```bash
riotplan create my-plan --path ./plans
riotplan status --path ./plans/my-plan
```

**After:**
Create `riotplan.config.yaml`:
```yaml
planDirectory: ./plans
```

Then use commands without `--path`:
```bash
riotplan create my-plan
riotplan status my-plan
```

**Note:** Explicit `--path` parameters still work and take precedence over all configuration tiers (backward compatible).

### From Old `.riotplanrc.json`

If you have an old `.riotplanrc.json` file, you can migrate to the new format:

**Old format:**
```json
{
  "defaultProvider": "anthropic",
  "autoUpdateStatus": true
}
```

**New format (`riotplan.config.yaml`):**
```yaml
planDirectory: ./plans  # New: specify plan directory
defaultProvider: anthropic
# Note: autoUpdateStatus and stepTemplate are not yet supported
# in the new config system
```

## Best Practices

1. **Use config files for teams:** Check `riotplan.config.yaml` into version control so everyone uses the same plan directory.

2. **Use env vars for personal overrides:** Set `RIOTPLAN_PLAN_DIRECTORY` in your shell profile for personal preferences.

3. **Let walk-up handle the common case:** Most projects with a `plans/` directory don't need any configuration.

4. **Use `--init-config` to get started:** Run `riotplan --init-config` to create a config file with sensible defaults.

5. **Use `check-config` for debugging:** When things aren't working as expected, run `riotplan check-config` to see what's happening.

## API Reference

For programmatic usage, see the [API documentation](../docs/public/api-reference.md).

**Key functions:**
- `resolvePlanDirectory()` - Resolve plan directory using four-tier strategy
- `loadConfig()` - Load configuration from CardiganTime
- `findPlansDirectory()` - Find plans/ directory via walk-up
