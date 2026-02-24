# MCP Overview

RiotPlan provides a comprehensive Model Context Protocol (MCP) server that allows AI assistants to manage long-lived, stateful workflows directly.

## What is MCP?

The Model Context Protocol (MCP) is a standard for connecting AI assistants to external tools and data sources. RiotPlan's MCP server exposes its full functionality through:

- **Tools** - Callable functions for plan management
- **Resources** - Read-only access to plan data
- **Prompts** - Workflow templates for common tasks

## Installation

### Global Installation

```bash
npm install -g @kjerneverk/riotplan
```

### Cursor Configuration

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "riotplan": {
      "command": "npx",
      "args": ["-y", "@kjerneverk/riotplan", "riotplan-mcp"]
    }
  }
}
```

Or if installed globally:

```json
{
  "mcpServers": {
    "riotplan": {
      "command": "riotplan-mcp"
    }
  }
}
```

### Restart Cursor

After adding the configuration, restart Cursor to activate the MCP server.

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

```typescript
// 1. Create plan
riotplan_plan({
  code: "feature-x",
  description: "Implement feature X with tests and docs",
  steps: 8
})

// 2. Check status
riotplan_status({ path: "./feature-x" })

// 3. Start first step
riotplan_step({ planId: "./feature-x", action: "start", step: 1 })

// 4. Read step content
fetch("riotplan://step/feature-x?number=1")

// 5. Complete step
riotplan_step({ planId: "./feature-x", action: "complete", step: 1 })

// 6. Repeat for remaining steps
```

### Exploring an Idea

```typescript
// 1. Create idea
riotplan_idea({
  code: "new-feature",
  description: "Explore adding a new feature"
})

// 2. Add notes
riotplan_idea({
  note: "Users have been requesting this feature"
})

// 3. Add constraints
riotplan_idea({
  constraint: "Must work with existing auth system"
})

// 4. Add questions
riotplan_idea({
  question: "How does this affect performance?"
})

// 5. When ready, start shaping
riotplan_shaping({ action: "start" })
```

## Benefits

### For AI Assistants

- **Structured Workflows** - Break complex tasks into manageable steps
- **State Persistence** - Resume work across multiple sessions
- **Progress Tracking** - Always know where you are
- **Context Maintenance** - Keep track of decisions and blockers
- **Adaptive Planning** - Add/modify steps as requirements emerge

### For Users

- **Transparent Progress** - See exactly what's been done
- **Reviewable Plans** - Inspect and adjust AI-generated plans
- **Collaborative Work** - Human and AI work together
- **Version Control Friendly** - All files are markdown
- **Exploration Support** - Try ideas before committing

## Documentation

- [MCP Tools](mcp-tools) - All available tools
- [MCP Resources](mcp-resources) - Read-only data access
- [MCP Prompts](mcp-prompts) - Workflow templates

## Troubleshooting

### Server Not Starting

Check installation:

```bash
which riotplan-mcp
# or
npx @kjerneverk/riotplan riotplan-mcp --help
```

### Tools Not Available

Verify MCP configuration in Cursor settings and restart the IDE.

### AI Provider Errors

Ensure API keys are set and execution packages are installed:

```bash
echo $ANTHROPIC_API_KEY
npm list -g @kjerneverk/execution-anthropic
```

## Next Steps

- Explore [MCP Tools](mcp-tools) - Learn about all available tools
- Read [MCP Resources](mcp-resources) - Understand data access
- Try [MCP Prompts](mcp-prompts) - Use workflow templates
