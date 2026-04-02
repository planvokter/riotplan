# Plan Structure

This guide explains the anatomy of a RiotPlan directory and the purpose of each file.

## Directory Layout

A complete plan has this structure:

```
my-feature/
├── my-feature-prompt.md     # Meta-prompt (original request)
├── SUMMARY.md               # Executive summary
├── EXECUTION_PLAN.md        # Step-by-step strategy
├── STATUS.md                # Current state tracking
├── plan/                    # Step files directory
│   ├── 01-analysis.md
│   ├── 02-design.md
│   ├── 03-implementation.md
│   ├── 04-testing.md
│   └── 05-documentation.md
├── analysis/                # Analysis output (optional)
│   ├── REQUIREMENTS.md
│   └── prompts/
└── amendments/              # Plan amendments (optional)
    └── 001-feedback.md
```

## Core Files

### Meta-Prompt: `{code}-prompt.md`

The meta-prompt captures the original request that initiated the plan.

**Purpose:**
- Preserves original intent
- Reference for scope decisions
- Context for future work

**Example:**

```markdown
# User Authentication Implementation

## Overview
Implement secure user authentication with JWT tokens, session management,
and password reset functionality.

## The Problem
Currently, the application has no authentication. Users cannot create
accounts, log in, or maintain sessions.

## Goals
1. Secure user registration with email verification
2. JWT-based authentication
3. Session management with refresh tokens
4. Password reset via email
5. Rate limiting on auth endpoints

## What This Plan Does NOT Do
- OAuth/social login (future enhancement)
- Two-factor authentication (future enhancement)
- Role-based access control (separate plan)

## Success Criteria
1. Users can register and verify email
2. Users can log in and receive JWT
3. Sessions persist across page reloads
4. Password reset works via email link
5. All endpoints have rate limiting
```

### Summary: `SUMMARY.md`

High-level overview of the approach and architecture.

**Purpose:**
- Executive summary for stakeholders
- Architectural decisions
- Key principles and philosophy

**Example:**

```markdown
# User Authentication - Summary

## Executive Summary
This plan implements JWT-based authentication with email verification,
session management, and password reset. The implementation follows
security best practices and uses industry-standard libraries.

## Philosophy
- Security first: All passwords hashed with bcrypt
- Stateless auth: JWT tokens for API authentication
- User-friendly: Clear error messages and email notifications
- Testable: Comprehensive test coverage for auth flows

## Architecture

### Authentication Flow
1. User registers → Email verification sent
2. User verifies email → Account activated
3. User logs in → JWT access token + refresh token
4. Client uses access token → Validated on each request
5. Access token expires → Use refresh token for new access token

### Technology Stack
- JWT for tokens (jsonwebtoken)
- bcrypt for password hashing
- nodemailer for email
- Redis for token blacklist
- Express middleware for auth

## Success Metrics
1. 100% test coverage on auth endpoints
2. All passwords properly hashed
3. Tokens expire appropriately
4. Rate limiting prevents brute force
5. Email verification works reliably
```

### Execution Plan: `EXECUTION_PLAN.md`

Detailed execution strategy with step sequence and quality gates.

**Purpose:**
- Define step order and dependencies
- Specify quality gates
- Guide execution
- Commit strategy

**Example:**

```markdown
# User Authentication - Execution Plan

> **Execute this file directly:** When ready, say "Execute EXECUTION_PLAN.md"

## Execution Instructions

1. **Read STATUS.md first** to check current state
2. **Find the next pending step** in the sequence below
3. **Execute that step** by reading its detailed plan file
4. **Update STATUS.md** after each step completes
5. **Continue** until all steps are complete

---

## Execution Sequence

### Phase 1: Foundation

| Order | Step | File | Est. Effort |
|-------|------|------|-------------|
| 1 | Database Schema | `plan/01-database-schema.md` | Small |
| 2 | User Model | `plan/02-user-model.md` | Small |
| 3 | Password Hashing | `plan/03-password-hashing.md` | Small |

### Phase 2: Core Authentication

| Order | Step | File | Est. Effort |
|-------|------|------|-------------|
| 4 | JWT Service | `plan/04-jwt-service.md` | Medium |
| 5 | Registration Endpoint | `plan/05-registration.md` | Medium |
| 6 | Login Endpoint | `plan/06-login.md` | Medium |
| 7 | Auth Middleware | `plan/07-auth-middleware.md` | Small |

### Phase 3: Advanced Features

| Order | Step | File | Est. Effort |
|-------|------|------|-------------|
| 8 | Email Verification | `plan/08-email-verification.md` | Large |
| 9 | Password Reset | `plan/09-password-reset.md` | Large |
| 10 | Rate Limiting | `plan/10-rate-limiting.md` | Medium |

### Phase 4: Completion

| Order | Step | File | Est. Effort |
|-------|------|------|-------------|
| 11 | Integration Tests | `plan/11-integration-tests.md` | Large |
| 12 | Documentation | `plan/12-documentation.md` | Small |

---

## Quality Gates

```bash
# After each step:
npm run lint
npm test
npm run type-check
```

---

## Commit Strategy

```
feat(auth): add database schema for users
feat(auth): implement user model
feat(auth): add password hashing with bcrypt
feat(auth): implement JWT service
feat(auth): add registration endpoint
feat(auth): add login endpoint
feat(auth): implement auth middleware
feat(auth): add email verification
feat(auth): implement password reset
feat(auth): add rate limiting
test(auth): add integration tests
docs(auth): document authentication system
```
```

