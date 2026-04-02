# STATUS.md Format

Complete reference for the STATUS.md file format used to track plan execution.

## Overview

STATUS.md is the heart of plan tracking. It contains:
- Current plan status and progress
- Step-by-step progress tracking
- Blockers and issues
- Execution history

## File Structure

```markdown
# {Plan Name} - Execution Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | `in_progress` |
| **Current Step** | 03-implementation |
| **Last Completed** | 02-design |
| **Started At** | 2026-01-08 |
| **Last Updated** | 2026-01-10 |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
| 01 | Analysis | ✅ Completed | 2026-01-08 | 2026-01-08 | - |
| 02 | Design | ✅ Completed | 2026-01-08 | 2026-01-09 | - |
| 03 | Implementation | 🔄 In Progress | 2026-01-09 | - | 50% done |
| 04 | Testing | ⬜ Pending | - | - | - |
| 05 | Documentation | ⬜ Pending | - | - | - |

## Blockers

_No blockers currently._

## Issues

_No issues encountered._

## Notes

_Plan progressing well._
```

## Current State Section

### Status Field

| Value | Description |
|-------|-------------|
| `pending` | Created but not started |
| `in_progress` | Currently being worked on |
| `completed` | All steps finished |
| `blocked` | Waiting on external dependency |
| `failed` | Encountered unrecoverable error |

### Current Step

The step currently being worked on (e.g., `03-implementation`).

Format: `{number}-{title}`

### Last Completed

The most recently completed step.

Format: `{number}-{title}` or `-` if none completed

### Timestamps

- **Started At**: When plan execution began (YYYY-MM-DD)
- **Last Updated**: When STATUS.md was last modified (YYYY-MM-DD)

## Step Progress Section

### Table Format

```markdown
| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
```

### Columns

#### Step

Step number (01, 02, 03, etc.)

#### Name

Step title (from filename, without number prefix)

Example: `01-analysis.md` → `Analysis`

#### Status

| Symbol | Status | When to Use |
|--------|--------|-------------|
| ⬜ | Pending | Not started |
| 🔄 | In Progress | Currently active |
| ✅ | Completed | Done |
| ❌ | Failed | Failed with error |
| ⏸️ | Blocked | Waiting on dependency |
| ⏭️ | Skipped | Intentionally skipped |

#### Started

Date when step was started (YYYY-MM-DD) or `-`

#### Completed

Date when step was completed (YYYY-MM-DD) or `-`

#### Notes

Brief notes about the step:
- Progress percentage (e.g., "50% done")
- Issues encountered
- Decisions made
- `-` if no notes

## Blockers Section

### Format

```markdown
## Blockers

- {Description of blocker}
- {Another blocker}
```

### When Empty

```markdown
## Blockers

_No blockers currently._
```

### Examples

```markdown
## Blockers

- Waiting for API key from DevOps team
- Database migration requires DBA approval
- Blocked on PR #123 review
```

## Issues Section

### Format

```markdown
## Issues

- {Severity}: {Description}
```

### Severity Levels

- **Critical**: Blocking progress
- **High**: Important but not blocking
- **Medium**: Should be addressed
- **Low**: Nice to fix

### When Empty

```markdown
## Issues

_No issues encountered._
```

### Examples

```markdown
## Issues

- Critical: Database migration script has syntax error
- High: Performance degradation in step 03
- Medium: Need to decide on session storage strategy
- Low: Code formatting inconsistent
```

## Notes Section

### Format

```markdown
## Notes

{Free-form notes about the plan}
```

### When Empty

```markdown
## Notes

_None._
```

### Examples

```markdown
## Notes

Implementation is progressing well. May need to add step 06 for deployment.

Decision: Using JWT for authentication instead of sessions.

Performance note: Step 03 took longer than expected due to database issues.
```

## Complete Example

