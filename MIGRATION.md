# Migrating to HTTP MCP Format

This guide explains how to migrate existing directory-based plans to the new UUID-based .plan format for use with the RiotPlan HTTP MCP server.

## Overview

The HTTP MCP server uses a centralized plan storage model with:
- **UUID-based identification**: Each plan has a unique UUID
- **.plan files**: Plans stored as SQLite databases with `.plan` extension
- **Organized directories**: Plans organized into `active/`, `done/`, and `hold/` subdirectories
- **Flat file naming**: Files named as `{uuid-abbrev}-{slug}.plan` (e.g., `a3f7b2c1-riotplan-http-mcp.plan`)

## Migration Command

```bash
riotplan migrate --source /path/to/old/plans --target /path/to/new/plans
```

### Options

- `--source <dir>`: Source directory containing directory-based plans (required)
- `--target <dir>`: Target directory for .plan files (required)
- `--dry-run`: Show what would be migrated without creating files
- `--project <slug>`: Project slug to add to metadata (e.g., `kjerneverk`, `redaksjon`)

### Examples

**Dry run to preview migration:**
```bash
riotplan migrate --source ./plans --target ./unified-plans --dry-run
```

**Migrate plans with project slug:**
```bash
riotplan migrate --source ./plans --target ./unified-plans --project kjerneverk
```

**Migrate multiple project directories:**
```bash
# Kjerneverk plans
riotplan migrate --source /Users/tobrien/gitw/kjerneverk/plans --target /Users/tobrien/gitw/tobrien/plans --project kjerneverk

# Redaksjon plans
riotplan migrate --source /Users/tobrien/gitw/redaksjon/plans --target /Users/tobrien/gitw/tobrien/plans --project redaksjon

# Grunnverk plans
riotplan migrate --source /Users/tobrien/gitw/grunnverk/plans --target /Users/tobrien/gitw/tobrien/plans --project grunnverk
```

## Migration Process

The migration tool:

1. **Scans source directory** recursively for plan directories
2. **Detects plan format** by looking for STATUS.md, SUMMARY.md, IDEA.md, or plan/ subdirectory
3. **Generates UUID** for each plan
4. **Determines category** from source path (done/, hold/, or active)
5. **Creates .plan file** in appropriate target subdirectory
6. **Migrates all data**:
   - Plan metadata (with new UUID)
   - Steps with status and timestamps
   - Files (IDEA.md, SHAPING.md, etc.)
   - Timeline events
   - Evidence, feedback, checkpoints

## Directory Structure

### Before (Directory-based)
```
plans/
├── my-feature/
│   ├── SUMMARY.md
│   ├── STATUS.md
│   ├── plan/
│   │   ├── 01-step.md
│   │   └── 02-step.md
│   └── .history/
│       └── timeline.jsonl
└── done/
    └── completed-feature/
        └── ...
```

### After (UUID-based)
```
unified-plans/
├── a3f7b2c1-my-feature.plan
└── done/
    └── b4c5d6e7-completed-feature.plan
```

## Starting the HTTP Server

After migration, start the HTTP MCP server:

```bash
riotplan-mcp-http --port 3002 --plans-dir /path/to/unified-plans
```

The server will:
- Serve plans from the unified directory
- Recognize `done/` and `hold/` subdirectories
- Identify plans by UUID
- Provide MCP tools for plan management

## VSCode Extension

After migration and server startup, use the RiotPlan VSCode extension:

1. Install the extension from `riotplan-vscode/`
2. Configure server URL in settings: `riotplan.serverUrl`
3. Browse plans in the Explorer sidebar under "Plans"
4. Plans are organized by category (Active, Done, Hold)

## Rollback

To rollback to directory-based format:
- The original directory-based plans are not modified by migration
- Keep backups of source directories before migrating
- The migration is one-way (no reverse migration tool currently)

## Notes

- **UUID Generation**: Each plan gets a new UUID during migration
- **Project Slug**: Optional project identifier added to description field
- **Category Detection**: Automatically detects done/hold from source path
- **Data Preservation**: All plan data is migrated (steps, files, timeline, etc.)
- **Idempotent**: Running migration multiple times creates duplicate .plan files with different UUIDs

## Troubleshooting

**Migration fails with "Plan not found":**
- Verify source directory contains valid plan directories
- Check that plans have at least one of: STATUS.md, SUMMARY.md, IDEA.md, or plan/ subdirectory

**Server can't find plans:**
- Verify plans directory path is correct
- Check that .plan files were created in target directory
- Ensure server has read permissions

**VSCode extension shows no plans:**
- Verify HTTP server is running
- Check server URL in VSCode settings
- Click refresh button in Plans view
