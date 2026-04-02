# Creating a Plan

**Purpose**: Instructions for creating a RiotPlan, either via CLI or direct LLM creation.

## Overview

A RiotPlan is a structured directory containing a prompt, summary, execution plan, status tracker, and numbered step files. Plans enable complex, multi-step work to be tracked, interrupted, and resumed.

---

## Method 1: Create Using RiotPlan CLI

The CLI provides scaffolding commands to initialize a plan structure.

### Basic Plan Creation

```bash
# Create a basic plan
riotplan plan init my-feature

# Create with description
riotplan plan init my-feature --description "Implement user authentication"

# Create with specific number of steps
riotplan plan init my-feature --steps 5

# Create in a specific location
riotplan plan init my-feature --path ./prompts/
```

### Validate Plan Structure

```bash
# Validate plan structure
riotplan plan validate ./prompts/my-feature
```

### Add Steps

```bash
# Add a new step
riotplan step add "Database Migration" --plan ./prompts/my-feature

# Step is created as plan/0X-database-migration.md
```

---

## Method 2: Direct LLM Creation (Without CLI)

When creating a plan directly as an LLM, follow these instructions:

### Step 1: Create the Directory Structure

Create the plan directory with this structure:

```
my-plan/
├── my-plan-prompt.md     # Meta-prompt (the original request)
├── SUMMARY.md            # Executive summary of approach
├── EXECUTION_PLAN.md     # Step-by-step execution strategy
├── STATUS.md             # Current state tracker
└── plan/                 # Step files directory
    ├── 01-analysis.md
    ├── 02-design.md
    ├── 03-implementation.md
    ├── 04-testing.md
    └── 05-documentation.md
```

### Step 2: Create the Meta-Prompt

File: `{plan-code}-prompt.md`

The meta-prompt captures the original request and context:

```markdown
# My Feature Implementation

## Overview

[Description of what this plan accomplishes]

## The Problem

[What problem are we solving?]

## Goals

1. [Goal 1]
2. [Goal 2]
3. [Goal 3]

## What This Plan Does NOT Do

- [Explicit scope boundaries]

## Success Criteria

1. [How we know we're done]
```

### Step 3: Create the Summary

File: `SUMMARY.md`

The summary provides a high-level overview of the approach:

```markdown
# My Feature - Summary

## Executive Summary

[2-3 sentences describing the approach]

## Philosophy

[Key principles guiding this plan]

## Architecture

[High-level technical approach, diagrams if helpful]

## Success Metrics

1. [Metric 1]
2. [Metric 2]
```

### Step 4: Create the Execution Plan

File: `EXECUTION_PLAN.md`

The execution plan is the primary driver of plan execution:

```markdown
# My Feature - Execution Plan

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
| 1 | Analysis | `plan/01-analysis.md` | Small |
| 2 | Design | `plan/02-design.md` | Medium |

### Phase 2: Implementation

| Order | Step | File | Est. Effort |
|-------|------|------|-------------|
| 3 | Implementation | `plan/03-implementation.md` | Large |
| 4 | Testing | `plan/04-testing.md` | Medium |

### Phase 3: Completion

| Order | Step | File | Est. Effort |
|-------|------|------|-------------|
| 5 | Documentation | `plan/05-documentation.md` | Small |

---

## Quality Gates

```bash
# After each step:
npm run precommit
```

---

## Step Details Quick Reference

### Step 01: Analysis
- [Brief description]
- **Affects:** [Files/areas]

### Step 02: Design
- [Brief description]
- **Affects:** [Files/areas]

[Continue for all steps...]

---

## Commit Strategy

```
feat(scope): step 01 description
feat(scope): step 02 description
```
```

### Step 5: Create the Status File

File: `STATUS.md`

The status file tracks execution progress:

```markdown
# My Feature - Execution Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | `pending` |
| **Current Step** | 01-analysis |
| **Last Completed** | - |
| **Created At** | 2026-01-25 |
| **Last Updated** | 2026-01-25 |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
| 01 | Analysis | ⬜ Pending | - | - | - |
| 02 | Design | ⬜ Pending | - | - | - |
| 03 | Implementation | ⬜ Pending | - | - | - |
| 04 | Testing | ⬜ Pending | - | - | - |
| 05 | Documentation | ⬜ Pending | - | - | - |

## Blockers

_None._

## Issues

_None._

## Notes

_Plan created and ready for execution._
```

### Step 6: Create Step Files

Each step file in `plan/` should follow this format:

File: `plan/01-analysis.md`

```markdown
# Step 01: Analysis

## Goal

[What this step accomplishes]

## Prerequisites

- [What must be done before this step]

## Tasks

### Task 1: [Name]

[Detailed instructions]

### Task 2: [Name]

[Detailed instructions]

## Acceptance Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Verification

```bash
# Commands to verify this step is complete
```

## Notes

[Any additional context]
```

---

## Plan Naming Conventions

| Element | Pattern | Example |
|---------|---------|---------|
| Directory | `kebab-case` | `user-authentication/` |
| Meta-prompt | `{code}-prompt.md` | `user-authentication-prompt.md` |
| Step files | `XX-name.md` | `01-analysis.md`, `02-design.md` |
| Step numbers | Two digits, zero-padded | `01`, `02`, ... `99` |

---

## LLM Creation Quick Reference

```
1. Create directory: my-plan/
2. Create my-plan-prompt.md (original request)
3. Create SUMMARY.md (approach overview)
4. Create EXECUTION_PLAN.md (step sequence)
5. Create STATUS.md (progress tracker)
6. Create plan/ subdirectory
7. Create plan/01-*.md, 02-*.md, etc. (step files)
```

### Sample Prompt for LLM Plan Creation

> Create a RiotPlan for implementing user authentication. The plan should include analysis, design, implementation, testing, and documentation phases. Create all required files: the meta-prompt, SUMMARY.md, EXECUTION_PLAN.md, STATUS.md, and step files in the plan/ directory.

---

## Best Practices

### Step Granularity

- Each step should be completable in a single session
- Steps should have clear boundaries and deliverables
- Avoid steps that are too large (break into sub-steps)
- Avoid steps that are too small (combine related work)

### Dependencies

- Order steps by dependencies (earlier steps first)
- Document prerequisites in each step file
- Note blocking dependencies in EXECUTION_PLAN.md

### Verification Criteria

Include machine-readable verification criteria:

```markdown
## Verification Criteria

### Must Have (Plan Fails Without)
- [ ] Core functionality works
- [ ] Tests pass

### Should Have (Plan Incomplete Without)
- [ ] Documentation updated
- [ ] Error handling complete

### Could Have (Nice to Have)
- [ ] Performance optimizations
```

### Status Updates

- Always update STATUS.md after each step
- Document blockers immediately when discovered
- Record issues for future reference
- Add notes for context that helps resumption