```markdown
# User Authentication - Execution Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | `in_progress` |
| **Current Step** | 05-authentication-endpoints |
| **Last Completed** | 04-jwt-service |
| **Started At** | 2026-01-08 |
| **Last Updated** | 2026-01-10 |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
| 01 | Database Schema | ✅ Completed | 2026-01-08 | 2026-01-08 | - |
| 02 | User Model | ✅ Completed | 2026-01-08 | 2026-01-08 | - |
| 03 | Password Hashing | ✅ Completed | 2026-01-08 | 2026-01-09 | Using bcrypt |
| 04 | JWT Service | ✅ Completed | 2026-01-09 | 2026-01-09 | - |
| 05 | Authentication Endpoints | 🔄 In Progress | 2026-01-09 | - | 60% done |
| 06 | Auth Middleware | ⬜ Pending | - | - | - |
| 07 | Email Verification | ⬜ Pending | - | - | - |
| 08 | Password Reset | ⬜ Pending | - | - | - |
| 09 | Rate Limiting | ⬜ Pending | - | - | - |
| 10 | Integration Tests | ⬜ Pending | - | - | - |
| 11 | Documentation | ⬜ Pending | - | - | - |

## Blockers

- Waiting for SMTP credentials for email verification (Step 07)

## Issues

- Medium: Need to decide on session storage strategy (Redis vs in-memory)
- Low: Consider adding refresh token rotation

## Notes

Implementation progressing well. Registration and login endpoints are working.
Need to discuss session storage approach with team before proceeding to step 07.

Decision made: Using JWT with 24-hour expiry and refresh tokens.
```

## Parsing Rules

### Date Format

All dates use ISO 8601 format: `YYYY-MM-DD`

Examples:
- `2026-01-08`
- `2026-12-31`

### Status Values

Status values must be one of:
- `pending`
- `in_progress`
- `completed`
- `blocked`
- `failed`

Wrapped in backticks in the table.

### Step Numbers

Step numbers are always two digits:
- `01`, `02`, `03`, ..., `99`

### Empty Values

Use `-` for empty values in tables, not empty string or `null`.

### Emoji

Use standard emoji for step status:
- ⬜ (U+2B1C) - Pending
- 🔄 (U+1F504) - In Progress
- ✅ (U+2705) - Completed
- ❌ (U+274C) - Failed
- ⏸️ (U+23F8) - Blocked
- ⏭️ (U+23ED) - Skipped

## Automatic Updates

STATUS.md is automatically updated when you:

### Start a Step

```bash
riotplan step start 05
```

Updates:
- Current Step → `05-authentication-endpoints`
- Step 05 Status → 🔄 In Progress
- Step 05 Started → Current date
- Last Updated → Current date

### Complete a Step

```bash
riotplan step complete 05
```

Updates:
- Step 05 Status → ✅ Completed
- Step 05 Completed → Current date
- Last Completed → `05-authentication-endpoints`
- Current Step → Next pending step
- Last Updated → Current date

### Add a Step

```bash
riotplan step add "Security Audit"
```

Updates:
- Adds new row to Step Progress table
- Renumbers subsequent steps if inserted in middle
- Last Updated → Current date

### Report Blocker

```bash
riotplan step block 07 "Waiting for SMTP credentials"
```

Updates:
- Step 07 Status → ⏸️ Blocked
- Adds to Blockers section
- Last Updated → Current date

### Report Issue

```bash
riotplan issue add "Medium: Need to decide on session storage"
```

Updates:
- Adds to Issues section
- Last Updated → Current date

## Manual Editing

You can manually edit STATUS.md, but:

### Do's

- Update Notes section freely
- Add context to step notes
- Clarify blockers and issues
- Fix formatting issues

### Don'ts

- Don't change the table structure
- Don't use invalid status values
- Don't break the markdown format
- Don't remove required sections

### Validation

After manual edits, validate:

```bash
riotplan plan validate
```

This checks:
- STATUS.md is parseable
- All required sections exist
- Status values are valid
- Step numbers are correct
- Dates are valid format

## Next Steps

- [Core Concepts](core-concepts) - Understanding plans and steps
- [Managing Steps](managing-steps) - Working with steps
- [CLI Usage](cli-usage) - Command reference
- [Programmatic Usage](programmatic-usage) - Using the API
