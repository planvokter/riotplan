# Testing Checklist for Plan Directory Configuration

This document provides checklists for manually testing the plan directory configuration feature.

## MCP Server Testing (Step 13)

### Scenario 1: MCP with Environment Variable
- [ ] Set `RIOTPLAN_PLAN_DIRECTORY` in `.cursor/mcp.json`:
  ```json
  {
    "mcpServers": {
      "riotplan": {
        "command": "npx",
        "args": ["-y", "@riotprompt/riotplan"],
        "env": {
          "RIOTPLAN_PLAN_DIRECTORY": "/path/to/custom/plans"
        }
      }
    }
  }
  ```
- [ ] Restart Cursor/IDE to load MCP server
- [ ] Run `riotplan idea create test-idea "Test idea"` via MCP
- [ ] Verify plan created in `/path/to/custom/plans/test-idea`
- [ ] Run `riotplan check-config` via MCP or CLI
- [ ] Verify output shows "Environment variable (tier 1)" as source

### Scenario 2: MCP with Config File
- [ ] Create `riotplan.config.yaml` in project root:
  ```yaml
  planDirectory: ./my-plans
  ```
- [ ] Remove `RIOTPLAN_PLAN_DIRECTORY` from `.cursor/mcp.json` (if set)
- [ ] Restart Cursor/IDE
- [ ] Run `riotplan idea create test-idea "Test"` via MCP
- [ ] Verify plan created in `./my-plans/test-idea`
- [ ] Run `riotplan check-config`
- [ ] Verify output shows "Config file (tier 2)" as source

### Scenario 3: MCP with Walk-Up
- [ ] Remove `RIOTPLAN_PLAN_DIRECTORY` from `.cursor/mcp.json`
- [ ] Remove or rename `riotplan.config.yaml`
- [ ] Ensure `plans/` directory exists in project root
- [ ] Restart Cursor/IDE
- [ ] Run `riotplan idea create test-idea "Test"` via MCP
- [ ] Verify plan created in `plans/test-idea`
- [ ] Run `riotplan check-config`
- [ ] Verify output shows "Walk-up detection (tier 3)" as source

### Scenario 4: MCP with Fallback
- [ ] Remove `RIOTPLAN_PLAN_DIRECTORY` from `.cursor/mcp.json`
- [ ] Remove `riotplan.config.yaml`
- [ ] Remove or rename `plans/` directory
- [ ] Restart Cursor/IDE
- [ ] Run `riotplan idea create test-idea "Test"` via MCP
- [ ] Verify plan created in `./plans/test-idea` (fallback)
- [ ] Run `riotplan check-config`
- [ ] Verify output shows "Fallback (tier 4)" as source

### Scenario 5: Precedence Testing
- [ ] Set `RIOTPLAN_PLAN_DIRECTORY` in `.cursor/mcp.json`
- [ ] Create `riotplan.config.yaml` with different `planDirectory`
- [ ] Ensure `plans/` directory exists
- [ ] Restart Cursor/IDE
- [ ] Run `riotplan check-config`
- [ ] Verify env var takes precedence (tier 1)
- [ ] Remove env var, restart, verify config takes precedence (tier 2)
- [ ] Remove config, restart, verify walk-up takes precedence (tier 3)

## CLI Testing (Step 14)

### Scenario 1: CLI with No Configuration
- [ ] Navigate to empty directory (no config, no plans/)
- [ ] Run `riotplan idea create test-idea "Test idea"`
- [ ] Verify `./plans` directory created
- [ ] Verify plan created in `./plans/test-idea`
- [ ] Run `riotplan check-config`
- [ ] Verify shows "Fallback (tier 4)"

### Scenario 2: CLI with Existing plans/ Directory
- [ ] Create `plans/` directory in project root
- [ ] Navigate to subdirectory: `cd src/utils`
- [ ] Run `riotplan idea create test-idea "Test"`
- [ ] Verify walk-up found `plans/` in project root
- [ ] Verify plan created in project root `plans/test-idea`
- [ ] Run `riotplan check-config`
- [ ] Verify shows "Walk-up detection (tier 3)"

### Scenario 3: CLI with Config File
- [ ] Create `riotplan.config.yaml`:
  ```yaml
  planDirectory: ./custom-plans
  ```
- [ ] Run from any directory in project
- [ ] Run `riotplan idea create test-idea "Test"`
- [ ] Verify plan created in `./custom-plans/test-idea`
- [ ] Run `riotplan check-config`
- [ ] Verify shows "Config file (tier 2)"

### Scenario 4: CLI with Environment Variable
- [ ] Set `export RIOTPLAN_PLAN_DIRECTORY=/tmp/test-plans`
- [ ] Run from any directory
- [ ] Run `riotplan idea create test-idea "Test"`
- [ ] Verify plan created in `/tmp/test-plans/test-idea`
- [ ] Run `riotplan check-config`
- [ ] Verify shows "Environment variable (tier 1)"

### Scenario 5: CLI with Explicit Path
- [ ] Run `riotplan idea create test-idea "Test" --path /custom/explicit/path`
- [ ] Verify explicit path takes precedence over all tiers
- [ ] Verify plan created in `/custom/explicit/path/test-idea`
- [ ] Verify backward compatibility maintained

### Scenario 6: CLI Configuration Commands
- [ ] Run `riotplan --init-config`
- [ ] Verify `riotplan.config.yaml` created with defaults
- [ ] Verify file contains `planDirectory: ./plans`
- [ ] Run `riotplan check-config`
- [ ] Verify shows correct configuration source
- [ ] Verify shows resolved plan directory

## Performance Testing

- [ ] Run `riotplan check-config` multiple times - should be fast (cached)
- [ ] Test MCP server startup time - should not be significantly slower
- [ ] Test walk-up from deep nested directory (e.g., `src/components/ui/buttons/`)
- [ ] Verify caching works (second call should be instant)

## Error Scenarios

- [ ] Invalid config file (malformed YAML/JSON) - should show helpful error
- [ ] Config file with invalid `planDirectory` (non-existent absolute path)
- [ ] Permission issues (read-only directory)
- [ ] Missing CardiganTime dependency (should fail gracefully)

## Notes

- All tests should be performed in a clean environment
- Clear caches between tests if needed: `clearResolverCache()`, `clearConfigCache()`, `clearWalkUpCache()`
- Document any issues found during testing