### Status: `STATUS.md`

Current execution state and progress tracking.

**Purpose:**
- Track which steps are complete
- Record blockers and issues
- Provide progress visibility
- Enable resumption

See [STATUS.md Format](status-format) for complete reference.

## Step Files

### Step File Structure

Each step file in `plan/` follows this format:

```markdown
# Step 01: Database Schema

## Goal
Create the database schema for user authentication including users table,
email verification tokens, and password reset tokens.

## Prerequisites
- Database connection configured
- Migration system in place

## Tasks

### Task 1: Create Users Table
Create migration for users table with:
- id (UUID primary key)
- email (unique, indexed)
- password_hash
- email_verified (boolean)
- created_at, updated_at

### Task 2: Create Email Verification Tokens Table
Create migration for email_verification_tokens:
- token (UUID primary key)
- user_id (foreign key to users)
- expires_at
- created_at

### Task 3: Create Password Reset Tokens Table
Create migration for password_reset_tokens:
- token (UUID primary key)
- user_id (foreign key to users)
- expires_at
- created_at

## Acceptance Criteria
- [ ] Users table exists with all required columns
- [ ] Email verification tokens table exists
- [ ] Password reset tokens table exists
- [ ] All foreign keys are properly configured
- [ ] Indexes are in place for performance
- [ ] Migration runs successfully

## Verification

```bash
# Run migrations
npm run migrate

# Verify tables exist
psql -d myapp -c "\dt"

# Check schema
psql -d myapp -c "\d users"
psql -d myapp -c "\d email_verification_tokens"
psql -d myapp -c "\d password_reset_tokens"
```

## Notes
- Using UUID for all primary keys for security
- Tokens expire after 24 hours
- Email must be unique and indexed for fast lookup
```

### Step Naming Convention

| Pattern | Example | Purpose |
|---------|---------|---------|
| `01-*.md` | `01-analysis.md` | First step |
| `02-*.md` | `02-design.md` | Second step |
| `XX-*.md` | `15-testing.md` | Any step (two digits) |

**Rules:**
- Always two digits (01, 02, ..., 99)
- Kebab-case for the name part
- Descriptive but concise names
- Sequential numbering (no gaps)

## Optional Directories

### Analysis: `analysis/`

Contains analysis output when using analysis-first workflow.

```
analysis/
├── REQUIREMENTS.md          # Elaborated requirements
└── prompts/
    ├── 001-initial.md
    ├── 002-feedback.md
    └── 003-refinement.md
```

**Purpose:**
- Capture detailed requirements
- Record elaboration feedback
- Preserve analysis context

### Amendments: `amendments/`

Contains plan amendments after generation.

```
amendments/
├── 001-add-step.md
├── 002-reorder-steps.md
└── 003-clarify-step-05.md
```

**Purpose:**
- Track structural changes
- Record feedback on generated plan
- Preserve amendment history

### Feedback: `feedback/`

Contains execution feedback records.

```
feedback/
├── 2026-01-15-step-03-feedback.md
└── 2026-01-18-blocker-report.md
```

**Purpose:**
- Document issues during execution
- Record decisions and rationale
- Capture lessons learned

## File Naming Conventions

| Element | Pattern | Example |
|---------|---------|---------|
| Directory | `kebab-case` | `user-authentication/` |
| Meta-prompt | `{code}-prompt.md` | `user-authentication-prompt.md` |
| Step files | `XX-name.md` | `01-analysis.md`, `02-design.md` |
| Step numbers | Two digits, zero-padded | `01`, `02`, ... `99` |
| Feedback | `YYYY-MM-DD-description.md` | `2026-01-15-step-03-feedback.md` |

## Validation

RiotPlan validates plan structure:

```bash
riotplan plan validate
```

Checks:
- Required files exist (STATUS.md, EXECUTION_PLAN.md, etc.)
- STATUS.md is parseable
- Step files have valid numbering (01-*, 02-*, etc.)
- Step dependencies are valid
- No circular dependencies

## Best Practices

### Keep Plans Focused

- One plan per feature or task
- Clear scope boundaries
- Explicit non-goals
- Reasonable number of steps (5-15 typical)

### Use Descriptive Names

- Plan directory: `user-authentication` not `auth`
- Step files: `01-database-schema.md` not `01-db.md`
- Clear, unambiguous names

### Document Decisions

- Use SUMMARY.md for architectural decisions
- Add notes to STATUS.md for context
- Record rationale in step files

### Version Control

- Commit plan files to git
- Track STATUS.md changes
- Review plan diffs in PRs

## Next Steps

- Learn about [Creating Plans](creating-plans) - How to create plans
- Explore [Managing Steps](managing-steps) - Working with steps
- Understand [STATUS.md Format](status-format) - Complete format reference
- Read [CLI Usage](cli-usage) - Command reference
