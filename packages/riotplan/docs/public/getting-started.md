# Getting Started

Welcome to **RiotPlan** - a framework for managing long-lived, stateful AI workflows.

## What is RiotPlan?

RiotPlan helps you manage complex, multi-step AI-assisted tasks that:

- **Span multiple sessions** - Work on a task over days or weeks
- **Have persistent state** - Track progress in STATUS.md
- **Are organized into steps** - Numbered files (01-STEP.md, 02-STEP.md)
- **Can be interrupted and resumed** - Pick up where you left off
- **Support collaboration** - Human reviews, feedback loops

## Installation

### Basic Installation

```bash
npm install -g @planvokter/riotplan
```

Or as a development dependency:

```bash
npm install --save-dev @planvokter/riotplan
```

### AI-Powered Generation (Optional)

RiotPlan can use AI to generate detailed, actionable plans from your descriptions. Install an execution provider:

```bash
# For Anthropic Claude (recommended)
npm install @kjerneverk/execution-anthropic

# For OpenAI GPT
npm install @kjerneverk/execution-openai

# For Google Gemini
npm install @kjerneverk/execution-gemini
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
```

Without an AI provider, RiotPlan falls back to template-based generation.

## Quick Start

### Create Your First Plan

```bash
riotplan create my-feature
```

This will:
1. Prompt for your plan description (opens editor)
2. Ask if you want analysis first or direct generation
3. Use AI to generate detailed plan content
4. Create all plan files with actionable steps

### Check Plan Status

```bash
riotplan status
```

Example output:

```
Plan: my-feature
Status: 🔄 in_progress
Progress: 45% (5/11 steps)
Current Step: 06-testing
Last Updated: 2026-01-10

Blockers: None
Issues: 1 (low priority)
```

### List Steps

```bash
riotplan step list
```

Example output:

```
✅ 01 analysis
✅ 02 design
✅ 03 architecture
✅ 04 implementation-core
🔄 05 implementation-api
⬜ 06 testing
⬜ 07 documentation
⬜ 08 release
```

### Execute Steps

```bash
# Start a step
riotplan step start 05

# Complete a step
riotplan step complete 05
```

## Plan Structure

A plan is a directory with this structure:

```
my-plan/
├── my-plan-prompt.md     # Meta-prompt (prompt-of-prompts)
├── SUMMARY.md            # Overview of the approach
├── EXECUTION_PLAN.md     # Step-by-step strategy
├── STATUS.md             # Current state (auto-updated)
├── plan/                 # Step files
│   ├── 01-first-step.md
│   ├── 02-second-step.md
│   └── ...
└── analysis/             # Analysis output (optional)
```

## Key Concepts

### Plans
A plan is a structured directory containing a prompt, summary, execution plan, status tracker, and numbered step files.

### Steps
Individual units of work, represented as numbered markdown files (01-analysis.md, 02-design.md, etc.).

### STATUS.md
Tracks current progress, completed steps, blockers, and issues. Updated automatically as you work.

### Execution Plan
Defines the sequence of steps, dependencies, and quality gates.

## Next Steps

- Learn about [Core Concepts](core-concepts) - Understanding Plans, Steps, and STATUS.md
- Explore [Plan Structure](plan-structure) - Anatomy of a plan directory
- Read [Creating Plans](creating-plans) - How to create and initialize plans
- Understand [Managing Steps](managing-steps) - Working with plan steps

## MCP Integration

RiotPlan is available as an MCP (Model Context Protocol) server for AI assistants like Cursor.

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "riotplan": {
      "command": "npx",
      "args": ["-y", "@planvokter/riotplan", "riotplan-mcp"]
    }
  }
}
```

This allows AI assistants to:
- Create and manage plans
- Track progress
- Execute steps
- Update status

## Philosophy

Plans bridge the gap between:
- **Prompts** (single interactions)
- **Agentic conversations** (multi-turn sessions)
- **Long-running workflows** (days/weeks of work)

A plan provides structure for complex, iterative AI-assisted work where:
- The work can't be done in one session
- Progress needs to be tracked
- Humans need to review and provide feedback
- The approach may evolve based on findings
