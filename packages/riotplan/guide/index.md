# AI Agent Guide: RiotPlan

**Role**: You are an AI assistant tasked with understanding, using, or extending `riotplan`, a framework for long-lived, stateful AI workflows.

**Goal**: Provide a comprehensive understanding of `riotplan`'s capabilities, architecture, and usage patterns to facilitate correct implementation of multi-step AI workflows.

## Core Capabilities

`riotplan` is a library for managing AI-assisted tasks that span multiple sessions, days, or weeks. Unlike single prompts or multi-turn conversations, plans have persistent state and support interruption/resumption.

*   **Structured Plans**: Plans are organized as directories with numbered step files (01-STEP.md, 02-STEP.md), status tracking, and execution strategies.
*   **Persistent State**: Progress is tracked in STATUS.md, allowing plans to be interrupted and resumed across sessions.
*   **Step Management**: Steps are individual prompts executed in sequence, with dependency tracking and progress indicators.
*   **Convention Over Configuration**: File and directory naming conventions define the plan structure.

## Quick Start Context

When analyzing or generating code using `riotplan`, keep these patterns in mind:

1.  **Plans are Directories**: A plan is a directory with a specific structure.
2.  **Steps are Numbered Files**: `01-analysis.md`, `02-design.md`, etc.
3.  **State is in STATUS.md**: Current progress, blockers, and issues.

```typescript
import { loadPlan, resumePlan } from 'riotplan';

// Load an existing plan
const plan = await loadPlan('./prompts/my-feature');

console.log(plan.metadata.code);     // 'my-feature'
console.log(plan.state.status);      // 'in_progress'
console.log(plan.state.currentStep); // 3

// Resume execution from current state
const result = await resumePlan(plan);
```

## Plan Structure Convention

```
my-plan/
├── my-plan-prompt.md     # Meta-prompt (prompt-of-prompts)
├── SUMMARY.md            # Overview of the approach
├── EXECUTION_PLAN.md     # Step-by-step strategy
├── STATUS.md             # Current state (auto-updated)
├── plan/                 # Step files
│   ├── 01-analysis.md
│   ├── 02-design.md
│   ├── 03-implementation.md
│   └── ...
└── analysis/             # Analysis output (optional)
```

## Documentation Structure

This guide directory contains specialized documentation for different aspects of the system:

*   [Creating Plans](./create.md): How to create a plan using CLI or direct LLM creation.
*   [AI Generation](./ai-generation.md): Using AI to generate detailed, actionable plans.
*   [Executing Plans](./execute.md): How to execute a plan using CLI or direct LLM execution.
*   [Usage Patterns](./usage.md): Common patterns for creating and managing plans.
*   [MCP Server](./mcp.md): Model Context Protocol integration for AI assistants.
*   [Cloud Run Deployment](./cloud-run.md): Deploy `riotplan-mcp-http` to Google Cloud Run.
*   [Architecture](./architecture.md): Internal design, module structure, and data flow.
*   [Configuration](./configuration.md): Configuration options and file conventions.
*   [Development](./development.md): Guide for contributing to `riotplan`.
