# MCP Overview

RiotPlan provides a comprehensive Model Context Protocol (MCP) server that allows AI assistants to manage long-lived, stateful workflows directly. **This is the primary way to use RiotPlan** — there is no CLI.

## What is MCP?

The Model Context Protocol (MCP) is a standard for connecting AI assistants to external tools and data sources. RiotPlan's MCP server exposes its full functionality through:

- **Tools** — Callable functions for plan management
- **Resources** — Read-only access to plan data
- **Prompts** — Workflow templates for common tasks

## Installation

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

`riotplan-mcp-http` also accepts `X-API-Key: <raw_key_secret>`.

### Restart Your Assistant

After adding the configuration, restart your AI assistant to activate the MCP server.

## Capabilities

### Plan Execution

Manage traditional RiotPlan workflows:

- Create plans with AI generation
- Track status and progress
- Manage steps (start, complete, add)
- Validate plan structure

### Ideation Workflow

Explore ideas before committing to a plan:

- Create ideas without commitment
- Add notes, constraints, and questions
- Attach evidence and context
- Kill ideas that don't work out

### Shaping Workflow

Evaluate different approaches:

- Propose multiple approaches
- Document tradeoffs and assumptions
- Add feedback and evidence
- Compare and select the best approach

### Checkpoints

Save and restore plan state:

- Create checkpoints with context
- List all checkpoints
- View checkpoint details
- Restore to previous state

### History

Track the evolution of your thinking:

- View complete timeline
- See all decisions and changes
- Filter by checkpoint
- Preserve full context

## AI Provider Configuration

For AI-powered plan generation, set your API key:

```bash
# Anthropic (recommended)
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI
export OPENAI_API_KEY="sk-..."

# Google Gemini
export GOOGLE_API_KEY="..."
```

Install the corresponding execution package:

```bash
npm install -g @kjerneverk/execution-anthropic
# or
npm install -g @kjerneverk/execution-openai
# or
npm install -g @kjerneverk/execution-gemini
```

## Quick Start

### Creating and Executing a Plan

Once the MCP server is connected, ask your AI assistant:

> "Create a plan called `feature-x` for implementing feature X with tests and docs, with 8 steps."

This calls the `riotplan_plan` MCP tool. Then:

> "Show me the status of the feature-x plan."

This calls `riotplan_status`. Then:

> "Start step 1 of the feature-x plan."

> "I've finished the work. Mark step 1 complete."

> "Show me the content of step 2."

Continue until all steps are done.

### Exploring an Idea

> "Create an idea called `new-feature` to explore adding a new feature."

> "Add a note: Users have been requesting this feature."

> "Add a constraint: Must work with existing auth system."

> "Add a question: How does this affect performance?"

> "Start shaping the new-feature idea."

## Benefits

### For AI Assistants

- **Structured Workflows** — Break complex tasks into manageable steps
- **State Persistence** — Resume work across multiple sessions
- **Progress Tracking** — Always know where you are
- **Context Maintenance** — Keep track of decisions and blockers
- **Adaptive Planning** — Add/modify steps as requirements emerge

### For Users

- **Transparent Progress** — See exactly what's been done
- **Reviewable Plans** — Inspect and adjust AI-generated plans
- **Collaborative Work** — Human and AI work together
- **Version Control Friendly** — All files are markdown
- **Exploration Support** — Try ideas before committing

## Documentation

- [MCP Tools](mcp-tools) — All available tools
- [MCP Resources](mcp-resources) — Read-only data access
- [MCP Prompts](mcp-prompts) — Workflow templates

## Troubleshooting

### Server Not Starting

Check that the MCP server can be reached:

```bash
npx @planvokter/riotplan riotplan-mcp --help
```

### Tools Not Available

Verify MCP configuration in your AI assistant's settings and restart.

### AI Provider Errors

Ensure API keys are set and execution packages are installed:

```bash
echo $ANTHROPIC_API_KEY
npm list -g @kjerneverk/execution-anthropic
```

## Next Steps

- Explore [MCP Tools](mcp-tools) — Learn about all available tools
- Read [MCP Resources](mcp-resources) — Understand data access
- Try [MCP Prompts](mcp-prompts) — Use workflow templates
- Learn about [Core Concepts](core-concepts) — Understanding Plans, Steps, and STATUS.md
