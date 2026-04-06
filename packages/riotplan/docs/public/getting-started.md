# Getting Started

Welcome to **RiotPlan** — a tool for developing and executing plans through AI assistants via MCP (Model Context Protocol).

## What is RiotPlan?

RiotPlan helps you manage complex, multi-step AI-assisted tasks that:

- **Span multiple sessions** — Work on a task over days or weeks
- **Have persistent state** — Track progress in STATUS.md
- **Are organized into steps** — Numbered files (01-STEP.md, 02-STEP.md)
- **Can be interrupted and resumed** — Pick up where you left off
- **Support collaboration** — Human reviews, feedback loops

RiotPlan is used **exclusively via MCP** — there is no CLI. You interact with it through AI assistants like Cursor, Claude Desktop, or any other MCP-compatible client.

## MCP Integration

RiotPlan works as an MCP server that your AI assistant connects to. Add it to your MCP configuration:

### Cursor

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

### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

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

### HTTP MCP Server

If you're using `@planvokter/riotplan-mcp-http` for a remote deployment:

```json
{
  "mcpServers": {
    "riotplan-http": {
      "url": "https://your-host.example.com/mcp",
      "headers": {
        "Authorization": "Bearer <raw_key_secret>"
      }
    }
  }
}
```

After adding the configuration, restart your AI assistant to activate the MCP server.

## Quick Start

Once the MCP server is connected, you can use RiotPlan entirely through your AI assistant. Here's a typical workflow:

### 1. Create a Plan

Ask your assistant to create a plan:

> "Create a plan called `user-auth` for implementing JWT-based authentication with 6 steps."

This calls the `riotplan_plan` MCP tool, which generates a structured plan directory with all the necessary files.

### 2. Check Status

> "Show me the status of the user-auth plan."

This calls `riotplan_status` and returns current progress, completed steps, and any blockers.

### 3. Start a Step

> "Start step 1 of the user-auth plan."

This calls `riotplan_step` with `action: "start"`, updating STATUS.md and marking the step as in-progress.

### 4. Complete a Step

> "I've finished the work for step 1. Mark it complete."

This calls `riotplan_step` with `action: "complete"`, recording the completion and advancing to the next step.

### 5. Repeat

Continue working through steps, checking status as needed. Your assistant handles all the bookkeeping.

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

## AI Provider Configuration

For AI-powered plan generation, set your API key in your environment:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
# or
export OPENAI_API_KEY="sk-..."
# or
export GOOGLE_API_KEY="..."
```

The MCP server uses these keys to generate detailed, actionable plan content. Without an AI provider, RiotPlan falls back to template-based generation.

## Next Steps

- Read the [MCP Overview](mcp-overview) for full MCP setup details and capabilities
- Explore [MCP Tools](mcp-tools) for all available tools
- Learn about [Core Concepts](core-concepts) — Understanding Plans, Steps, and STATUS.md
- Explore [Plan Structure](plan-structure) — Anatomy of a plan directory
- Read [Creating Plans](creating-plans) — How to create plans via MCP
- Understand [Managing Steps](managing-steps) — Working with plan steps via MCP

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
