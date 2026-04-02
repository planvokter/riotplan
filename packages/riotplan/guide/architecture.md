# Architecture

**Purpose**: High-level overview of the internal design of `riotplan`.

## Core Concepts

### Plan Structure
A `Plan` in RiotPlan is not a single file; it is a directory containing multiple files that together define a long-lived workflow:

1.  **Meta-Prompt**: The initial prompt that creates the plan (`{code}-prompt.md`).
2.  **Summary**: High-level overview of the approach (`SUMMARY.md`).
3.  **Execution Plan**: Step-by-step strategy (`EXECUTION_PLAN.md`).
4.  **Status**: Current state and progress (`STATUS.md`).
5.  **Steps**: Numbered prompt files (`01-*.md`, `02-*.md`, etc.).
6.  **Analysis**: Optional directory for analysis output.

### Step System
The fundamental unit of work is the `PlanStep`.
*   A Step corresponds to a numbered markdown file (e.g., `01-analysis.md`).
*   Steps have a status: `pending`, `in_progress`, `completed`, `failed`, `blocked`, `skipped`.
*   Steps can have dependencies on other steps (by number).

### State Management
Plan state is persisted in `STATUS.md`:
*   Current status and step
*   Progress tracking per step
*   Blockers and issues
*   Timestamps for auditing

## Module Structure

The project is organized into distinct logical modules:

*   **`src/index.ts`**: Main entry point. Exports all sub-modules.
*   **`src/types.ts`**: Type definitions for Plan, PlanStep, PlanState, etc.
*   **`src/loader.ts`**: Logic for discovering and loading plans from directories.
*   **`src/parser.ts`**: Parsers for STATUS.md and EXECUTION_PLAN.md.
*   **`src/generator.ts`**: Generates STATUS.md from plan state.
*   **`src/executor.ts`**: Manages step execution and state updates.

## Data Flow

1.  **Discovery**: Scan directory for plan files using conventions.
2.  **Load**: Parse plan files into structured objects.
3.  **Execute**: Run steps in order, respecting dependencies.
4.  **Update**: Persist state changes to STATUS.md.
5.  **Resume**: On next session, load state and continue from last step.

## File Conventions

| File/Pattern | Purpose |
|--------------|---------|
| `{code}-prompt.md` | Meta-prompt that initiates the plan |
| `prompt-of-prompts.md` | Alternative meta-prompt name |
| `SUMMARY.md` | Overview of the approach |
| `STATUS.md` | Current execution state |
| `EXECUTION_PLAN.md` | Strategy document |
| `/^\d{2}-(.+)\.md$/` | Step files (01-foo.md, 02-bar.md) |
| `plan/` | Optional subdirectory for steps |
| `analysis/` | Optional output directory |

## Design Decisions

*   **Directory as Plan**: The filesystem structure IS the plan definition, making it easy to version control and review.
*   **Human-Readable State**: STATUS.md uses markdown tables and emoji for easy visual inspection.
*   **Numbered Steps**: Sequential numbering ensures deterministic execution order.
*   **Optional Phases**: Steps can be grouped into phases for larger plans.
*   **Convention Over Configuration**: Minimal configuration needed; structure is inferred from file names.
