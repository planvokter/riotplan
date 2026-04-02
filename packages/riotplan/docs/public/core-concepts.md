# Core Concepts

Understanding the fundamental concepts of RiotPlan will help you create and manage effective long-lived workflows.

## Plans

A **plan** is a structured directory that represents a multi-step AI-assisted task. Unlike single prompts or multi-turn conversations, plans have:

- **Persistent state** - Progress is tracked across sessions
- **Structured steps** - Work is broken into manageable units
- **Clear boundaries** - Explicit scope and success criteria
- **Resumability** - Can be interrupted and continued later

### Plan Lifecycle

1. **Creation** - Define what you want to accomplish
2. **Generation** - AI creates detailed steps (or use templates)
3. **Execution** - Work through steps sequentially
4. **Tracking** - STATUS.md updates as you progress
5. **Completion** - All steps done, plan archived

### Plan States

| State | Description |
|-------|-------------|
| `pending` | Created but not started |
| `in_progress` | Currently being worked on |
| `completed` | All steps finished |
| `blocked` | Waiting on external dependency |
| `failed` | Encountered unrecoverable error |

## Steps

**Steps** are the fundamental units of work in a plan. Each step:

- Is a numbered markdown file (01-analysis.md, 02-design.md)
- Contains specific tasks and acceptance criteria
- Has a clear goal and verification method
- Can depend on other steps
- Tracks its own status independently

### Step Anatomy

```markdown
# Step 01: Analysis

## Goal
What this step accomplishes

## Prerequisites
- What must be done before this step

## Tasks

### Task 1: Gather Requirements
Detailed instructions for this task

### Task 2: Document Findings
More detailed instructions

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Verification
```bash
# Commands to verify this step is complete
npm test
```

## Notes
Any additional context
```

### Step States

| Symbol | Status | Meaning |
|--------|--------|---------|
| ⬜ | `pending` | Not started |
| 🔄 | `in_progress` | Currently active |
| ✅ | `completed` | Done |
| ❌ | `failed` | Failed with error |
| ⏸️ | `blocked` | Waiting on dependency |
| ⏭️ | `skipped` | Intentionally skipped |

### Step Dependencies

Steps can depend on other steps:

```markdown
## Prerequisites
- Step 01 must be completed
- Step 02 must be completed
```

RiotPlan validates dependencies and prevents:
- Circular dependencies
- Missing dependencies
- Out-of-order execution

## STATUS.md

The **STATUS.md** file is the heart of plan tracking. It contains:

### Current State

```markdown
## Current State

| Field | Value |
|-------|-------|
| **Status** | `in_progress` |
| **Current Step** | 03-implementation |
| **Last Completed** | 02-design |
| **Started At** | 2026-01-08 |
| **Last Updated** | 2026-01-10 |
```

### Step Progress

```markdown
## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
| 01 | Analysis | ✅ Completed | 2026-01-08 | 2026-01-08 | - |
| 02 | Design | ✅ Completed | 2026-01-08 | 2026-01-09 | - |
| 03 | Implementation | 🔄 In Progress | 2026-01-09 | - | 50% done |
| 04 | Testing | ⬜ Pending | - | - | - |
| 05 | Documentation | ⬜ Pending | - | - | - |
```

### Blockers and Issues

```markdown
## Blockers

- Waiting for API key from DevOps team

## Issues

- Minor: Need to decide on session storage strategy
- Critical: Database migration script has syntax error
```

### Automatic Updates

STATUS.md is automatically updated when you:
- Start a step (`riotplan step start`)
- Complete a step (`riotplan step complete`)
- Add a step (`riotplan step add`)
- Report a blocker or issue

## Execution Plan

The **EXECUTION_PLAN.md** file defines:

### Execution Sequence

```markdown
## Execution Sequence

### Phase 1: Foundation

| Order | Step | File | Est. Effort |
|-------|------|------|-------------|
| 1 | Analysis | `plan/01-analysis.md` | Small |
| 2 | Design | `plan/02-design.md` | Medium |

### Phase 2: Implementation

| Order | Step | File | Est. Effort |
|-------|------|------|-------------|
| 3 | Implementation | `plan/03-implementation.md` | Large |
| 4 | Testing | `plan/04-testing.md` | Medium |
```

### Quality Gates

```markdown
## Quality Gates

```bash
# After each step:
npm run precommit
npm test
```
```

### Commit Strategy

```markdown
## Commit Strategy

```
feat(scope): step 01 description
feat(scope): step 02 description
```
```

## Meta-Prompt

The **{code}-prompt.md** file captures the original request:

```markdown
# My Feature Implementation

## Overview
Description of what this plan accomplishes

## The Problem
What problem are we solving?

## Goals
1. Goal 1
2. Goal 2
3. Goal 3

## What This Plan Does NOT Do
- Explicit scope boundaries

## Success Criteria
1. How we know we're done
```

This file preserves the original intent and serves as a reference throughout execution.

## Summary

The **SUMMARY.md** file provides a high-level overview:

```markdown
# My Feature - Summary

## Executive Summary
2-3 sentences describing the approach

## Philosophy
Key principles guiding this plan

## Architecture
High-level technical approach, diagrams if helpful

## Success Metrics
1. Metric 1
2. Metric 2
```

## File Conventions

| File/Pattern | Purpose |
|--------------|---------|
| `{code}-prompt.md` | Meta-prompt that initiates the plan |
| `SUMMARY.md` | Overview of the approach |
| `EXECUTION_PLAN.md` | Strategy document |
| `STATUS.md` | Current execution state |
| `01-*.md`, `02-*.md` | Step files (numbered) |
| `plan/` | Optional subdirectory for steps |
| `analysis/` | Optional output directory |

## Convention Over Configuration

RiotPlan uses file and directory naming conventions to define plan structure:

- **Directory name** becomes the plan code
- **Numbered files** define step sequence
- **Specific filenames** have specific meanings
- **Minimal configuration** needed

This makes plans:
- Easy to version control
- Human-readable
- Self-documenting
- Tool-independent

## Next Steps

- Learn about [Plan Structure](plan-structure) - Detailed directory anatomy
- Read [Creating Plans](creating-plans) - How to create plans
- Explore [Managing Steps](managing-steps) - Working with steps
- Understand [STATUS.md Format](status-format) - Complete format reference
